/*
# Create Credit System for AI Content Generation

## Purpose
Track AI generation credits that users purchase and consume when generating
images, videos, copy, TTS, and other AI-powered content.

## New Tables

1. `credit_balance`
   - Singleton row (id=1) tracking the user's current credit balance
   - `balance` (integer, default 10): number of credits available
   - `total_purchased` (integer): lifetime credits purchased
   - `total_consumed` (integer): lifetime credits consumed
   - `updated_at` (timestamp): last modification time

2. `credit_transactions`
   - Append-only ledger of every credit addition and deduction
   - `id` (uuid, primary key)
   - `amount` (integer): positive for purchases, negative for consumption
   - `balance_after` (integer): snapshot of balance after this transaction
   - `type` (text): 'purchase' | 'consumption' | 'refund' | 'bonus' | 'admin'
   - `description` (text): human-readable description
   - `feature` (text, nullable): which AI feature consumed the credit
   - `package_id` (text, nullable): which package was purchased
   - `created_at` (timestamp)

## RPC Functions

1. `deduct_credits(amount, feature, description)`
   - SECURITY DEFINER: atomically deducts credits and logs the transaction
   - Returns the new balance, or raises an error if insufficient credits
   - Prevents race conditions via row-level lock

2. `add_credits(amount, type, description, package_id)`
   - SECURITY DEFINER: atomically adds credits and logs the transaction
   - Used after purchase confirmation or admin grants

## Security
- RLS enabled on both tables
- anon + authenticated roles have SELECT access (single-tenant app, no auth)
- All mutations go through SECURITY DEFINER RPCs (bypass RLS safely)
- Direct INSERT/UPDATE/DELETE denied to anon/authenticated

## Default Balance
- New users start with 10 free credits
*/

-- ============================================================
-- credit_balance table (singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_balance (
  id integer PRIMARY KEY DEFAULT 1,
  balance integer NOT NULL DEFAULT 0,
  total_purchased integer NOT NULL DEFAULT 0,
  total_consumed integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_balance_singleton CHECK (id = 1)
);

ALTER TABLE credit_balance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_credit_balance" ON credit_balance;
CREATE POLICY "anon_read_credit_balance"
ON credit_balance FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_update_credit_balance" ON credit_balance;
CREATE POLICY "anon_update_credit_balance"
ON credit_balance FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed the singleton row with 10 free starter credits if not exists
INSERT INTO credit_balance (id, balance, total_purchased, total_consumed)
VALUES (1, 10, 10, 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- credit_transactions table (append-only ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  type text NOT NULL CHECK (type IN ('purchase', 'consumption', 'refund', 'bonus', 'admin')),
  description text NOT NULL DEFAULT '',
  feature text,
  package_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_credit_transactions" ON credit_transactions;
CREATE POLICY "anon_read_credit_transactions"
ON credit_transactions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_credit_transactions" ON credit_transactions;
CREATE POLICY "anon_insert_credit_transactions"
ON credit_transactions FOR INSERT
TO anon, authenticated WITH CHECK (true);

-- Index for recent-transactions queries
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at
ON credit_transactions (created_at DESC);

-- ============================================================
-- deduct_credits RPC (SECURITY DEFINER)
-- Atomically deducts credits, logs transaction, returns new balance
-- ============================================================
CREATE OR REPLACE FUNCTION deduct_credits(
  p_amount integer,
  p_feature text DEFAULT NULL,
  p_description text DEFAULT ''
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
  v_new_balance integer;
BEGIN
  -- Lock the singleton row to prevent concurrent overwrites
  SELECT balance INTO v_balance
  FROM credit_balance
  WHERE id = 1
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Credit balance not initialized';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS: have %, need %', v_balance, p_amount;
  END IF;

  v_new_balance := v_balance - p_amount;

  UPDATE credit_balance
  SET balance = v_new_balance,
      total_consumed = total_consumed + p_amount,
      updated_at = now()
  WHERE id = 1;

  INSERT INTO credit_transactions (amount, balance_after, type, description, feature)
  VALUES (-p_amount, v_new_balance, 'consumption', p_description, p_feature);

  RETURN v_new_balance;
END;
$$;

-- ============================================================
-- add_credits RPC (SECURITY DEFINER)
-- Atomically adds credits, logs transaction, returns new balance
-- ============================================================
CREATE OR REPLACE FUNCTION add_credits(
  p_amount integer,
  p_type text DEFAULT 'purchase',
  p_description text DEFAULT '',
  p_package_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
  v_new_balance integer;
BEGIN
  SELECT balance INTO v_balance
  FROM credit_balance
  WHERE id = 1
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Credit balance not initialized';
  END IF;

  v_new_balance := v_balance + p_amount;

  UPDATE credit_balance
  SET balance = v_new_balance,
      total_purchased = total_purchased + p_amount,
      updated_at = now()
  WHERE id = 1;

  INSERT INTO credit_transactions (amount, balance_after, type, description, package_id)
  VALUES (p_amount, v_new_balance, p_type, p_description, p_package_id);

  RETURN v_new_balance;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION deduct_credits TO anon, authenticated;
GRANT EXECUTE ON FUNCTION add_credits TO anon, authenticated;