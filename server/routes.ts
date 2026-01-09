import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAccountSchema, insertTransactionSchema, insertObligationSchema } from "@shared/schema";
import OpenAI from "openai";
import multer from "multer";
import * as pdfParseModule from "pdf-parse";

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
  // Accounts API
  app.get("/api/accounts", async (req, res) => {
    try {
      const accounts = await storage.getAccounts();
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  app.get("/api/accounts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const account = await storage.getAccount(id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      res.json(account);
    } catch (error) {
      console.error("Error fetching account:", error);
      res.status(500).json({ error: "Failed to fetch account" });
    }
  });

  app.post("/api/accounts", async (req, res) => {
    try {
      const validatedData = insertAccountSchema.parse(req.body);
      const account = await storage.createAccount(validatedData);
      res.status(201).json(account);
    } catch (error) {
      console.error("Error creating account:", error);
      res.status(400).json({ error: "Invalid account data" });
    }
  });

  app.patch("/api/accounts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const account = await storage.updateAccount(id, req.body);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      res.json(account);
    } catch (error) {
      console.error("Error updating account:", error);
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  app.delete("/api/accounts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAccount(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting account:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // Transactions API
  app.get("/api/transactions", async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.get("/api/transactions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      console.error("Error fetching transaction:", error);
      res.status(500).json({ error: "Failed to fetch transaction" });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const validatedData = insertTransactionSchema.parse(req.body);
      const transaction = await storage.createTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(400).json({ error: "Invalid transaction data" });
    }
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTransaction(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });

  // Delete transactions by date range (for statement period deletion)
  app.delete("/api/transactions/by-date-range", async (req, res) => {
    try {
      const { accountId, startDate, endDate } = req.body;
      
      if (!accountId || !startDate || !endDate) {
        return res.status(400).json({ error: "accountId, startDate, and endDate are required" });
      }

      const deletedCount = await storage.deleteTransactionsByDateRange(
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

  // Parse PDF statement
  app.post("/api/parse-pdf", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const pdfParse = (pdfParseModule as any).default || pdfParseModule;
      const pdfData = await pdfParse(req.file.buffer);
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
  app.post("/api/transactions/bulk", async (req, res) => {
    try {
      const { transactions } = req.body;
      
      if (!Array.isArray(transactions) || transactions.length === 0) {
        return res.status(400).json({ error: "No transactions provided" });
      }

      const imported: any[] = [];
      const errors: { index: number; error: string }[] = [];

      for (let i = 0; i < transactions.length; i++) {
        try {
          const validatedData = insertTransactionSchema.parse(transactions[i]);
          const transaction = await storage.createTransaction(validatedData);
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
  app.get("/api/obligations", async (req, res) => {
    try {
      const obligations = await storage.getObligations();
      res.json(obligations);
    } catch (error) {
      console.error("Error fetching obligations:", error);
      res.status(500).json({ error: "Failed to fetch obligations" });
    }
  });

  app.get("/api/obligations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const obligation = await storage.getObligation(id);
      if (!obligation) {
        return res.status(404).json({ error: "Obligation not found" });
      }
      res.json(obligation);
    } catch (error) {
      console.error("Error fetching obligation:", error);
      res.status(500).json({ error: "Failed to fetch obligation" });
    }
  });

  app.post("/api/obligations", async (req, res) => {
    try {
      const validatedData = insertObligationSchema.parse(req.body);
      const obligation = await storage.createObligation(validatedData);
      res.status(201).json(obligation);
    } catch (error) {
      console.error("Error creating obligation:", error);
      res.status(400).json({ error: "Invalid obligation data" });
    }
  });

  app.patch("/api/obligations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const obligation = await storage.updateObligation(id, req.body);
      if (!obligation) {
        return res.status(404).json({ error: "Obligation not found" });
      }
      res.json(obligation);
    } catch (error) {
      console.error("Error updating obligation:", error);
      res.status(500).json({ error: "Failed to update obligation" });
    }
  });

  app.delete("/api/obligations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteObligation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting obligation:", error);
      res.status(500).json({ error: "Failed to delete obligation" });
    }
  });

  // Conversations API
  app.get("/api/conversations", async (req, res) => {
    try {
      const conversations = await storage.getConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await storage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const { title } = req.body;
      const conversation = await storage.createConversation(title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.delete("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Messages API with streaming
  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content } = req.body;

      // Save user message
      await storage.createMessage(conversationId, "user", content);

      // Get conversation history for context
      const messages = await storage.getMessagesByConversation(conversationId);
      
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
      await storage.createMessage(conversationId, "assistant", fullResponse);

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

  return httpServer;
}
