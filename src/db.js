// Interface de comunicação com o Banco de Dados (Electron IPC + Supabase Sync)
import { supabase } from './supabase';

const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

// Mock inicial para caso rode no navegador (fallback se não houver conexão de primeira)
const initialMockData = {
  products: [
    { id: "1", code: "7891000100101", name: "Cimento CP II Mauá 50kg", description: "Cimento Portland composto, ideal para obras em geral.", costPrice: 28.50, salePrice: 38.90, stock: 150, minStock: 20, category: "Materiais Básicos", unit: "Saco" },
    { id: "2", code: "7891000100102", name: "Tijolo Baiano 8 Furos 9x19x19cm", description: "Tijolo cerâmico para vedação, excelente rendimento.", costPrice: 0.85, salePrice: 1.45, stock: 2400, minStock: 500, category: "Materiais Básicos", unit: "Milheiro" },
    { id: "3", code: "7891000100103", name: "Tubo PVC Esgoto 100mm 6m Tigre", description: "Tubo de PVC para condução de efluentes sanitários.", costPrice: 42.00, salePrice: 65.00, stock: 12, minStock: 15, category: "Hidráulica", unit: "Barra" },
    { id: "4", code: "7891000100104", name: "Fio Rígido Flexível 2.5mm² Azul 100m Cobrecom", description: "Cabo flexível azul de 2.5mm, ideal para instalações elétricas internas.", costPrice: 110.00, salePrice: 169.90, stock: 8, minStock: 10, category: "Elétrica", unit: "Rolo" },
    { id: "5", code: "7891000100105", name: "Argamassa ACIII 20kg Quartzolit", description: "Argamassa de alta aderência para assentamento de cerâmicas e porcelanatos.", costPrice: 18.20, salePrice: 27.50, stock: 65, minStock: 15, category: "Materiais Básicos", unit: "Saco" },
    { id: "6", code: "7891000100106", name: "Torneira de Parede para Cozinha Metal Deca", description: "Torneira com bica móvel e mecanismo de 1/4 de volta.", costPrice: 75.00, salePrice: 120.00, stock: 15, minStock: 5, category: "Acabamento", unit: "Unidade" },
    { id: "7", code: "7891000100107", name: "Parafuso Sextavado Zincado 1/4 x 3/4", description: "Parafuso sextavado para fixações em metal e madeira.", costPrice: 0.15, salePrice: 0.35, stock: 850, minStock: 100, category: "Ferragens", unit: "Cento" },
    { id: "8", code: "7891000100108", name: "Pintura Tinta Acrílica Fosca Rende Muito Branco 18L Coral", description: "Tinta acrílica de alto rendimento na cor branca, acabamento fosco.", costPrice: 210.00, salePrice: 329.00, stock: 4, minStock: 6, category: "Tintas", unit: "Lata" },
    { id: "9", code: "7891000100109", name: "Adesivo Plástico Cola para PVC 175g Tigre", description: "Adesivo plástico para união de tubos e conexões de PVC.", costPrice: 7.20, salePrice: 12.90, stock: 35, minStock: 5, category: "Hidráulica", unit: "Bisnaga" },
    { id: "10", code: "7891000100110", name: "Fita Isolante Imperial 3M 10m", description: "Fita isolante de PVC antichama, excelente flexibilidade.", costPrice: 2.10, salePrice: 4.80, stock: 60, minStock: 10, category: "Elétrica", unit: "Rolo" },
    { id: "11", code: "7891000100111", name: "Rolo de Lã para Pintura Tigre 23cm", description: "Rolo de lã de carneiro para aplicação de tintas acrílicas.", costPrice: 12.00, salePrice: 22.50, stock: 18, minStock: 3, category: "Tintas", unit: "Unidade" },
    { id: "12", code: "7891000100112", name: "Fita Veda Rosca 18mm x 10m Tigre", description: "Fita veda rosca para vedação de juntas roscáveis.", costPrice: 1.50, salePrice: 3.50, stock: 120, minStock: 15, category: "Hidráulica", unit: "Rolo" }
  ],
  sales: [],
  expenses: [],
  closures: [], // Fechamentos de caixa
  syncQueue: [], // Fila de sincronização offline
  creditAccounts: [] // Contas a receber (fiados/marcados)
};

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

// Carrega o banco de dados completo (Local)
export async function loadDB() {
  let dbData;
  if (isElectron) {
    try {
      dbData = await window.electronAPI.readDatabase();
    } catch (e) {
      console.error("Falha ao ler banco nativo, usando LocalStorage", e);
    }
  }
  
  if (!dbData) {
    const localData = localStorage.getItem('novo_lar_db');
    if (!localData) {
      localStorage.setItem('novo_lar_db', JSON.stringify(initialMockData));
      dbData = initialMockData;
    } else {
      dbData = JSON.parse(localData);
    }
  }

  // Garantia de migração para múltiplas lojas (adiciona storeId se não houver)
  let migrated = false;
  if (dbData.sales) {
    dbData.sales.forEach(s => {
      if (!s.storeId) {
        s.storeId = 'loja-1';
        migrated = true;
      }
    });
  }
  if (dbData.expenses) {
    dbData.expenses.forEach(e => {
      if (!e.storeId) {
        e.storeId = 'loja-1';
        migrated = true;
      }
    });
  }
  if (!dbData.closures) {
    dbData.closures = [];
    migrated = true;
  }
  if (!dbData.creditAccounts) {
    dbData.creditAccounts = [];
    migrated = true;
  }

  if (migrated) {
    await saveDB(dbData);
  }

  return dbData;
}

// Salva o banco de dados completo (Local)
export async function saveDB(data) {
  if (isElectron) {
    try {
      const res = await window.electronAPI.writeDatabase(data);
      if (res && res.success) return true;
    } catch (e) {
      console.error("Falha ao salvar no banco nativo", e);
    }
  }
  
  localStorage.setItem('novo_lar_db', JSON.stringify(data));
  return true;
}

// ================== FUNÇÕES AUXILIARES CRUD COM CLOUD SYNC ==================

// PRODUTOS
export async function getProducts() {
  const db = await loadDB();
  return db.products || [];
}

export async function saveProduct(product) {
  const db = await loadDB();
  if (!db.products) db.products = [];
  
  let targetProduct;
  if (product.id) {
    const idx = db.products.findIndex(p => p.id === product.id);
    if (idx !== -1) {
      db.products[idx] = { ...db.products[idx], ...product };
      targetProduct = db.products[idx];
    }
  } else {
    targetProduct = {
      ...product,
      id: Date.now().toString()
    };
    db.products.push(targetProduct);
  }
  
  await saveDB(db);

  const stock1 = targetProduct.stockLoja1 ?? targetProduct.stock ?? 0;
  const stock2 = targetProduct.stockLoja2 ?? 0;
  const cleanDesc = (targetProduct.description || '').replace(/\s\[STOCKS:\d+\|\d+\]$/, '');
  const supabaseDesc = `${cleanDesc} [STOCKS:${stock1}|${stock2}]`.trim();

  // Tentar enviar para a nuvem de forma assíncrona
  try {
    const { error } = await supabase.from('products').upsert({
      id: targetProduct.id,
      code: targetProduct.code,
      name: targetProduct.name,
      description: supabaseDesc,
      cost_price: targetProduct.costPrice,
      sale_price: targetProduct.salePrice,
      stock: targetProduct.stock,
      min_stock: targetProduct.minStock,
      category: targetProduct.category,
      unit: targetProduct.unit,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  } catch (err) {
    console.warn("Offline ou erro na nuvem ao salvar produto, mantido localmente", err);
    // Adicionar à fila de sincronização
    await addToSyncQueue('product', targetProduct.id);
  }
  
  return db.products;
}

export async function deleteProduct(id) {
  const db = await loadDB();
  db.products = (db.products || []).filter(p => p.id !== id);
  await saveDB(db);

  // Excluir na nuvem
  try {
    await supabase.from('products').delete().eq('id', id);
  } catch (err) {
    console.warn("Erro ao deletar produto na nuvem, mantido localmente", err);
    await addToSyncQueue('delete_product', id);
  }
  return db.products;
}

// VENDAS
export async function getSales() {
  const db = await loadDB();
  return db.sales || [];
}

export async function registerSale(saleItems, paymentMethod, deliveryDetails = null, discount = 0) {
  const db = await loadDB();
  if (!db.sales) db.sales = [];
  if (!db.products) db.products = [];

  let totalCost = 0;
  let totalPrice = 0;
  
  const saleProducts = saleItems.map(item => {
    const originalProduct = db.products.find(p => p.id === item.id);
    const itemCost = originalProduct ? originalProduct.costPrice : item.costPrice || 0;
    
    totalCost += itemCost * item.quantity;
    totalPrice += item.salePrice * item.quantity;
    
    // Atualizar estoque no banco local
    if (originalProduct) {
      originalProduct.stock = Math.max(0, originalProduct.stock - item.quantity);
    }
    
    return {
      productId: item.id,
      name: item.name,
      quantity: item.quantity,
      salePrice: item.salePrice,
      costPrice: itemCost
    };
  });

  const finalTotalPrice = Math.max(0, totalPrice - discount);

  const newSale = {
    id: `V-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toISOString(),
    items: saleProducts,
    totalPrice: parseFloat(finalTotalPrice.toFixed(2)),
    totalCost: parseFloat(totalCost.toFixed(2)),
    profit: parseFloat((finalTotalPrice - totalCost).toFixed(2)),
    paymentMethod,
    storeId: getStoreId(),
    deliveryDetails,
    synced: false
  };

  db.sales.push(newSale);
  await saveDB(db);

  // Tentar enviar para a nuvem
  try {
    const { error } = await supabase.from('sales').insert({
      id: newSale.id,
      timestamp: newSale.timestamp,
      total_price: newSale.totalPrice,
      total_cost: newSale.totalCost,
      profit: newSale.profit,
      payment_method: newSale.paymentMethod,
      store_id: getStoreId(),
      items: newSale.items
    });
    
    if (error) throw error;
    
    // Se deu certo, atualiza o estoque físico dos produtos na nuvem também
    for (const item of saleItems) {
      const originalProduct = db.products.find(p => p.id === item.id);
      if (originalProduct) {
        await supabase.from('products').update({
          stock: originalProduct.stock
        }).eq('id', item.id);
      }
    }

    // Marcar como sincronizado localmente
    newSale.synced = true;
    await saveDB(db);
  } catch (err) {
    console.warn("Venda gravada localmente. Offline para sincronizar na nuvem.", err);
    await addToSyncQueue('sale', newSale.id);
  }

  return { sales: db.sales, products: db.products };
}

export async function updateSaleDeliveryStatus(saleId, status, deliveredAt = null) {
  const db = await loadDB();
  if (!db.sales) return [];

  const idx = db.sales.findIndex(s => s.id === saleId);
  if (idx !== -1) {
    if (!db.sales[idx].deliveryDetails) {
      db.sales[idx].deliveryDetails = {};
    }
    db.sales[idx].deliveryDetails.status = status;
    db.sales[idx].deliveryDetails.deliveredAt = deliveredAt;
    db.sales[idx].synced = false;
    await saveDB(db);
  }
  return db.sales;
}

// GASTOS / DESPESAS
export async function getExpenses() {
  const db = await loadDB();
  return db.expenses || [];
}

export async function saveExpense(expense) {
  const db = await loadDB();
  if (!db.expenses) db.expenses = [];
  
  let targetExpense;
  if (expense.id) {
    const idx = db.expenses.findIndex(g => g.id === expense.id);
    if (idx !== -1) {
      db.expenses[idx] = { ...db.expenses[idx], ...expense };
      targetExpense = db.expenses[idx];
    }
  } else {
    targetExpense = {
      ...expense,
      id: `G-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      storeId: getStoreId(),
      synced: false
    };
    db.expenses.push(targetExpense);
  }
  
  await saveDB(db);

  // Enviar para nuvem
  try {
    const { error } = await supabase.from('expenses').insert({
      id: targetExpense.id,
      timestamp: targetExpense.timestamp,
      description: targetExpense.description,
      amount: targetExpense.amount,
      category: targetExpense.category,
      store_id: getStoreId()
    });
    if (error) throw error;
    
    targetExpense.synced = true;
    await saveDB(db);
  } catch (err) {
    console.warn("Despesa salva localmente. Sincronização pendente.", err);
    await addToSyncQueue('expense', targetExpense.id);
  }
  
  return db.expenses;
}

export async function deleteExpense(id) {
  const db = await loadDB();
  db.expenses = (db.expenses || []).filter(g => g.id !== id);
  await saveDB(db);

  try {
    await supabase.from('expenses').delete().eq('id', id);
  } catch (err) {
    console.warn("Erro ao deletar despesa na nuvem, mantido localmente", err);
    await addToSyncQueue('delete_expense', id);
  }
  return db.expenses;
}

// ================== SISTEMA DE FILA DE SINCRONIZAÇÃO (SYNC QUEUE) ==================

async function addToSyncQueue(type, recordId) {
  const db = await loadDB();
  if (!db.syncQueue) db.syncQueue = [];
  
  // Evitar duplicados na fila
  if (!db.syncQueue.some(q => q.type === type && q.recordId === recordId)) {
    db.syncQueue.push({ type, recordId, timestamp: new Date().toISOString() });
    await saveDB(db);
  }
}

export async function runBackgroundSync() {
  const db = await loadDB();
  if (!db.syncQueue || db.syncQueue.length === 0) {
    // Se não há fila, puxar novidades de produtos da nuvem para atualizar estoque local
    try {
      const { data: cloudProducts, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });
        
      if (error) {
        console.error("Erro na consulta do Supabase:", error);
        if (error.message && error.message.includes('relation "products" does not exist')) {
          return { status: 'error', message: 'Tabelas não criadas no Supabase (Execute o script SQL)' };
        }
        return { status: 'error', message: error.message || 'Erro de conexão' };
      }

      if (cloudProducts) {
        // Recarregar o banco fresco para evitar sobrescrever vendas recentes concorrentes
        const freshDb = await loadDB();
        const localProducts = freshDb.products || [];
        const merged = [...localProducts];
        
        cloudProducts.forEach(cp => {
          const idx = merged.findIndex(p => p.id === cp.id);
          
          const rawDesc = cp.description || '';
          const match = rawDesc.match(/\s\[STOCKS:(\d+)\|(\d+)\]$/);
          let stockLoja1 = parseFloat(cp.stock) || 0;
          let stockLoja2 = 0;
          let cleanDescription = rawDesc;
          
          if (match) {
            stockLoja1 = parseInt(match[1]) || 0;
            stockLoja2 = parseInt(match[2]) || 0;
            cleanDescription = rawDesc.replace(/\s\[STOCKS:\d+\|\d+\]$/, '');
          }

          const cpTransformed = {
            id: cp.id,
            code: cp.code,
            name: cp.name,
            description: cleanDescription,
            costPrice: parseFloat(cp.cost_price),
            salePrice: parseFloat(cp.sale_price),
            stockLoja1,
            stockLoja2,
            stock: stockLoja1 + stockLoja2,
            minStock: cp.min_stock,
            category: cp.category,
            unit: cp.unit
          };
          
          if (idx !== -1) {
            merged[idx] = cpTransformed;
          } else {
            merged.push(cpTransformed);
          }
        });
        
        freshDb.products = merged;
        await saveDB(freshDb);
        return { status: 'success', message: 'Estoque sincronizado' };
      }
    } catch (e) {
      console.warn("Falha ao atualizar produtos da nuvem (Sem conexão)", e);
      return { status: 'offline', message: 'Sem internet para atualizar' };
    }
    return { status: 'offline', message: 'Aguardando conexão...' };
  }

  console.log(`Processando fila de sincronização offline: ${db.syncQueue.length} itens.`);
  const newQueue = [...db.syncQueue];
  let processedCount = 0;
  const processedSales = [];
  const processedExpenses = [];

  for (const job of db.syncQueue) {
    try {
      if (job.type === 'product') {
        const prod = db.products.find(p => p.id === job.recordId);
        if (prod) {
          const stock1 = prod.stockLoja1 ?? prod.stock ?? 0;
          const stock2 = prod.stockLoja2 ?? 0;
          const cleanDesc = (prod.description || '').replace(/\s\[STOCKS:\d+\|\d+\]$/, '');
          const supabaseDesc = `${cleanDesc} [STOCKS:${stock1}|${stock2}]`.trim();

          const { error } = await supabase.from('products').upsert({
            id: prod.id,
            code: prod.code,
            name: prod.name,
            description: supabaseDesc,
            cost_price: prod.costPrice,
            sale_price: prod.salePrice,
            stock: prod.stock,
            min_stock: prod.minStock,
            category: prod.category,
            unit: prod.unit,
            updated_at: new Date().toISOString()
          });
          if (error) throw error;
        }
      } 
      else if (job.type === 'sale') {
        const sale = db.sales.find(s => s.id === job.recordId);
        if (sale) {
          const { error } = await supabase.from('sales').insert({
            id: sale.id,
            timestamp: sale.timestamp,
            total_price: sale.totalPrice,
            total_cost: sale.totalCost,
            profit: sale.profit,
            payment_method: sale.paymentMethod,
            store_id: getStoreId(),
            items: sale.items
          });
          if (error) throw error;
          
          // Atualiza estoques na nuvem
          for (const item of sale.items) {
            const prod = db.products.find(p => p.id === item.productId);
            if (prod) {
              await supabase.from('products').update({ stock: prod.stock }).eq('id', prod.id);
            }
          }
          processedSales.push(sale.id);
        }
      }
      else if (job.type === 'expense') {
        const exp = db.expenses.find(e => e.id === job.recordId);
        if (exp) {
          const { error } = await supabase.from('expenses').insert({
            id: exp.id,
            timestamp: exp.timestamp,
            description: exp.description,
            amount: exp.amount,
            category: exp.category,
            store_id: getStoreId()
          });
          if (error) throw error;
          processedExpenses.push(exp.id);
        }
      }
      else if (job.type === 'delete_product') {
        await supabase.from('products').delete().eq('id', job.recordId);
      }
      else if (job.type === 'delete_expense') {
        await supabase.from('expenses').delete().eq('id', job.recordId);
      }

      // Remover do array local do job concluído
      const index = newQueue.findIndex(q => q.type === job.type && q.recordId === job.recordId);
      if (index !== -1) newQueue.splice(index, 1);
      processedCount++;
    } catch (err) {
      console.warn(`Falha ao sincronizar item da fila (${job.type}:${job.recordId})`, err);
      break; // Interrompe para tentar na próxima oportunidade
    }
  }

  // Recarregar banco fresco e salvar atualizações de status de forma segura!
  const freshDb = await loadDB();
  freshDb.syncQueue = newQueue;
  
  processedSales.forEach(saleId => {
    const sale = freshDb.sales?.find(s => s.id === saleId);
    if (sale) sale.synced = true;
  });
  
  processedExpenses.forEach(expId => {
    const exp = freshDb.expenses?.find(e => e.id === expId);
    if (exp) exp.synced = true;
  });

  await saveDB(freshDb);
  
  return { 
    status: processedCount > 0 ? 'syncing' : 'offline', 
    message: processedCount > 0 ? `Sincronizados ${processedCount} itens!` : 'Aguardando conexão...' 
  };
}

// ================== GESTÃO DE FECHAMENTO DE CAIXA ==================

export async function getClosures() {
  const db = await loadDB();
  return db.closures || [];
}

export async function saveClosure(closureData) {
  const db = await loadDB();
  if (!db.closures) db.closures = [];

  const newClosure = {
    ...closureData,
    id: Date.now().toString(),
    closedAt: new Date().toISOString()
  };

  db.closures.push(newClosure);
  await saveDB(db);

  // Tentar enviar para nuvem assincronamente (se a tabela existir)
  try {
    await supabase.from('closures').insert({
      id: newClosure.id,
      store_id: newClosure.storeId,
      date: newClosure.date,
      closed_at: newClosure.closedAt,
      expected_cash: newClosure.expectedCash,
      actual_cash: newClosure.actualCash,
      difference: newClosure.difference,
      observations: newClosure.observations
    });
  } catch (err) {
    console.warn("Erro ao salvar fechamento na nuvem", err);
  }

  return db.closures;
}

export async function getPendingClosures(storeId) {
  const db = await loadDB();
  const sales = db.sales ? db.sales.filter(s => s.storeId === storeId && s.paymentMethod !== 'Fiado') : [];
  const expenses = db.expenses ? db.expenses.filter(e => e.storeId === storeId) : [];
  const closures = db.closures ? db.closures.filter(c => c.storeId === storeId) : [];

  const activityDates = new Set();
  const extractDate = (isoString) => {
    // Retorna YYYY-MM-DD respeitando o timezone local
    const d = new Date(isoString);
    const offset = d.getTimezoneOffset() * 60000;
    const localDate = new Date(d.getTime() - offset);
    return localDate.toISOString().split('T')[0];
  };

  sales.forEach(s => activityDates.add(extractDate(s.timestamp)));
  expenses.forEach(e => activityDates.add(extractDate(e.timestamp)));

  // Obter data de hoje localmente
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

  return pendingDates.sort(); // Retorna as datas pendentes ordenadas
}

// ================== GESTÃO DE FIADOS / MARCADOS ==================

export async function getCreditAccounts() {
  const db = await loadDB();
  return db.creditAccounts || [];
}

export async function saveCreditAccount(account) {
  const db = await loadDB();
  if (!db.creditAccounts) db.creditAccounts = [];

  let targetAccount;
  if (account.id) {
    const idx = db.creditAccounts.findIndex(a => a.id === account.id);
    if (idx !== -1) {
      db.creditAccounts[idx] = { ...db.creditAccounts[idx], ...account };
      targetAccount = db.creditAccounts[idx];
    }
  } else {
    targetAccount = {
      ...account,
      id: Date.now().toString(),
      balance: 0,
      history: []
    };
    db.creditAccounts.push(targetAccount);
  }

  await saveDB(db);
  // Futuramente, pode sincronizar com Supabase aqui
  return db.creditAccounts;
}

export async function addCreditTransaction(accountId, type, amount, description, saleId = null, items = null, deliveryDetails = null, dueDate = null, paymentMethod = null) {
  const db = await loadDB();
  if (!db.creditAccounts) return false;

  const idx = db.creditAccounts.findIndex(a => a.id === accountId);
  if (idx === -1) return false;

  const account = db.creditAccounts[idx];
  
  const transaction = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    type, // 'charge' (compras) ou 'payment' (pagamentos)
    amount: parseFloat(amount),
    description,
    saleId,
    items,
    deliveryDetails,
    dueDate,
    paymentMethod
  };

  if (!account.history) account.history = [];
  account.history.push(transaction);

  if (type === 'charge') {
    account.balance = (account.balance || 0) + transaction.amount;
  } else if (type === 'payment') {
    account.balance = (account.balance || 0) - transaction.amount;
    // Opcional: registrar como uma entrada de caixa 'Dinheiro' ou outro se necessário,
    // mas por enquanto controlaremos no fiado.
  }

  db.creditAccounts[idx] = account;
  await saveDB(db);
  return db.creditAccounts;
}
