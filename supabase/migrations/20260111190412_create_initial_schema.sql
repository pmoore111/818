/*
  # Initial Schema - Finance Management Application

  1. New Tables
    - `users` (handled by Supabase Auth automatically)
    - `user_profiles`
      - `id` (uuid, references auth.users)
      - `subscription_status` (text) - 'free', 'active', 'canceled', 'past_due'
      - `subscription_tier` (text) - 'free', 'pro', 'business'
      - `stripe_customer_id` (text)
      - `stripe_subscription_id` (text)
      - `subscription_end_date` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `accounts`
      - `id` (serial, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `type` (text) - 'personal' or 'business'
      - `category` (text) - 'checking', 'savings', 'credit_card', 'loan', 'investment'
      - `balance` (numeric)
      - `credit_limit` (numeric)
      - `credit_score` (integer)
      - `interest_rate` (numeric)
      - `due_day` (integer)
      - `statement_day` (integer)
      - `created_at` (timestamptz)
    
    - `transactions`
      - `id` (serial, primary key)
      - `user_id` (uuid, references auth.users)
      - `account_id` (integer, references accounts)
      - `description` (text)
      - `amount` (numeric)
      - `category` (text)
      - `subcategory` (text)
      - `date` (date)
      - `created_at` (timestamptz)
    
    - `obligations`
      - `id` (serial, primary key)
      - `user_id` (uuid, references auth.users)
      - `account_id` (integer, references accounts)
      - `name` (text)
      - `amount` (numeric)
      - `type` (text)
      - `category` (text)
      - `due_date` (date)
      - `is_recurring` (boolean)
      - `frequency` (text)
      - `is_paid` (boolean)
      - `website_url` (text)
      - `notes` (text)
      - `created_at` (timestamptz)
    
    - `conversations`
      - `id` (serial, primary key)
      - `user_id` (uuid, references auth.users)
      - `title` (text)
      - `created_at` (timestamptz)
    
    - `messages`
      - `id` (serial, primary key)
      - `conversation_id` (integer, references conversations)
      - `role` (text) - 'user' or 'assistant'
      - `content` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Users can only access data they own

  3. Important Notes
    - All user_id fields reference auth.users(id) which is managed by Supabase Auth
    - Cascade deletes ensure data cleanup when users are deleted
    - All tables have proper indexing on user_id for performance
    - Numeric fields use appropriate precision for financial data
*/

-- Create user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_status text NOT NULL DEFAULT 'free',
  subscription_tier text NOT NULL DEFAULT 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_end_date timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  category text NOT NULL,
  balance numeric(12, 2) NOT NULL DEFAULT 0,
  credit_limit numeric(12, 2),
  credit_score integer,
  interest_rate numeric(5, 2),
  due_day integer,
  statement_day integer,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  category text NOT NULL,
  subcategory text,
  date date NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create obligations table
CREATE TABLE IF NOT EXISTS obligations (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id integer REFERENCES accounts(id) ON DELETE SET NULL,
  name text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  type text NOT NULL,
  category text NOT NULL DEFAULT 'subscription',
  due_date date NOT NULL,
  is_recurring boolean DEFAULT false,
  frequency text,
  is_paid boolean DEFAULT false,
  website_url text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id serial PRIMARY KEY,
  conversation_id integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_obligations_user_id ON obligations(user_id);
CREATE INDEX IF NOT EXISTS idx_obligations_due_date ON obligations(due_date);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for accounts
CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for transactions
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for obligations
CREATE POLICY "Users can view own obligations"
  ON obligations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own obligations"
  ON obligations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own obligations"
  ON obligations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own obligations"
  ON obligations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for conversations
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for messages
CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in own conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages in own conversations"
  ON messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, subscription_status, subscription_tier)
  VALUES (NEW.id, 'free', 'free');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();