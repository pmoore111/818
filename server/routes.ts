import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, InsertAccount, InsertTransaction, InsertObligation } from "./storage";
import OpenAI from "openai";
import multer from "multer";
import { requireAuth, getUserId, type AuthRequest } from "./auth";
import { supabase } from "./supabase";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

async function parsePDF(buffer: Buffer): Promise<{ text: string }> {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = pdfParseModule.default || pdfParseModule;
  return pdfParse(buffer);
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const upload = multer({ storage: multer.memoryStorage() });

interface ParsedPDFTransaction {
  date: string;
  description: string;
  amount: number;
  authCode?: string;
}

function parseLiliStatementPDF(text: string): ParsedPDFTransaction[] {
  const transactions: ParsedPDFTransaction[] = [];
  const lines = text.split('\n');
  
  // Match transaction lines: MM/DD/YYYY followed by auth code and description
  const txPattern = /^(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(.+?)\s+\$?([-]?\d+\.?\d*)\s+\$?[-]?\d+\.?\d*$/;
  
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(txPattern);
    
    if (match) {
      const [, dateStr, authCode, description, amountStr] = match;
      
      // Parse date from MM/DD/YYYY to YYYY-MM-DD
      const [month, day, year] = dateStr.split('/');
      const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      
      // Parse amount
      const amount = parseFloat(amountStr.replace(/[$,]/g, ''));
      
      transactions.push({
        date: formattedDate,
        description: description.trim(),
        amount,
        authCode,
      });
    }
  }
  
  return transactions;
}

function parseGenericStatementPDF(text: string): ParsedPDFTransaction[] {
  const transactions: ParsedPDFTransaction[] = [];
  const lines = text.split('\n');
  
  // Try to find lines that look like transactions
  // Pattern: Date (various formats), description, amount
  const datePatterns = [
    /^(\d{2}\/\d{2}\/\d{4})/,  // MM/DD/YYYY
    /^(\d{4}-\d{2}-\d{2})/,    // YYYY-MM-DD
    /^(\d{2}-\d{2}-\d{4})/,    // MM-DD-YYYY
  ];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    for (const pattern of datePatterns) {
      const dateMatch = trimmed.match(pattern);
      if (dateMatch) {
        // Try to extract amount (look for dollar amounts)
        const amountMatch = trimmed.match(/\$?([-]?\d{1,3}(?:,\d{3})*\.?\d{0,2})(?:\s|$)/g);
        
        if (amountMatch && amountMatch.length > 0) {
          const dateStr = dateMatch[1];
          let formattedDate = dateStr;
          
          // Convert to YYYY-MM-DD format
          if (dateStr.includes('/')) {
            const [month, day, year] = dateStr.split('/');
            formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          } else if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
            const [month, day, year] = dateStr.split('-');
            formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
          
          // Get the first amount found
          const amountStr = amountMatch[0].replace(/[$,\s]/g, '');
          const amount = parseFloat(amountStr);
          
          // Extract description (everything between date and amount)
          const dateEndIdx = trimmed.indexOf(dateMatch[1]) + dateMatch[1].length;
          const amountStartIdx = trimmed.lastIndexOf(amountMatch[amountMatch.length - 1]);
          let description = trimmed.substring(dateEndIdx, amountStartIdx).trim();
          
          // Clean up description (remove auth codes if present)
          description = description.replace(/^\d+\s+/, '').trim();
          
          if (description && !isNaN(amount)) {
            transactions.push({
              date: formattedDate,
              description,
              amount,
            });
          }
        }
        break;
      }
    }
  }
  
  return transactions;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Auth routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password } = req.body;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.json({ user: data.user, session: data.session });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Failed to sign up" });
    }
  });

  app.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, password } = req.body;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.json({ user: data.user, session: data.session });
    } catch (error) {
      console.error("Signin error:", error);
      res.status(500).json({ error: "Failed to sign in" });
    }
  });

  app.post("/api/auth/signout", requireAuth, async (req: AuthRequest, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.substring(7);

      if (token) {
        await supabase.auth.signOut();
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Signout error:", error);
      res.status(500).json({ error: "Failed to sign out" });
    }
  });

  app.get("/api/auth/user", requireAuth, async (req: AuthRequest, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.substring(7);

      if (!token) {
        return res.status(401).json({ error: "No token provided" });
      }

      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({ error: "Invalid token" });
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      res.json({ user, profile });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Accounts API
  app.get("/api/accounts", requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);
      const accounts = await storage.getAccounts(userId);
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  app.get("/api/accounts/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const account = await storage.getAccount(userId, id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      res.json(account);
    } catch (error) {
      console.error("Error fetching account:", error);
      res.status(500).json({ error: "Failed to fetch account" });
    }
  });

  app.post("/api/accounts", requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);
      const account = await storage.createAccount(userId, req.body);
      res.status(201).json(account);
    } catch (error) {
      console.error("Error creating account:", error);
      res.status(400).json({ error: "Invalid account data" });
    }
  });

  app.patch("/api/accounts/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const account = await storage.updateAccount(userId, id, req.body);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      res.json(account);
    } catch (error) {
      console.error("Error updating account:", error);
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  app.delete("/api/accounts/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      await storage.deleteAccount(userId, id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting account:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // Transactions API
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const transactions = await storage.getTransactions(userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.get("/api/transactions/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const transaction = await storage.getTransaction(userId, id);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      console.error("Error fetching transaction:", error);
      res.status(500).json({ error: "Failed to fetch transaction" });
    }
  });

  app.post("/api/transactions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);
      const transaction = await storage.createTransaction(userId, req.body);
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(400).json({ error: "Invalid transaction data" });
    }
  });

  // Delete transactions by date range (for statement period deletion)
  // This route MUST come before /api/transactions/:id to avoid matching "by-date-range" as an ID
  app.delete("/api/transactions/by-date-range", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { accountId, startDate, endDate } = req.body;
      
      if (!accountId || !startDate || !endDate) {
        return res.status(400).json({ error: "accountId, startDate, and endDate are required" });
      }

      const deletedCount = await storage.deleteTransactionsByDateRange(
        userId,
        parseInt(accountId),
        startDate,
        endDate
      );

      res.json({ deleted: deletedCount });
    } catch (error) {
      console.error("Error deleting transactions:", error);
      res.status(500).json({ error: "Failed to delete transactions" });
    }
  });

  app.delete("/api/transactions/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      await storage.deleteTransaction(userId, id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });

  // Parse PDF statement
  app.post("/api/parse-pdf", requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const pdfData = await parsePDF(req.file.buffer);
      const text = pdfData.text;
      
      // Try Lili format first
      let transactions = parseLiliStatementPDF(text);
      
      // If no transactions found, try generic parser
      if (transactions.length === 0) {
        transactions = parseGenericStatementPDF(text);
      }

      res.json({
        success: true,
        transactions,
        rawText: text.substring(0, 2000), // Preview for debugging
      });
    } catch (error) {
      console.error("Error parsing PDF:", error);
      res.status(500).json({ error: "Failed to parse PDF" });
    }
  });

  // Bulk import transactions (for CSV import)
  app.post("/api/transactions/bulk", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { transactions } = req.body;
      
      if (!Array.isArray(transactions) || transactions.length === 0) {
        return res.status(400).json({ error: "No transactions provided" });
      }

      const imported: any[] = [];
      const errors: { index: number; error: string }[] = [];

      for (let i = 0; i < transactions.length; i++) {
        try {
          const transaction = await storage.createTransaction(userId, transactions[i]);
          imported.push(transaction);
        } catch (err) {
          errors.push({ index: i, error: err instanceof Error ? err.message : "Invalid data" });
        }
      }

      res.status(201).json({
        imported: imported.length,
        errors: errors.length,
        details: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("Error bulk importing transactions:", error);
      res.status(500).json({ error: "Failed to import transactions" });
    }
  });

  // Obligations API
  app.get("/api/obligations", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const obligations = await storage.getObligations(userId);
      res.json(obligations);
    } catch (error) {
      console.error("Error fetching obligations:", error);
      res.status(500).json({ error: "Failed to fetch obligations" });
    }
  });

  app.get("/api/obligations/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const obligation = await storage.getObligation(userId, id);
      if (!obligation) {
        return res.status(404).json({ error: "Obligation not found" });
      }
      res.json(obligation);
    } catch (error) {
      console.error("Error fetching obligation:", error);
      res.status(500).json({ error: "Failed to fetch obligation" });
    }
  });

  app.post("/api/obligations", requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);
      const obligation = await storage.createObligation(userId, req.body);
      res.status(201).json(obligation);
    } catch (error) {
      console.error("Error creating obligation:", error);
      res.status(400).json({ error: "Invalid obligation data" });
    }
  });

  app.patch("/api/obligations/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const obligation = await storage.updateObligation(userId, id, req.body);
      if (!obligation) {
        return res.status(404).json({ error: "Obligation not found" });
      }
      res.json(obligation);
    } catch (error) {
      console.error("Error updating obligation:", error);
      res.status(500).json({ error: "Failed to update obligation" });
    }
  });

  app.delete("/api/obligations/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      await storage.deleteObligation(userId, id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting obligation:", error);
      res.status(500).json({ error: "Failed to delete obligation" });
    }
  });

  // Conversations API
  app.get("/api/conversations", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const conversation = await storage.getConversation(userId, id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await storage.getMessagesByConversation(userId, id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { title } = req.body;
      const conversation = await storage.createConversation(userId, title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.delete("/api/conversations/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      await storage.deleteConversation(userId, id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Messages API with streaming
  app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const conversationId = parseInt(req.params.id);
      const { content } = req.body;

      // Save user message
      await storage.createMessage(userId, conversationId, "user", content);

      // Get conversation history for context
      const messages = await storage.getMessagesByConversation(userId, conversationId);
      
      // Build chat messages for OpenAI
      const systemMessage = {
        role: "system" as const,
        content: `You are a helpful personal finance assistant. You help users understand their spending habits, improve their credit scores, and manage both personal and business finances effectively. 
        
When analyzing financial data:
- Provide specific, actionable advice
- Point out patterns in spending
- Suggest ways to improve credit scores
- Help identify areas for saving money
- Distinguish between personal and business financial advice when relevant

Be concise but thorough. Use numbers and percentages when helpful.`,
      };

      const chatMessages = [
        systemMessage,
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Stream response from OpenAI
      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: chatMessages,
        stream: true,
        max_completion_tokens: 2048,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      // Save assistant message
      await storage.createMessage(userId, conversationId, "assistant", fullResponse);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });

  // Subscription routes
  app.post("/api/subscriptions/create-checkout", requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);
      const { priceId, tier } = req.body;

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ error: "Stripe not configured" });
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .maybeSingle();

      let customerId = profile?.stripe_customer_id;

      if (!customerId) {
        const { data: { user } } = await supabase.auth.getUser(req.headers.authorization!.substring(7));
        const customer = await stripe.customers.create({
          email: user?.email,
          metadata: { userId }
        });
        customerId = customer.id;

        await supabase
          .from('user_profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId);
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${req.headers.origin || process.env.APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin || process.env.APP_URL}/dashboard`,
        metadata: { userId, tier }
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Checkout error:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.post("/api/subscriptions/manage-portal", requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = getUserId(req);

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ error: "Stripe not configured" });
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .maybeSingle();

      if (!profile?.stripe_customer_id) {
        return res.status(400).json({ error: "No active subscription" });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${req.headers.origin || process.env.APP_URL}/dashboard`,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Portal error:", error);
      res.status(500).json({ error: "Failed to create portal session" });
    }
  });

  app.post("/api/webhooks/stripe", async (req, res) => {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).json({ error: "Stripe not configured" });
    }

    const sig = req.headers['stripe-signature'];
    if (!sig) {
      return res.status(400).json({ error: "No signature" });
    }

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as any;
          const userId = session.metadata.userId;
          const tier = session.metadata.tier;

          await supabase
            .from('user_profiles')
            .update({
              subscription_status: 'active',
              subscription_tier: tier,
              stripe_subscription_id: session.subscription
            })
            .eq('id', userId);
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as any;
          const customer = subscription.customer;

          const { data: profile } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('stripe_customer_id', customer)
            .maybeSingle();

          if (profile) {
            await supabase
              .from('user_profiles')
              .update({
                subscription_status: subscription.status,
                subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString()
              })
              .eq('id', profile.id);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as any;
          const customer = subscription.customer;

          const { data: profile } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('stripe_customer_id', customer)
            .maybeSingle();

          if (profile) {
            await supabase
              .from('user_profiles')
              .update({
                subscription_status: 'canceled',
                subscription_tier: 'free',
                stripe_subscription_id: null
              })
              .eq('id', profile.id);
          }
          break;
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(400).json({ error: "Webhook processing failed" });
    }
  });

  return httpServer;
}
