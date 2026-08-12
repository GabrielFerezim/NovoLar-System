// Interface de comunicação com o Banco de Dados (SQLite Local + Espelho NeonDB em Background)
import { sql } from './neon';

const isElectron = () => typeof window !== 'undefined' && window.electronAPI !== undefined;

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

const initialMockData = {
  products: [],
  sales: [],
  expenses: [],
  closures: [],
  syncQueue: [],
  creditAccounts: []
};

// --- INICIALIZAÇÃO DE TABELAS NO NEONDB ---
export async function initializeNeonTables() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT,
        description TEXT,
        cost_price NUMERIC,
        sale_price NUMERIC,
        stock INTEGER,
        min_stock INTEGER,
        category TEXT,
        unit TEXT,
        updated_at TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMP,
        total_price NUMERIC,
        total_cost NUMERIC,
        profit NUMERIC,
        payment_method TEXT,
        store_id TEXT,
        items TEXT,
        delivery_details TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMP,
        description TEXT,
        amount NUMERIC,
        category TEXT,
        store_id TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS closures (
        id TEXT PRIMARY KEY,
        store_id TEXT,
        date TEXT,
        closed_at TIMESTAMP,
        expected_cash NUMERIC,
        actual_cash NUMERIC,
        difference NUMERIC,
        observations TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS credit_accounts (
        id TEXT PRIMARY KEY,
        name TEXT,
        address TEXT,
        phone TEXT,
        balance NUMERIC,
        history TEXT
      )
    `;
  } catch (err) {
    console.error("Falha ao inicializar tabelas no NeonDB:", err.message);
  }
}

// Carrega o banco de dados completo (SQLite local no Electron / NeonDB na Web)
export async function loadDB() {
  if (isElectron()) {
    try {
      const [productsRes, salesRes, expensesRes, closuresRes, accountsRes] = await Promise.all([
        window.electronAPI.dbAll('SELECT * FROM products ORDER BY name ASC'),
        window.electronAPI.dbAll('SELECT * FROM sales ORDER BY timestamp DESC'),
        window.electronAPI.dbAll('SELECT * FROM expenses ORDER BY timestamp DESC'),
        window.electronAPI.dbAll('SELECT * FROM closures'),
        window.electronAPI.dbAll('SELECT * FROM credit_accounts')
      ]);

      const products = (productsRes.success ? productsRes.data : []) || [];
      const sales = (salesRes.success ? salesRes.data : []) || [];
      const expenses = (expensesRes.success ? expensesRes.data : []) || [];
      const closures = (closuresRes.success ? closuresRes.data : []) || [];
      const creditAccounts = (accountsRes.success ? accountsRes.data : []) || [];

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
        balance: parseFloat(ca.balance) || 0,
        history: safeParseJSON(ca.history, [])
      }));

      const formattedProducts = products.map(p => ({
        ...p,
        costPrice: parseFloat(p.costPrice) || 0,
        salePrice: parseFloat(p.salePrice) || 0,
        stockLoja1: parseInt(p.stockLoja1) || 0,
        stockLoja2: parseInt(p.stockLoja2) || 0,
        stock: parseInt(p.stock) || 0,
        minStock: parseInt(p.minStock) || 0
      }));

      return {
        products: formattedProducts,
        sales: parsedSales,
        expenses: expenses.map(e => ({ ...e, amount: parseFloat(e.amount) || 0, synced: true })),
        closures: closures.map(c => ({
          ...c,
          expectedCash: parseFloat(c.expectedCash) || 0,
          actualCash: parseFloat(c.actualCash) || 0,
          difference: parseFloat(c.difference) || 0
        })),
        syncQueue: [],
        creditAccounts: parsedAccounts
      };
    } catch (e) {
      console.error("Falha ao ler tabelas SQLite nativas", e);
    }
  } else {
    // Modo Navegador/Vercel: lê direto do NeonDB
    try {
      await initializeNeonTables();
      const [productsRes, salesRes, expensesRes, closuresRes, accountsRes] = await Promise.all([
        sql`SELECT * FROM products ORDER BY name ASC`,
        sql`SELECT * FROM sales ORDER BY timestamp DESC`,
        sql`SELECT * FROM expenses ORDER BY timestamp DESC`,
        sql`SELECT * FROM closures`,
        sql`SELECT * FROM credit_accounts`
      ]);

      const parsedSales = (salesRes || []).map(s => ({
        id: s.id,
        timestamp: s.timestamp,
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
        address: ca.address,
        phone: ca.phone,
        balance: parseFloat(ca.balance) || 0,
        history: safeParseJSON(ca.history, [])
      }));

      const formattedProducts = (productsRes || []).map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        costPrice: parseFloat(p.cost_price) || 0,
        salePrice: parseFloat(p.sale_price) || 0,
        stockLoja1: parseInt(p.stock) || 0,
        stockLoja2: 0,
        stock: parseInt(p.stock) || 0,
        minStock: parseInt(p.min_stock) || 0,
        category: p.category,
        unit: p.unit
      }));

      return {
        products: formattedProducts,
        sales: parsedSales,
        expenses: (expensesRes || []).map(e => ({
          id: e.id,
          timestamp: e.timestamp,
          description: e.description,
          amount: parseFloat(e.amount) || 0,
          category: e.category,
          storeId: e.store_id || 'loja-1',
          synced: true
        })),
        closures: (closuresRes || []).map(c => ({
          id: c.id,
          storeId: c.store_id,
          date: c.date,
          closedAt: c.closed_at,
          expectedCash: parseFloat(c.expected_cash) || 0,
          actualCash: parseFloat(c.actual_cash) || 0,
          difference: parseFloat(c.difference) || 0,
          observations: c.observations
        })),
        syncQueue: [],
        creditAccounts: parsedAccounts
      };
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
    dbData = JSON.parse(localData);
  }
  return dbData;
}

// Salva o banco de dados completo (Utilizado para imports/backups)
export async function saveDB(data) {
  if (isElectron()) {
    try {
      await window.electronAPI.dbRun('BEGIN TRANSACTION');
      await window.electronAPI.dbRun('DELETE FROM products');
      await window.electronAPI.dbRun('DELETE FROM sales');
      await window.electronAPI.dbRun('DELETE FROM expenses');
      await window.electronAPI.dbRun('DELETE FROM closures');
      await window.electronAPI.dbRun('DELETE FROM credit_accounts');

      if (data.products) {
        for (const p of data.products) {
          await window.electronAPI.dbRun(
            `INSERT INTO products (id, code, name, description, costPrice, salePrice, stockLoja1, stockLoja2, stock, minStock, category, unit)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.id, p.code, p.name, p.description, p.costPrice, p.salePrice, p.stockLoja1, p.stockLoja2, p.stock, p.minStock, p.category, p.unit]
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
            `INSERT INTO expenses (id, timestamp, description, amount, category, storeId)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [e.id, e.timestamp, e.description, e.amount, e.category, e.storeId]
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
            `INSERT INTO credit_accounts (id, name, address, phone, balance, history)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [ca.id, ca.name, ca.address, ca.phone, ca.balance, JSON.stringify(ca.history)]
          );
        }
      }

      await window.electronAPI.dbRun('COMMIT');
      localStorage.setItem('novo_lar_db', JSON.stringify(data));
      
      // Espelha na nuvem em background
      syncAllToCloud().catch(err => console.warn("Erro ao sincronizar backup na nuvem:", err));
      return true;
    } catch (err) {
      console.error('Erro ao salvar no banco SQLite:', err);
      await window.electronAPI.dbRun('ROLLBACK');
    }
  } else {
    // Gravação direta na web
    try {
      await initializeNeonTables();
      await sql`DELETE FROM products`;
      if (data.products) {
        for (const p of data.products) {
          await sql`
            INSERT INTO products (id, code, name, description, cost_price, sale_price, stock, min_stock, category, unit, updated_at)
            VALUES (${p.id}, ${p.code}, ${p.name}, ${p.description}, ${p.costPrice}, ${p.salePrice}, ${p.stock}, ${p.minStock}, ${p.category}, ${p.unit}, ${new Date().toISOString()})
          `;
        }
      }
    } catch (err) {
      console.error("Erro ao gravar dados no NeonDB:", err);
    }
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
    
    // Dispara espelhamento em background
    syncAllToCloud().catch(err => console.warn("Falha no espelhamento automático:", err));
    return getProducts();
  }

  // Web
  try {
    await initializeNeonTables();
    await sql`
      INSERT INTO products (id, code, name, description, cost_price, sale_price, stock, min_stock, category, unit, updated_at)
      VALUES (${formattedLocalProduct.id}, ${formattedLocalProduct.code}, ${formattedLocalProduct.name}, ${formattedLocalProduct.description}, ${formattedLocalProduct.costPrice}, ${formattedLocalProduct.salePrice}, ${formattedLocalProduct.stock}, ${formattedLocalProduct.minStock}, ${formattedLocalProduct.category}, ${formattedLocalProduct.unit}, ${new Date().toISOString()})
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        cost_price = EXCLUDED.cost_price,
        sale_price = EXCLUDED.sale_price,
        stock = EXCLUDED.stock,
        min_stock = EXCLUDED.min_stock,
        category = EXCLUDED.category,
        unit = EXCLUDED.unit,
        updated_at = EXCLUDED.updated_at
    `;
  } catch (err) {
    console.error("Erro na nuvem:", err);
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
    syncAllToCloud().catch(err => console.warn("Falha no espelhamento ao excluir:", err));
    return getProducts();
  }

  // Web
  try {
    await sql`DELETE FROM products WHERE id = ${pId}`;
  } catch (e) {
    console.error(e);
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

  if (isElectron()) {
    await window.electronAPI.dbRun('BEGIN TRANSACTION');
    try {
      await window.electronAPI.dbRun(
        `INSERT INTO sales (id, timestamp, totalPrice, totalCost, profit, paymentMethod, storeId, items, deliveryDetails)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [saleId, timestamp, finalTotalPrice, totalCost, finalTotalPrice - totalCost, paymentMethod, currentStore, JSON.stringify(saleProducts), deliveryDetails ? JSON.stringify(deliveryDetails) : null]
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

    syncAllToCloud().catch(err => console.warn("Falha no espelhamento automático da venda:", err));
    const freshDb = await loadDB();
    return { sales: freshDb.sales, products: freshDb.products };
  }

  // Web
  try {
    await sql`
      INSERT INTO sales (id, timestamp, total_price, total_cost, profit, payment_method, store_id, items, delivery_details)
      VALUES (${saleId}, ${timestamp}, ${finalTotalPrice}, ${totalCost}, ${finalTotalPrice - totalCost}, ${paymentMethod}, ${currentStore}, ${JSON.stringify(saleProducts)}, ${deliveryDetails ? JSON.stringify(deliveryDetails) : null})
    `;
  } catch (e) {
    console.error(e);
  }
  return getSales();
}

export async function updateSaleDeliveryStatus(saleId, status, deliveredAt = null) {
  if (isElectron()) {
    const res = await window.electronAPI.dbGet('SELECT deliveryDetails FROM sales WHERE id = ?', [saleId]);
    if (res.success && res.data) {
      const details = JSON.parse(res.data.deliveryDetails || '{}');
      details.status = status;
      details.deliveredAt = deliveredAt;
      await window.electronAPI.dbRun('UPDATE sales SET deliveryDetails = ? WHERE id = ?', [JSON.stringify(details), saleId]);
    }
    syncAllToCloud().catch(err => console.warn("Falha ao espelhar entrega:", err));
    return getSales();
  }

  // Web
  try {
    const saleRes = await sql`SELECT delivery_details FROM sales WHERE id = ${saleId}`;
    if (saleRes && saleRes.length > 0) {
      const details = JSON.parse(saleRes[0].delivery_details || '{}');
      details.status = status;
      details.deliveredAt = deliveredAt;
      await sql`UPDATE sales SET delivery_details = ${JSON.stringify(details)} WHERE id = ${saleId}`;
    }
  } catch (e) {
    console.error(e);
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

  if (isElectron()) {
    await window.electronAPI.dbRun(
      `INSERT OR REPLACE INTO expenses (id, timestamp, description, amount, category, storeId)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [expId, timestamp, expense.description, amount, expense.category, storeId]
    );
    syncAllToCloud().catch(err => console.warn("Falha ao espelhar despesa:", err));
    return getExpenses();
  }

  // Web
  try {
    await sql`
      INSERT INTO expenses (id, timestamp, description, amount, category, store_id)
      VALUES (${expId}, ${timestamp}, ${expense.description}, ${amount}, ${expense.category}, ${storeId})
      ON CONFLICT (id) DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        description = EXCLUDED.description,
        amount = EXCLUDED.amount,
        category = EXCLUDED.category,
        store_id = EXCLUDED.store_id
    `;
  } catch (e) {
    console.error(e);
  }
  return getExpenses();
}

export async function deleteExpense(id) {
  const expId = String(id);
  if (isElectron()) {
    await window.electronAPI.dbRun('DELETE FROM expenses WHERE id = ?', [expId]);
    syncAllToCloud().catch(err => console.warn("Falha ao espelhar exclusão de despesa:", err));
    return getExpenses();
  }

  // Web
  try {
    await sql`DELETE FROM expenses WHERE id = ${expId}`;
  } catch (e) {
    console.error(e);
  }
  return getExpenses();
}

// ================== GESTÃO DE FECHAMENTO DE CAIXA ==================

export async function getClosures() {
  const db = await loadDB();
  return db.closures || [];
}

export async function saveClosure(closureData) {
  const closureId = Date.now().toString();
  const closedAt = new Date().toISOString();

  if (isElectron()) {
    await window.electronAPI.dbRun(
      `INSERT INTO closures (id, storeId, date, closedAt, expectedCash, actualCash, difference, observations)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [closureId, closureData.storeId, closureData.date, closedAt, closureData.expectedCash, closureData.actualCash, closureData.difference, closureData.observations]
    );
    syncAllToCloud().catch(err => console.warn("Falha ao espelhar fechamento de caixa:", err));
    return getClosures();
  }

  // Web
  try {
    await sql`
      INSERT INTO closures (id, store_id, date, closed_at, expected_cash, actual_cash, difference, observations)
      VALUES (${closureId}, ${closureData.storeId}, ${closureData.date}, ${closedAt}, ${closureData.expectedCash}, ${closureData.actualCash}, ${closureData.difference}, ${closureData.observations})
    `;
  } catch (e) {
    console.error(e);
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
    }
  } else {
    targetAccount = {
      ...account,
      id: Date.now().toString(),
      balance: 0,
      history: []
    };
    localAccounts.push(targetAccount);
  }

  if (isElectron() && targetAccount) {
    await window.electronAPI.dbRun(
      `INSERT OR REPLACE INTO credit_accounts (id, name, address, phone, balance, history)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [targetAccount.id, targetAccount.name, targetAccount.address || '', targetAccount.phone || '', targetAccount.balance || 0, JSON.stringify(targetAccount.history || [])]
    );
    syncAllToCloud().catch(err => console.warn("Falha ao espelhar fiado:", err));
    return getCreditAccounts();
  }

  // Web
  if (targetAccount) {
    try {
      await sql`
        INSERT INTO credit_accounts (id, name, address, phone, balance, history)
        VALUES (${targetAccount.id}, ${targetAccount.name}, ${targetAccount.address || ''}, ${targetAccount.phone || ''}, ${targetAccount.balance || 0}, ${JSON.stringify(targetAccount.history || [])})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          address = EXCLUDED.address,
          phone = EXCLUDED.phone,
          balance = EXCLUDED.balance,
          history = EXCLUDED.history
      `;
    } catch (e) {
      console.error(e);
    }
  }
  return getCreditAccounts();
}

export async function addCreditTransaction(accountId, type, amount, description, saleId = null, items = null, deliveryDetails = null, dueDate = null, paymentMethod = null) {
  const transaction = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    type,
    amount: parseFloat(amount),
    description,
    saleId,
    items,
    deliveryDetails,
    dueDate,
    paymentMethod
  };

  if (isElectron()) {
    const res = await window.electronAPI.dbGet('SELECT * FROM credit_accounts WHERE id = ?', [accountId]);
    if (res.success && res.data) {
      const account = res.data;
      const history = JSON.parse(account.history || '[]');
      history.push(transaction);

      let balance = parseFloat(account.balance) || 0;
      if (type === 'charge') {
        balance += transaction.amount;
      } else if (type === 'payment') {
        balance -= transaction.amount;
      }

      await window.electronAPI.dbRun(
        'UPDATE credit_accounts SET balance = ?, history = ? WHERE id = ?',
        [balance, JSON.stringify(history), accountId]
      );
    }
    syncAllToCloud().catch(err => console.warn("Falha ao espelhar transação de fiado:", err));
    return getCreditAccounts();
  }

  // Web
  try {
    const accRes = await sql`SELECT * FROM credit_accounts WHERE id = ${accountId}`;
    if (accRes && accRes.length > 0) {
      const account = accRes[0];
      const history = JSON.parse(account.history || '[]');
      history.push(transaction);
      let balance = parseFloat(account.balance) || 0;
      if (type === 'charge') {
        balance += transaction.amount;
      } else if (type === 'payment') {
        balance -= transaction.amount;
      }

      await sql`
        UPDATE credit_accounts SET balance = ${balance}, history = ${JSON.stringify(history)} WHERE id = ${accountId}
      `;
    }
  } catch (e) {
    console.error(e);
  }
  return getCreditAccounts();
}

// Apaga TODOS os dados locais e remotos
export async function clearAllDatabase() {
  if (isElectron()) {
    await window.electronAPI.dbRun('DELETE FROM products');
    await window.electronAPI.dbRun('DELETE FROM sales');
    await window.electronAPI.dbRun('DELETE FROM expenses');
    await window.electronAPI.dbRun('DELETE FROM closures');
    await window.electronAPI.dbRun('DELETE FROM credit_accounts');
  }

  try {
    await sql`DELETE FROM products`;
    await sql`DELETE FROM sales`;
    await sql`DELETE FROM expenses`;
    await sql`DELETE FROM closures`;
    await sql`DELETE FROM credit_accounts`;
  } catch (e) {
    console.warn("Erro ao limpar nuvem:", e);
  }

  const emptyDb = {
    products: [],
    sales: [],
    expenses: [],
    closures: [],
    syncQueue: [],
    creditAccounts: []
  };

  await saveDB(emptyDb);
  return emptyDb;
}

// ================== GERENCIAMENTO E CONTROLE DE REPLICAÇÃO ==================

export async function syncAllToCloud() {
  try {
    await initializeNeonTables();

    // Carregar do SQLite Local
    const localDb = await loadDB();

    // 1. Produtos
    for (const p of localDb.products || []) {
      const totalStock = (p.stockLoja1 ?? p.stock ?? 0) + (p.stockLoja2 ?? 0);
      await sql`
        INSERT INTO products (id, code, name, description, cost_price, sale_price, stock, min_stock, category, unit, updated_at)
        VALUES (${p.id}, ${p.code}, ${p.name}, ${p.description || ''}, ${p.costPrice}, ${p.salePrice}, ${totalStock}, ${p.minStock}, ${p.category}, ${p.unit}, ${new Date().toISOString()})
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          cost_price = EXCLUDED.cost_price,
          sale_price = EXCLUDED.sale_price,
          stock = EXCLUDED.stock,
          min_stock = EXCLUDED.min_stock,
          category = EXCLUDED.category,
          unit = EXCLUDED.unit,
          updated_at = EXCLUDED.updated_at
      `;
    }
    const localProductIds = (localDb.products || []).map(p => p.id);
    if (localProductIds.length > 0) {
      await sql`DELETE FROM products WHERE NOT (id = ANY(${localProductIds}))`;
    } else {
      await sql`DELETE FROM products`;
    }

    // 2. Vendas
    for (const s of localDb.sales || []) {
      await sql`
        INSERT INTO sales (id, timestamp, total_price, total_cost, profit, payment_method, store_id, items, delivery_details)
        VALUES (${s.id}, ${s.timestamp}, ${s.totalPrice}, ${s.totalCost}, ${s.profit}, ${s.paymentMethod}, ${s.storeId}, ${JSON.stringify(s.items)}, ${s.deliveryDetails ? JSON.stringify(s.deliveryDetails) : null})
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
    }
    const localSaleIds = (localDb.sales || []).map(s => s.id);
    if (localSaleIds.length > 0) {
      await sql`DELETE FROM sales WHERE NOT (id = ANY(${localSaleIds}))`;
    } else {
      await sql`DELETE FROM sales`;
    }

    // 3. Despesas
    for (const e of localDb.expenses || []) {
      await sql`
        INSERT INTO expenses (id, timestamp, description, amount, category, store_id)
        VALUES (${e.id}, ${e.timestamp}, ${e.description}, ${e.amount}, ${e.category}, ${e.storeId})
        ON CONFLICT (id) DO UPDATE SET
          timestamp = EXCLUDED.timestamp,
          description = EXCLUDED.description,
          amount = EXCLUDED.amount,
          category = EXCLUDED.category,
          store_id = EXCLUDED.store_id
      `;
    }
    const localExpenseIds = (localDb.expenses || []).map(e => e.id);
    if (localExpenseIds.length > 0) {
      await sql`DELETE FROM expenses WHERE NOT (id = ANY(${localExpenseIds}))`;
    } else {
      await sql`DELETE FROM expenses`;
    }

    // 4. Fechamentos
    for (const c of localDb.closures || []) {
      await sql`
        INSERT INTO closures (id, store_id, date, closed_at, expected_cash, actual_cash, difference, observations)
        VALUES (${c.id}, ${c.storeId}, ${c.date}, ${c.closedAt}, ${c.expectedCash}, ${c.actualCash}, ${c.difference}, ${c.observations || ''})
        ON CONFLICT (id) DO UPDATE SET
          store_id = EXCLUDED.store_id,
          date = EXCLUDED.date,
          closed_at = EXCLUDED.closed_at,
          expected_cash = EXCLUDED.expected_cash,
          actual_cash = EXCLUDED.actual_cash,
          difference = EXCLUDED.difference,
          observations = EXCLUDED.observations
      `;
    }
    const localClosureIds = (localDb.closures || []).map(c => c.id);
    if (localClosureIds.length > 0) {
      await sql`DELETE FROM closures WHERE NOT (id = ANY(${localClosureIds}))`;
    } else {
      await sql`DELETE FROM closures`;
    }

    // 5. Fiados
    for (const ca of localDb.creditAccounts || []) {
      await sql`
        INSERT INTO credit_accounts (id, name, address, phone, balance, history)
        VALUES (${ca.id}, ${ca.name}, ${ca.address || ''}, ${ca.phone || ''}, ${ca.balance}, ${JSON.stringify(ca.history)})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          address = EXCLUDED.address,
          phone = EXCLUDED.phone,
          balance = EXCLUDED.balance,
          history = EXCLUDED.history
      `;
    }
    const localAccountIds = (localDb.creditAccounts || []).map(ca => ca.id);
    if (localAccountIds.length > 0) {
      await sql`DELETE FROM credit_accounts WHERE NOT (id = ANY(${localAccountIds}))`;
    } else {
      await sql`DELETE FROM credit_accounts`;
    }

    console.log("✅ Espelhamento de Tabelas concluído.");
    return { success: true, data: localDb };
  } catch (err) {
    console.error("Erro durante o espelhamento das Tabelas:", err.message);
    return { success: false, error: err.message };
  }
}

export async function syncAllFromCloud() {
  // Chamada de compatibilidade: o Electron apenas executa push (SQLite -> Nuvem)
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
  return { status: 'idle', message: 'Navegador não sincroniza em background' };
}
