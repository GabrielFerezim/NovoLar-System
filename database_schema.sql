-- SCRIPT DE CRIAÇÃO DAS TABELAS NO SUPABASE / NEON POSTGRESQL
-- Este script define a estrutura completa para espelhamento em nuvem entre App Desktop e Web.

-- 1. Tabela de Produtos (Compartilhada entre as lojas)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT NOT NULL,
    description TEXT,
    cost_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    sale_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    stock_loja1 INTEGER NOT NULL DEFAULT 0,
    stock_loja2 INTEGER NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 0,
    category TEXT,
    unit TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Vendas
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    profit NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL,
    store_id TEXT NOT NULL, -- Identifica a loja (ex: loja-1, loja-2)
    items TEXT NOT NULL,    -- Itens vendidos em formato JSON
    delivery_details TEXT   -- Detalhes e status de entrega (Pendente, Entregue, etc.)
);

-- 3. Tabela de Despesas
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    store_id TEXT NOT NULL,
    source TEXT DEFAULT 'Caixa Físico'
);

-- 4. Tabela de Fechamentos de Caixa (Closures)
CREATE TABLE IF NOT EXISTS closures (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    closed_at TIMESTAMPTZ NOT NULL,
    expected_cash NUMERIC(10, 2) NOT NULL DEFAULT 0,
    actual_cash NUMERIC(10, 2) NOT NULL DEFAULT 0,
    difference NUMERIC(10, 2) NOT NULL DEFAULT 0,
    observations TEXT
);

-- 5. Tabela de Contas de Fiado / Marcados
CREATE TABLE IF NOT EXISTS credit_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'Cliente',
    address TEXT,
    phone TEXT,
    balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
    history TEXT NOT NULL DEFAULT '[]', -- Histórico completo de transações em JSON
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabela de Transações do Cofre
CREATE TABLE IF NOT EXISTS vault_transactions (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL, -- deposit | withdrawal
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    description TEXT,
    store_id TEXT NOT NULL,
    date TEXT NOT NULL
);

-- 7. Tabela de Boletos / Contas a Pagar
CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    due_date TEXT,
    status TEXT DEFAULT 'Pendente',
    store_id TEXT NOT NULL
);

-- Desabilitar RLS para permitir sincronização direta
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE closures DISABLE ROW LEVEL SECURITY;
ALTER TABLE credit_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE vault_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE bills DISABLE ROW LEVEL SECURITY;
