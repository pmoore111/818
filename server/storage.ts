import { supabase, getSupabaseClient } from "./supabase";

export interface Account {
  id: number;
  user_id: string;
  name: string;
  type: string;
  category: string;
  balance: string;
  credit_limit?: string | null;
  credit_score?: number | null;
  interest_rate?: string | null;
  due_day?: number | null;
  statement_day?: number | null;
  created_at: string;
}

export interface InsertAccount {
  name: string;
  type: string;
  category: string;
  balance: string;
  credit_limit?: string | null;
  credit_score?: number | null;
  interest_rate?: string | null;
  due_day?: number | null;
  statement_day?: number | null;
}

export interface Transaction {
  id: number;
  user_id: string;
  account_id: number;
  description: string;
  amount: string;
  category: string;
  subcategory?: string | null;
  date: string;
  created_at: string;
}

export interface InsertTransaction {
  account_id: number;
  description: string;
  amount: string;
  category: string;
  subcategory?: string | null;
  date: string;
}

export interface Obligation {
  id: number;
  user_id: string;
  account_id?: number | null;
  name: string;
  amount: string;
  type: string;
  category: string;
  due_date: string;
  is_recurring?: boolean;
  frequency?: string | null;
  is_paid?: boolean;
  website_url?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface InsertObligation {
  account_id?: number | null;
  name: string;
  amount: string;
  type: string;
  category: string;
  due_date: string;
  is_recurring?: boolean;
  frequency?: string | null;
  is_paid?: boolean;
  website_url?: string | null;
  notes?: string | null;
}

export interface Conversation {
  id: number;
  user_id: string;
  title: string;
  created_at: string;
}

export interface InsertConversation {
  title: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: string;
  content: string;
  created_at: string;
}

export interface InsertMessage {
  conversation_id: number;
  role: string;
  content: string;
}

export interface IStorage {
  getAccounts(userId: string): Promise<Account[]>;
  getAccount(userId: string, id: number): Promise<Account | undefined>;
  createAccount(userId: string, account: InsertAccount): Promise<Account>;
  updateAccount(userId: string, id: number, data: Partial<InsertAccount>): Promise<Account | undefined>;
  deleteAccount(userId: string, id: number): Promise<void>;

  getTransactions(userId: string): Promise<Transaction[]>;
  getTransaction(userId: string, id: number): Promise<Transaction | undefined>;
  getTransactionsByAccount(userId: string, accountId: number): Promise<Transaction[]>;
  createTransaction(userId: string, transaction: InsertTransaction): Promise<Transaction>;
  deleteTransaction(userId: string, id: number): Promise<void>;
  deleteTransactionsByDateRange(userId: string, accountId: number, startDate: string, endDate: string): Promise<number>;

  getObligations(userId: string): Promise<Obligation[]>;
  getObligation(userId: string, id: number): Promise<Obligation | undefined>;
  createObligation(userId: string, obligation: InsertObligation): Promise<Obligation>;
  updateObligation(userId: string, id: number, data: Partial<InsertObligation>): Promise<Obligation | undefined>;
  deleteObligation(userId: string, id: number): Promise<void>;

  getConversations(userId: string): Promise<Conversation[]>;
  getConversation(userId: string, id: number): Promise<Conversation | undefined>;
  createConversation(userId: string, title: string): Promise<Conversation>;
  deleteConversation(userId: string, id: number): Promise<void>;

  getMessagesByConversation(userId: string, conversationId: number): Promise<Message[]>;
  createMessage(userId: string, conversationId: number, role: string, content: string): Promise<Message>;
}

export class SupabaseStorage implements IStorage {
  async getAccounts(userId: string): Promise<Account[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getAccount(userId: string, id: number): Promise<Account | undefined> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data || undefined;
  }

  async createAccount(userId: string, account: InsertAccount): Promise<Account> {
    const { data, error } = await supabase
      .from('accounts')
      .insert({ ...account, user_id: userId })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateAccount(userId: string, id: number, data: Partial<InsertAccount>): Promise<Account | undefined> {
    const { data: updated, error } = await supabase
      .from('accounts')
      .update(data)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return updated || undefined;
  }

  async deleteAccount(userId: string, id: number): Promise<void> {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async getTransactions(userId: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getTransaction(userId: string, id: number): Promise<Transaction | undefined> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data || undefined;
  }

  async getTransactionsByAccount(userId: string, accountId: number): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async createTransaction(userId: string, transaction: InsertTransaction): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...transaction, user_id: userId })
      .select()
      .single();

    if (error) throw error;

    const account = await this.getAccount(userId, transaction.account_id);
    if (account) {
      const currentBalance = parseFloat(account.balance);
      const transactionAmount = parseFloat(transaction.amount);
      const newBalance = (currentBalance + transactionAmount).toFixed(2);
      await this.updateAccount(userId, transaction.account_id, { balance: newBalance });
    }

    return data;
  }

  async deleteTransaction(userId: string, id: number): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async deleteTransactionsByDateRange(userId: string, accountId: number, startDate: string, endDate: string): Promise<number> {
    const { data, error } = await supabase
      .from('transactions')
      .delete()
      .eq('account_id', accountId)
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .select();

    if (error) throw error;
    return data?.length || 0;
  }

  async getObligations(userId: string): Promise<Obligation[]> {
    const { data, error } = await supabase
      .from('obligations')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getObligation(userId: string, id: number): Promise<Obligation | undefined> {
    const { data, error } = await supabase
      .from('obligations')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data || undefined;
  }

  async createObligation(userId: string, obligation: InsertObligation): Promise<Obligation> {
    const { data, error } = await supabase
      .from('obligations')
      .insert({ ...obligation, user_id: userId })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateObligation(userId: string, id: number, data: Partial<InsertObligation>): Promise<Obligation | undefined> {
    const { data: updated, error } = await supabase
      .from('obligations')
      .update(data)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return updated || undefined;
  }

  async deleteObligation(userId: string, id: number): Promise<void> {
    const { error } = await supabase
      .from('obligations')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getConversation(userId: string, id: number): Promise<Conversation | undefined> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data || undefined;
  }

  async createConversation(userId: string, title: string): Promise<Conversation> {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ title, user_id: userId })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteConversation(userId: string, id: number): Promise<void> {
    const conversation = await this.getConversation(userId, id);
    if (conversation) {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
    }
  }

  async getMessagesByConversation(userId: string, conversationId: number): Promise<Message[]> {
    const conversation = await this.getConversation(userId, conversationId);
    if (!conversation) return [];

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async createMessage(userId: string, conversationId: number, role: string, content: string): Promise<Message> {
    const conversation = await this.getConversation(userId, conversationId);
    if (!conversation) {
      throw new Error("Conversation not found or not authorized");
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, role, content })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

export const storage = new SupabaseStorage();
