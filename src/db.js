// Interface de comunicação com o Banco de Dados (SQLite Local + Espelho NeonDB em Nuvem)
import { sql } from './neon';

export const isElectron = () => typeof window !== 'undefined' && window.electronAPI !== undefined;

function safeParseJSON(val, defaultVal = []) {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === 'object' || Array.isArray(val)) return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    console.error("Falha ao analisar JSON:", val, e);
    return defaultVal;
  }
}

function formatTimestamp(t) {
  if (!t) return new Date().toISOString();
  if (t instanceof Date) return t.toISOString();
  return String(t);
}

const initialMockData = {
  products: [],
  sales: [],
  expenses: [],
  closures: [],
  syncQueue: [],
  creditAccounts: [],
  vaultTransactions: [],
  bills: []
};

// --- INICIALIZAÇÃO DE TABELAS NO NEONDB (POSTGRESQL) ---
let neonInitialized = false;

export async function initializeNeonTables() {
  if (neonInitialized) return;
  try {
    // 1. Tabela de Produtos
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT NOT NULL,
        description TEXT,
        cost_price NUMERIC(10, 2) DEFAULT 0,
        sale_price NUMERIC(10, 2) DEFAULT 0,
        stock_loja1 INTEGER DEFAULT 0,
        stock_loja2 INTEGER DEFAULT 0,
        stock INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 0,
        category TEXT,
        unit TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    try {
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_loja1 INTEGER DEFAULT 0`;
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_loja2 INTEGER DEFAULT 0`;
    } catch (e) {}

    // 2. Tabela de Vendas
    await sql`
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        total_price NUMERIC(10, 2) DEFAULT 0,
        total_cost NUMERIC(10, 2) DEFAULT 0,
        profit NUMERIC(10, 2) DEFAULT 0,
        payment_method TEXT NOT NULL,
        store_id TEXT NOT NULL,
        items TEXT NOT NULL,
        delivery_details TEXT
      )
    `;

    try {
      await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_details TEXT`;
    } catch (e) {}

    // 3. Tabela de Despesas
    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC(10, 2) DEFAULT 0,
        category TEXT NOT NULL,
        store_id TEXT NOT NULL,
        source TEXT DEFAULT 'Caixa Físico'
      )
    `;

    try {
      await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Caixa Físico'`;
    } catch (e) {}

    // 4. Tabela de Fechamentos de Caixa
    await sql`
      CREATE TABLE IF NOT EXISTS closures (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        date TEXT NOT NULL,
        closed_at TIMESTAMPTZ NOT NULL,
        expected_cash NUMERIC(10, 2) DEFAULT 0,
        actual_cash NUMERIC(10, 2) DEFAULT 0,
        difference NUMERIC(10, 2) DEFAULT 0,
        observations TEXT
      )
    `;

    // 5. Tabela de Fiados / Marcados
    await sql`
      CREATE TABLE IF NOT EXISTS credit_accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'Cliente',
        address TEXT,
        phone TEXT,
        balance NUMERIC(10, 2) DEFAULT 0,
        history TEXT DEFAULT '[]'
      )
    `;

    try {
      await sql`ALTER TABLE credit_accounts ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Cliente'`;
    } catch (e) {}

    // 6. Tabela de Cofre
    await sql`
      CREATE TABLE IF NOT EXISTS vault_transactions (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        type TEXT NOT NULL,
        amount NUMERIC(10, 2) DEFAULT 0,
        description TEXT,
        store_id TEXT NOT NULL,
        date TEXT NOT NULL
      )
    `;

    // 7. Tabela de Boletos / Contas a Pagar
    await sql`
      CREATE TABLE IF NOT EXISTS bills (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        amount NUMERIC(10, 2) DEFAULT 0,
        category TEXT,
        due_date TEXT,
        status TEXT DEFAULT 'Pendente',
        store_id TEXT NOT NULL
      )
    `;

    neonInitialized = true;
  } catch (err) {
    console.error("Falha ao inicializar tabelas no NeonDB:", err.message);
  }
}

// Carrega o banco de dados completo (SQLite local no Electron / NeonDB na Web)
export async function loadDB() {
  if (isElectron()) {
    try {
      const [productsRes, salesRes, expensesRes, closuresRes, accountsRes, vaultRes, billsRes] = await Promise.all([
        window.electronAPI.dbAll('SELECT * FROM products ORDER BY name ASC'),
        window.electronAPI.dbAll('SELECT * FROM sales ORDER BY timestamp DESC'),
        window.electronAPI.dbAll('SELECT * FROM expenses ORDER BY timestamp DESC'),
        window.electronAPI.dbAll('SELECT * FROM closures'),
        window.electronAPI.dbAll('SELECT * FROM credit_accounts'),
        window.electronAPI.dbAll('SELECT * FROM vault_transactions ORDER BY timestamp DESC'),
        window.electronAPI.dbAll('SELECT * FROM bills')
      ]);

      const products = (productsRes.success ? productsRes.data : []) || [];
      const sales = (salesRes.success ? salesRes.data : []) || [];
      const expenses = (expensesRes.success ? expensesRes.data : []) || [];
      const closures = (closuresRes.success ? closuresRes.data : []) || [];
      const creditAccounts = (accountsRes.success ? accountsRes.data : []) || [];
      const vaultTransactions = (vaultRes.success ? vaultRes.data : []) || [];
      const bills = (billsRes.success ? billsRes.data : []) || [];

      const parsedSales = sales.map(s => ({
        ...s,
        totalPrice: parseFloat(s.totalPrice) || 0,
        totalCost: parseFloat(s.totalCost) || 0,
        profit: parseFloat(s.profit) || 0,
        items: safeParseJSON(s.items, []),
        deliveryDetails: safeParseJSON(s.deliveryDetails, null),
        synced: true
      }));

      const parsedAccounts = creditAccounts.map(ca => ({
        ...ca,
        role: ca.role || 'Cliente',
        balance: parseFloat(ca.balance) || 0,
        history: safeParseJSON(ca.history, [])
      }));

      const formattedProducts = products.map(p => ({
        ...p,
        costPrice: parseFloat(p.costPrice) || 0,
        salePrice: parseFloat(p.salePrice) || 0,
        stockLoja1: parseInt(p.stockLoja1) || 0,
        stockLoja2: parseInt(p.stockLoja2) || 0,
        stock: (parseInt(p.stockLoja1) || 0) + (parseInt(p.stockLoja2) || 0) || parseInt(p.stock) || 0,
        minStock: parseInt(p.minStock) || 0
      }));

      const parsedVault = vaultTransactions.map(vt => ({
        ...vt,
        amount: parseFloat(vt.amount) || 0
      }));

      return {
        products: formattedProducts,
        sales: parsedSales,
        expenses: expenses.map(e => ({ ...e, amount: parseFloat(e.amount) || 0, source: e.source || 'Caixa Físico', synced: true })),
        closures: closures.map(c => ({
          ...c,
          expectedCash: parseFloat(c.expectedCash) || 0,
          actualCash: parseFloat(c.actualCash) || 0,
          difference: parseFloat(c.difference) || 0
        })),
        syncQueue: [],
        creditAccounts: parsedAccounts,
        vaultTransactions: parsedVault,
        bills: bills.map(b => ({
          ...b,
          amount: parseFloat(b.amount) || 0,
          dueDate: b.dueDate || '',
          status: b.status || 'Pendente',
          storeId: b.storeId || 'loja-1',
          synced: true
        }))
      };
    } catch (e) {
      console.error("Falha ao ler tabelas SQLite nativas", e);
    }
  } else {
    // Modo Navegador/Vercel: lê direto do NeonDB em Nuvem
    try {
      await initializeNeonTables();
      const [productsRes, salesRes, expensesRes, closuresRes, accountsRes, vaultRes, billsRes] = await Promise.all([
        sql`SELECT * FROM products ORDER BY name ASC`,
        sql`SELECT * FROM sales ORDER BY timestamp DESC`,
        sql`SELECT * FROM expenses ORDER BY timestamp DESC`,
        sql`SELECT * FROM closures`,
        sql`SELECT * FROM credit_accounts`,
        sql`SELECT * FROM vault_transactions ORDER BY timestamp DESC`,
        sql`SELECT * FROM bills`
      ]);

      const parsedSales = (salesRes || []).map(s => ({
        id: s.id,
        timestamp: formatTimestamp(s.timestamp),
        totalPrice: parseFloat(s.total_price) || 0,
        totalCost: parseFloat(s.total_cost) || 0,
        profit: parseFloat(s.profit) || 0,
        paymentMethod: s.payment_method,
        storeId: s.store_id || 'loja-1',
        items: safeParseJSON(s.items, []),
        deliveryDetails: safeParseJSON(s.delivery_details, null),
        synced: true
      }));

      const parsedAccounts = (accountsRes || []).map(ca => ({
        id: ca.id,
        name: ca.name,
        role: ca.role || 'Cliente',
        address: ca.address || '',
        phone: ca.phone || '',
        balance: parseFloat(ca.balance) || 0,
        history: safeParseJSON(ca.history, [])
      }));

      const formattedProducts = (productsRes || []).map(p => {
        const s1 = parseInt(p.stock_loja1) || 0;
        const s2 = parseInt(p.stock_loja2) || 0;
        const total = (s1 + s2 > 0) ? (s1 + s2) : (parseInt(p.stock) || 0);
        return {
          id: p.id,
          code: p.code || '',
          name: p.name,
          description: p.description || '',
          costPrice: parseFloat(p.cost_price) || 0,
          salePrice: parseFloat(p.sale_price) || 0,
          stockLoja1: s1 || total,
          stockLoja2: s2,
          stock: total,
          minStock: parseInt(p.min_stock) || 0,
          category: p.category || 'Materiais Básicos',
          unit: p.unit || 'Unidade'
        };
      });

      const parsedVault = (vaultRes || []).map(vt => ({
        id: vt.id,
        timestamp: formatTimestamp(vt.timestamp),
        type: vt.type,
        amount: parseFloat(vt.amount) || 0,
        description: vt.description || '',
        storeId: vt.store_id || 'loja-1',
        date: vt.date
      }));

      const result = {
        products: formattedProducts,
        sales: parsedSales,
        expenses: (expensesRes || []).map(e => ({
          id: e.id,
          timestamp: formatTimestamp(e.timestamp),
          description: e.description,
          amount: parseFloat(e.amount) || 0,
          category: e.category,
          storeId: e.store_id || 'loja-1',
          source: e.source || 'Caixa Físico',
          synced: true
        })),
        closures: (closuresRes || []).map(c => ({
          id: c.id,
          storeId: c.store_id,
          date: c.date,
          closedAt: formatTimestamp(c.closed_at),
          expectedCash: parseFloat(c.expected_cash) || 0,
          actualCash: parseFloat(c.actual_cash) || 0,
          difference: parseFloat(c.difference) || 0,
          observations: c.observations || ''
        })),
        syncQueue: [],
        creditAccounts: parsedAccounts,
        vaultTransactions: parsedVault,
        bills: (billsRes || []).map(b => ({
          id: b.id,
          description: b.description,
          amount: parseFloat(b.amount) || 0,
          category: b.category || 'Geral',
          dueDate: b.due_date || '',
          status: b.status || 'Pendente',
          storeId: b.store_id || 'loja-1',
          synced: true
        }))
      };

      try {
        localStorage.setItem('novo_lar_db', JSON.stringify(result));
      } catch (e) {}

      return result;
    } catch (e) {
      console.warn("Falha ao ler dados do NeonDB no navegador, usando LocalStorage como fallback", e);
    }
  }
  
  const localData = localStorage.getItem('novo_lar_db');
  let dbData;
  if (!localData) {
    localStorage.setItem('novo_lar_db', JSON.stringify(initialMockData));
    dbData = initialMockData;
  } else {
    try {
      dbData = JSON.parse(localData);
    } catch (e) {
      dbData = initialMockData;
    }
  }
  return dbData;
}

// Salva o banco de dados completo (Utilizado para imports de backups)
export async function saveDB(data) {
  if (isElectron()) {
    try {
      await window.electronAPI.dbRun('BEGIN TRANSACTION');
      await window.electronAPI.dbRun('DELETE FROM products');
      await window.electronAPI.dbRun('DELETE FROM sales');
      await window.electronAPI.dbRun('DELETE FROM expenses');
      await window.electronAPI.dbRun('DELETE FROM closures');
      await window.electronAPI.dbRun('DELETE FROM credit_accounts');
      await window.electronAPI.dbRun('DELETE FROM vault_transactions');
      await window.electronAPI.dbRun('DELETE FROM bills');

      if (data.products) {
        for (const p of data.products) {
          await window.electronAPI.dbRun(
            `INSERT INTO products (id, code, name, description, costPrice, salePrice, stockLoja1, stockLoja2, stock, minStock, category, unit)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.id, p.code, p.name, p.description, p.costPrice, p.salePrice, p.stockLoja1 || 0, p.stockLoja2 || 0, p.stock || 0, p.minStock || 0, p.category, p.unit]
          );
        }
      }

      if (data.sales) {
        for (const s of data.sales) {
          await window.electronAPI.dbRun(
            `INSERT INTO sales (id, timestamp, totalPrice, totalCost, profit, paymentMethod, storeId, items, deliveryDetails)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [s.id, s.timestamp, s.totalPrice, s.totalCost, s.profit, s.paymentMethod, s.storeId, JSON.stringify(s.items), s.deliveryDetails ? JSON.stringify(s.deliveryDetails) : null]
          );
        }
      }

      if (data.expenses) {
        for (const e of data.expenses) {
          await window.electronAPI.dbRun(
            `INSERT INTO expenses (id, timestamp, description, amount, category, storeId, source)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [e.id, e.timestamp, e.description, e.amount, e.category, e.storeId, e.source || 'Caixa Físico']
          );
        }
      }

      if (data.closures) {
        for (const c of data.closures) {
          await window.electronAPI.dbRun(
            `INSERT INTO closures (id, storeId, date, closedAt, expectedCash, actualCash, difference, observations)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [c.id, c.storeId, c.date, c.closedAt, c.expectedCash, c.actualCash, c.difference, c.observations]
          );
        }
      }

      if (data.creditAccounts) {
        for (const ca of data.creditAccounts) {
          await window.electronAPI.dbRun(
            `INSERT INTO credit_accounts (id, name, role, address, phone, balance, history)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [ca.id, ca.name, ca.role || 'Cliente', ca.address, ca.phone, ca.balance, JSON.stringify(ca.history)]
          );
        }
      }

      if (data.vaultTransactions) {
        for (const vt of data.vaultTransactions) {
          await window.electronAPI.dbRun(
            `INSERT INTO vault_transactions (id, timestamp, type, amount, description, storeId, date)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [vt.id, vt.timestamp, vt.type, vt.amount, vt.description, vt.storeId, vt.date]
          );
        }
      }

      if (data.bills) {
        for (const b of data.bills) {
          await window.electronAPI.dbRun(
            `INSERT INTO bills (id, description, amount, category, dueDate, status, storeId)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [b.id, b.description, b.amount, b.category, b.dueDate, b.status || 'Pendente', b.storeId || 'loja-1']
          );
        }
      }

      await window.electronAPI.dbRun('COMMIT');
    } catch (err) {
      console.error('Erro ao salvar no banco SQLite:', err);
      await window.electronAPI.dbRun('ROLLBACK');
    }
  }

  // Grava também na nuvem NeonDB
  try {
    await initializeNeonTables();
    await sql`DELETE FROM products`;
    await sql`DELETE FROM sales`;
    await sql`DELETE FROM expenses`;
    await sql`DELETE FROM closures`;
    await sql`DELETE FROM credit_accounts`;
    await sql`DELETE FROM vault_transactions`;
    await sql`DELETE FROM bills`;

    if (data.products) {
      for (const p of data.products) {
        await sql`
          INSERT INTO products (id, code, name, description, cost_price, sale_price, stock_loja1, stock_loja2, stock, min_stock, category, unit, updated_at)
          VALUES (${p.id}, ${p.code || ''}, ${p.name}, ${p.description || ''}, ${p.costPrice || 0}, ${p.salePrice || 0}, ${p.stockLoja1 || 0}, ${p.stockLoja2 || 0}, ${p.stock || 0}, ${p.minStock || 0}, ${p.category || 'Materiais Básicos'}, ${p.unit || 'Unidade'}, ${new Date().toISOString()})
        `;
      }
    }

    if (data.sales) {
      for (const s of data.sales) {
        await sql`
          INSERT INTO sales (id, timestamp, total_price, total_cost, profit, payment_method, store_id, items, delivery_details)
          VALUES (${s.id}, ${s.timestamp}, ${s.totalPrice || 0}, ${s.totalCost || 0}, ${s.profit || 0}, ${s.paymentMethod || ''}, ${s.storeId || 'loja-1'}, ${JSON.stringify(s.items || [])}, ${s.deliveryDetails ? JSON.stringify(s.deliveryDetails) : null})
        `;
      }
    }

    if (data.expenses) {
      for (const e of data.expenses) {
        await sql`
          INSERT INTO expenses (id, timestamp, description, amount, category, store_id, source)
          VALUES (${e.id}, ${e.timestamp}, ${e.description}, ${e.amount || 0}, ${e.category || ''}, ${e.storeId || 'loja-1'}, ${e.source || 'Caixa Físico'})
        `;
      }
    }

    if (data.closures) {
      for (const c of data.closures) {
        await sql`
          INSERT INTO closures (id, store_id, date, closed_at, expected_cash, actual_cash, difference, observations)
          VALUES (${c.id}, ${c.storeId || 'loja-1'}, ${c.date}, ${c.closedAt}, ${c.expectedCash || 0}, ${c.actualCash || 0}, ${c.difference || 0}, ${c.observations || ''})
        `;
      }
    }

    if (data.creditAccounts) {
      for (const ca of data.creditAccounts) {
        await sql`
          INSERT INTO credit_accounts (id, name, role, address, phone, balance, history)
          VALUES (${ca.id}, ${ca.name}, ${ca.role || 'Cliente'}, ${ca.address || ''}, ${ca.phone || ''}, ${ca.balance || 0}, ${JSON.stringify(ca.history || [])})
        `;
      }
    }

    if (data.vaultTransactions) {
      for (const vt of data.vaultTransactions) {
        await sql`
          INSERT INTO vault_transactions (id, timestamp, type, amount, description, store_id, date)
          VALUES (${vt.id}, ${vt.timestamp}, ${vt.type}, ${vt.amount || 0}, ${vt.description || ''}, ${vt.storeId || 'loja-1'}, ${vt.date})
        `;
      }
    }

    if (data.bills) {
      for (const b of data.bills) {
        await sql`
          INSERT INTO bills (id, description, amount, category, due_date, status, store_id)
          VALUES (${b.id}, ${b.description}, ${b.amount || 0}, ${b.category || 'Geral'}, ${b.dueDate || ''}, ${b.status || 'Pendente'}, ${b.storeId || 'loja-1'})
        `;
      }
    }
  } catch (err) {
    console.error("Erro ao gravar dados no NeonDB:", err);
  }
  
  localStorage.setItem('novo_lar_db', JSON.stringify(data));
  return true;
}

// --- CONTROLE DE ID DA LOJA ---
export function getStoreId() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('novo_lar_store_id') || 'loja-1';
  }
  return 'loja-1';
}

export function setStoreId(id) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('novo_lar_store_id', id);
  }
}

// ================== GERENCIAMENTO DE PRODUTOS ==================

export async function getProducts() {
  const db = await loadDB();
  return db.products || [];
}

export async function saveProduct(product) {
  const productId = product.id ? String(product.id) : Date.now().toString();
  const stock1 = product.stockLoja1 ?? product.stock ?? 0;
  const stock2 = product.stockLoja2 ?? 0;
  const cleanDesc = (product.description || '').replace(/\s?\[STOCKS:\d+\|\d+\]$/, '');
  const totalStock = stock1 + stock2;

  const formattedLocalProduct = {
    id: productId,
    code: String(product.code || '').trim(),
    name: String(product.name || '').trim(),
    description: cleanDesc,
    costPrice: parseFloat(product.costPrice) || 0,
    salePrice: parseFloat(product.salePrice) || 0,
    stockLoja1: stock1,
    stockLoja2: stock2,
    stock: totalStock,
    minStock: parseInt(product.minStock) || 0,
    category: product.category || 'Materiais Básicos',
    unit: product.unit || 'Unidade'
  };

  if (isElectron()) {
    const res = await window.electronAPI.dbRun(
      `INSERT OR REPLACE INTO products (id, code, name, description, costPrice, salePrice, stockLoja1, stockLoja2, stock, minStock, category, unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        formattedLocalProduct.id,
        formattedLocalProduct.code,
        formattedLocalProduct.name,
        formattedLocalProduct.description,
        formattedLocalProduct.costPrice,
        formattedLocalProduct.salePrice,
        formattedLocalProduct.stockLoja1,
        formattedLocalProduct.stockLoja2,
        formattedLocalProduct.stock,
        formattedLocalProduct.minStock,
        formattedLocalProduct.category,
        formattedLocalProduct.unit
      ]
    );
    if (!res.success) {
      alert("Erro ao salvar produto no SQLite: " + res.error);
    }
  }

  // PUSH direto para a nuvem
  try {
    await initializeNeonTables();
    await sql`
      INSERT INTO products (id, code, name, description, cost_price, sale_price, stock_loja1, stock_loja2, stock, min_stock, category, unit, updated_at)
      VALUES (${formattedLocalProduct.id}, ${formattedLocalProduct.code}, ${formattedLocalProduct.name}, ${formattedLocalProduct.description}, ${formattedLocalProduct.costPrice}, ${formattedLocalProduct.salePrice}, ${formattedLocalProduct.stockLoja1}, ${formattedLocalProduct.stockLoja2}, ${formattedLocalProduct.stock}, ${formattedLocalProduct.minStock}, ${formattedLocalProduct.category}, ${formattedLocalProduct.unit}, ${new Date().toISOString()})
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        cost_price = EXCLUDED.cost_price,
        sale_price = EXCLUDED.sale_price,
        stock_loja1 = EXCLUDED.stock_loja1,
        stock_loja2 = EXCLUDED.stock_loja2,
        stock = EXCLUDED.stock,
        min_stock = EXCLUDED.min_stock,
        category = EXCLUDED.category,
        unit = EXCLUDED.unit,
        updated_at = EXCLUDED.updated_at
    `;
  } catch (err) {
    console.error("Erro ao salvar produto na nuvem:", err);
  }

  return getProducts();
}

export async function deleteProduct(id) {
  const pId = String(id);
  if (isElectron()) {
    const res = await window.electronAPI.dbRun('DELETE FROM products WHERE id = ?', [pId]);
    if (!res.success) {
      alert("Erro ao excluir produto no SQLite: " + res.error);
    }
  }

  try {
    await initializeNeonTables();
    await sql`DELETE FROM products WHERE id = ${pId}`;
  } catch (e) {
    console.error("Erro ao excluir produto na nuvem:", e);
  }
  return getProducts();
}

// ================== GERENCIAMENTO DE VENDAS ==================

export async function getSales() {
  const db = await loadDB();
  return db.sales || [];
}

export async function registerSale(saleItems, paymentMethod, deliveryDetails = null, discount = 0) {
  const currentStore = getStoreId();
  let totalCost = 0;
  let totalPrice = 0;

  const products = await getProducts();
  
  const saleProducts = saleItems.map(item => {
    const originalProduct = products.find(p => String(p.id) === String(item.id));
    const itemCost = originalProduct ? originalProduct.costPrice : item.costPrice || 0;
    
    totalCost += itemCost * item.quantity;
    totalPrice += item.salePrice * item.quantity;
    
    return {
      productId: String(item.id),
      name: item.name,
      quantity: item.quantity,
      salePrice: item.salePrice,
      costPrice: itemCost
    };
  });

  const finalTotalPrice = Math.max(0, totalPrice - discount);
  const saleId = Date.now().toString();
  const timestamp = new Date().toISOString();
  const deliveryStr = deliveryDetails ? JSON.stringify(deliveryDetails) : null;
  const itemsStr = JSON.stringify(saleProducts);

  if (isElectron()) {
    await window.electronAPI.dbRun('BEGIN TRANSACTION');
    try {
      await window.electronAPI.dbRun(
        `INSERT INTO sales (id, timestamp, totalPrice, totalCost, profit, paymentMethod, storeId, items, deliveryDetails)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [saleId, timestamp, finalTotalPrice, totalCost, finalTotalPrice - totalCost, paymentMethod, currentStore, itemsStr, deliveryStr]
      );

      for (const item of saleItems) {
        const prod = products.find(p => String(p.id) === String(item.id));
        if (prod) {
          let stock1 = prod.stockLoja1 ?? prod.stock ?? 0;
          let stock2 = prod.stockLoja2 ?? 0;
          if (currentStore === 'loja-2') {
            stock2 = Math.max(0, stock2 - item.quantity);
          } else {
            stock1 = Math.max(0, stock1 - item.quantity);
          }
          const totalStock = stock1 + stock2;

          await window.electronAPI.dbRun(
            'UPDATE products SET stockLoja1 = ?, stockLoja2 = ?, stock = ? WHERE id = ?',
            [stock1, stock2, totalStock, prod.id]
          );
        }
      }
      await window.electronAPI.dbRun('COMMIT');
    } catch (err) {
      await window.electronAPI.dbRun('ROLLBACK');
      alert("Erro ao gravar venda: " + err.message);
    }
  }

  // Grava também no NeonDB
  try {
    await initializeNeonTables();
    await sql`
      INSERT INTO sales (id, timestamp, total_price, total_cost, profit, payment_method, store_id, items, delivery_details)
      VALUES (${saleId}, ${timestamp}, ${finalTotalPrice}, ${totalCost}, ${finalTotalPrice - totalCost}, ${paymentMethod}, ${currentStore}, ${itemsStr}, ${deliveryStr})
      ON CONFLICT (id) DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        total_price = EXCLUDED.total_price,
        total_cost = EXCLUDED.total_cost,
        profit = EXCLUDED.profit,
        payment_method = EXCLUDED.payment_method,
        store_id = EXCLUDED.store_id,
        items = EXCLUDED.items,
        delivery_details = EXCLUDED.delivery_details
    `;

    for (const item of saleItems) {
      const prod = products.find(p => String(p.id) === String(item.id));
      if (prod) {
        let stock1 = prod.stockLoja1 ?? prod.stock ?? 0;
        let stock2 = prod.stockLoja2 ?? 0;
        if (currentStore === 'loja-2') {
          stock2 = Math.max(0, stock2 - item.quantity);
        } else {
          stock1 = Math.max(0, stock1 - item.quantity);
        }
        const totalStock = stock1 + stock2;

        await sql`
          UPDATE products 
          SET stock_loja1 = ${stock1}, stock_loja2 = ${stock2}, stock = ${totalStock}, updated_at = ${new Date().toISOString()}
          WHERE id = ${prod.id}
        `;
      }
    }
  } catch (e) {
    console.error("Erro ao registrar venda na nuvem:", e);
  }

  const freshDb = await loadDB();
  return { sales: freshDb.sales, products: freshDb.products };
}

export async function updateSaleDeliveryStatus(saleId, status, deliveredAt = null) {
  const sid = String(saleId);
  if (isElectron()) {
    const res = await window.electronAPI.dbGet('SELECT deliveryDetails FROM sales WHERE id = ?', [sid]);
    if (res.success && res.data) {
      const details = safeParseJSON(res.data.deliveryDetails, {});
      details.status = status;
      details.deliveredAt = deliveredAt;
      const detailsStr = JSON.stringify(details);
      await window.electronAPI.dbRun('UPDATE sales SET deliveryDetails = ? WHERE id = ?', [detailsStr, sid]);
    }
  }

  // PUSH para a nuvem
  try {
    await initializeNeonTables();
    const saleRes = await sql`SELECT delivery_details FROM sales WHERE id = ${sid}`;
    if (saleRes && saleRes.length > 0) {
      const details = safeParseJSON(saleRes[0].delivery_details, {});
      details.status = status;
      details.deliveredAt = deliveredAt;
      const detailsStr = JSON.stringify(details);
      await sql`UPDATE sales SET delivery_details = ${detailsStr} WHERE id = ${sid}`;
    }
  } catch (e) {
    console.error("Erro ao atualizar entrega na nuvem:", e);
  }
  return getSales();
}

// ================== GERENCIAMENTO DE DESPESAS ==================

export async function getExpenses() {
  const db = await loadDB();
  return db.expenses || [];
}

export async function saveExpense(expense) {
  const expId = expense.id ? String(expense.id) : Date.now().toString();
  const timestamp = expense.timestamp || new Date().toISOString();
  const amount = parseFloat(expense.amount) || 0;
  const storeId = expense.storeId || getStoreId();
  const source = expense.source || 'Caixa Físico';
  const description = expense.description || '';
  const category = expense.category || 'Geral';

  if (isElectron()) {
    await window.electronAPI.dbRun(
      `INSERT OR REPLACE INTO expenses (id, timestamp, description, amount, category, storeId, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [expId, timestamp, description, amount, category, storeId, source]
    );
  }

  // PUSH direto para a nuvem
  try {
    await initializeNeonTables();
    await sql`
      INSERT INTO expenses (id, timestamp, description, amount, category, store_id, source)
      VALUES (${expId}, ${timestamp}, ${description}, ${amount}, ${category}, ${storeId}, ${source})
      ON CONFLICT (id) DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        description = EXCLUDED.description,
        amount = EXCLUDED.amount,
        category = EXCLUDED.category,
        store_id = EXCLUDED.store_id,
        source = EXCLUDED.source
    `;
  } catch (err) {
    console.error("Erro ao salvar despesa na nuvem:", err);
  }

  return getExpenses();
}

export async function deleteExpense(id) {
  const expId = String(id);
  if (isElectron()) {
    await window.electronAPI.dbRun('DELETE FROM expenses WHERE id = ?', [expId]);
  }

  try {
    await initializeNeonTables();
    await sql`DELETE FROM expenses WHERE id = ${expId}`;
  } catch (e) {
    console.error("Erro ao deletar despesa na nuvem:", e);
  }
  return getExpenses();
}

// ================== GERENCIAMENTO DE BOLETOS / CONTAS A PAGAR ==================

export async function getBills() {
  const db = await loadDB();
  return db.bills || [];
}

export async function saveBill(bill) {
  const billId = bill.id ? String(bill.id) : Date.now().toString();
  const amount = parseFloat(bill.amount) || 0;
  const storeId = bill.storeId || getStoreId();
  const status = bill.status || 'Pendente';
  const description = bill.description || '';
  const category = bill.category || 'Geral';
  const dueDate = bill.dueDate || '';

  if (isElectron()) {
    await window.electronAPI.dbRun(
      `INSERT OR REPLACE INTO bills (id, description, amount, category, dueDate, status, storeId)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [billId, description, amount, category, dueDate, status, storeId]
    );
  }

  // PUSH direto para a nuvem
  try {
    await initializeNeonTables();
    await sql`
      INSERT INTO bills (id, description, amount, category, due_date, status, store_id)
      VALUES (${billId}, ${description}, ${amount}, ${category}, ${dueDate}, ${status}, ${storeId})
      ON CONFLICT (id) DO UPDATE SET
        description = EXCLUDED.description,
        amount = EXCLUDED.amount,
        category = EXCLUDED.category,
        due_date = EXCLUDED.due_date,
        status = EXCLUDED.status,
        store_id = EXCLUDED.store_id
    `;
  } catch (err) {
    console.error("Erro ao salvar boleto na nuvem:", err);
  }

  return getBills();
}

export async function deleteBill(id) {
  const billId = String(id);
  if (isElectron()) {
    await window.electronAPI.dbRun('DELETE FROM bills WHERE id = ?', [billId]);
  }

  try {
    await initializeNeonTables();
    await sql`DELETE FROM bills WHERE id = ${billId}`;
  } catch (e) {
    console.error("Erro ao deletar boleto na nuvem:", e);
  }
  return getBills();
}

// ================== GESTÃO DE FECHAMENTO DE CAIXA ==================

export async function getClosures() {
  const db = await loadDB();
  return db.closures || [];
}

export async function saveClosure(closureData) {
  const closureId = closureData.id ? String(closureData.id) : Date.now().toString();
  const closedAt = closureData.closedAt || new Date().toISOString();
  const storeId = closureData.storeId || getStoreId();
  const expectedCash = parseFloat(closureData.expectedCash) || 0;
  const actualCash = parseFloat(closureData.actualCash) || 0;
  const difference = parseFloat(closureData.difference) || 0;
  const observations = closureData.observations || '';
  const date = closureData.date || new Date().toISOString().split('T')[0];

  if (isElectron()) {
    await window.electronAPI.dbRun(
      `INSERT OR REPLACE INTO closures (id, storeId, date, closedAt, expectedCash, actualCash, difference, observations)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [closureId, storeId, date, closedAt, expectedCash, actualCash, difference, observations]
    );
  }

  // PUSH direto para a nuvem
  try {
    await initializeNeonTables();
    await sql`
      INSERT INTO closures (id, store_id, date, closed_at, expected_cash, actual_cash, difference, observations)
      VALUES (${closureId}, ${storeId}, ${date}, ${closedAt}, ${expectedCash}, ${actualCash}, ${difference}, ${observations})
      ON CONFLICT (id) DO UPDATE SET
        store_id = EXCLUDED.store_id,
        date = EXCLUDED.date,
        closed_at = EXCLUDED.closed_at,
        expected_cash = EXCLUDED.expected_cash,
        actual_cash = EXCLUDED.actual_cash,
        difference = EXCLUDED.difference,
        observations = EXCLUDED.observations
    `;
  } catch (err) {
    console.error("Erro ao salvar fechamento na nuvem:", err);
  }

  return getClosures();
}

export async function getPendingClosures(storeId) {
  const db = await loadDB();
  const sales = db.sales ? db.sales.filter(s => s.storeId === storeId && s.paymentMethod !== 'Fiado') : [];
  const expenses = db.expenses ? db.expenses.filter(e => e.storeId === storeId) : [];
  const closures = db.closures ? db.closures.filter(c => c.storeId === storeId) : [];

  const activityDates = new Set();
  const extractDate = (isoString) => {
    const d = new Date(isoString);
    const offset = d.getTimezoneOffset() * 60000;
    const localDate = new Date(d.getTime() - offset);
    return localDate.toISOString().split('T')[0];
  };

  sales.forEach(s => activityDates.add(extractDate(s.timestamp)));
  expenses.forEach(e => activityDates.add(extractDate(e.timestamp)));

  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  const today = new Date(d.getTime() - offset).toISOString().split('T')[0];
  
  const pendingDates = [];

  activityDates.forEach(date => {
    if (date < today) {
      const isClosed = closures.some(c => c.date === date);
      if (!isClosed) {
        pendingDates.push(date);
      }
    }
  });

  return pendingDates.sort();
}

// ================== GESTÃO DE FIADOS / MARCADOS ==================

export async function getCreditAccounts() {
  const db = await loadDB();
  return db.creditAccounts || [];
}

export async function saveCreditAccount(account) {
  const db = await loadDB();
  const localAccounts = db.creditAccounts || [];
  
  let targetAccount;
  if (account.id) {
    const idx = localAccounts.findIndex(a => a.id === account.id);
    if (idx !== -1) {
      localAccounts[idx] = { ...localAccounts[idx], ...account };
      targetAccount = localAccounts[idx];
    } else {
      targetAccount = { ...account };
      localAccounts.push(targetAccount);
    }
  } else {
    const initialBalance = parseFloat(account.balance) || 0;
    targetAccount = {
      ...account,
      id: Date.now().toString(),
      role: account.role || 'Cliente',
      balance: initialBalance,
      history: initialBalance > 0 ? [{
        id: `init-${Date.now()}`,
        type: 'debt',
        amount: initialBalance,
        description: 'Saldo acumulado inicial cadastrado',
        timestamp: new Date().toISOString()
      }] : []
    };
    localAccounts.push(targetAccount);
  }

  const historyStr = JSON.stringify(targetAccount.history || []);
  const balanceVal = parseFloat(targetAccount.balance) || 0;
  const roleVal = targetAccount.role || 'Cliente';

  if (isElectron() && targetAccount) {
    await window.electronAPI.dbRun(
      `INSERT OR REPLACE INTO credit_accounts (id, name, role, address, phone, balance, history)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [targetAccount.id, targetAccount.name, roleVal, targetAccount.address || '', targetAccount.phone || '', balanceVal, historyStr]
    );
  }

  // PUSH direto para a nuvem
  if (targetAccount) {
    try {
      await initializeNeonTables();
      await sql`
        INSERT INTO credit_accounts (id, name, role, address, phone, balance, history)
        VALUES (${targetAccount.id}, ${targetAccount.name}, ${roleVal}, ${targetAccount.address || ''}, ${targetAccount.phone || ''}, ${balanceVal}, ${historyStr})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          address = EXCLUDED.address,
          phone = EXCLUDED.phone,
          balance = EXCLUDED.balance,
          history = EXCLUDED.history
      `;
    } catch (e) {
      console.error("Erro ao salvar conta de fiado na nuvem:", e);
    }
  }
  return getCreditAccounts();
}

export async function addCreditTransaction(accountId, type, amount, description, saleId = null, items = null, deliveryDetails = null, dueDate = null, paymentMethod = null) {
  const transaction = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    type,
    amount: parseFloat(amount) || 0,
    description,
    saleId,
    items,
    deliveryDetails,
    dueDate,
    paymentMethod
  };

  let updatedBalance = 0;
  let updatedHistory = [];

  if (isElectron()) {
    const res = await window.electronAPI.dbGet('SELECT * FROM credit_accounts WHERE id = ?', [accountId]);
    if (res.success && res.data) {
      const account = res.data;
      const history = safeParseJSON(account.history, []);
      history.push(transaction);

      let balance = parseFloat(account.balance) || 0;
      if (type === 'charge' || type === 'debt') {
        balance += transaction.amount;
      } else if (type === 'payment') {
        balance -= transaction.amount;
      }

      updatedBalance = balance;
      updatedHistory = history;

      const historyStr = JSON.stringify(history);

      await window.electronAPI.dbRun(
        'UPDATE credit_accounts SET balance = ?, history = ? WHERE id = ?',
        [balance, historyStr, accountId]
      );
    }
  }

  // PUSH direto para a nuvem
  try {
    await initializeNeonTables();
    const accRes = await sql`SELECT * FROM credit_accounts WHERE id = ${accountId}`;
    if (accRes && accRes.length > 0) {
      const account = accRes[0];
      const history = safeParseJSON(account.history, []);
      history.push(transaction);
      let balance = parseFloat(account.balance) || 0;
      if (type === 'charge' || type === 'debt') {
        balance += transaction.amount;
      } else if (type === 'payment') {
        balance -= transaction.amount;
      }

      const historyStr = JSON.stringify(history);

      await sql`
        UPDATE credit_accounts 
        SET balance = ${balance}, history = ${historyStr} 
        WHERE id = ${accountId}
      `;
    }
  } catch (e) {
    console.error("Erro ao registrar transação de fiado na nuvem:", e);
  }
  return getCreditAccounts();
}

// Apaga TODOS os dados locais e remotos
export async function clearAllDatabase() {
  if (isElectron()) {
    try {
      await window.electronAPI.dbRun('BEGIN TRANSACTION');
      await window.electronAPI.dbRun('DELETE FROM products');
      await window.electronAPI.dbRun('DELETE FROM sales');
      await window.electronAPI.dbRun('DELETE FROM expenses');
      await window.electronAPI.dbRun('DELETE FROM closures');
      await window.electronAPI.dbRun('DELETE FROM credit_accounts');
      await window.electronAPI.dbRun('DELETE FROM vault_transactions');
      await window.electronAPI.dbRun('DELETE FROM bills');
      await window.electronAPI.dbRun('COMMIT');
    } catch (err) {
      try {
        await window.electronAPI.dbRun('ROLLBACK');
      } catch (rb) {}
      console.error("Erro ao limpar SQLite local:", err);
    }
  }

  try {
    await initializeNeonTables();
    await Promise.all([
      sql`DELETE FROM products`,
      sql`DELETE FROM sales`,
      sql`DELETE FROM expenses`,
      sql`DELETE FROM closures`,
      sql`DELETE FROM credit_accounts`,
      sql`DELETE FROM vault_transactions`,
      sql`DELETE FROM bills`
    ]);
  } catch (e) {
    console.warn("Erro ao limpar nuvem:", e);
  }

  const emptyDb = {
    products: [],
    sales: [],
    expenses: [],
    closures: [],
    syncQueue: [],
    creditAccounts: [],
    vaultTransactions: [],
    bills: []
  };

  try {
    localStorage.setItem('novo_lar_db', JSON.stringify(emptyDb));
  } catch (e) {}

  return emptyDb;
}

// ================== GERENCIAMENTO E CONTROLE DE REPLICAÇÃO ==================

export async function syncAllToCloud() {
  if (!isElectron()) {
    return { success: true, message: 'Navegador sempre conectado diretamente ao NeonDB' };
  }

  try {
    await initializeNeonTables();

    // ========================================================
    // PULL & MIRROR: SINCRONIZAR SQLITE COM A NUVEM
    // ========================================================
    const [cloudProducts, cloudSales, cloudExpenses, cloudClosures, cloudAccounts, cloudVault, cloudBills] = await Promise.all([
      sql`SELECT * FROM products`,
      sql`SELECT * FROM sales`,
      sql`SELECT * FROM expenses`,
      sql`SELECT * FROM closures`,
      sql`SELECT * FROM credit_accounts`,
      sql`SELECT * FROM vault_transactions`,
      sql`SELECT * FROM bills`
    ]);

    await window.electronAPI.dbRun('BEGIN TRANSACTION');

    // 1. Substituir produtos
    await window.electronAPI.dbRun('DELETE FROM products');
    for (const p of cloudProducts || []) {
      const s1 = parseInt(p.stock_loja1) || 0;
      const s2 = parseInt(p.stock_loja2) || 0;
      const total = (s1 + s2 > 0) ? (s1 + s2) : (parseInt(p.stock) || 0);

      await window.electronAPI.dbRun(
        `INSERT INTO products (id, code, name, description, costPrice, salePrice, stockLoja1, stockLoja2, stock, minStock, category, unit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.code || '',
          p.name || '',
          p.description || '',
          parseFloat(p.cost_price) || 0,
          parseFloat(p.sale_price) || 0,
          s1,
          s2,
          total,
          parseInt(p.min_stock) || 0,
          p.category || 'Materiais Básicos',
          p.unit || 'Unidade'
        ]
      );
    }

    // 2. Substituir vendas
    await window.electronAPI.dbRun('DELETE FROM sales');
    for (const s of cloudSales || []) {
      await window.electronAPI.dbRun(
        `INSERT INTO sales (id, timestamp, totalPrice, totalCost, profit, paymentMethod, storeId, items, deliveryDetails)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id,
          formatTimestamp(s.timestamp),
          parseFloat(s.total_price) || 0,
          parseFloat(s.total_cost) || 0,
          parseFloat(s.profit) || 0,
          s.payment_method || '',
          s.store_id || 'loja-1',
          typeof s.items === 'object' ? JSON.stringify(s.items) : (s.items || '[]'),
          typeof s.delivery_details === 'object' ? JSON.stringify(s.delivery_details) : (s.delivery_details || null)
        ]
      );
    }

    // 3. Substituir despesas
    await window.electronAPI.dbRun('DELETE FROM expenses');
    for (const e of cloudExpenses || []) {
      await window.electronAPI.dbRun(
        `INSERT INTO expenses (id, timestamp, description, amount, category, storeId, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          e.id,
          formatTimestamp(e.timestamp),
          e.description || '',
          parseFloat(e.amount) || 0,
          e.category || '',
          e.store_id || 'loja-1',
          e.source || 'Caixa Físico'
        ]
      );
    }

    // 4. Substituir fechamentos
    await window.electronAPI.dbRun('DELETE FROM closures');
    for (const c of cloudClosures || []) {
      await window.electronAPI.dbRun(
        `INSERT INTO closures (id, storeId, date, closedAt, expectedCash, actualCash, difference, observations)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id,
          c.store_id || 'loja-1',
          c.date || '',
          formatTimestamp(c.closed_at),
          parseFloat(c.expected_cash) || 0,
          parseFloat(c.actual_cash) || 0,
          parseFloat(c.difference) || 0,
          c.observations || ''
        ]
      );
    }

    // 5. Substituir fiados
    await window.electronAPI.dbRun('DELETE FROM credit_accounts');
    for (const ca of cloudAccounts || []) {
      await window.electronAPI.dbRun(
        `INSERT INTO credit_accounts (id, name, role, address, phone, balance, history)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          ca.id,
          ca.name || '',
          ca.role || 'Cliente',
          ca.address || '',
          ca.phone || '',
          parseFloat(ca.balance) || 0,
          typeof ca.history === 'object' ? JSON.stringify(ca.history) : (ca.history || '[]')
        ]
      );
    }

    // 6. Substituir transações do cofre
    await window.electronAPI.dbRun('DELETE FROM vault_transactions');
    for (const vt of cloudVault || []) {
      await window.electronAPI.dbRun(
        `INSERT INTO vault_transactions (id, timestamp, type, amount, description, storeId, date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          vt.id,
          formatTimestamp(vt.timestamp),
          vt.type || 'deposit',
          parseFloat(vt.amount) || 0,
          vt.description || '',
          vt.store_id || 'loja-1',
          vt.date || ''
        ]
      );
    }

    // 7. Substituir boletos
    await window.electronAPI.dbRun('DELETE FROM bills');
    for (const b of cloudBills || []) {
      await window.electronAPI.dbRun(
        `INSERT INTO bills (id, description, amount, category, dueDate, status, storeId)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          b.id,
          b.description || '',
          parseFloat(b.amount) || 0,
          b.category || '',
          b.due_date || '',
          b.status || 'Pendente',
          b.store_id || 'loja-1'
        ]
      );
    }

    await window.electronAPI.dbRun('COMMIT');
    return { success: true };
  } catch (err) {
    if (isElectron()) {
      try {
        await window.electronAPI.dbRun('ROLLBACK');
      } catch (rb) {}
    }
    console.error("Erro durante a sincronização com o NeonDB:", err.message);
    return { success: false, error: err.message };
  }
}

export async function syncAllFromCloud() {
  return syncAllToCloud();
}

export async function runBackgroundSync() {
  if (isElectron()) {
    const res = await syncAllToCloud();
    if (res.success) {
      return { status: 'success', message: 'Sincronizado' };
    } else {
      return { status: 'error', message: res.error };
    }
  }
  return { status: 'success', message: 'Web conectado' };
}

// ================== GERENCIAMENTO DO COFRE ==================

export async function getVaultTransactions() {
  const db = await loadDB();
  return db.vaultTransactions || [];
}

export async function saveVaultTransaction(vt) {
  const vtId = vt.id ? String(vt.id) : Date.now().toString();
  const timestamp = vt.timestamp || new Date().toISOString();
  const amount = parseFloat(vt.amount) || 0;
  const storeId = vt.storeId || getStoreId();
  const date = vt.date || new Date().toISOString().split('T')[0];
  const description = vt.description || '';
  const type = vt.type || 'deposit';

  if (isElectron()) {
    await window.electronAPI.dbRun(
      `INSERT OR REPLACE INTO vault_transactions (id, timestamp, type, amount, description, storeId, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [vtId, timestamp, type, amount, description, storeId, date]
    );
  }

  // PUSH direto para a nuvem
  try {
    await initializeNeonTables();
    await sql`
      INSERT INTO vault_transactions (id, timestamp, type, amount, description, store_id, date)
      VALUES (${vtId}, ${timestamp}, ${type}, ${amount}, ${description}, ${storeId}, ${date})
      ON CONFLICT (id) DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        type = EXCLUDED.type,
        amount = EXCLUDED.amount,
        description = EXCLUDED.description,
        store_id = EXCLUDED.store_id,
        date = EXCLUDED.date
    `;
  } catch (err) {
    console.error("Erro ao gravar transação de cofre no NeonDB:", err);
  }

  return getVaultTransactions();
}

export async function deleteVaultTransaction(id) {
  const vtId = String(id);
  if (isElectron()) {
    await window.electronAPI.dbRun('DELETE FROM vault_transactions WHERE id = ?', [vtId]);
  }

  try {
    await initializeNeonTables();
    await sql`DELETE FROM vault_transactions WHERE id = ${vtId}`;
  } catch (e) {
    console.error("Erro ao excluir do cofre na nuvem:", e);
  }
  return getVaultTransactions();
}

// ================== GERENCIAMENTO DE ORÇAMENTOS & COTAÇÕES ==================

export async function getQuotes() {
  const db = await loadDB();
  return db.quotes || [];
}

export async function saveQuote(q) {
  const quoteId = q.id ? String(q.id) : ('ORC-' + Date.now().toString().slice(-6));
  const timestamp = q.timestamp || new Date().toISOString();
  const validUntil = q.validUntil || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const customerName = q.customerName || 'Cliente Balcão';
  const customerPhone = q.customerPhone || '';
  const storeId = q.storeId || getStoreId();
  const totalPrice = parseFloat(q.totalPrice) || 0;
  const items = typeof q.items === 'object' ? JSON.stringify(q.items) : (q.items || '[]');
  const notes = q.notes || '';
  const status = q.status || 'Pendente';

  if (isElectron()) {
    await window.electronAPI.dbRun(
      `INSERT OR REPLACE INTO quotes (id, timestamp, validUntil, customerName, customerPhone, storeId, totalPrice, items, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [quoteId, timestamp, validUntil, customerName, customerPhone, storeId, totalPrice, items, notes, status]
    );
  }

  // PUSH direto para NeonDB
  try {
    await initializeNeonTables();
    await sql`
      INSERT INTO quotes (id, timestamp, valid_until, customer_name, customer_phone, store_id, total_price, items, notes, status)
      VALUES (${quoteId}, ${timestamp}, ${validUntil}, ${customerName}, ${customerPhone}, ${storeId}, ${totalPrice}, ${items}, ${notes}, ${status})
      ON CONFLICT (id) DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        valid_until = EXCLUDED.valid_until,
        customer_name = EXCLUDED.customer_name,
        customer_phone = EXCLUDED.customer_phone,
        store_id = EXCLUDED.store_id,
        total_price = EXCLUDED.total_price,
        items = EXCLUDED.items,
        notes = EXCLUDED.notes,
        status = EXCLUDED.status
    `;
  } catch (err) {
    console.error("Erro ao salvar orçamento no NeonDB:", err);
  }

  return getQuotes();
}

export async function deleteQuote(id) {
  const quoteId = String(id);
  if (isElectron()) {
    await window.electronAPI.dbRun('DELETE FROM quotes WHERE id = ?', [quoteId]);
  }

  try {
    await initializeNeonTables();
    await sql`DELETE FROM quotes WHERE id = ${quoteId}`;
  } catch (e) {
    console.error("Erro ao excluir orçamento na nuvem:", e);
  }
  return getQuotes();
}

export async function updateQuoteStatus(id, status) {
  const quoteId = String(id);
  if (isElectron()) {
    await window.electronAPI.dbRun('UPDATE quotes SET status = ? WHERE id = ?', [status, quoteId]);
  }

  try {
    await initializeNeonTables();
    await sql`UPDATE quotes SET status = ${status} WHERE id = ${quoteId}`;
  } catch (e) {
    console.error("Erro ao atualizar status do orçamento na nuvem:", e);
  }
  return getQuotes();
}

export async function deleteCreditAccount(id) {
  const accountId = String(id);
  if (isElectron()) {
    await window.electronAPI.dbRun('DELETE FROM credit_accounts WHERE id = ?', [accountId]);
  }

  try {
    await initializeNeonTables();
    await sql`DELETE FROM credit_accounts WHERE id = ${accountId}`;
  } catch (e) {
    console.error("Erro ao excluir conta de fiado na nuvem:", e);
  }
  return getCreditAccounts();
}

export async function deleteClosure(id) {
  const closureId = String(id);
  if (isElectron()) {
    await window.electronAPI.dbRun('DELETE FROM closures WHERE id = ?', [closureId]);
  }

  try {
    await initializeNeonTables();
    await sql`DELETE FROM closures WHERE id = ${closureId}`;
  } catch (e) {
    console.error("Erro ao excluir fechamento na nuvem:", e);
  }
  return getClosures();
}

