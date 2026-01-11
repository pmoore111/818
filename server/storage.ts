import {
  type Account,
  type InsertAccount,
  type Transaction,
  type InsertTransaction,
  type Obligation,
  type InsertObligation,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  accounts,
  transactions,
  obligations,
  conversations,
  messages,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Accounts
  getAccounts(userId: string): Promise<Account[]>;
  getAccount(userId: string, id: number): Promise<Account | undefined>;
  createAccount(userId: string, account: InsertAccount): Promise<Account>;
  updateAccount(userId: string, id: number, data: Partial<InsertAccount>): Promise<Account | undefined>;
  deleteAccount(userId: string, id: number): Promise<void>;

  // Transactions
  getTransactions(userId: string): Promise<Transaction[]>;
  getTransaction(userId: string, id: number): Promise<Transaction | undefined>;
  getTransactionsByAccount(userId: string, accountId: number): Promise<Transaction[]>;
  createTransaction(userId: string, transaction: InsertTransaction): Promise<Transaction>;
  deleteTransaction(userId: string, id: number): Promise<void>;
  deleteTransactionsByDateRange(userId: string, accountId: number, startDate: string, endDate: string): Promise<number>;

  // Obligations
  getObligations(userId: string): Promise<Obligation[]>;
  getObligation(userId: string, id: number): Promise<Obligation | undefined>;
  createObligation(userId: string, obligation: InsertObligation): Promise<Obligation>;
  updateObligation(userId: string, id: number, data: Partial<InsertObligation>): Promise<Obligation | undefined>;
  deleteObligation(userId: string, id: number): Promise<void>;

  // Conversations
  getConversations(userId: string): Promise<Conversation[]>;
  getConversation(userId: string, id: number): Promise<Conversation | undefined>;
  createConversation(userId: string, title: string): Promise<Conversation>;
  deleteConversation(userId: string, id: number): Promise<void>;

  // Messages
  getMessagesByConversation(userId: string, conversationId: number): Promise<Message[]>;
  createMessage(userId: string, conversationId: number, role: string, content: string): Promise<Message>;
}

export class DatabaseStorage implements IStorage {
  // Accounts
  async getAccounts(userId: string): Promise<Account[]> {
    return db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(desc(accounts.createdAt));
  }

  async getAccount(userId: string, id: number): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(
      and(eq(accounts.id, id), eq(accounts.userId, userId))
    );
    return account || undefined;
  }

  async createAccount(userId: string, account: InsertAccount): Promise<Account> {
    const [created] = await db.insert(accounts).values({ ...account, userId }).returning();
    return created;
  }

  async updateAccount(userId: string, id: number, data: Partial<InsertAccount>): Promise<Account | undefined> {
    const [updated] = await db.update(accounts).set(data).where(
      and(eq(accounts.id, id), eq(accounts.userId, userId))
    ).returning();
    return updated || undefined;
  }

  async deleteAccount(userId: string, id: number): Promise<void> {
    await db.delete(accounts).where(
      and(eq(accounts.id, id), eq(accounts.userId, userId))
    );
  }

  // Transactions
  async getTransactions(userId: string): Promise<Transaction[]> {
    return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.date));
  }

  async getTransaction(userId: string, id: number): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(
      and(eq(transactions.id, id), eq(transactions.userId, userId))
    );
    return transaction || undefined;
  }

  async getTransactionsByAccount(userId: string, accountId: number): Promise<Transaction[]> {
    return db.select().from(transactions).where(
      and(eq(transactions.accountId, accountId), eq(transactions.userId, userId))
    ).orderBy(desc(transactions.date));
  }

  async createTransaction(userId: string, transaction: InsertTransaction): Promise<Transaction> {
    const [created] = await db.insert(transactions).values({ ...transaction, userId }).returning();
    
    // Update account balance
    const account = await this.getAccount(userId, transaction.accountId);
    if (account) {
      const currentBalance = parseFloat(account.balance);
      const transactionAmount = parseFloat(transaction.amount);
      const newBalance = (currentBalance + transactionAmount).toFixed(2);
      await this.updateAccount(userId, transaction.accountId, { balance: newBalance });
    }
    
    return created;
  }

  async deleteTransaction(userId: string, id: number): Promise<void> {
    await db.delete(transactions).where(
      and(eq(transactions.id, id), eq(transactions.userId, userId))
    );
  }

  async deleteTransactionsByDateRange(userId: string, accountId: number, startDate: string, endDate: string): Promise<number> {
    const deleted = await db.delete(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          eq(transactions.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      )
      .returning();
    return deleted.length;
  }

  // Obligations
  async getObligations(userId: string): Promise<Obligation[]> {
    return db.select().from(obligations).where(eq(obligations.userId, userId)).orderBy(obligations.dueDate);
  }

  async getObligation(userId: string, id: number): Promise<Obligation | undefined> {
    const [obligation] = await db.select().from(obligations).where(
      and(eq(obligations.id, id), eq(obligations.userId, userId))
    );
    return obligation || undefined;
  }

  async createObligation(userId: string, obligation: InsertObligation): Promise<Obligation> {
    const [created] = await db.insert(obligations).values({ ...obligation, userId }).returning();
    return created;
  }

  async updateObligation(userId: string, id: number, data: Partial<InsertObligation>): Promise<Obligation | undefined> {
    const [updated] = await db.update(obligations).set(data).where(
      and(eq(obligations.id, id), eq(obligations.userId, userId))
    ).returning();
    return updated || undefined;
  }

  async deleteObligation(userId: string, id: number): Promise<void> {
    await db.delete(obligations).where(
      and(eq(obligations.id, id), eq(obligations.userId, userId))
    );
  }

  // Conversations
  async getConversations(userId: string): Promise<Conversation[]> {
    return db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.createdAt));
  }

  async getConversation(userId: string, id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(
      and(eq(conversations.id, id), eq(conversations.userId, userId))
    );
    return conversation || undefined;
  }

  async createConversation(userId: string, title: string): Promise<Conversation> {
    const [created] = await db.insert(conversations).values({ title, userId }).returning();
    return created;
  }

  async deleteConversation(userId: string, id: number): Promise<void> {
    // First verify the conversation belongs to this user
    const conversation = await this.getConversation(userId, id);
    if (conversation) {
      await db.delete(messages).where(eq(messages.conversationId, id));
      await db.delete(conversations).where(
        and(eq(conversations.id, id), eq(conversations.userId, userId))
      );
    }
  }

  // Messages
  async getMessagesByConversation(userId: string, conversationId: number): Promise<Message[]> {
    // First verify the conversation belongs to this user
    const conversation = await this.getConversation(userId, conversationId);
    if (!conversation) return [];
    return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  }

  async createMessage(userId: string, conversationId: number, role: string, content: string): Promise<Message> {
    // First verify the conversation belongs to this user
    const conversation = await this.getConversation(userId, conversationId);
    if (!conversation) {
      throw new Error("Conversation not found or not authorized");
    }
    const [created] = await db.insert(messages).values({ conversationId, role, content }).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
