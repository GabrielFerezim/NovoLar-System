// Interface de comunicação com o Banco de Dados (Electron IPC + Supabase Sync)
import { supabase } from './supabase';

const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

const initialMockData = {
  products: [],
  sales: [],
  expenses: [],
  closures: [],
  syncQueue: [],
  creditAccounts: []
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

// ========================================================
// SINCRONIZAÇÃO COMPLETA DA NUVEM → LOCAL (Cloud-first)
// Chamado na inicialização para garantir que Electron e
// Vercel mostrem exatamente os mesmos dados do Supabase.
// ========================================================
export async function syncAllFromCloud() {
  try {
    // Buscar tudo do Supabase em paralelo
    const [
      resProducts,
      resSales,
      resExpenses,
      resClosures,
      resAccounts
    ] = await Promise.all([
      supabase.from('products').select('*').order('name', { ascending: true }),
      supabase.from('sales').select('*').order('timestamp', { ascending: false }),
      supabase.from('expenses').select('*').order('timestamp', { ascending: false }),
      supabase.from('closures').select('*'),
      supabase.from('credit_accounts').select('*')
    ]);

    // Validar erros - se houver erro crítico, abortamos para não apagar a base local
    if (resProducts.error) throw new Error(`Erro ao buscar produtos: ${resProducts.error.message}`);
    if (resSales.error) throw new Error(`Erro ao buscar vendas: ${resSales.error.message}`);
    if (resExpenses.error) throw new Error(`Erro ao buscar despesas: ${resExpenses.error.message}`);

    const cloudProducts = resProducts.data || [];
    const cloudSales = resSales.data || [];
    const cloudExpenses = resExpenses.data || [];

    // Fechamentos e Fiados podem não ter a tabela criada ainda (caso não tenham rodado o SQL)
    let cloudClosures = resClosures.data || [];
    if (resClosures.error) {
      if (resClosures.error.message.includes('relation "closures" does not exist')) {
        cloudClosures = [];
      } else {
        throw new Error(`Erro ao buscar fechamentos: ${resClosures.error.message}`);
      }
    }

    let cloudAccounts = resAccounts.data || [];
    if (resAccounts.error) {
      if (resAccounts.error.message.includes('relation "credit_accounts" does not exist')) {
        cloudAccounts = [];
      } else {
        throw new Error(`Erro ao buscar fiados: ${resAccounts.error.message}`);
      }
    }

    // Carregar banco local para manter a fila de sync e dados extras
    const localDb = await loadDB();

    // Transformar produtos (parse de stockLoja1/stockLoja2 do campo description)
    const products = (cloudProducts || []).map(cp => {
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
      return {
        id: String(cp.id),
        code: String(cp.code || ''),
        name: cp.name,
        description: cleanDescription,
        costPrice: parseFloat(cp.cost_price) || 0,
        salePrice: parseFloat(cp.sale_price) || 0,
        stockLoja1,
        stockLoja2,
        stock: stockLoja1 + stockLoja2,
        minStock: parseInt(cp.min_stock) || 0,
        category: cp.category || 'Materiais Básicos',
        unit: cp.unit || 'Unidade'
      };
    });

    // Transformar vendas
    const sales = (cloudSales || []).map(s => ({
      id: String(s.id),
      timestamp: s.timestamp,
      totalPrice: parseFloat(s.total_price) || 0,
      totalCost: parseFloat(s.total_cost) || 0,
      profit: parseFloat(s.profit) || 0,
      paymentMethod: s.payment_method,
      storeId: s.store_id,
      items: (s.items || []).map(item => ({
        ...item,
        productId: String(item.productId || item.id || '')
      })),
      deliveryDetails: s.delivery_details || null,
      synced: true
    }));

    // Transformar despesas
    const expenses = (cloudExpenses || []).map(e => ({
      id: String(e.id),
      timestamp: e.timestamp,
      description: e.description,
      amount: parseFloat(e.amount) || 0,
      category: e.category,
      storeId: e.store_id,
      synced: true
    }));

    // Transformar fechamentos
    const closures = (cloudClosures || []).map(c => ({
      id: String(c.id),
      storeId: c.store_id,
      date: c.date,
      closedAt: c.closed_at,
      expectedCash: parseFloat(c.expected_cash) || 0,
      actualCash: parseFloat(c.actual_cash) || 0,
      difference: parseFloat(c.difference) || 0,
      observations: c.observations
    }));

    // Transformar fiados
    const creditAccounts = (cloudAccounts || []).map(ca => ({
      id: String(ca.id),
      name: ca.name,
      address: ca.address || '',
      phone: ca.phone || '',
      balance: parseFloat(ca.balance) || 0,
      history: Array.isArray(ca.history) ? ca.history : []
    }));

    // Mesclar: cloud é a verdade, mas mantemos itens locais pendentes de sync
    const localOnlyProducts = (localDb.products || []).filter(
      lp => !products.find(p => String(p.id) === String(lp.id))
    );
    const localOnlySales = (localDb.sales || []).filter(
      ls => !ls.synced && !sales.find(s => String(s.id) === String(ls.id))
    );
    const localOnlyExpenses = (localDb.expenses || []).filter(
      le => !le.synced && !expenses.find(e => String(e.id) === String(le.id))
    );

    const mergedDb = {
      ...localDb,
      products: [...products, ...localOnlyProducts],
      sales: [...sales, ...localOnlySales],
      expenses: [...expenses, ...localOnlyExpenses],
      closures,
      creditAccounts,
      syncQueue: localDb.syncQueue || []
    };

    await saveDB(mergedDb);
    console.log('✅ Dados sincronizados da nuvem com sucesso!');
    return { success: true, data: mergedDb };
  } catch (e) {
    console.warn('⚠️ Sem conexão — usando dados locais como fallback.', e);
    return { success: false };
  }
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
  
  const currentStore = getStoreId();

  const saleProducts = saleItems.map(item => {
    const originalProduct = db.products.find(p => p.id === item.id);
    const itemCost = originalProduct ? originalProduct.costPrice : item.costPrice || 0;
    
    totalCost += itemCost * item.quantity;
    totalPrice += item.salePrice * item.quantity;
    
    // Atualizar estoque no banco local (específico por loja)
    if (originalProduct) {
      if (currentStore === 'loja-2') {
        originalProduct.stockLoja2 = Math.max(0, (originalProduct.stockLoja2 ?? 0) - item.quantity);
      } else {
        originalProduct.stockLoja1 = Math.max(0, (originalProduct.stockLoja1 ?? originalProduct.stock ?? 0) - item.quantity);
      }
      originalProduct.stock = (originalProduct.stockLoja1 ?? 0) + (originalProduct.stockLoja2 ?? 0);
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
    storeId: currentStore,
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
      store_id: currentStore,
      items: newSale.items,
      delivery_details: newSale.deliveryDetails
    });
    
    if (error) throw error;
    
    // Se deu certo, atualiza o estoque físico dos produtos na nuvem com o split correto
    for (const item of saleItems) {
      const originalProduct = db.products.find(p => p.id === item.id);
      if (originalProduct) {
        const stock1 = originalProduct.stockLoja1 ?? originalProduct.stock ?? 0;
        const stock2 = originalProduct.stockLoja2 ?? 0;
        const cleanDesc = (originalProduct.description || '').replace(/\s\[STOCKS:\d+\|\d+\]$/, '');
        const supabaseDesc = `${cleanDesc} [STOCKS:${stock1}|${stock2}]`.trim();

        await supabase.from('products').update({
          stock: originalProduct.stock,
          description: supabaseDesc
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

    // Tentar enviar atualização para a nuvem
    try {
      const { error } = await supabase
        .from('sales')
        .update({ delivery_details: db.sales[idx].deliveryDetails })
        .eq('id', saleId);
      
      if (error) throw error;

      db.sales[idx].synced = true;
      await saveDB(db);
    } catch (err) {
      console.warn("Erro ao atualizar status de entrega no Supabase (offline):", err);
      await addToSyncQueue('sale', saleId);
    }
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
          const cpId = String(cp.id);
          const idx = merged.findIndex(p => String(p.id) === cpId);
          
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
            id: cpId,
            code: String(cp.code || ''),
            name: cp.name,
            description: cleanDescription,
            costPrice: parseFloat(cp.cost_price) || 0,
            salePrice: parseFloat(cp.sale_price) || 0,
            stockLoja1,
            stockLoja2,
            stock: stockLoja1 + stockLoja2,
            minStock: parseInt(cp.min_stock) || 0,
            category: cp.category || 'Materiais Básicos',
            unit: cp.unit || 'Unidade'
          };
          
          if (idx !== -1) {
            merged[idx] = cpTransformed;
          } else {
            merged.push(cpTransformed);
          }
        });
        
        freshDb.products = merged;
        await saveDB(freshDb);

        // ===== Sync bidirecional de Contas de Fiado =====
        try {
          const { data: cloudAccounts } = await supabase
            .from('credit_accounts')
            .select('*');

          if (cloudAccounts) {
            const reloadedDb = await loadDB();
            const localAccounts = reloadedDb.creditAccounts || [];
            const mergedAccounts = [...localAccounts];

            // 1. Mesclar contas da nuvem que não existem localmente
            cloudAccounts.forEach(ca => {
              const caId = String(ca.id);
              const idx = mergedAccounts.findIndex(a => String(a.id) === caId);
              const cloudAccount = {
                id: caId,
                name: ca.name,
                address: ca.address || '',
                phone: ca.phone || '',
                balance: parseFloat(ca.balance) || 0,
                history: Array.isArray(ca.history) ? ca.history : []
              };
              if (idx === -1) {
                mergedAccounts.push(cloudAccount);
              } else {
                // Usar a versão com mais histórico (mais completa)
                const localHistory = mergedAccounts[idx].history || [];
                const cloudHistory = cloudAccount.history || [];
                if (cloudHistory.length > localHistory.length) {
                  mergedAccounts[idx] = cloudAccount;
                }
              }
            });

            // 2. Enviar para a nuvem contas locais que não estão na nuvem
            const cloudIds = new Set(cloudAccounts.map(ca => ca.id));
            for (const localAcc of localAccounts) {
              if (!cloudIds.has(localAcc.id)) {
                try {
                  await supabase.from('credit_accounts').upsert({
                    id: localAcc.id,
                    name: localAcc.name,
                    address: localAcc.address || '',
                    phone: localAcc.phone || '',
                    balance: localAcc.balance || 0,
                    history: localAcc.history || [],
                    updated_at: new Date().toISOString()
                  });
                } catch (e) {
                  console.warn('Erro ao enviar conta fiado local para nuvem:', e);
                }
              }
            }

            reloadedDb.creditAccounts = mergedAccounts;
            await saveDB(reloadedDb);
          }
        } catch (e) {
          console.warn('Erro ao sincronizar fiados com Supabase (offline):', e);
        }
        // ===== Fim do Sync de Fiados =====

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
          const { error } = await supabase.from('sales').upsert({
            id: sale.id,
            timestamp: sale.timestamp,
            total_price: sale.totalPrice,
            total_cost: sale.totalCost,
            profit: sale.profit,
            payment_method: sale.paymentMethod,
            store_id: sale.storeId || getStoreId(),
            items: sale.items,
            delivery_details: sale.deliveryDetails
          });
          if (error) throw error;
          
          // Atualiza estoques na nuvem com o split correto
          for (const item of sale.items) {
            const prod = db.products.find(p => p.id === item.productId);
            if (prod) {
              const stock1 = prod.stockLoja1 ?? prod.stock ?? 0;
              const stock2 = prod.stockLoja2 ?? 0;
              const cleanDesc = (prod.description || '').replace(/\s\[STOCKS:\d+\|\d+\]$/, '');
              const supabaseDesc = `${cleanDesc} [STOCKS:${stock1}|${stock2}]`.trim();

              await supabase.from('products').update({
                stock: prod.stock,
                description: supabaseDesc
              }).eq('id', prod.id);
            }
          }
          processedSales.push(sale.id);
        }
      }
      else if (job.type === 'expense') {
        const exp = db.expenses.find(e => e.id === job.recordId);
        if (exp) {
          const { error } = await supabase.from('expenses').upsert({
            id: exp.id,
            timestamp: exp.timestamp,
            description: exp.description,
            amount: exp.amount,
            category: exp.category,
            store_id: exp.storeId || getStoreId()
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

  // Sincronizar com Supabase
  if (targetAccount) {
    try {
      const { error } = await supabase.from('credit_accounts').upsert({
        id: targetAccount.id,
        name: targetAccount.name,
        address: targetAccount.address || '',
        phone: targetAccount.phone || '',
        balance: targetAccount.balance || 0,
        history: targetAccount.history || [],
        updated_at: new Date().toISOString()
      });
      if (error) console.warn('Erro ao sincronizar conta fiado com Supabase:', error);
    } catch (err) {
      console.warn('Offline ao salvar conta fiado:', err);
    }
  }

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
  }

  db.creditAccounts[idx] = account;
  await saveDB(db);

  // Sincronizar conta atualizada com Supabase
  try {
    const { error } = await supabase.from('credit_accounts').upsert({
      id: account.id,
      name: account.name,
      address: account.address || '',
      phone: account.phone || '',
      balance: account.balance || 0,
      history: account.history || [],
      updated_at: new Date().toISOString()
    });
    if (error) console.warn('Erro ao sincronizar transação fiado com Supabase:', error);
  } catch (err) {
    console.warn('Offline ao sincronizar transação fiado:', err);
  }

  return db.creditAccounts;
}

// Apaga TODOS os dados locais e do Supabase para começar do zero
export async function clearAllDatabase() {
  const emptyDb = {
    products: [],
    sales: [],
    expenses: [],
    closures: [],
    syncQueue: [],
    creditAccounts: []
  };

  // Salva banco vazio localmente
  await saveDB(emptyDb);

  // Deleta tudo de todas as tabelas no Supabase
  try {
    const tables = ['sales', 'expenses', 'products', 'closures', 'credit_accounts'];
    await Promise.all(
      tables.map(table => supabase.from(table).delete().neq('id', 'dummy_non_existent_id'))
    );
    console.log('✅ Supabase limpo com sucesso!');
  } catch (e) {
    console.error('Erro ao limpar Supabase:', e);
    throw e;
  }

  return emptyDb;
}
