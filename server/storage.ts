import {
  type User,
  type InsertUser,
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
  users,
  accounts,
  transactions,
  obligations,
  conversations,
  messages,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Accounts
  getAccounts(): Promise<Account[]>;
  getAccount(id: number): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccount(id: number, data: Partial<InsertAccount>): Promise<Account | undefined>;
  deleteAccount(id: number): Promise<void>;

  // Transactions
  getTransactions(): Promise<Transaction[]>;
  getTransaction(id: number): Promise<Transaction | undefined>;
  getTransactionsByAccount(accountId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  deleteTransaction(id: number): Promise<void>;
  deleteTransactionsByDateRange(accountId: number, startDate: string, endDate: string): Promise<number>;

  // Obligations
  getObligations(): Promise<Obligation[]>;
  getObligation(id: number): Promise<Obligation | undefined>;
  createObligation(obligation: InsertObligation): Promise<Obligation>;
  updateObligation(id: number, data: Partial<InsertObligation>): Promise<Obligation | undefined>;
  deleteObligation(id: number): Promise<void>;

  // Conversations
  getConversations(): Promise<Conversation[]>;
  getConversation(id: number): Promise<Conversation | undefined>;
  createConversation(title: string): Promise<Conversation>;
  deleteConversation(id: number): Promise<void>;

  // Messages
  getMessagesByConversation(conversationId: number): Promise<Message[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<Message>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Accounts
  async getAccounts(): Promise<Account[]> {
    return db.select().from(accounts).orderBy(desc(accounts.createdAt));
  }

  async getAccount(id: number): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account || undefined;
  }

  async createAccount(account: InsertAccount): Promise<Account> {
    const [created] = await db.insert(accounts).values(account).returning();
    return created;
  }

  async updateAccount(id: number, data: Partial<InsertAccount>): Promise<Account | undefined> {
    const [updated] = await db.update(accounts).set(data).where(eq(accounts.id, id)).returning();
    return updated || undefined;
  }

  async deleteAccount(id: number): Promise<void> {
    await db.delete(accounts).where(eq(accounts.id, id));
  }

  // Transactions
  async getTransactions(): Promise<Transaction[]> {
    return db.select().from(transactions).orderBy(desc(transactions.date));
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction || undefined;
  }

  async getTransactionsByAccount(accountId: number): Promise<Transaction[]> {
    return db.select().from(transactions).where(eq(transactions.accountId, accountId)).orderBy(desc(transactions.date));
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [created] = await db.insert(transactions).values(transaction).returning();
    
    // Update account balance
    const account = await this.getAccount(transaction.accountId);
    if (account) {
      const currentBalance = parseFloat(account.balance);
      const transactionAmount = parseFloat(transaction.amount);
      const newBalance = (currentBalance + transactionAmount).toFixed(2);
      await this.updateAccount(transaction.accountId, { balance: newBalance });
    }
    
    return created;
  }

  async deleteTransaction(id: number): Promise<void> {
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  async deleteTransactionsByDateRange(accountId: number, startDate: string, endDate: string): Promise<number> {
    const deleted = await db.delete(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      )
      .returning();
    return deleted.length;
  }

  // Obligations
  async getObligations(): Promise<Obligation[]> {
    return db.select().from(obligations).orderBy(obligations.dueDate);
  }

  async getObligation(id: number): Promise<Obligation | undefined> {
    const [obligation] = await db.select().from(obligations).where(eq(obligations.id, id));
    return obligation || undefined;
  }

  async createObligation(obligation: InsertObligation): Promise<Obligation> {
    const [created] = await db.insert(obligations).values(obligation).returning();
    return created;
  }

  async updateObligation(id: number, data: Partial<InsertObligation>): Promise<Obligation | undefined> {
    const [updated] = await db.update(obligations).set(data).where(eq(obligations.id, id)).returning();
    return updated || undefined;
  }

  async deleteObligation(id: number): Promise<void> {
    await db.delete(obligations).where(eq(obligations.id, id));
  }

  // Conversations
  async getConversations(): Promise<Conversation[]> {
    return db.select().from(conversations).orderBy(desc(conversations.createdAt));
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async createConversation(title: string): Promise<Conversation> {
    const [created] = await db.insert(conversations).values({ title }).returning();
    return created;
  }

  async deleteConversation(id: number): Promise<void> {
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  }

  // Messages
  async getMessagesByConversation(conversationId: number): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  }

  async createMessage(conversationId: number, role: string, content: string): Promise<Message> {
    const [created] = await db.insert(messages).values({ conversationId, role, content }).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
