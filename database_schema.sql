-- SCRIPT DE CRIAÇÃO DAS TABELAS NO SUPABASE
-- Copie este código e cole no painel do Supabase em "SQL Editor" -> "New Query", depois clique em "Run".

-- 1. Tabela de Produtos (Compartilhada entre as lojas)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    cost_price NUMERIC(10, 2) NOT NULL,
    sale_price NUMERIC(10, 2) NOT NULL,
    stock INTEGER NOT NULL,
    min_stock INTEGER NOT NULL,
    category TEXT,
    unit TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Vendas
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    total_cost NUMERIC(10, 2) NOT NULL,
    profit NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL,
    store_id TEXT NOT NULL, -- Identifica de qual loja veio a venda (ex: loja-1, loja-2)
    items JSONB NOT NULL   -- Armazena os itens vendidos de forma simples e segura
);

-- 3. Tabela de Despesas
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    category TEXT NOT NULL,
    store_id TEXT NOT NULL  -- Identifica de qual loja veio a despesa
);

-- 4. Desabilitar RLS (Row Level Security) para permitir que o app acesse e grave diretamente usando a chave pública
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
