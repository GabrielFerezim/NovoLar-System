import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  History,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Barcode,
  Plus,
  Search,
  Trash2,
  Edit3,
  Check,
  X,
  CreditCard,
  Coins,
  Smartphone,
  Info,
  Calendar,
  Layers,
  Sparkles,
  Printer,
  CheckCircle,
  Download,
  Upload,
  Database,
  Send,
  Menu,
  Truck,
  FileText,
  Bell,
  Users,
  BookOpen,
  ArrowRightLeft,
  Lock
} from 'lucide-react';
import {
  getProducts,
  saveProduct,
  deleteProduct,
  getSales,
  registerSale,
  getExpenses,
  saveExpense,
  deleteExpense,
  loadDB,
  saveDB,
  getStoreId,
  setStoreId,
  runBackgroundSync,
  syncAllFromCloud,
  updateSaleDeliveryStatus,
  getPendingClosures,
  saveClosure,
  getCreditAccounts,
  saveCreditAccount,
  addCreditTransaction,
  clearAllDatabase,
  getVaultTransactions,
  saveVaultTransaction,
  deleteVaultTransaction
} from './db';
import { FiadoCheckoutModal, CreditAccountsView } from './FiadoComponents';

export const getProductStock = (product) => {
  const store = getStoreId();
  if (store === 'loja-1') {
    return product.stockLoja1 ?? product.stock ?? 0;
  }
  return product.stockLoja2 ?? 0;
};

export default function App() {
  // Estado Global do Banco de Dados
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [creditAccounts, setCreditAccounts] = useState([]);
  const [vaultTransactions, setVaultTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Controle de Sessão de Login
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('novo_lar_is_logged_in') === 'true';
    }
    return false;
  });

  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('novo_lar_user_role') || 'admin';
  });
  const [lastSaleReceipt, setLastSaleReceipt] = useState(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedInvoiceSale, setSelectedInvoiceSale] = useState(null);

  // Estados de Controle Multi-Loja e Nuvem
  const [storeId, setStoreIdState] = useState(getStoreId());
  const [syncStatus, setSyncStatus] = useState('Conectando...');
  const [syncPendingCount, setSyncPendingCount] = useState(0);

  // Controle de Abas: 'pdv', 'daily-data', 'calendar', 'admin-products', 'admin-finance'
  const [activeTab, setActiveTab] = useState('pdv');
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auto-expandir menu de administração quando uma aba admin estiver ativa
  useEffect(() => {
    if (activeTab.startsWith('admin') && activeTab !== 'admin-deliveries') {
      setIsAdminMenuOpen(true);
    }
  }, [activeTab]);

  // Função para calcular o saldo de caixa acumulado antes de uma data específica
  const getCashBalanceAtDate = (dateString) => {
    const targetDate = new Date(dateString + 'T00:00:00');

    const priorSales = filteredSales.filter(s => {
      const saleDate = new Date(s.timestamp.split('T')[0] + 'T00:00:00');
      return saleDate < targetDate;
    });

    const priorExpenses = filteredExpenses.filter(e => {
      const expDate = new Date(e.timestamp.split('T')[0] + 'T00:00:00');
      return expDate < targetDate;
    });

    const totalPriorSales = priorSales.reduce((sum, s) => sum + s.totalPrice, 0);
    const totalPriorExpenses = priorExpenses.reduce((sum, e) => sum + e.amount, 0);

    return totalPriorSales - totalPriorExpenses;
  };

  const handleLogin = (store, role = 'admin') => {
    localStorage.setItem('novo_lar_is_logged_in', 'true');
    localStorage.setItem('novo_lar_store_id', store);
    localStorage.setItem('novo_lar_user_role', 'admin');
    setStoreId(store);
    setStoreIdState(store);
    setUserRole('admin');
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('novo_lar_is_logged_in');
    localStorage.removeItem('novo_lar_user_role');
    setIsLoggedIn(false);
  };

  const handleExportBackup = async () => {
    try {
      // Exporta diretamente do localStorage para garantir que pega tudo
      const db = await loadDB();
      const backupData = {
        exportedAt: new Date().toISOString(),
        version: '2.0',
        products: db.products || [],
        sales: db.sales || [],
        expenses: db.expenses || [],
        closures: db.closures || [],
        creditAccounts: db.creditAccounts || [],
        vaultTransactions: db.vaultTransactions || []
      };
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `novoLar_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showScanNotification('Backup exportado com sucesso!');
    } catch (err) {
      alert('Erro ao exportar backup: ' + err.message);
    }
  };

  const handleImportBackup = (e) => {
    const fileReader = new FileReader();
    const file = e.target.files[0];
    if (!file) return;
    // Limpar o input para permitir re-importar o mesmo arquivo
    e.target.value = '';

    fileReader.onload = async (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        if (!parsedData.products) {
          alert('Arquivo de backup inválido.');
          return;
        }

        if (!confirm('Deseja importar este backup? Os dados serão MESCLADOS com os dados atuais (nada será apagado).')) {
          return;
        }

        // Carrega o banco atual
        const currentDb = await loadDB();

        // Merge inteligente: só adiciona registros que ainda não existem localmente
        const mergeById = (local, incoming) => {
          const localIds = new Set(local.map(item => item.id));
          const merged = [...local];
          (incoming || []).forEach(item => {
            if (!localIds.has(item.id)) {
              merged.push(item);
            }
          });
          return merged;
        };

        const updatedDB = {
          ...currentDb,
          products: mergeById(currentDb.products || [], parsedData.products),
          sales: mergeById(currentDb.sales || [], parsedData.sales || []),
          expenses: mergeById(currentDb.expenses || [], parsedData.expenses || []),
          closures: mergeById(currentDb.closures || [], parsedData.closures || []),
          creditAccounts: mergeById(currentDb.creditAccounts || [], parsedData.creditAccounts || []),
          vaultTransactions: mergeById(currentDb.vaultTransactions || [], parsedData.vaultTransactions || []),
          syncQueue: currentDb.syncQueue || []
        };

        await saveDB(updatedDB);
        setProducts(updatedDB.products);
        setSales(updatedDB.sales);
        setExpenses(updatedDB.expenses);
        setCreditAccounts(updatedDB.creditAccounts);
        setVaultTransactions(updatedDB.vaultTransactions || []);

        // Disparar sincronização com Supabase para enviar os novos dados
        await executeSync();

        const addedProducts = updatedDB.products.length - (currentDb.products || []).length;
        const addedSales = updatedDB.sales.length - (currentDb.sales || []).length;
        const addedAccounts = updatedDB.creditAccounts.length - (currentDb.creditAccounts || []).length;

        showScanNotification(`Backup importado! +${addedProducts} produtos, +${addedSales} vendas, +${addedAccounts} contas fiado.`);
      } catch (err) {
        alert('Erro ao ler arquivo de backup: ' + err.message);
      }
    };
    fileReader.readAsText(file);
  };

  const handleResetAllData = async () => {
    const confirmText = prompt("ATENÇÃO EXTREMA: Isso irá apagar PERMANENTEMENTE todos os dados (produtos, vendas, despesas, fiados e fechamentos) locais e na nuvem.\n\nPara confirmar, digite APAGAR TUDO em maiúsculas:");
    if (confirmText !== 'APAGAR TUDO') {
      alert('Operação cancelada ou texto incorreto.');
      return;
    }

    try {
      setLoading(true);
      await clearAllDatabase();

      // Limpa os estados do React
      setProducts([]);
      setSales([]);
      setExpenses([]);
      setCreditAccounts([]);
      setVaultTransactions([]);
      setSyncPendingCount(0);

      alert('Tudo limpo! Todo o sistema e a nuvem foram zerados com sucesso.');
    } catch (err) {
      alert('Erro ao resetar o sistema: ' + err.message);
    } finally {
      setLoading(false);
    }
  };


  // Status do Scanner Global
  const [scannerActive, setScannerActive] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [scannerNotification, setScannerNotification] = useState(null);

  // Estados de Modais
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [transferProduct, setTransferProduct] = useState(null);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [closureModalOpen, setClosureModalOpen] = useState(false);
  const [closureTargetDate, setClosureTargetDate] = useState(null);
  const [pendingClosures, setPendingClosures] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Buscar dados ao iniciar
  const fetchData = async () => {
    setLoading(true);
    try {
      // O App carrega os dados locais
      const localDb = await loadDB();
      setProducts(localDb.products || []);
      setSales(localDb.sales || []);
      setExpenses(localDb.expenses || []);
      setCreditAccounts(localDb.creditAccounts || []);
      setVaultTransactions(localDb.vaultTransactions || []);
      setSyncPendingCount(0);

      const pendings = await getPendingClosures(getStoreId());
      setPendingClosures(pendings);

      // Dispara o espelhamento em background inicial
      executeSync();
    } catch (error) {
      console.error("Erro ao carregar dados locais:", error);
    } finally {
      setLoading(false);
    }
  };

  const executeSync = async () => {
    setSyncStatus('Espelhando...');
    try {
      const res = await runBackgroundSync();
      if (res.status === 'success') {
        setSyncStatus('Sincronizado');
      } else {
        setSyncStatus('Offline');
      }
    } catch (e) {
      setSyncStatus('Offline');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Sincronização/espelhamento em background a cada 30 segundos
    const timer = setInterval(() => {
      executeSync();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Notificação temporária de Scanner
  const showScanNotification = (message, type = 'success') => {
    setScannerNotification({ message, type });
    setTimeout(() => setScannerNotification(null), 3000);
  };

  // --- ESCUTADOR GLOBAL DO LEITOR DE CÓDIGO DE BARRAS ---
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e) => {
      // Ignorar teclas se o leitor estiver desativado nas configurações
      if (!scannerActive) return;
      // Ignorar teclas modificadoras
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      const delay = now - lastKeyTime;
      lastKeyTime = now;

      // Se a digitação demorar muito entre caracteres (>50ms), descarta o buffer (presume digitação manual)
      // a menos que o buffer esteja vazio (primeira tecla)
      if (delay > 50 && buffer.length > 0) {
        buffer = '';
      }

      // Adiciona números ao buffer
      if (/^[0-9]$/.test(e.key)) {
        buffer += e.key;
      }
      // Ao terminar o sinal de bip, a maioria dos leitores envia "Enter"
      else if (e.key === 'Enter') {
        if (buffer.length >= 4) {
          e.preventDefault();
          handleBarcodeScanned(buffer);
          buffer = '';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, activeTab, scannerActive]);

  // Processa o produto bipado
  const handleBarcodeScanned = (barcode) => {
    setLastScannedCode(barcode);

    // Procura o produto pelo código de barras
    const foundProduct = products.find(p => p.code === barcode);

    if (foundProduct) {
      const currentStock = getProductStock(foundProduct);
      if (currentStock <= 0) {
        showScanNotification(`Produto '${foundProduct.name}' está sem estoque nesta loja!`, 'error');
        return;
      }

      // Adiciona o produto ao carrinho do PDV
      // Se não estiver na aba do PDV, opcionalmente avisa ou muda de aba
      addToCartFromScan(foundProduct);
      showScanNotification(`Bipado: ${foundProduct.name} (R$ ${foundProduct.salePrice.toFixed(2)})`, 'success');

      // Se estiver em outra aba, avisa o usuário
      if (activeTab !== 'pdv') {
        setActiveTab('pdv');
      }
    } else {
      showScanNotification(`Código não cadastrado: ${barcode}`, 'error');
    }
  };

  // --- ESTADO DO CARRINHO PDV ---
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [amountPaid, setAmountPaid] = useState('');
  const [discount, setDiscount] = useState(0);
  const [checkoutInstallments, setCheckoutInstallments] = useState('1x');

  const addToCartFromScan = (product) => {
    const currentStock = getProductStock(product);
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        // Verifica limite de estoque
        if (existingItem.quantity >= currentStock) {
          showScanNotification(`Estoque máximo atingido para ${product.name} nesta loja`, 'error');
          return prevCart;
        }
        return prevCart.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });
  };

  const updateCartQty = (productId, delta) => {
    const pIdStr = String(productId);
    const product = products.find(p => String(p.id) === pIdStr);
    setCart(prevCart => {
      return prevCart.map(item => {
        if (String(item.id) === pIdStr) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (product && newQty > product.stock) {
            showScanNotification(`Apenas ${product.stock} unidades disponíveis no estoque.`, 'error');
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const [showFiadoModal, setShowFiadoModal] = useState(false);
  const [pendingDeliveryDetails, setPendingDeliveryDetails] = useState(null);

  const handleFiadoCheckout = async (accountId, dueDate = null) => {
    setShowFiadoModal(false);
    if (cart.length === 0) return;

    try {
      const saleItems = [...cart];
      const saleTotal = Math.max(0, saleItems.reduce((acc, item) => acc + item.salePrice * item.quantity, 0) - discount);

      const res = await registerSale(cart, 'Fiado', pendingDeliveryDetails, discount);

      const saleId = res.sales.length > 0 ? res.sales[res.sales.length - 1].id : '001';
      const updatedAccounts = await addCreditTransaction(
        accountId,
        'charge',
        saleTotal,
        'Compra Marcada (Fiado)',
        saleId,
        saleItems,
        pendingDeliveryDetails,
        dueDate
      );

      setProducts(res.products);
      setSales(res.sales);
      if (updatedAccounts) setCreditAccounts(updatedAccounts);

      setLastSaleReceipt({
        id: saleId,
        items: saleItems,
        paymentMethod: 'Fiado',
        amountPaid: 0,
        discount: discount,
        timestamp: new Date().toISOString(),
        deliveryDetails: pendingDeliveryDetails
      });

      setCart([]);
      setAmountPaid('');
      setDiscount(0);
      setCheckoutInstallments('1x');
      setPendingDeliveryDetails(null);
      showScanNotification("Venda Fiado concluída!", "success");
    } catch (error) {
      console.error("Erro no Fiado:", error);
      showScanNotification("Erro ao registrar fiado.", "error");
    }
  };

  const handleCreateCreditAccount = async (accountData) => {
    try {
      const updated = await saveCreditAccount(accountData);
      setCreditAccounts(updated);
      showScanNotification("Conta criada com sucesso!", "success");
    } catch (e) {
      console.error("Erro ao criar conta fiado:", e);
      showScanNotification("Erro ao criar conta.", "error");
    }
  };

  const handleCheckout = async (deliveryDetails = null) => {
    if (cart.length === 0) return;

    if (paymentMethod === 'Fiado') {
      setPendingDeliveryDetails(deliveryDetails);
      setShowFiadoModal(true);
      return;
    }

    try {
      const saleItems = [...cart];
      let salePayment = paymentMethod;
      if (paymentMethod === 'Crédito') {
        salePayment = `Cartão Crédito (${checkoutInstallments})`;
      } else if (paymentMethod === 'Débito') {
        salePayment = 'Cartão Débito';
      }
      const salePaid = parseFloat(amountPaid.replace(',', '.')) || 0;

      const res = await registerSale(cart, salePayment, deliveryDetails, discount);
      setProducts(res.products);
      setSales(res.sales);

      const saleId = res.sales.length > 0 ? res.sales[res.sales.length - 1].id : '001';

      setLastSaleReceipt({
        id: saleId,
        items: saleItems,
        paymentMethod: salePayment,
        amountPaid: salePaid,
        discount: discount,
        timestamp: new Date().toISOString(),
        deliveryDetails
      });

      setCart([]);
      setAmountPaid('');
      setDiscount(0);
      setCheckoutInstallments('1x');
      showScanNotification("Venda finalizada com sucesso!", "success");
    } catch (error) {
      console.error("Erro ao finalizar venda:", error);
      showScanNotification("Erro ao finalizar venda.", "error");
    }
  };

  // --- CONTROLE DE ENTREGAS ---
  const handleUpdateDeliveryStatus = async (saleId, status, deliveredAt = null) => {
    try {
      const updatedSales = await updateSaleDeliveryStatus(saleId, status, deliveredAt);
      setSales(updatedSales);
      showScanNotification(status === 'Entregue' ? "Entrega concluída!" : "Status da entrega atualizado.");
    } catch (e) {
      console.error("Erro ao atualizar entrega:", e);
      showScanNotification("Erro ao atualizar status.", "error");
    }
  };

  // --- CRUD PRODUTOS ---
  const handleSaveProduct = async (productData) => {
    try {
      const updatedProducts = await saveProduct(productData);
      setProducts(updatedProducts);
      setProductModalOpen(false);
      setEditingProduct(null);
      showScanNotification("Produto salvo com sucesso!");
    } catch (e) {
      console.error(e);
      showScanNotification("Erro ao salvar produto.", "error");
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm("Tem certeza que deseja excluir este produto?")) {
      try {
        const updatedProducts = await deleteProduct(productId);
        setProducts(updatedProducts);
        showScanNotification("Produto excluído!");
      } catch (e) {
        console.error(e);
        showScanNotification("Erro ao excluir produto.", "error");
      }
    }
  };
  // --- CRUD COFRE ---
  const handleSaveVaultTransaction = async (vtData) => {
    try {
      const updatedVault = await saveVaultTransaction(vtData);
      setVaultTransactions(updatedVault);
      showScanNotification("Movimentação do cofre registrada!");
    } catch (e) {
      console.error(e);
      showScanNotification("Erro ao registrar no cofre.", "error");
    }
  };

  const handleDeleteVaultTransaction = async (vtId) => {
    if (window.confirm("Tem certeza que deseja excluir esta movimentação do cofre?")) {
      try {
        const updatedVault = await deleteVaultTransaction(vtId);
        setVaultTransactions(updatedVault);
        showScanNotification("Movimentação do cofre excluída!");
      } catch (e) {
        console.error(e);
        showScanNotification("Erro ao excluir do cofre.", "error");
      }
    }
  };

  const handleTransferStock = async (productId, fromStore, toStore, amount) => {
    try {
      const db = await loadDB();
      const idx = db.products.findIndex(p => p.id === productId);
      if (idx !== -1) {
        const prod = db.products[idx];
        prod.stockLoja1 = prod.stockLoja1 ?? prod.stock ?? 0;
        prod.stockLoja2 = prod.stockLoja2 ?? 0;

        if (fromStore === 'loja-1') {
          prod.stockLoja1 = Math.max(0, prod.stockLoja1 - amount);
          prod.stockLoja2 = prod.stockLoja2 + amount;
        } else {
          prod.stockLoja2 = Math.max(0, prod.stockLoja2 - amount);
          prod.stockLoja1 = prod.stockLoja1 + amount;
        }

        prod.stock = prod.stockLoja1 + prod.stockLoja2;

        const updatedProducts = await saveProduct(prod);
        setProducts(updatedProducts);
        setTransferProduct(null);
        showScanNotification("Estoque transferido com sucesso!", "success");
      }
    } catch (e) {
      console.error(e);
      showScanNotification("Erro ao transferir estoque.", "error");
    }
  };

  // --- GESTÃO DESPESAS ---
  const handleSaveExpense = async (expenseData) => {
    try {
      const updatedExpenses = await saveExpense(expenseData);
      setExpenses(updatedExpenses);
      setExpenseModalOpen(false);
      showScanNotification("Despesa registrada com sucesso!");
    } catch (e) {
      console.error(e);
      showScanNotification("Erro ao registrar despesa.", "error");
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (window.confirm("Excluir esta despesa?")) {
      try {
        const updatedExpenses = await deleteExpense(expenseId);
        setExpenses(updatedExpenses);
        showScanNotification("Despesa removida!");
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Simulador de Bip (para fins de testes sem leitor físico)
  const triggerSimulatedScan = (code) => {
    handleBarcodeScanned(code);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <Barcode size={48} style={{ color: 'var(--primary)', animation: 'spin 2s linear infinite', marginBottom: '16px' }} />
          <h2>Carregando Novo Lar...</h2>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginView onLogin={handleLogin} />;
  }

  // Estatísticas e KPI Computados (filtrados por loja logada)
  const filteredSales = sales.filter(s => s.storeId === storeId && s.paymentMethod !== 'Fiado');
  const filteredExpenses = expenses.filter(e => e.storeId === storeId);

  // =====================================
  // GERAÇÃO DE NOTIFICAÇÕES (Dropdown)
  // =====================================
  const notifications = [];

  // Datas base para cálculo
  const todayDateObj = new Date();
  const todayOffset = todayDateObj.getTimezoneOffset() * 60000;
  const todayStr = new Date(todayDateObj.getTime() - todayOffset).toISOString().split('T')[0];

  const tomorrowDateObj = new Date(todayDateObj);
  tomorrowDateObj.setDate(tomorrowDateObj.getDate() + 1);
  const tomorrowStr = new Date(tomorrowDateObj.getTime() - (tomorrowDateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

  // 1. Notificações de Fechamento de Caixa
  pendingClosures.forEach(date => {
    notifications.push({
      id: `closure-${date}`,
      type: 'closure',
      icon: <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />,
      title: 'Caixa Aberto',
      message: `O caixa do dia ${date.split('-').reverse().join('/')} não foi fechado.`,
      onClick: () => {
        setClosureTargetDate(date);
        setClosureModalOpen(true);
        setIsNotificationsOpen(false);
      }
    });
  });

  // 2. Notificações de Entregas Pendentes
  sales.filter(s => s.storeId === storeId).forEach(sale => {
    if (sale.deliveryDetails && sale.deliveryDetails.requiresDelivery && sale.deliveryDetails.status !== 'delivered' && sale.deliveryDetails.status !== 'Entregue') {
      const delDate = sale.deliveryDetails.date;
      if (delDate === todayStr) {
        notifications.push({
          id: `del-${sale.id}`,
          type: 'delivery_today',
          icon: <Truck size={18} style={{ color: 'var(--brand-yellow)' }} />,
          title: 'Entrega para Hoje!',
          message: `Pedido #${sale.id.substring(sale.id.length - 4)} para ${sale.deliveryDetails.receiver || 'Cliente'}.`,
          onClick: () => {
            setActiveTab('admin-deliveries');
            setIsNotificationsOpen(false);
          }
        });
      } else if (delDate === tomorrowStr) {
        notifications.push({
          id: `del-${sale.id}`,
          type: 'delivery_tomorrow',
          icon: <Package size={18} style={{ color: 'var(--primary)' }} />,
          title: 'Entrega Amanhã',
          message: `Prepare o pedido #${sale.id.substring(sale.id.length - 4)} para ${sale.deliveryDetails.receiver || 'Cliente'}.`,
          onClick: () => {
            setActiveTab('admin-deliveries');
            setIsNotificationsOpen(false);
          }
        });
      } else if (delDate && delDate < todayStr) {
        notifications.push({
          id: `del-${sale.id}`,
          type: 'delivery_late',
          icon: <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />,
          title: 'Entrega Atrasada',
          message: `O pedido #${sale.id.substring(sale.id.length - 4)} estava agendado para ${delDate.split('-').reverse().join('/')}.`,
          onClick: () => {
            setActiveTab('admin-deliveries');
            setIsNotificationsOpen(false);
          }
        });
      }
    }
  });

  // 3. Notificações de Fiados Atrasados
  creditAccounts.forEach(account => {
    if (!account.history || account.balance <= 0) return;

    const charges = account.history.filter(t => t.type === 'charge' && t.dueDate);
    if (charges.length === 0) return;

    const sortedCharges = charges.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const oldestDue = sortedCharges[0].dueDate;

    if (oldestDue && oldestDue < todayStr) {
      notifications.push({
        id: `fiado-late-${account.id}`,
        type: 'fiado_late',
        icon: <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />,
        title: 'Fiado Atrasado!',
        message: `${account.name} possui débito vencido desde ${oldestDue.split('-').reverse().join('/')} (Saldo: R$ ${account.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
        onClick: () => {
          setActiveTab('credit-accounts');
          setIsNotificationsOpen(false);
        }
      });
    }
  });

  const totalSalesValue = filteredSales.reduce((sum, s) => sum + s.totalPrice, 0);
  const totalProfitValue = filteredSales.reduce((sum, s) => sum + s.profit, 0);
  const totalExpensesValue = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalVaultDeposits = vaultTransactions.filter(vt => vt.storeId === storeId && vt.type === 'deposit').reduce((sum, vt) => sum + vt.amount, 0);
  const totalVaultWithdrawals = vaultTransactions.filter(vt => vt.storeId === storeId && vt.type === 'withdrawal').reduce((sum, vt) => sum + vt.amount, 0);
  const netCash = totalSalesValue - totalExpensesValue - totalVaultDeposits + totalVaultWithdrawals;
  const lowStockCount = products.filter(p => getProductStock(p) <= p.minStock).length;

  const handleClosure = async (closureData) => {
    try {
      await saveClosure(closureData);
      if (closureData.sangriaAmount > 0) {
        await handleSaveVaultTransaction({
          type: 'deposit',
          amount: closureData.sangriaAmount,
          description: `Sangria automática via Fechamento de Caixa do dia ${closureData.date.split('-').reverse().join('/')}`,
          date: closureData.date,
          storeId: storeId
        });
      }
      showScanNotification(`Caixa fechado para o dia ${closureData.date}`);
      setClosureModalOpen(false);
      setClosureTargetDate(null);
      const pendings = await getPendingClosures(storeId);
      setPendingClosures(pendings);
    } catch (e) {
      console.error("Erro ao fechar caixa:", e);
      showScanNotification("Erro ao fechar caixa", "error");
    }
  };

  return (
    <div className="app-container">
      {/* Backdrop do menu mobile */}
      {isMobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            zIndex: 998,
            animation: 'fadeIn 0.2s ease-out'
          }}
        />
      )}

      {/* Sidebar Lateral */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand" style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
          <img src="logo.png" alt="Novo Lar Logo" style={{ width: '100%', maxWidth: '180px', height: 'auto', objectFit: 'contain' }} />
        </div>

        <nav className="sidebar-menu">
          <li>
            <button
              className={`menu-item-btn ${activeTab === 'pdv' ? 'active' : ''}`}
              onClick={() => { setActiveTab('pdv'); setIsMobileMenuOpen(false); }}
            >
              <ShoppingBag size={20} />
              Frente de Caixa (PDV)
            </button>
          </li>
          <li>
            <button
              className={`menu-item-btn ${activeTab === 'daily-data' ? 'active' : ''}`}
              onClick={() => { setActiveTab('daily-data'); setIsMobileMenuOpen(false); }}
            >
              <LayoutDashboard size={20} />
              Dados Diários (Hoje)
            </button>
          </li>
          <li>
            <button
              className={`menu-item-btn ${activeTab === 'calendar' ? 'active' : ''}`}
              onClick={() => { setActiveTab('calendar'); setIsMobileMenuOpen(false); }}
            >
              <Calendar size={20} />
              Relatórios por Calendário
            </button>
          </li>
          <li>
            <button
              className={`menu-item-btn ${activeTab === 'credit-accounts' ? 'active' : ''}`}
              onClick={() => { setActiveTab('credit-accounts'); setIsMobileMenuOpen(false); }}
            >
              <BookOpen size={20} />
              Contas Marcadas (Fiado)
            </button>
          </li>
          <li>
            <button
              className={`menu-item-btn ${activeTab === 'admin-deliveries' ? 'active' : ''}`}
              onClick={() => { setActiveTab('admin-deliveries'); setIsMobileMenuOpen(false); }}
            >
              <Truck size={20} />
              Controle de Entregas
            </button>
          </li>
          <li>
            <button
              className={`menu-item-btn ${(activeTab.startsWith('admin') && activeTab !== 'admin-deliveries') ? 'active' : ''}`}
              onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={20} />
                <span>Administração</span>
              </div>
              <span style={{ fontSize: '10px', transform: isAdminMenuOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
            </button>

            {isAdminMenuOpen && (
              <ul className="sidebar-submenu" style={{ listStyle: 'none', paddingLeft: '16px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li>
                  <button
                    className={`submenu-item-btn ${activeTab === 'admin-products' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('admin-products'); setIsMobileMenuOpen(false); }}
                  >
                    <Package size={16} />
                    Cadastrar Produtos
                  </button>
                </li>
                <li>
                  <button
                    className={`submenu-item-btn ${activeTab === 'admin-finance' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('admin-finance'); setIsMobileMenuOpen(false); }}
                  >
                    <TrendingUp size={16} />
                    Controle Geral
                  </button>
                </li>
                <li>
                  <button
                    className={`submenu-item-btn ${activeTab === 'admin-insights' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('admin-insights'); setIsMobileMenuOpen(false); }}
                  >
                    <Sparkles size={16} />
                    Insights (IA)
                  </button>
                </li>
                <li>
                  <button
                    className={`submenu-item-btn ${activeTab === 'admin-vault' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('admin-vault'); setIsMobileMenuOpen(false); }}
                  >
                    <Lock size={16} />
                    Controle do Cofre
                  </button>
                </li>
              </ul>
            )}
          </li>
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="status-badge" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div
                  className="status-dot"
                  style={{
                    backgroundColor: syncStatus === 'Sincronizado'
                      ? 'var(--success)'
                      : (syncStatus === 'Espelhando...' ? 'var(--brand-yellow)' : 'var(--text-muted)')
                  }}
                ></div>
                <span style={{ fontWeight: '600', fontSize: '12px' }}>
                  Banco Local Ativo
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span>Nuvem: <strong>{syncStatus}</strong></span>
                <button
                  onClick={executeSync}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: 'var(--brand-primary)',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '0',
                    textDecoration: 'underline'
                  }}
                  title="Forçar espelhamento agora"
                >
                  Sincronizar
                </button>
              </div>
            </div>

            {/* Terminal Logado e Botão de Logout */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '0 2px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)' }}>Terminal Logado:</div>
              <div style={{
                padding: '6px 10px',
                fontSize: '13px',
                fontWeight: '700',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)' }}></div>
                {storeId === 'loja-1' ? 'Loja 1 - Matriz' : 'Loja 2 - Filial'}
              </div>
              <button
                onClick={handleLogout}
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--danger)',
                  backgroundColor: 'var(--danger-glow)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginTop: '4px'
                }}
              >
                <X size={14} /> Sair do Terminal
              </button>
            </div>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '6px 0 0 0', borderTop: '1px solid var(--border-color)', marginTop: '4px' }}>
            v1.1.0 • Multi-Loja Nuvem
          </div>
        </div>
      </aside>

      {/* Área Principal de Conteúdo */}
      <main className="main-content">
        {/* Top Header */}
        <header className="top-header" style={{ display: 'flex', alignItems: 'center' }}>
          {/* Botão Hambúrguer Mobile */}
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              padding: '8px',
              marginRight: '8px',
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Menu size={24} />
          </button>

          <div className="header-title-container" style={{ flexGrow: 1 }}>
            <h1 className="header-title">
              {activeTab === 'daily-data' && 'Dados Diários (Hoje)'}
              {activeTab === 'calendar' && 'Calendário de Relatórios'}
              {activeTab === 'pdv' && 'Frente de Caixa / Checkout'}
              {activeTab === 'admin-insights' && 'Insights Comerciais (IA)'}
              {activeTab === 'admin-products' && 'Administração: Produtos & Estoque'}
              {activeTab === 'credit-accounts' && 'Gestão de Contas (Fiados)'}
              {activeTab === 'admin-finance' && 'Administração: Controle Geral & Rede'}
              {activeTab === 'admin-deliveries' && 'Administração: Controle de Entregas'}
              {activeTab === 'admin-vault' && 'Administração: Controle do Cofre'}
            </h1>
            <span className="header-subtitle">
              {activeTab === 'daily-data' && 'Acompanhamento do faturamento, lucros e despesas de hoje'}
              {activeTab === 'calendar' && 'Selecione qualquer data no calendário para extrair relatórios históricos'}
              {activeTab === 'pdv' && 'Adicione produtos bipando ou digitando o código de barras'}
              {activeTab === 'admin-insights' && 'Análise de vendas, priorização de compras por lucro e diagnóstico de mercado'}
              {activeTab === 'admin-products' && 'Cadastrar, edite e gerencie o estoque mínimo dos produtos'}
              {activeTab === 'credit-accounts' && 'Acompanhe as dívidas e pagamentos dos seus clientes de confiança'}
              {activeTab === 'admin-finance' && 'Controle financeiro consolidado de faturamento, lucros, gráficos e rede ao vivo'}
              {activeTab === 'admin-deliveries' && 'Painel de expedição de pedidos para entrega física e geração de Notas Fiscais'}
              {activeTab === 'admin-vault' && 'Rastreamento de sangrias em dinheiro físico enviadas ou retiradas do cofre seguro'}
            </span>
          </div>

          <div className="header-actions">
            {/* Sino de Notificações (Dropdown) */}
            <div style={{ position: 'relative' }}>
              <div
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                title={notifications.length > 0 ? `Existem ${notifications.length} nova(s) notificação(ões)` : 'Sem notificações'}
              >
                <Bell size={24} style={{ color: 'var(--text-primary)', animation: notifications.length > 0 ? 'pulse 2s infinite' : 'none' }} />
                {notifications.length > 0 && (
                  <span style={{ position: 'absolute', top: 0, right: 0, backgroundColor: 'var(--danger)', color: '#fff', fontSize: '10px', fontWeight: 'bold', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {notifications.length}
                  </span>
                )}
              </div>

              {/* Dropdown Menu de Notificações */}
              {isNotificationsOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  width: '320px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  zIndex: 2000,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: '700', fontSize: '14px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Notificações
                    <span style={{ fontSize: '11px', backgroundColor: 'var(--primary)', color: '#fff', padding: '2px 8px', borderRadius: '12px' }}>{notifications.length} Novas</span>
                  </div>

                  <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        <CheckCircle size={32} style={{ color: 'var(--success)', opacity: 0.5, margin: '0 auto 8px auto' }} />
                        <br />Tudo tranquilo por aqui!<br />Nenhuma notificação pendente.
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          onClick={notif.onClick}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'flex-start',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <div style={{ marginTop: '2px' }}>{notif.icon}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px', color: 'var(--text-primary)' }}>{notif.title}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{notif.message}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {(activeTab === 'admin-products' || activeTab === 'products') && (
              <button className="btn-primary" style={{ padding: '10px 16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => { setEditingProduct(null); setProductModalOpen(true); }}>
                <Plus size={16} /> <span className="btn-text-responsive">Cadastrar Produto</span>
              </button>
            )}

            {(activeTab === 'admin-finance' || activeTab === 'history') && (
              <button className="btn-primary" style={{ padding: '10px 16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setExpenseModalOpen(true)}>
                <Plus size={16} /> <span className="btn-text-responsive">Registrar Despesa</span>
              </button>
            )}

            {(activeTab === 'daily-data' || activeTab === 'pdv') && (
              <button
                className="btn-primary"
                style={{ padding: '10px 16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--brand-yellow)', color: '#000' }}
                onClick={() => {
                  const d = new Date();
                  const offset = d.getTimezoneOffset() * 60000;
                  const todayStr = new Date(d.getTime() - offset).toISOString().split('T')[0];
                  setClosureTargetDate(todayStr);
                  setClosureModalOpen(true);
                }}
              >
                <CheckCircle size={16} /> <span className="btn-text-responsive">Fechar Caixa (Hoje)</span>
              </button>
            )}
          </div>
        </header>

        {/* Notificação Flutuante do Scanner */}
        {scannerNotification && (
          <div style={{
            position: 'absolute',
            top: '80px',
            right: '24px',
            zIndex: 1000,
            backgroundColor: scannerNotification.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-md)',
            fontWeight: '600',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'modalFadeIn 0.2s ease-out'
          }}>
            {scannerNotification.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
            {scannerNotification.message}
          </div>
        )}

        {/* Renderização Condicional de Telas */}
        <div className="page-container">
          {activeTab === 'daily-data' && (
            <DailyDashboardView
              sales={filteredSales}
              expenses={filteredExpenses}
              products={products}
              vaultTransactions={vaultTransactions}
              storeId={storeId}
              onSimulateScan={triggerSimulatedScan}
              onChangeTab={setActiveTab}
              getCashBalanceAtDate={getCashBalanceAtDate}
            />
          )}

          {activeTab === 'pdv' && (
            <PDVView
              products={products}
              cart={cart}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              amountPaid={amountPaid}
              setAmountPaid={setAmountPaid}
              onUpdateCartQty={updateCartQty}
              onRemoveFromCart={removeFromCart}
              onCheckout={handleCheckout}
              onSimulateScan={triggerSimulatedScan}
              onQuickRegister={(virtualProduct) => {
                setEditingProduct(virtualProduct);
                setProductModalOpen(true);
              }}
              currentCashBalance={netCash}
              onAddToCart={addToCartFromScan}
              discount={discount}
              setDiscount={setDiscount}
              checkoutInstallments={checkoutInstallments}
              setCheckoutInstallments={setCheckoutInstallments}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarReportsView
              sales={filteredSales}
              expenses={filteredExpenses}
              getCashBalanceAtDate={getCashBalanceAtDate}
            />
          )}

          {activeTab === 'admin-insights' && (
            <AIAssistantView
              products={products}
              sales={filteredSales}
              expenses={filteredExpenses}
            />
          )}

          {activeTab === 'credit-accounts' && (
            <CreditAccountsView
              creditAccounts={creditAccounts}
              onCreateAccount={async (acc) => {
                const updated = await saveCreditAccount(acc);
                setCreditAccounts(updated);
              }}
              onAddTransaction={async (accountId, type, amount, description, paymentMethod = 'Dinheiro') => {
                let saleId = null;
                let fakeItems = null;

                if (type === 'payment') {
                  const client = creditAccounts.find(a => a.id === accountId);
                  const clientName = client ? client.name : 'Cliente';
                  fakeItems = [{
                    id: `rec-${Date.now()}`,
                    name: `Recebimento Fiado - ${clientName}`,
                    quantity: 1,
                    salePrice: amount,
                    costPrice: 0
                  }];
                  const res = await registerSale(fakeItems, paymentMethod, null);
                  setProducts(res.products);
                  setSales(res.sales);

                  saleId = res.sales.length > 0 ? res.sales[res.sales.length - 1].id : `R-${Date.now().toString().slice(-4)}`;

                  // Abrir cupom fiscal na tela para impressão do pagamento
                  setLastSaleReceipt({
                    id: saleId,
                    items: fakeItems,
                    paymentMethod: paymentMethod,
                    amountPaid: paymentMethod === 'Dinheiro' ? amount : 0,
                    timestamp: new Date().toISOString(),
                    deliveryDetails: null
                  });
                }

                const updated = await addCreditTransaction(
                  accountId,
                  type,
                  amount,
                  description,
                  saleId,
                  fakeItems,
                  null,
                  null,
                  paymentMethod
                );

                if (updated) {
                  setCreditAccounts(updated);
                }
              }}
              onViewReceipt={(receipt) => setLastSaleReceipt(receipt)}
            />
          )}

          {activeTab === 'admin-products' && (
            <ProductsView
              products={products}
              onEditProduct={(p) => { setEditingProduct(p); setProductModalOpen(true); }}
              onDeleteProduct={handleDeleteProduct}
              onTransferStock={(p) => setTransferProduct(p)}
            />
          )}

          {activeTab === 'admin-finance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <DashboardView
                products={products}
                sales={filteredSales}
                expenses={filteredExpenses}
                totalSales={totalSalesValue}
                totalProfit={totalProfitValue}
                totalExpenses={totalExpensesValue}
                netCash={netCash}
                lowStockCount={lowStockCount}
                onSimulateScan={triggerSimulatedScan}
                onChangeTab={setActiveTab}
                onExportBackup={handleExportBackup}
                onImportBackup={handleImportBackup}
                onResetAllData={handleResetAllData}
              />
              <HistoryExpensesView
                sales={filteredSales}
                expenses={filteredExpenses}
                onDeleteExpense={handleDeleteExpense}
              />
            </div>
          )}

          {activeTab === 'admin-deliveries' && (
            <DeliveriesView
              sales={sales}
              onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
              onGenerateInvoice={(sale) => {
                setSelectedInvoiceSale(sale);
                setInvoiceModalOpen(true);
              }}
            />
          )}

          {activeTab === 'admin-vault' && (
            <VaultView
              vaultTransactions={vaultTransactions}
              onDeleteVaultTransaction={handleDeleteVaultTransaction}
              storeId={storeId}
            />
          )}
        </div>
      </main>

      {/* MODAL DE CADASTRO/EDIÇÃO DE PRODUTO */}
      {productModalOpen && (
        <ProductModal
          product={editingProduct}
          onClose={() => { setProductModalOpen(false); setEditingProduct(null); }}
          onSave={handleSaveProduct}
        />
      )}

      {/* MODAL DE TRANSFERÊNCIA DE ESTOQUE */}
      {transferProduct && (
        <TransferStockModal
          product={transferProduct}
          onClose={() => setTransferProduct(null)}
          onConfirm={handleTransferStock}
        />
      )}

      {/* MODAL DE CADASTRO DE DESPESA */}
      {expenseModalOpen && (
        <ExpenseModal
          onClose={() => setExpenseModalOpen(false)}
          onSave={handleSaveExpense}
        />
      )}

      {/* MODAL DE RECIBO DE VENDA */}
      {lastSaleReceipt && (
        <ReceiptModal
          receipt={lastSaleReceipt}
          onClose={() => setLastSaleReceipt(null)}
        />
      )}

      {/* MODAL DE CHECKOUT FIADO */}
      {showFiadoModal && (
        <FiadoCheckoutModal
          creditAccounts={creditAccounts}
          onConfirm={handleFiadoCheckout}
          onClose={() => setShowFiadoModal(false)}
          onCreateAccount={handleCreateCreditAccount}
        />
      )}

      {/* MODAL DE NOTA FISCAL (DANFE SIMPLIFICADA) */}
      {invoiceModalOpen && selectedInvoiceSale && (
        <InvoiceModal
          sale={selectedInvoiceSale}
          onClose={() => { setInvoiceModalOpen(false); setSelectedInvoiceSale(null); }}
        />
      )}

      {/* MODAL DE FECHAMENTO DE CAIXA */}
      {closureModalOpen && (
        <ClosureModal
          date={closureTargetDate}
          sales={sales.filter(s => s.paymentMethod !== 'Fiado')}
          expenses={expenses}
          storeId={storeId}
          vaultTransactions={vaultTransactions}
          onClose={() => { setClosureModalOpen(false); setClosureTargetDate(null); }}
          onSave={handleClosure}
        />
      )}
    </div>
  );
}

// ==========================================
// 1. TELA: DASHBOARD VIEW
// ==========================================
function DashboardView({
  products,
  sales,
  expenses,
  totalSales,
  totalProfit,
  totalExpenses,
  netCash,
  lowStockCount,
  onSimulateScan,
  onChangeTab,
  onExportBackup,
  onImportBackup,
  onResetAllData
}) {
  const [viewMode, setViewMode] = useState('local'); // 'local' ou 'consolidated'
  const [cloudStoreFilter, setCloudStoreFilter] = useState('all'); // 'all', 'loja-1', 'loja-2'
  const [timeRange, setTimeRange] = useState('month'); // 'month', 'year', 'all'
  const [cloudSales, setCloudSales] = useState([]);
  const [cloudExpenses, setCloudExpenses] = useState([]);
  const [loadingCloud, setLoadingCloud] = useState(false);

  useEffect(() => {
    if (viewMode === 'consolidated') {
      const fetchCloudData = async () => {
        setLoadingCloud(true);
        try {
          const { data: sData, error: sErr } = await supabase.from('sales').select('*');
          const { data: eData, error: eErr } = await supabase.from('expenses').select('*');

          if (!sErr && sData) {
            setCloudSales(sData.map(s => ({
              id: s.id,
              timestamp: s.timestamp,
              totalPrice: parseFloat(s.total_price),
              totalCost: parseFloat(s.total_cost),
              profit: parseFloat(s.profit),
              paymentMethod: s.payment_method,
              storeId: s.store_id,
              items: s.items
            })));
          }
          if (!eErr && eData) {
            setCloudExpenses(eData.map(e => ({
              id: e.id,
              timestamp: e.timestamp,
              description: e.description,
              amount: parseFloat(e.amount),
              category: e.category,
              storeId: e.store_id
            })));
          }
        } catch (err) {
          console.error("Erro ao carregar dados consolidados", err);
        } finally {
          setLoadingCloud(false);
        }
      };
      fetchCloudData();
    }
  }, [viewMode]);

  const activeSales = viewMode === 'consolidated'
    ? (cloudStoreFilter === 'all' ? cloudSales : cloudSales.filter(s => s.storeId === cloudStoreFilter))
    : sales;
  const activeExpenses = viewMode === 'consolidated'
    ? (cloudStoreFilter === 'all' ? cloudExpenses : cloudExpenses.filter(e => e.storeId === cloudStoreFilter))
    : expenses;

  // Filtragem por período
  const getFilteredDataByRange = (items) => {
    const today = new Date();
    return items.filter(item => {
      const itemDate = new Date(item.timestamp);
      if (timeRange === 'month') {
        return itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear();
      } else if (timeRange === 'year') {
        return itemDate.getFullYear() === today.getFullYear();
      }
      return true; // 'all'
    });
  };

  const rangedSales = getFilteredDataByRange(activeSales);
  const rangedExpenses = getFilteredDataByRange(activeExpenses);

  const activeTotalSales = rangedSales.reduce((sum, s) => sum + s.totalPrice, 0);
  const activeTotalProfit = rangedSales.reduce((sum, s) => sum + s.profit, 0);
  const activeTotalExpenses = rangedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const activeNetCash = activeTotalSales - activeTotalExpenses;

  const lowStockItems = products.filter(p => getProductStock(p) <= p.minStock);

  // Agrupar faturamento dinamicamente para o gráfico com base no período
  const getDynamicChartData = () => {
    if (timeRange === 'year') {
      const monthNamesShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const currentYear = new Date().getFullYear();
      const data = monthNamesShort.map((monthName, idx) => ({
        label: monthName,
        amount: 0,
        monthIdx: idx
      }));

      rangedSales.forEach(sale => {
        const d = new Date(sale.timestamp);
        if (d.getFullYear() === currentYear) {
          data[d.getMonth()].amount += sale.totalPrice;
        }
      });

      const maxVal = Math.max(...data.map(d => d.amount), 100);
      return data.map(d => ({
        dayLabel: d.label,
        amount: d.amount,
        percentage: (d.amount / maxVal) * 100
      }));
    } else if (timeRange === 'month') {
      const data = [
        { label: 'Sem 1 (1-7)', amount: 0, range: [1, 7] },
        { label: 'Sem 2 (8-14)', amount: 0, range: [8, 14] },
        { label: 'Sem 3 (15-21)', amount: 0, range: [15, 21] },
        { label: 'Sem 4 (22-28)', amount: 0, range: [22, 28] },
        { label: 'Sem 5 (29+)', amount: 0, range: [29, 31] }
      ];

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      rangedSales.forEach(sale => {
        const d = new Date(sale.timestamp);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          const dateDay = d.getDate();
          const match = data.find(w => dateDay >= w.range[0] && dateDay <= w.range[1]);
          if (match) {
            match.amount += sale.totalPrice;
          }
        }
      });

      const maxVal = Math.max(...data.map(d => d.amount), 100);
      return data.map(d => ({
        dayLabel: d.label,
        amount: d.amount,
        percentage: (d.amount / maxVal) * 100
      }));
    } else {
      const data = [];
      const d = new Date();
      const monthNamesShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      for (let i = 5; i >= 0; i--) {
        const tempDate = new Date();
        tempDate.setMonth(d.getMonth() - i);
        data.push({
          label: `${monthNamesShort[tempDate.getMonth()]}`,
          month: tempDate.getMonth(),
          year: tempDate.getFullYear(),
          amount: 0
        });
      }

      activeSales.forEach(sale => {
        const sDate = new Date(sale.timestamp);
        const match = data.find(d => d.month === sDate.getMonth() && d.year === sDate.getFullYear());
        if (match) {
          match.amount += sale.totalPrice;
        }
      });

      const maxVal = Math.max(...data.map(d => d.amount), 100);
      return data.map(d => ({
        dayLabel: d.label,
        amount: d.amount,
        percentage: (d.amount / maxVal) * 100
      }));
    }
  };

  const chartData = getDynamicChartData();

  return (
    <>
      {/* Seletor de visualização (Faturamento Local vs Rede Consolidadado) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 18px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '4px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Modo do Painel:
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {viewMode === 'local' ? 'Exibindo dados apenas desta loja física' : 'Exibindo faturamento consolidado de todas as lojas ao vivo'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--bg-tertiary)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
            <button
              onClick={() => setViewMode('local')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: viewMode === 'local' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'local' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
            >
              Esta Loja (Local)
            </button>
            <button
              onClick={() => setViewMode('consolidated')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: viewMode === 'consolidated' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'consolidated' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
            >
              Rede (Ao Vivo)
            </button>
          </div>

          {viewMode === 'consolidated' && (
            <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--bg-tertiary)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary-glow)' }}>
              <button
                onClick={() => setCloudStoreFilter('all')}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: cloudStoreFilter === 'all' ? 'var(--primary)' : 'transparent',
                  color: cloudStoreFilter === 'all' ? '#000' : 'var(--text-secondary)',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
              >
                Todas as Lojas
              </button>
              <button
                onClick={() => setCloudStoreFilter('loja-1')}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: cloudStoreFilter === 'loja-1' ? 'var(--primary)' : 'transparent',
                  color: cloudStoreFilter === 'loja-1' ? '#000' : 'var(--text-secondary)',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
              >
                Loja 1
              </button>
              <button
                onClick={() => setCloudStoreFilter('loja-2')}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: cloudStoreFilter === 'loja-2' ? 'var(--primary)' : 'transparent',
                  color: cloudStoreFilter === 'loja-2' ? '#000' : 'var(--text-secondary)',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
              >
                Loja 2
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Seletor de Período (Mês Atual, Ano Atual, Todo o Período) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 18px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px',
        marginTop: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Período de Análise:
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Filtrar faturamento, lucros e despesas do controle geral
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--bg-tertiary)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
          <button
            onClick={() => setTimeRange('month')}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: timeRange === 'month' ? 'var(--bg-card)' : 'transparent',
              color: timeRange === 'month' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
          >
            Mês Atual
          </button>
          <button
            onClick={() => setTimeRange('year')}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: timeRange === 'year' ? 'var(--bg-card)' : 'transparent',
              color: timeRange === 'year' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
          >
            Ano Atual
          </button>
          <button
            onClick={() => setTimeRange('all')}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: timeRange === 'all' ? 'var(--bg-card)' : 'transparent',
              color: timeRange === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
          >
            Todo o Período
          </button>
        </div>
      </div>

      {loadingCloud && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '8px',
          color: 'var(--primary)',
          fontWeight: '600',
          fontSize: '13px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--primary-glow)',
          boxShadow: 'var(--shadow-sm)',
          animation: 'pulse 2s infinite'
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)', animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }}></div>
          Buscando novas vendas na nuvem...
        </div>
      )}

      {/* Grid de KPIs */}
      <div className="dashboard-summary-grid">
        <div className="kpi-card sales">
          <div className="kpi-icon-wrapper">
            <TrendingUp size={24} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Faturamento Período</span>
            <span className="kpi-value">R$ {activeTotalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="kpi-card profit">
          <div className="kpi-icon-wrapper">
            <DollarSign size={24} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">{viewMode === 'consolidated' ? 'Lucro Rede Período' : 'Lucro Período'}</span>
            <span className="kpi-value" style={{ color: 'var(--success)' }}>
              R$ {activeTotalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="kpi-card expenses">
          <div className="kpi-icon-wrapper">
            <DollarSign size={24} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Gastos & Despesas</span>
            <span className="kpi-value" style={{ color: 'var(--danger)' }}>
              R$ {activeTotalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="kpi-card low-stock" style={{ borderColor: lowStockCount > 0 ? 'rgba(216, 45, 51, 0.3)' : 'var(--border-color)' }}>
          <div className="kpi-icon-wrapper">
            <AlertTriangle size={24} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Estoque Baixo</span>
            <span className="kpi-value" style={{ color: lowStockCount > 0 ? 'var(--brand-red)' : 'inherit' }}>
              {lowStockCount} {lowStockCount === 1 ? 'Produto' : 'Produtos'}
            </span>
          </div>
        </div>
      </div>



      {/* Gráfico & Alertas */}
      <div className="dashboard-details-grid">
        {/* Painel Esquerdo: Faturamento */}
        <div className="section-card">
          <div className="card-header">
            <h2 className="card-title">
              <TrendingUp size={20} className="brand-icon" style={{ color: 'var(--primary)' }} />
              Evolução das Vendas (Faturamento)
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {timeRange === 'month' && 'Semanas do Mês Atual'}
              {timeRange === 'year' && 'Meses do Ano Atual'}
              {timeRange === 'all' && 'Últimos 6 Meses'}
            </span>
          </div>

          <div className="chart-container">
            {chartData.map((d, index) => (
              <div key={index} className="chart-bar-wrapper">
                <div
                  className="chart-bar-fill"
                  style={{ height: `${d.percentage}%` }}
                >
                  <div className="chart-tooltip">R$ {d.amount.toFixed(2)}</div>
                </div>
                <span className="chart-label" style={{ fontSize: '10px' }}>{d.dayLabel}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            <span>Saldo Líquido Período: <strong style={{ color: activeNetCash >= 0 ? 'var(--success)' : 'var(--danger)' }}>R$ {activeNetCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
            <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => onChangeTab('admin-finance')}>Atualizar Vista</button>
          </div>
        </div>

        {/* Painel Direito: Estoque Baixo */}
        <div className="section-card">
          <div className="card-header">
            <h2 className="card-title" style={{ color: lowStockCount > 0 ? 'var(--brand-red)' : 'var(--text-primary)' }}>
              <AlertTriangle size={20} />
              Estoque Crítico / Reposição
            </h2>
            <span className="badge badge-danger">{lowStockCount}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '200px' }}>
            {lowStockItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                <Check size={28} style={{ color: 'var(--success)', marginBottom: '8px' }} />
                <p style={{ fontSize: '13px' }}>Todos os produtos estão com estoque saudável!</p>
              </div>
            ) : (
              lowStockItems.map(item => (
                <div key={item.id} className="stock-alert-item">
                  <div className="stock-alert-info">
                    <span className="stock-alert-name">{item.name}</span>
                    <span className="stock-alert-qty">Estoque: {item.stock} {item.unit} (Mín: {item.minStock})</span>
                  </div>
                  <span className="stock-alert-badge">Comprar</span>
                </div>
              ))
            )}
          </div>
          {lowStockItems.length > 0 && (
            <button className="btn-secondary" onClick={() => onChangeTab('admin-products')} style={{ width: '100%', fontSize: '13px' }}>
              Ir para Inventário
            </button>
          )}
        </div>
      </div>

      {/* Painel de Vendas Recentes da Rede (Apenas modo Consolidado) */}
      {viewMode === 'consolidated' && (
        <div className="section-card" style={{ marginTop: '24px' }}>
          <div className="card-header">
            <h2 className="card-title">
              <History size={20} className="brand-icon" style={{ color: 'var(--primary)' }} />
              Vendas Recentes na Rede
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Últimas transações sincronizadas ao vivo
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', maxHeight: '300px', overflowY: 'auto' }}>
            {activeSales.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                Nenhuma venda registrada na rede para os filtros atuais.
              </div>
            ) : (
              [...activeSales]
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 10)
                .map((sale, idx) => {
                  const saleDate = new Date(sale.timestamp);
                  const storeName = sale.storeId === 'loja-1' ? 'Loja 1' : sale.storeId === 'loja-2' ? 'Loja 2' : sale.storeId;
                  const storeColor = sale.storeId === 'loja-1' ? 'var(--primary)' : 'var(--brand-yellow)';
                  const itemsCount = sale.items ? sale.items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0;
                  return (
                    <div key={idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      backgroundColor: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', color: 'var(--primary)' }}>
                          <ShoppingBag size={18} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{sale.id}</span>
                            <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)', color: storeColor, border: `1px solid ${storeColor}40` }}>
                              {storeName}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {saleDate.toLocaleDateString('pt-BR')} às {saleDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {itemsCount} {itemsCount === 1 ? 'item' : 'itens'}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                          R$ {sale.totalPrice.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>
                          {sale.paymentMethod}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* Painel de Backups do Terminal */}
      <div className="section-card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2 className="card-title">
            <Database size={20} className="brand-icon" style={{ color: 'var(--primary)' }} />
            Segurança & Backup do Terminal
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mantenha seus dados seguros contra falhas de hardware</span>
        </div>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '12px' }}>
          <div style={{ flex: '1', minWidth: '240px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Baixe uma cópia completa contendo <strong>produtos, vendas, despesas, fiados e fechamentos de caixa</strong>. Use este arquivo para migrar dados entre dispositivos. Recomendamos salvar semanalmente.
            </p>
            <button
              onClick={onExportBackup}
              className="btn-primary"
              style={{ marginTop: '12px', width: 'auto', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Download size={16} /> Fazer Backup (Exportar JSON)
            </button>
          </div>
          <div style={{ width: '1px', backgroundColor: 'var(--border-color)', alignSelf: 'stretch' }}></div>
          <div style={{ flex: '1', minWidth: '240px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Importe um backup para <strong>mesclar</strong> os dados com os já existentes (nenhum dado atual é apagado). Ideal para migrar dados do computador local para a Vercel ou outro dispositivo.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
              <input
                type="file"
                accept=".json"
                id="backup-upload"
                style={{ display: 'none' }}
                onChange={onImportBackup}
              />
              <label
                htmlFor="backup-upload"
                className="btn-secondary"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
              >
                <Upload size={16} /> Escolher Arquivo de Backup
              </label>
            </div>
          </div>
          <div style={{ width: '1px', backgroundColor: 'var(--border-color)', alignSelf: 'stretch' }}></div>
          <div style={{ flex: '1', minWidth: '240px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              <strong>Zerar Banco de Dados:</strong> Apague todos os produtos, vendas, despesas, fiados e fechamentos de caixa localmente e na nuvem para iniciar o uso do zero.
            </p>
            <button
              onClick={onResetAllData}
              className="btn-danger"
              style={{
                marginTop: '12px',
                width: 'auto',
                padding: '10px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--danger, #dc2626)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={16} /> Zerar Sistema e Nuvem
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ==========================================
// 2. TELA: FRENTE DE CAIXA (PDV)
// ==========================================
function PDVView({
  products,
  cart,
  paymentMethod,
  setPaymentMethod,
  amountPaid,
  setAmountPaid,
  onUpdateCartQty,
  onRemoveFromCart,
  onCheckout,
  onSimulateScan,
  onQuickRegister,
  currentCashBalance = 0,
  onAddToCart,
  discount,
  setDiscount,
  checkoutInstallments,
  setCheckoutInstallments
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const searchInputRef = useRef(null);
  const amountPaidInputRef = useRef(null);

  // Estados locais para agendamento de entregas
  const [requiresDelivery, setRequiresDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Sistema de recomendação inteligente (Assistente IA local)
  const getAISuggestion = () => {
    if (cart.length === 0) return null;

    const AI_RULES = [
      {
        keywords: ['cano', 'tubo', 'pvc', 'conexão', 'tê', 'curva', 'joelho', 'luva'],
        suggestedKeyword: 'cola',
        reason: 'Identificamos conexões de encanamento. É comum o cliente precisar de adesivo plástico (cola) para a fixação.',
        title: 'Cola para PVC'
      },
      {
        keywords: ['cimento', 'tijolo', 'bloco', 'areia', 'pedra'],
        suggestedKeyword: 'argamassa',
        reason: 'Materiais de alvenaria detectados. Sugira oferecer argamassa colante para garantir a aderência do assentamento.',
        title: 'Argamassa'
      },
      {
        keywords: ['fio', 'cabo', 'tomada', 'interruptor', 'disjuntor'],
        suggestedKeyword: 'fita isolante',
        reason: 'Componentes elétricos selecionados. Lembre o cliente de levar fita isolante para as emendas de segurança.',
        title: 'Fita Isolante'
      },
      {
        keywords: ['tinta', 'pintura', 'selador', 'esmalte', 'verniz'],
        suggestedKeyword: 'rolo',
        reason: 'O cliente está comprando tinta. Sugira rolos de pintura ou trinchas para a execução do serviço.',
        title: 'Rolo de Pintura'
      },
      {
        keywords: ['torneira', 'registro', 'chuveiro', 'engate', 'sifão'],
        suggestedKeyword: 'veda rosca',
        reason: 'Itens hidráulicos com rosca selecionados. Sugira fita veda rosca para evitar vazamentos nas conexões.',
        title: 'Fita Veda Rosca'
      }
    ];

    for (const item of cart) {
      const nameLower = item.name.toLowerCase();
      const matchRule = AI_RULES.find(rule =>
        rule.keywords.some(keyword => nameLower.includes(keyword))
      );

      if (matchRule) {
        // Procurar no estoque do catálogo o item sugerido que NÃO esteja no carrinho
        const suggestionProduct = products.find(p =>
          p.name.toLowerCase().includes(matchRule.suggestedKeyword) &&
          !cart.some(cartItem => cartItem.id === p.id)
        );

        if (suggestionProduct) {
          return {
            triggerProduct: item.name,
            suggestedProduct: suggestionProduct,
            isVirtual: false,
            reason: matchRule.reason,
            title: matchRule.title
          };
        } else {
          // Fallback virtual se o lojista não tem o produto cadastrado ainda no estoque
          return {
            triggerProduct: item.name,
            suggestedProduct: {
              id: null,
              name: matchRule.suggestedKeyword === 'cola'
                ? 'Adesivo Plástico Cola para PVC 175g Tigre'
                : matchRule.suggestedKeyword === 'fita isolante'
                  ? 'Fita Isolante Imperial 3M 10m'
                  : matchRule.suggestedKeyword === 'argamassa'
                    ? 'Argamassa ACIII 20kg Quartzolit'
                    : matchRule.suggestedKeyword === 'rolo'
                      ? 'Rolo de Lã para Pintura Tigre 23cm'
                      : 'Fita Veda Rosca 18mm x 10m Tigre',
              salePrice: matchRule.suggestedKeyword === 'cola' ? 12.90 : matchRule.suggestedKeyword === 'fita isolante' ? 4.80 : matchRule.suggestedKeyword === 'argamassa' ? 27.50 : matchRule.suggestedKeyword === 'rolo' ? 22.50 : 3.50,
              costPrice: matchRule.suggestedKeyword === 'cola' ? 7.20 : matchRule.suggestedKeyword === 'fita isolante' ? 2.10 : matchRule.suggestedKeyword === 'argamassa' ? 18.20 : matchRule.suggestedKeyword === 'rolo' ? 12.00 : 1.50,
              unit: matchRule.suggestedKeyword === 'cola' ? 'Bisnaga' : matchRule.suggestedKeyword === 'argamassa' ? 'Saco' : matchRule.suggestedKeyword === 'rolo' ? 'Unidade' : 'Rolo',
              stock: 50,
              minStock: 10,
              code: matchRule.suggestedKeyword === 'cola' ? '7891000100109' : matchRule.suggestedKeyword === 'fita isolante' ? '7891000100110' : matchRule.suggestedKeyword === 'argamassa' ? '7891000100105' : matchRule.suggestedKeyword === 'rolo' ? '7891000100111' : '7891000100112',
              category: matchRule.suggestedKeyword === 'cola' || matchRule.suggestedKeyword === 'veda rosca' ? 'Hidráulica' : matchRule.suggestedKeyword === 'argamassa' ? 'Materiais Básicos' : matchRule.suggestedKeyword === 'rolo' ? 'Tintas' : 'Elétrica'
            },
            isVirtual: true,
            reason: matchRule.reason,
            title: matchRule.title
          };
        }
      }
    }
    return null;
  };

  const suggestion = getAISuggestion();

  // Sistema de atalhos de teclado F2, F4, F8
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (paymentMethod === 'Dinheiro') {
          if (amountPaidInputRef.current) {
            amountPaidInputRef.current.focus();
            amountPaidInputRef.current.select();
          }
        } else {
          if (cart.length > 0) {
            onCheckout();
          }
        }
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) {
          if (confirm("Deseja realmente limpar todos os itens do carrinho?")) {
            cart.forEach(item => onRemoveFromCart(item.id));
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, paymentMethod, onCheckout, onRemoveFromCart]);

  // Pesquisar produtos manualmente
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    const cleanTerm = searchTerm.toLowerCase();
    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(cleanTerm) ||
      p.code.includes(cleanTerm) ||
      (p.category && p.category.toLowerCase().includes(cleanTerm))
    );
    setSearchResults(filtered.slice(0, 5)); // limita a 5 resultados rápidos
  }, [searchTerm, products]);

  const selectProductManual = (product) => {
    const currentStock = getProductStock(product);
    if (currentStock <= 0) {
      alert(`Produto '${product.name}' está sem estoque nesta loja!`);
      return;
    }
    const existing = cart.find(item => item.id === product.id);
    if (existing && existing.quantity >= currentStock) {
      alert("Estoque máximo atingido!");
      return;
    }

    onAddToCart(product);

    setSearchTerm('');
    setSearchResults([]);
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  };

  const totalCart = cart.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0);
  const totalCost = cart.reduce((sum, item) => sum + ((item.costPrice || 0) * item.quantity), 0);
  const totalCartWithDiscount = Math.max(0, totalCart - discount);
  const profit = totalCartWithDiscount - totalCost;

  // Cálculo de troco
  const numericPaid = parseFloat(amountPaid.replace(',', '.')) || 0;
  const change = numericPaid > totalCartWithDiscount ? numericPaid - totalCartWithDiscount : 0;

  return (
    <div className="pdv-layout">
      {/* LADO ESQUERDO: Carrinho e Pesquisa */}
      <div className="pdv-left-panel">

        {/* Barra de Pesquisa manual / bipagem manual */}
        <div className="barcode-search-container">
          <div className="input-group">
            <Search className="input-icon" size={20} />
            <input
              ref={searchInputRef}
              type="text"
              className="input-field"
              placeholder="Digite o código de barras ou nome do produto (Aperte F2 para focar)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Resultados de Pesquisa Rápida */}
          {searchResults.length > 0 && (
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              position: 'absolute',
              width: 'calc(100% - 470px)',
              top: '150px',
              zIndex: 10,
              boxShadow: 'var(--shadow-lg)'
            }}>
              {searchResults.map(p => (
                <div
                  key={p.id}
                  onClick={() => selectProductManual(p)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-color)'
                  }}
                  className="search-item-hover"
                >
                  <div>
                    <strong style={{ color: 'var(--primary)' }}>{p.name}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cód: {p.code} | Estoque: {p.stock} {p.unit}</div>
                  </div>
                  <strong>R$ {p.salePrice.toFixed(2)}</strong>
                </div>
              ))}
            </div>
          )}

          <div className="barcode-focus-reminder">
            <Barcode size={14} />
            <span>Dica do Leitor:</span> Ao bipar com o leitor físico USB, o produto entra no carrinho na hora, não importa onde o cursor esteja na tela.
          </div>
        </div>

        {/* Painel do Assistente de Vendas IA */}
        {suggestion && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(18, 121, 138, 0.04) 0%, rgba(243, 180, 29, 0.04) 100%)',
            border: '1.5px solid rgba(18, 121, 138, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            animation: 'modalFadeIn 0.25s ease-out',
            boxShadow: 'var(--shadow-sm)',
            marginTop: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                flexShrink: 0,
                boxShadow: '0 0 10px var(--primary-glow)'
              }}>
                <Sparkles size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Assistente de Vendas Novo Lar (Sugestão IA)
                  </span>
                  <span style={{
                    fontSize: '9px',
                    backgroundColor: 'var(--brand-red)',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: '700'
                  }}>
                    IA
                  </span>
                </div>
                <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '4px' }}>
                  Oferecer {suggestion.suggestedProduct.name}?
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {suggestion.reason} (Preço: R$ {suggestion.suggestedProduct.salePrice.toFixed(2)} • Estoque: {suggestion.suggestedProduct.stock} {suggestion.suggestedProduct.unit})
                </p>
              </div>
            </div>

            <button
              className="btn-primary"
              style={{
                width: 'auto',
                padding: '10px 18px',
                fontSize: '13px',
                backgroundColor: suggestion.isVirtual ? 'var(--brand-yellow)' : 'var(--primary)',
                color: suggestion.isVirtual ? '#000' : '#fff',
                borderColor: 'transparent'
              }}
              onClick={() => {
                if (suggestion.isVirtual) {
                  onQuickRegister(suggestion.suggestedProduct);
                } else {
                  selectProductManual(suggestion.suggestedProduct);
                }
              }}
            >
              {suggestion.isVirtual ? 'Cadastrar Item' : '+ Adicionar'}
            </button>
          </div>
        )}

        {/* Carrinho de Compras */}
        <div className="pdv-cart-card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="card-title">
              <ShoppingBag size={20} className="brand-icon" style={{ color: 'var(--primary)' }} />
              Carrinho de Venda
            </h2>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{cart.length} itens</span>
          </div>

          <div className="cart-table-wrapper">
            {cart.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <Barcode size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                <h3>Nenhum produto no carrinho</h3>
                <p style={{ fontSize: '13px', marginTop: '6px', textAlign: 'center' }}>Bipe um código de barras para começar a registrar a venda ou use o painel de simulação.</p>
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Preço Un.</th>
                    <th style={{ width: '120px' }}>Quant.</th>
                    <th>Total</th>
                    <th style={{ width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div>
                          <strong>{item.name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cód: {item.code}</div>
                        </div>
                      </td>
                      <td>R$ {item.salePrice.toFixed(2)}</td>
                      <td>
                        <div className="quantity-control">
                          <button className="qty-btn" onClick={() => onUpdateCartQty(item.id, -1)}>-</button>
                          <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: '600' }}>{item.quantity}</span>
                          <button className="qty-btn" onClick={() => onUpdateCartQty(item.id, 1)}>+</button>
                        </div>
                      </td>
                      <td><strong>R$ {(item.salePrice * item.quantity).toFixed(2)}</strong></td>
                      <td>
                        <button className="delete-btn" onClick={() => onRemoveFromCart(item.id)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>



          {/* Painel de Atalhos Rápidos */}
          <div style={{
            display: 'flex',
            gap: '12px',
            padding: '12px 16px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--text-secondary)'
          }}>
            <span style={{ fontWeight: '700' }}>Atalhos do Caixa:</span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <kbd className="shortcut-badge">F2</kbd> Buscar
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <kbd className="shortcut-badge">F4</kbd> Pagamento
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <kbd className="shortcut-badge">F8</kbd> Limpar
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* LADO DIREITO: Painel de Checkout / Pagamento */}
      <div className="pdv-right-panel">
        {/* Total do Caixa Badge */}
        <div style={{
          backgroundColor: 'var(--primary-glow)',
          border: '1px solid rgba(18, 121, 138, 0.2)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Coins size={18} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>Saldo Acumulado do Caixa:</span>
          </div>
          <strong style={{ fontSize: '16px', color: 'var(--primary)' }}>
            R$ {currentCashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
        </div>

        <div className="checkout-header">
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>Checkout</span>
          <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Resumo & Pagamento</h2>
        </div>

        <div className="checkout-summary">
          <div className="checkout-row">
            <span>Subtotal</span>
            <span>R$ {totalCart.toFixed(2)}</span>
          </div>
          <div className="checkout-row">
            <span>Desconto</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {discount > 0 && (
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                  onClick={() => setDiscount(0)}
                >
                  [Remover]
                </button>
              )}
              <span style={{ color: 'var(--success)', fontWeight: '700' }}>
                {discount > 0 ? `- R$ ${discount.toFixed(2)}` : 'R$ 0,00'}
              </span>
            </div>
          </div>

          {/* Caixa de Sugestão de Desconto */}
          {totalCart > 0 && discount === 0 && (
            (() => {
              let pct = 0;
              if (totalCart >= 500) pct = 10;
              else if (totalCart >= 200) pct = 7;
              else if (totalCart >= 100) pct = 5;
              else if (totalCart >= 50) pct = 3;

              if (pct === 0) return null;

              const suggestedAmount = parseFloat((totalCart * (pct / 100)).toFixed(2));
              return (
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: 'rgba(74, 222, 128, 0.05)',
                  border: '1px dashed var(--success)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  animation: 'fadeIn 0.2s ease-out'
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Sugestão de Desconto ({pct}%): <strong style={{ color: 'var(--success)' }}>R$ {suggestedAmount.toFixed(2)}</strong>
                  </div>
                  <button
                    className="btn-primary"
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      width: 'auto',
                      height: 'auto',
                      backgroundColor: 'var(--success)',
                      borderColor: 'var(--success)',
                      color: '#000',
                      fontWeight: '700'
                    }}
                    onClick={() => setDiscount(suggestedAmount)}
                  >
                    Aplicar
                  </button>
                </div>
              );
            })()
          )}

          <div style={{ marginTop: '16px' }}>
            <span className="input-label">Forma de Pagamento</span>
            <div className="payment-grid">
              <button
                className={`payment-btn ${paymentMethod === 'Pix' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('Pix')}
              >
                <Smartphone size={20} />
                Pix
              </button>
              <button
                className={`payment-btn ${paymentMethod === 'Dinheiro' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('Dinheiro')}
              >
                <Coins size={20} />
                Dinheiro
              </button>
              <button
                className={`payment-btn ${paymentMethod === 'Crédito' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('Crédito')}
              >
                <CreditCard size={20} />
                Cartão Crédito
              </button>
              <button
                className={`payment-btn ${paymentMethod === 'Débito' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('Débito')}
              >
                <CreditCard size={20} />
                Cartão Débito
              </button>
              <button
                className={`payment-btn ${paymentMethod === 'Fiado' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('Fiado')}
              >
                <BookOpen size={20} />
                Marcado / Fiado
              </button>
            </div>
          </div>

          {/* Parcelas no pagamento em crédito */}
          {paymentMethod === 'Crédito' && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', animation: 'modalFadeIn 0.2s ease-out' }}>
              <div className="form-group">
                <label>Número de Parcelas</label>
                <select value={checkoutInstallments} onChange={(e) => setCheckoutInstallments(e.target.value)}>
                  <option value="1x">1x (À vista)</option>
                  <option value="2x">2x</option>
                  <option value="3x">3x</option>
                  <option value="4x">4x</option>
                  <option value="5x">5x</option>
                  <option value="6x">6x</option>
                  <option value="7x">7x</option>
                  <option value="8x">8x</option>
                  <option value="9x">9x</option>
                  <option value="10x">10x</option>
                  <option value="11x">11x</option>
                  <option value="12x">12x</option>
                </select>
              </div>
            </div>
          )}

          {/* Troco no pagamento em dinheiro */}
          {paymentMethod === 'Dinheiro' && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', animation: 'modalFadeIn 0.2s ease-out' }}>
              <div className="form-group">
                <label>Valor Pago pelo Cliente</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }}>R$</span>
                  <input
                    ref={amountPaidInputRef}
                    type="text"
                    placeholder="0,00"
                    style={{ paddingLeft: '32px', width: '100%' }}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                  />
                </div>
              </div>

              {numericPaid > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--success-glow)', border: '1px solid var(--success)', marginTop: '4px' }}>
                  <span style={{ fontWeight: '500' }}>Troco a devolver:</span>
                  <strong style={{ color: 'var(--success)', fontSize: '16px' }}>R$ {change.toFixed(2)}</strong>
                </div>
              )}
            </div>
          )}

          {/* Agendamento de Entrega Form */}
          <div style={{
            marginTop: '16px',
            padding: '12px 14px',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-tertiary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setRequiresDelivery(!requiresDelivery)}>
              <input
                type="checkbox"
                checked={requiresDelivery}
                onChange={(e) => setRequiresDelivery(e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                onClick={(e) => e.stopPropagation()}
              />
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Agendar entrega deste pedido?</span>
            </div>

            {requiresDelivery && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', animation: 'modalFadeIn 0.2s ease-out' }}>
                <div>
                  <label className="input-label" style={{ fontSize: '10px', marginBottom: '2px', display: 'block', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Recebedor / Contato na Obra</label>
                  <input
                    type="text"
                    placeholder="Nome de quem vai receber..."
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    style={{ padding: '8px 10px', fontSize: '12px', width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div>
                  <label className="input-label" style={{ fontSize: '10px', marginBottom: '2px', display: 'block', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Endereço de Entrega</label>
                  <input
                    type="text"
                    placeholder="Rua, número, bairro, cidade..."
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    style={{ padding: '8px 10px', fontSize: '12px', width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label className="input-label" style={{ fontSize: '10px', marginBottom: '2px', display: 'block', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Data Programada</label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      style={{ padding: '6px 8px', fontSize: '12px', width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                    />
                  </div>
                  <div>
                    <label className="input-label" style={{ fontSize: '10px', marginBottom: '2px', display: 'block', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Observações</label>
                    <input
                      type="text"
                      placeholder="Instruções de entrega..."
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      style={{ padding: '8px 10px', fontSize: '12px', width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ flexGrow: 1 }}></div>

          <div className="checkout-row total" style={{ marginTop: '16px' }}>
            <span>TOTAL</span>
            <span>R$ {totalCartWithDiscount.toFixed(2)}</span>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span>Itens no carrinho: {cart.reduce((sum, i) => sum + i.quantity, 0)}</span>
            <span>Lucro presumido nesta venda: R$ {profit.toFixed(2)}</span>
          </div>
        </div>

        <div className="checkout-footer">
          <button
            className="btn-primary"
            disabled={cart.length === 0}
            onClick={() => {
              const deliveryDetails = requiresDelivery ? {
                requiresDelivery: true,
                address: deliveryAddress,
                date: deliveryDate,
                receiver: receiverName,
                notes: deliveryNotes,
                status: 'Pendente',
                deliveredAt: null
              } : null;
              onCheckout(deliveryDetails);
              setRequiresDelivery(false);
              setDeliveryAddress('');
              setDeliveryDate('');
              setReceiverName('');
              setDeliveryNotes('');
            }}
          >
            <Check size={20} />
            Finalizar Venda (Confirmar)
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. TELA: CADASTRO PRODUTOS / INVENTÁRIO
// ==========================================
function ProductsView({ products, onEditProduct, onDeleteProduct, onTransferStock }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [storeFilter, setStoreFilter] = useState('all'); // 'all' | 'loja-1' | 'loja-2'

  const filteredProducts = products.filter(p => {
    const nameStr = (p.name || '').toLowerCase();
    const codeStr = String(p.code || '');
    const catStr = (p.category || '').toLowerCase();
    const searchLower = searchTerm.toLowerCase();

    const matchesSearch = nameStr.includes(searchLower) ||
      codeStr.includes(searchLower) ||
      catStr.includes(searchLower);

    if (!matchesSearch) return false;

    if (storeFilter === 'loja-1') {
      return (p.stockLoja1 ?? p.stock ?? 0) > 0 || (p.stockLoja2 ?? 0) === 0;
    } else if (storeFilter === 'loja-2') {
      return (p.stockLoja2 ?? 0) > 0 || (p.stockLoja1 ?? 0) === 0;
    }
    return true;
  });

  const getProductStock = (p) => (p.stockLoja1 ?? p.stock ?? 0) + (p.stockLoja2 ?? 0);

  return (
    <div className="section-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <h2 className="card-title">
          <Package size={20} className="brand-icon" style={{ color: 'var(--primary)' }} />
          Lista de Produtos em Estoque
        </h2>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Seletor de Loja */}
          <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
            {[
              { id: 'all', label: 'Todas Lojas' },
              { id: 'loja-1', label: 'Loja 1' },
              { id: 'loja-2', label: 'Loja 2' }
            ].map(filter => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStoreFilter(filter.id)}
                className={`tab-btn-pill ${storeFilter === filter.id ? 'active' : ''}`}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: storeFilter === filter.id ? 'var(--primary)' : 'transparent',
                  color: storeFilter === filter.id ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="input-group" style={{ maxWidth: '350px', width: '220px' }}>
            <Search className="input-icon" size={18} />
            <input
              type="text"
              className="input-field"
              style={{ padding: '10px 14px 10px 42px' }}
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="table-container">
        {filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <Package size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p>Nenhum produto cadastrado ou correspondente à busca.</p>
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Código (Barras)</th>
                <th>Nome do Produto</th>
                <th>Categoria</th>
                <th>Custo</th>
                <th>Venda</th>
                <th style={{ width: '220px' }}>Estoque por Loja</th>
                <th style={{ width: '120px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => {
                const isLowStock = getProductStock(p) <= p.minStock;
                return (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: '500' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Barcode size={14} style={{ color: 'var(--text-muted)' }} />
                        {p.code}
                      </span>
                    </td>
                    <td>
                      <div>
                        <strong>{p.name}</strong>
                        {p.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.description}</div>}
                      </div>
                    </td>
                    <td><span className="badge badge-info">{p.category || 'Geral'}</span></td>
                    <td>R$ {(p.costPrice || 0).toFixed(2)}</td>
                    <td><strong>R$ {(p.salePrice || 0).toFixed(2)}</strong></td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>🏠 Loja 1 (Matriz):</span>
                          <strong>{p.stockLoja1 ?? p.stock ?? 0} {p.unit || 'un'}</strong>
                        </div>
                        <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>🏢 Loja 2 (Filial):</span>
                          <strong>{p.stockLoja2 ?? 0} {p.unit || 'un'}</strong>
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: isLowStock ? 'var(--warning)' : 'var(--text-muted)',
                          borderTop: '1px dashed var(--border-color)',
                          marginTop: '2px',
                          paddingTop: '2px',
                          display: 'flex',
                          justifyContent: 'space-between'
                        }}>
                          <span>Total Geral:</span>
                          <strong>{(p.stockLoja1 ?? p.stock ?? 0) + (p.stockLoja2 ?? 0)} {p.unit || 'un'}</strong>
                        </div>
                      </div>
                      {isLowStock && (
                        <div style={{ fontSize: '10px', color: 'var(--warning)', fontWeight: '600', marginTop: '2px', textAlign: 'right' }}>
                          ⚠ Estoque Crítico (Mín: {p.minStock})
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          className="delete-btn"
                          style={{ color: 'var(--primary)', padding: '4px' }}
                          onClick={() => onTransferStock(p)}
                          title="Transferir Estoque entre Lojas"
                        >
                          <ArrowRightLeft size={16} />
                        </button>
                        <button
                          className="delete-btn"
                          style={{ color: 'var(--text-secondary)', padding: '4px' }}
                          onClick={() => onEditProduct(p)}
                          title="Editar Produto"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          className="delete-btn"
                          style={{ padding: '4px' }}
                          onClick={() => onDeleteProduct(p.id)}
                          title="Excluir Produto"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        Total de produtos no catálogo: {products.length}
      </div>
    </div>
  );
}

// ==========================================
// 4. TELA: HISTÓRICO DE VENDAS E DESPESAS
// ==========================================
function HistoryExpensesView({ sales, expenses, onDeleteExpense }) {
  const [subTab, setSubTab] = useState('sales'); // 'sales' ou 'expenses'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Sub-Navegação interna */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button
          className={`btn-secondary ${subTab === 'sales' ? 'active' : ''}`}
          style={{
            backgroundColor: subTab === 'sales' ? 'var(--primary-glow)' : 'var(--bg-card)',
            borderColor: subTab === 'sales' ? 'var(--primary)' : 'var(--border-color)',
            color: subTab === 'sales' ? 'var(--primary)' : 'var(--text-primary)',
            padding: '8px 16px'
          }}
          onClick={() => setSubTab('sales')}
        >
          <History size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Histórico de Vendas ({sales.length})
        </button>
        <button
          className={`btn-secondary ${subTab === 'expenses' ? 'active' : ''}`}
          style={{
            backgroundColor: subTab === 'expenses' ? 'var(--danger-glow)' : 'var(--bg-card)',
            borderColor: subTab === 'expenses' ? 'var(--danger)' : 'var(--border-color)',
            color: subTab === 'expenses' ? 'var(--danger)' : 'var(--text-primary)',
            padding: '8px 16px'
          }}
          onClick={() => setSubTab('expenses')}
        >
          <DollarSign size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Controle de Gastos / Despesas ({expenses.length})
        </button>
      </div>

      {subTab === 'sales' ? (
        <div className="section-card">
          <div className="card-header">
            <h2 className="card-title">Histórico de Saídas / Caixa</h2>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Relatório de entradas registradas</span>
          </div>

          <div className="table-container">
            {sales.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <History size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p>Nenhuma venda registrada ainda no sistema.</p>
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Data & Hora</th>
                    <th>ID Venda</th>
                    <th>Itens</th>
                    <th>Pagamento</th>
                    <th>Custo Prod.</th>
                    <th>Faturamento</th>
                    <th>Lucro Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {[...sales].reverse().map(sale => (
                    <tr key={sale.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                          {new Date(sale.timestamp).toLocaleString('pt-BR')}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: '600' }}>{sale.id}</td>
                      <td>
                        <div style={{ fontSize: '13px' }}>
                          {sale.items.map((it, idx) => (
                            <div key={idx}>• {it.name} (x{it.quantity})</div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-info">{sale.paymentMethod || 'Dinheiro'}</span>
                      </td>
                      <td>R$ {sale.totalCost?.toFixed(2) || '0.00'}</td>
                      <td><strong>R$ {sale.totalPrice.toFixed(2)}</strong></td>
                      <td><strong style={{ color: 'var(--success)' }}>R$ {sale.profit.toFixed(2)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="section-card">
          <div className="card-header">
            <h2 className="card-title">Fluxo de Despesas Comerciais</h2>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Contas, infraestrutura, logística e outros gastos</span>
          </div>

          <div className="table-container">
            {expenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <DollarSign size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p>Nenhuma despesa ou saída registrada neste período.</p>
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Categoria</th>
                    <th>Descrição / Fornecedor</th>
                    <th>Valor</th>
                    <th style={{ width: '80px', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {[...expenses].reverse().map(exp => (
                    <tr key={exp.id}>
                      <td>{new Date(exp.timestamp).toLocaleDateString('pt-BR')}</td>
                      <td><span className="badge badge-danger" style={{ textTransform: 'uppercase' }}>{exp.category}</span></td>
                      <td><strong>{exp.description}</strong></td>
                      <td><strong style={{ color: 'var(--danger)' }}>R$ {exp.amount.toFixed(2)}</strong></td>
                      <td>
                        <div style={{ textAlign: 'right' }}>
                          <button
                            className="delete-btn"
                            onClick={() => onDeleteExpense(exp.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MODAL: CRIAR OU EDITAR PRODUTO
// ==========================================
function ProductModal({ product, onClose, onSave }) {
  const [code, setCode] = useState(product ? product.code : '');
  const [name, setName] = useState(product ? product.name : '');
  const [description, setDescription] = useState(product ? product.description : '');
  const [costPrice, setCostPrice] = useState(product ? product.costPrice.toString() : '');
  const [salePrice, setSalePrice] = useState(product ? product.salePrice.toString() : '');

  const [stockLoja1, setStockLoja1] = useState(() => {
    if (product) {
      return (product.stockLoja1 ?? product.stock ?? 0).toString();
    }
    return '';
  });

  const [stockLoja2, setStockLoja2] = useState(() => {
    if (product) {
      return (product.stockLoja2 ?? 0).toString();
    }
    return '';
  });

  const [minStock, setMinStock] = useState(product ? product.minStock.toString() : '');
  const [category, setCategory] = useState(product ? product.category : 'Materiais Básicos');
  const [unit, setUnit] = useState(product ? product.unit : 'Unidade');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!code || !name || !costPrice || !salePrice || !stockLoja1 || !stockLoja2 || !minStock) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    const s1 = parseInt(stockLoja1) || 0;
    const s2 = parseInt(stockLoja2) || 0;

    onSave({
      id: product ? product.id : null,
      code: code.trim(),
      name: name.trim(),
      description: description.trim(),
      costPrice: parseFloat(costPrice.replace(',', '.')),
      salePrice: parseFloat(salePrice.replace(',', '.')),
      stockLoja1: s1,
      stockLoja2: s2,
      stock: s1 + s2,
      minStock: parseInt(minStock),
      category,
      unit
    });
  };

  // Gerar código de barras fictício se não tiver
  const generateEan = () => {
    const random = Math.floor(100000000000 + Math.random() * 900000000000);
    setCode("789" + random.toString());
  };

  return (
    <div className="modal-overlay">
      <form className="modal-content" onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2 style={{ fontSize: '18px', fontWeight: '700' }}>
            {product ? 'Editar Produto' : 'Cadastrar Novo Produto'}
          </h2>
          <button type="button" className="delete-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          <div className="form-row">
            <div className="form-group" style={{ position: 'relative' }}>
              <label>Código de Barras (EAN) *</label>
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Bipe com o leitor ou digite..."
                  required
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button type="button" className="btn-secondary" style={{ padding: '0 16px', whiteSpace: 'nowrap' }} onClick={generateEan}>
                  Gerar
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Nome do Produto *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Cimento CP II 50kg"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Descrição Opcional</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Fabricante: Votoran, Secagem rápida"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Categoria</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Materiais Básicos">Materiais Básicos</option>
                <option value="Hidráulica">Hidráulica</option>
                <option value="Elétrica">Elétrica</option>
                <option value="Acabamento">Acabamento</option>
                <option value="Ferragens">Ferragens</option>
                <option value="Tintas">Tintas</option>
                <option value="Ferramentas">Ferramentas</option>
              </select>
            </div>

            <div className="form-group">
              <label>Unidade de Medida</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="Unidade">Unidade (Un)</option>
                <option value="Saco">Saco</option>
                <option value="Metro">Metro (m)</option>
                <option value="Barra">Barra</option>
                <option value="Caixa">Caixa</option>
                <option value="Rolo">Rolo</option>
                <option value="Milheiro">Milheiro</option>
                <option value="Lata">Lata</option>
                <option value="Kg">Kg</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Preço de Custo (Compra) *</label>
              <input
                type="text"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>

            <div className="form-group">
              <label>Preço de Venda (Cliente) *</label>
              <input
                type="text"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Estoque Loja 1 (Matriz) *</label>
              <input
                type="number"
                value={stockLoja1}
                onChange={(e) => setStockLoja1(e.target.value)}
                placeholder="Ex: 50"
                required
              />
            </div>

            <div className="form-group">
              <label>Estoque Loja 2 (Filial) *</label>
              <input
                type="number"
                value={stockLoja2}
                onChange={(e) => setStockLoja2(e.target.value)}
                placeholder="Ex: 0"
                required
              />
            </div>

            <div className="form-group">
              <label>Mínimo (Alerta) *</label>
              <input
                type="number"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                placeholder="Ex: 10"
                required
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Salvar Produto</button>
        </div>
      </form>
    </div>
  );
}

// ==========================================
// MODAL: TRANSFERIR ESTOQUE ENTRE LOJAS
// ==========================================
function TransferStockModal({ product, onClose, onConfirm }) {
  const [fromStore, setFromStore] = useState('loja-1');
  const [toStore, setToStore] = useState('loja-2');
  const [qty, setQty] = useState('');

  const stockFrom = fromStore === 'loja-1' ? (product.stockLoja1 ?? product.stock ?? 0) : (product.stockLoja2 ?? 0);
  const stockTo = toStore === 'loja-1' ? (product.stockLoja1 ?? product.stock ?? 0) : (product.stockLoja2 ?? 0);

  const handleConfirm = (e) => {
    e.preventDefault();
    const amount = parseInt(qty);
    if (!amount || amount <= 0) {
      alert("Por favor, insira uma quantidade válida.");
      return;
    }
    if (amount > stockFrom) {
      alert(`Quantidade indisponível na origem! Estoque atual: ${stockFrom}`);
      return;
    }
    onConfirm(product.id, fromStore, toStore, amount);
  };

  const toggleStores = () => {
    setFromStore(prev => prev === 'loja-1' ? 'loja-2' : 'loja-1');
    setToStore(prev => prev === 'loja-1' ? 'loja-2' : 'loja-1');
  };

  return (
    <div className="modal-overlay">
      <form className="modal-content" onSubmit={handleConfirm} style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Transferir Estoque</h2>
          <button type="button" className="delete-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <strong style={{ fontSize: '15px' }}>{product.name}</strong>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Código: {product.code}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr auto 1.2fr', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Origem</div>
              <strong style={{ fontSize: '13px', display: 'block', marginTop: '2px' }}>{fromStore === 'loja-1' ? 'Loja 1 (Matriz)' : 'Loja 2 (Filial)'}</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>Estoque: {stockFrom}</span>
            </div>

            <button type="button" className="qty-btn" style={{ width: '32px', height: '32px', border: '1px solid var(--border-color)', borderRadius: '50%' }} onClick={toggleStores}>
              ⇄
            </button>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Destino</div>
              <strong style={{ fontSize: '13px', display: 'block', marginTop: '2px' }}>{toStore === 'loja-1' ? 'Loja 1 (Matriz)' : 'Loja 2 (Filial)'}</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>Estoque: {stockTo}</span>
            </div>
          </div>

          <div className="form-group">
            <label>Quantidade a Transferir *</label>
            <input
              type="number"
              required
              min="1"
              max={stockFrom}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Ex: 10"
              style={{ width: '100%' }}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Confirmar Transferência</button>
        </div>
      </form>
    </div>
  );
}

// ==========================================
// MODAL: REGISTRAR DESPESA
// ==========================================
function ExpenseModal({ onClose, onSave }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Contas Fixas');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description || !amount) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    onSave({
      description: description.trim(),
      amount: parseFloat(amount.replace(',', '.')),
      category
    });
  };

  return (
    <div className="modal-overlay">
      <form className="modal-content" onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Registrar Gasto / Despesa</h2>
          <button type="button" className="delete-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Descrição da Despesa *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Conta de Luz Enel Julho"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Valor da Despesa *</label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>

            <div className="form-group">
              <label>Categoria de Gasto</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Contas Fixas">Contas Fixas (Água, Luz, Net)</option>
                <option value="Infraestrutura">Infraestrutura & Obras</option>
                <option value="Fornecedores">Pagamento Fornecedores</option>
                <option value="Logística">Logística & Frete</option>
                <option value="Funcionários">Salário & Comissões</option>
                <option value="Outros">Outros Gastos</option>
              </select>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>Registrar Despesa</button>
        </div>
      </form>
    </div>
  );
}

// ==========================================
// 6. TELA: LOGIN VIEW
// ==========================================
function LoginView({ onLogin }) {
  const [selectedStore, setSelectedStore] = useState('loja-1');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === '123') {
      onLogin(selectedStore, 'admin');
    } else {
      setError('Senha de acesso incorreta! Tente "123".');
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-logo-container" style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
          <img src="logo.png" alt="Novo Lar Logo" style={{ width: '100%', maxWidth: '280px', height: 'auto', objectFit: 'contain' }} />
        </div>

        <h2 className="login-title">Acesso ao Sistema</h2>
        <p className="login-subtitle">Escolha o seu terminal e insira a senha</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="input-label" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Selecione a Loja:</label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="login-select"
            >
              <option value="loja-1">Loja 1 - Matriz</option>
              <option value="loja-2">Loja 2 - Filial</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="input-label" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Senha de Acesso:</label>
            <input
              type="password"
              placeholder="Digite a senha de acesso (123)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field login-input"
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn-primary login-btn">
            Entrar no Terminal
          </button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 7. TELA: DADOS DIÁRIOS (HOJE)
// ==========================================
function DailyDashboardView({ sales, expenses, products, vaultTransactions = [], storeId, onSimulateScan, onChangeTab, getCashBalanceAtDate }) {
  const todayStr = new Date().toISOString().split('T')[0];

  const todaySales = sales.filter(s => s.timestamp.split('T')[0] === todayStr);
  const todayExpenses = expenses.filter(e => e.timestamp.split('T')[0] === todayStr);
  const todayVaultTransactions = vaultTransactions.filter(vt => vt.storeId === storeId && vt.date === todayStr);

  const totalSales = todaySales.reduce((sum, s) => sum + s.totalPrice, 0);
  const totalProfit = todaySales.reduce((sum, s) => sum + s.profit, 0);
  const totalExpenses = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

  const totalVaultDeposits = todayVaultTransactions.filter(vt => vt.type === 'deposit').reduce((sum, vt) => sum + vt.amount, 0);
  const totalVaultWithdrawals = todayVaultTransactions.filter(vt => vt.type === 'withdrawal').reduce((sum, vt) => sum + vt.amount, 0);

  const netCash = totalSales - totalExpenses - totalVaultDeposits + totalVaultWithdrawals;

  // Calculando saldos de abertura e fechamento
  const openingCash = getCashBalanceAtDate ? getCashBalanceAtDate(todayStr) : 0;
  const closingCash = openingCash + totalSales - totalExpenses - totalVaultDeposits + totalVaultWithdrawals;

  const lowStockItems = products.filter(p => getProductStock(p) <= p.minStock);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Grid de KPIs do Dia */}
      <div className="dashboard-summary-grid">
        <div className="kpi-card sales">
          <div className="kpi-icon-wrapper" style={{ color: 'var(--primary)', backgroundColor: 'var(--primary-glow)' }}>
            <ShoppingBag size={24} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Vendas de Hoje</span>
            <span className="kpi-value">R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="kpi-card profit">
          <div className="kpi-icon-wrapper">
            <DollarSign size={24} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Lucro de Hoje</span>
            <span className="kpi-value" style={{ color: 'var(--success)' }}>
              R$ {totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="kpi-card expenses">
          <div className="kpi-icon-wrapper">
            <DollarSign size={24} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Gastos de Hoje</span>
            <span className="kpi-value" style={{ color: 'var(--danger)' }}>
              R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="kpi-card low-stock" style={{ borderColor: lowStockItems.length > 0 ? 'rgba(216, 45, 51, 0.3)' : 'var(--border-color)' }}>
          <div className="kpi-icon-wrapper">
            <AlertTriangle size={24} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Alerta Estoque</span>
            <span className="kpi-value" style={{ color: lowStockItems.length > 0 ? 'var(--brand-red)' : 'inherit' }}>
              {lowStockItems.length} {lowStockItems.length === 1 ? 'Produto' : 'Produtos'}
            </span>
          </div>
        </div>
      </div>

      {/* Fluxo de Caixa Diário */}
      <div style={{
        padding: '14px 20px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Coins size={18} style={{ color: 'var(--primary)' }} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Fundo de Abertura</div>
            <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
              R$ {openingCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </strong>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={18} style={{ color: 'var(--success)' }} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Movimentação do Dia</div>
            <strong style={{ fontSize: '15px', color: netCash >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {netCash >= 0 ? '+' : ''} R$ {netCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </strong>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShoppingBag size={18} style={{ color: 'var(--primary)' }} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Saldo de Fechamento</div>
            <strong style={{ fontSize: '16px', color: 'var(--primary)' }}>
              R$ {closingCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '20px' }}>
        {/* Coluna da Esquerda: Tabelas do Dia */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="section-card">
            <div className="card-header">
              <h3 className="card-title">Vendas do Dia (Hoje)</h3>
            </div>
            <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
              {todaySales.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0', fontSize: '14px' }}>
                  Nenhuma venda realizada hoje. Abra o PDV para começar!
                </p>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Horário</th>
                      <th>ID</th>
                      <th>Itens</th>
                      <th>Pagamento</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todaySales.map(sale => (
                      <tr key={sale.id}>
                        <td>{new Date(sale.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ fontWeight: '700' }}>{sale.id}</td>
                        <td>{sale.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</td>
                        <td>{sale.paymentMethod}</td>
                        <td style={{ fontWeight: '700', color: 'var(--primary)' }}>R$ {sale.totalPrice.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="section-card">
            <div className="card-header">
              <h3 className="card-title">Despesas do Dia (Hoje)</h3>
            </div>
            <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
              {todayExpenses.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0', fontSize: '14px' }}>
                  Nenhuma despesa lançada hoje.
                </p>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Categoria</th>
                      <th>Descrição</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayExpenses.map(exp => (
                      <tr key={exp.id}>
                        <td style={{ fontWeight: '700' }}>{exp.id}</td>
                        <td>{exp.category}</td>
                        <td>{exp.description}</td>
                        <td style={{ fontWeight: '700', color: 'var(--danger)' }}>R$ {exp.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Coluna da Direita: Alertas de Estoque & Simulação */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="section-card">
            <div className="card-header">
              <h3 className="card-title">Produtos com Estoque Crítico</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
              {lowStockItems.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: '13px' }}>Todo o estoque está regularizado!</p>
              ) : (
                lowStockItems.map(p => (
                  <div key={p.id} className="stock-alert-item">
                    <div className="stock-alert-info">
                      <span className="stock-alert-name">{p.name}</span>
                      <span className="stock-alert-qty">Estoque: {p.stock} {p.unit}</span>
                    </div>
                    <span className="stock-alert-badge">Mín: {p.minStock}</span>
                  </div>
                ))
              )}
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}

// ==========================================
// 8. TELA: RELATÓRIOS POR CALENDÁRIO
// ==========================================
function CalendarReportsView({ sales, expenses, getCashBalanceAtDate }) {
  const [reportMode, setReportMode] = useState('single'); // 'single' | 'range'
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const daySales = reportMode === 'single'
    ? sales.filter(s => s.timestamp.split('T')[0] === startDate)
    : sales.filter(s => {
      const d = s.timestamp.split('T')[0];
      return d >= startDate && d <= endDate;
    });

  const dayExpenses = reportMode === 'single'
    ? expenses.filter(e => e.timestamp.split('T')[0] === startDate)
    : expenses.filter(e => {
      const d = e.timestamp.split('T')[0];
      return d >= startDate && d <= endDate;
    });

  const totalSales = daySales.reduce((sum, s) => sum + s.totalPrice, 0);
  const totalProfit = daySales.reduce((sum, s) => sum + s.profit, 0);
  const totalExpenses = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netCash = totalSales - totalExpenses;

  // Calculando saldos de abertura e fechamento
  const openingCash = getCashBalanceAtDate ? getCashBalanceAtDate(startDate) : 0;
  const closingCash = openingCash + totalSales - totalExpenses;

  // Detalhamento de formas de pagamento
  const pixAmount = daySales
    .filter(s => s.paymentMethod === 'Pix')
    .reduce((sum, s) => sum + s.totalPrice, 0);

  const cashAmount = daySales
    .filter(s => s.paymentMethod === 'Dinheiro')
    .reduce((sum, s) => sum + s.totalPrice, 0);

  const cardAmount = daySales
    .filter(s => {
      const pm = s.paymentMethod.toLowerCase();
      return pm.includes('cartão') || pm.includes('card') || pm.includes('crédito') || pm.includes('débito');
    })
    .reduce((sum, s) => sum + s.totalPrice, 0);

  const otherAmount = daySales
    .filter(s => {
      const pm = s.paymentMethod.toLowerCase();
      const isPix = pm === 'pix';
      const isCash = pm === 'dinheiro';
      const isCard = pm.includes('cartão') || pm.includes('card') || pm.includes('crédito') || pm.includes('débito');
      return !isPix && !isCash && !isCard;
    })
    .reduce((sum, s) => sum + s.totalPrice, 0);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    return { firstDay, totalDays };
  };

  const { firstDay, totalDays } = getDaysInMonth(currentMonth);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const daysArray = Array(firstDay).fill(null).concat(
    Array(totalDays).fill(0).map((_, i) => i + 1)
  );

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const handleDayClick = (formattedDate) => {
    if (reportMode === 'single') {
      setStartDate(formattedDate);
      setEndDate(formattedDate);
    } else {
      if (formattedDate < startDate) {
        setStartDate(formattedDate);
      } else {
        setEndDate(formattedDate);
      }
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '24px' }}>
      {/* Lado Esquerdo: Calendário */}
      <div className="section-card" style={{ height: 'fit-content' }}>
        <div className="card-header" style={{ marginBottom: '12px' }}>
          <h3 className="card-title">Selecione uma Data</h3>
        </div>

        {/* Seletor de Modo: Dia Único vs Período */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          <button
            className={`tab-btn-pill ${reportMode === 'single' ? 'active' : ''}`}
            onClick={() => setReportMode('single')}
            style={{
              flex: 1,
              padding: '8px',
              fontSize: '12px',
              fontWeight: '700',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              backgroundColor: reportMode === 'single' ? 'var(--primary)' : 'transparent',
              color: reportMode === 'single' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            Dia Único
          </button>
          <button
            className={`tab-btn-pill ${reportMode === 'range' ? 'active' : ''}`}
            onClick={() => setReportMode('range')}
            style={{
              flex: 1,
              padding: '8px',
              fontSize: '12px',
              fontWeight: '700',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              backgroundColor: reportMode === 'range' ? 'var(--primary)' : 'transparent',
              color: reportMode === 'range' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            Período (Intervalo)
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <button onClick={prevMonth} className="qty-btn" style={{ width: '32px', height: '32px' }}>&lt;</button>
          <span style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>
            {monthNames[currentMonth.getMonth()]} de {currentMonth.getFullYear()}
          </span>
          <button onClick={nextMonth} className="qty-btn" style={{ width: '32px', height: '32px' }}>&gt;</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontWeight: '700', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {daysArray.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`}></div>;

            const year = currentMonth.getFullYear();
            const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
            const dateDay = String(day).padStart(2, '0');
            const formattedDate = `${year}-${month}-${dateDay}`;

            const isSelected = reportMode === 'single'
              ? startDate === formattedDate
              : (formattedDate >= startDate && formattedDate <= endDate);
            const isToday = new Date().toISOString().split('T')[0] === formattedDate;

            const hasSales = sales.some(s => s.timestamp.split('T')[0] === formattedDate);
            const hasExpenses = expenses.some(e => e.timestamp.split('T')[0] === formattedDate);

            return (
              <button
                key={day}
                onClick={() => handleDayClick(formattedDate)}
                style={{
                  height: '38px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected ? 'var(--primary)' : (isToday ? 'var(--primary-glow)' : 'var(--bg-tertiary)'),
                  color: isSelected ? '#ffffff' : 'var(--text-primary)',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: (isSelected || isToday) ? '700' : '500',
                  fontSize: '13px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'var(--transition)'
                }}
              >
                {day}
                {(hasSales || hasExpenses) && (
                  <div style={{
                    display: 'flex',
                    gap: '2px',
                    position: 'absolute',
                    bottom: '3px'
                  }}>
                    {hasSales && <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isSelected ? '#ffffff' : 'var(--success)' }}></div>}
                    {hasExpenses && <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isSelected ? '#ffffff' : 'var(--danger)' }}></div>}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {reportMode === 'single' ? (
          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <label className="input-label" style={{ fontSize: '12px' }}>Ou escolha no calendário do sistema:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                if (e.target.value) {
                  setStartDate(e.target.value);
                  setEndDate(e.target.value);
                  setCurrentMonth(new Date(e.target.value));
                }
              }}
              className="input-field"
              style={{ padding: '8px 12px', height: '38px', fontSize: '13px' }}
            />
          </div>
        ) : (
          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="input-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Data Inicial:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setStartDate(e.target.value);
                    }
                  }}
                  className="input-field"
                  style={{ padding: '6px 8px', fontSize: '12px', height: '36px' }}
                />
              </div>
              <div>
                <label className="input-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Data Final:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setEndDate(e.target.value);
                    }
                  }}
                  className="input-field"
                  style={{ padding: '6px 8px', fontSize: '12px', height: '36px' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lado Direito: Relatório do Dia */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="section-card">
          <div className="card-header">
            <h3 className="card-title">
              {reportMode === 'single'
                ? `Relatório Diário — ${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')}`
                : `Relatório de Período — ${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} até ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}`
              }
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--primary-glow)', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase' }}>Faturamento</span>
              <strong style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: '4px' }}>
                R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>

            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--success-glow)', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--success)', textTransform: 'uppercase' }}>Lucro Presumido</span>
              <strong style={{ fontSize: '20px', color: 'var(--success)', marginTop: '4px' }}>
                R$ {totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>

            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--danger-glow)', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--danger)', textTransform: 'uppercase' }}>Despesas</span>
              <strong style={{ fontSize: '20px', color: 'var(--danger)', marginTop: '4px' }}>
                R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

          <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: netCash >= 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>Saldo Líquido de Caixa:</span>
            <strong style={{ fontSize: '16px', color: netCash >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              R$ {netCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </strong>
          </div>

          {/* Caixa de Abertura e Fechamento no Relatório Diário */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginTop: '16px',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '16px'
          }}>
            <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Abertura de Caixa</div>
              <strong style={{ fontSize: '14px', color: 'var(--text-primary)', marginTop: '2px', display: 'block' }}>
                R$ {openingCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'var(--primary-glow)' }}>
              <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Fechamento de Caixa</div>
              <strong style={{ fontSize: '14px', color: 'var(--primary)', marginTop: '2px', display: 'block' }}>
                R$ {closingCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          </div>
        </div>

        {/* Relatório de Meios de Pagamento */}
        <div className="section-card">
          <div className="card-header" style={{ marginBottom: '12px' }}>
            <h3 className="card-title">Faturamento por Meio de Pagamento</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Pix */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={16} style={{ color: '#3b82f6' }} />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Pix</span>
              </div>
              <strong style={{ fontSize: '14px', color: '#3b82f6' }}>R$ {pixAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </div>

            {/* Dinheiro */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Coins size={16} style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Dinheiro</span>
              </div>
              <strong style={{ fontSize: '14px', color: 'var(--success)' }}>R$ {cashAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </div>

            {/* Cartões */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={16} style={{ color: 'var(--brand-yellow)' }} />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>Cartões (Crédito/Débito)</span>
              </div>
              <strong style={{ fontSize: '14px', color: 'var(--brand-yellow)' }}>R$ {cardAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
            </div>

            {/* Outros */}
            {otherAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Info size={16} style={{ color: 'var(--text-secondary)' }} />
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>Outros</span>
                </div>
                <strong style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>R$ {otherAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </div>
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="card-header">
            <h3 className="card-title">Vendas Registradas ({daySales.length})</h3>
          </div>
          <div className="table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {daySales.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: '14px' }}>Nenhuma venda registrada nesta data.</p>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Horário</th>
                    <th>ID</th>
                    <th>Itens</th>
                    <th>Pagamento</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {daySales.map(sale => (
                    <tr key={sale.id}>
                      <td>{new Date(sale.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ fontWeight: '700' }}>{sale.id}</td>
                      <td>{sale.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}</td>
                      <td>{sale.paymentMethod}</td>
                      <td style={{ fontWeight: '700', color: 'var(--primary)' }}>R$ {sale.totalPrice.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="card-header">
            <h3 className="card-title">Despesas Registradas ({dayExpenses.length})</h3>
          </div>
          <div className="table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {dayExpenses.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: '14px' }}>Nenhuma despesa registrada nesta data.</p>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Categoria</th>
                    <th>Descrição</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {dayExpenses.map(exp => (
                    <tr key={exp.id}>
                      <td style={{ fontWeight: '700' }}>{exp.id}</td>
                      <td>{exp.category}</td>
                      <td>{exp.description}</td>
                      <td style={{ fontWeight: '700', color: 'var(--danger)' }}>R$ {exp.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 10. COMPONENTE: RECIBO TÉRMICO DE VENDA
// ==========================================
function ReceiptModal({ receipt, onClose }) {
  if (!receipt) return null;

  const subtotal = receipt.items.reduce((sum, item) => sum + item.salePrice * item.quantity, 0);
  const total = Math.max(0, subtotal - (receipt.discount || 0));
  const change = receipt.paymentMethod === 'Dinheiro' && receipt.amountPaid > total
    ? receipt.amountPaid - total
    : 0;

  const handlePrint = () => {
    const printContent = document.getElementById('thermal-receipt-print-area').innerHTML;

    // Abrir uma janela de impressão limpa
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Cupom de Venda - Novo Lar</title>
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              color: #000;
              margin: 10px;
              padding: 0;
              width: 300px;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .item-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .totals-row { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 2px; }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '380px', padding: '20px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '18px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={20} style={{ color: 'var(--success)' }} />
            Venda Concluída!
          </h2>
        </div>

        <div className="modal-body" style={{ maxHeight: '420px', overflowY: 'auto', padding: '10px 0' }}>
          {/* Bobina Térmica Simulada */}
          <div
            id="thermal-receipt-print-area"
            style={{
              backgroundColor: '#fffcf5',
              border: '1px solid #e0dcd3',
              borderRadius: 'var(--radius-sm)',
              padding: '16px',
              fontFamily: '"Courier New", Courier, monospace',
              color: '#333',
              boxShadow: 'inset 0 0 10px rgba(0,0,0,0.02)',
              fontSize: '13px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <img src="logo.png" alt="Novo Lar Logo" style={{ maxWidth: '140px', height: 'auto', display: 'block', margin: '0 auto' }} />
            </div>
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15px' }}>NOVO LAR CASA & CONSTRUÇÃO</div>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#666', marginTop: '2px' }}>LOJA MATRIZ - CNPJ: 62.002.153/0001-25</div>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#666' }}>Rua das Rosas, 1077 - Jardim Novo Eden</div>

            <div style={{ borderTop: '1px dashed #ccc', margin: '10px 0' }}></div>

            <div><strong>CUPOM NÃO FISCAL - VENDA #{receipt.id}</strong></div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
              Data: {new Date(receipt.timestamp).toLocaleString('pt-BR')}
            </div>

            <div style={{ borderTop: '1px dashed #ccc', margin: '10px 0' }}></div>

            {/* Itens */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {receipt.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#555' }}>
                    <span>{item.quantity} {item.unit} x R$ {item.salePrice.toFixed(2)}</span>
                    <strong>R$ {(item.salePrice * item.quantity).toFixed(2)}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px dashed #ccc', margin: '10px 0' }}></div>

            {/* Totais */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {receipt.discount > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span>Subtotal:</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#16a34a' }}>
                    <span>Desconto:</span>
                    <span>- R$ {receipt.discount.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
                <span>TOTAL</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>Forma Pagto:</span>
                <span>{receipt.paymentMethod}</span>
              </div>
              {receipt.paymentMethod === 'Dinheiro' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span>Valor Pago:</span>
                    <span>R$ {receipt.amountPaid.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', color: 'var(--success)' }}>
                    <span>Troco:</span>
                    <span>R$ {change.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            <div style={{ borderTop: '1px dashed #ccc', margin: '10px 0' }}></div>

            <div style={{ textAlign: 'center', fontSize: '11px', fontStyle: 'italic', color: '#666' }}>
              Obrigado pela preferência!<br />Volte sempre!
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', gap: '8px', width: '100%' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: 1 }}
            onClick={onClose}
          >
            Fechar
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ flex: 1.5, gap: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={handlePrint}
          >
            <Printer size={16} /> Imprimir Cupom
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 10. TELA: ASSISTENTE DE IA E INTELIGÊNCIA COMERCIAL
// ==========================================
function AIAssistantView({ products, sales, expenses }) {
  // Estado da chave da API e controle da gaveta de configuração
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('novo_lar_gemini_api_key') || '';
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [keyInput, setKeyInput] = useState(apiKey);
  const [saveStatus, setSaveStatus] = useState('');

  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Olá! Sou o **Novo Lar Copilot**, a inteligência comercial dedicada para o seu depósito de materiais de construção.\n\nAnalisei seu estoque, custos e histórico de vendas. O que você gostaria de saber?\n\n* **Quais produtos trazem mais lucro para a loja?**\n* **O que preciso comprar para repor o estoque hoje?**\n* **Quais itens estão parados (encalhados)?**\n* **Ideias para aumentar as vendas com ofertas combinadas.**\n\n*💡 Para ativar a inteligência real capaz de responder qualquer pergunta livre, insira sua chave da API do Gemini clicando no ícone de engrenagem no topo do chat.*',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Salvar a chave da API no localStorage
  const handleSaveApiKey = (e) => {
    e.preventDefault();
    localStorage.setItem('novo_lar_gemini_api_key', keyInput);
    setApiKey(keyInput);
    setSaveStatus('Chave salva com sucesso!');
    setTimeout(() => {
      setSaveStatus('');
      setIsDrawerOpen(false);
    }, 1500);
  };

  // Verifica se o estoque está vazio
  const isEstoqueVazio = products.length === 0;

  // Lógica de análise de categorias para uma loja de materiais de construção
  const categoriesList = ['Materiais Básicos', 'Hidráulica', 'Elétrica', 'Tintas', 'Acabamento', 'Ferragens'];

  const categoryStats = categoriesList.map(cat => {
    const catProducts = products.filter(p => p.category === cat);
    const total = catProducts.length;
    if (total === 0) return { category: cat, total: 0, critical: 0, health: 0, class: 'warning', label: 'Sem Cadastro' };

    const critical = catProducts.filter(p => getProductStock(p) <= p.minStock).length;
    const goodCount = total - critical;
    const health = Math.round((goodCount / total) * 100);

    let statusClass = 'good';
    let statusLabel = 'Saudável';
    if (health < 40) {
      statusClass = 'critical';
      statusLabel = 'Crítico';
    } else if (health < 75) {
      statusClass = 'warning';
      statusLabel = 'Atenção';
    }

    return {
      category: cat,
      total,
      critical,
      health,
      class: statusClass,
      label: statusLabel
    };
  });

  // Lógica de processamento de dados para análise de vendas
  const productSalesMap = {};
  sales.forEach(sale => {
    if (sale.items) {
      sale.items.forEach(item => {
        const id = item.productId || item.id;
        if (id) {
          productSalesMap[id] = (productSalesMap[id] || 0) + (item.quantity || 0);
        }
      });
    }
  });

  const productListWithSales = products.map(p => {
    const qtySold = productSalesMap[p.id] || 0;
    const unitProfit = p.salePrice - p.costPrice;
    const totalProfit = qtySold * unitProfit;
    return {
      ...p,
      qtySold,
      unitProfit,
      totalProfit
    };
  });

  const maisVendidos = [...productListWithSales]
    .filter(p => p.qtySold > 0)
    .sort((a, b) => b.qtySold - a.qtySold)
    .slice(0, 5);

  const menosVendidos = [...productListWithSales]
    .sort((a, b) => a.qtySold - b.qtySold)
    .slice(0, 5);

  const emAlertaEstoque = productListWithSales.filter(p => getProductStock(p) <= p.minStock);

  const recomendacoesReposicao = emAlertaEstoque.map(p => {
    const priorityScore = p.unitProfit * (p.qtySold + 1);
    let priorityLabel = 'Baixa';
    let priorityClass = 'low';

    if (priorityScore >= 30 || (p.qtySold > 10 && p.unitProfit > 5)) {
      priorityLabel = 'Alta';
      priorityClass = 'high';
    } else if (priorityScore >= 10 || p.qtySold > 2) {
      priorityLabel = 'Média';
      priorityClass = 'medium';
    }

    return {
      ...p,
      priorityScore,
      priorityLabel,
      priorityClass
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);

  // Diagnóstico Comercial Inteligente (IA) - Métricas Reais
  const totalRevenue = sales.reduce((sum, s) => sum + s.totalPrice, 0);
  const totalCost = sales.reduce((sum, s) => sum + s.totalCost, 0);
  const totalProfit = totalRevenue - totalCost;
  const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const salesCount = sales.length;
  const ticketMedio = salesCount > 0 ? totalRevenue / salesCount : 0;

  const totalStockCost = products.reduce((sum, p) => sum + (p.stock * p.costPrice), 0);

  const deadStockProducts = productListWithSales.filter(p => p.qtySold === 0 && p.stock > 0);
  const deadStockCost = deadStockProducts.reduce((sum, p) => sum + (p.stock * p.costPrice), 0);

  const replacementCost = emAlertaEstoque.reduce((sum, p) => {
    const qtyNeeded = p.minStock - p.stock;
    return sum + (qtyNeeded > 0 ? qtyNeeded * p.costPrice : 0);
  }, 0);

  const potentialRevenue = products.reduce((sum, p) => sum + (p.stock * p.salePrice), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalProfit - totalExpenses;

  // Enviar pergunta para a API do Gemini ou Fallback Local
  const handleAskAI = async (question) => {
    if (!question.trim()) return;

    const userMsg = { sender: 'user', text: question, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    if (apiKey.trim()) {
      // PROMPT DO SISTEMA COM DADOS EM TEMPO REAL EM JSON
      const systemPrompt = `Você é o "Novo Lar Copilot", um assistente inteligente e analista de negócios especialista em depósitos de materiais de construção.
Você está integrado ao sistema comercial do depósito "Novo Lar - Casa & Construção" e tem acesso ao banco de dados atualizado da loja em tempo real.

Sua tarefa:
1. Responder à dúvida do dono da loja em português de forma clara, prestativa e estruturada.
2. Usar dados reais do JSON fornecido para fazer contas de lucros, faturamento, despesas e estoque.
3. Se a pergunta for sobre reposição, ajude a decidir o que comprar com base no lucro (Preço Venda - Preço Custo) e se o produto tem saída. Explique que itens de obra bruta (como Cimento) são essenciais, mas itens de acabamento/elétrica dão margem maior.
4. Dar ideias de mercado criativas para vender produtos de material de construção (como combos, descontos no Pix, cross-selling como cimento + argamassa, rolos + tintas).
5. Responda usando Markdown rico (negrito, listas e tabelas pequenas quando relevante). Seja conciso e direto ao ponto.

Abaixo estão os dados reais do banco de dados da loja em formato JSON:
${JSON.stringify({
        produtos: products.map(p => ({
          id: p.id,
          codigo: p.code,
          nome: p.name,
          categoria: p.category,
          estoque: p.stock,
          estoque_minimo: p.minStock,
          preco_custo: p.costPrice,
          preco_venda: p.salePrice,
          unidade: p.unit
        })),
        vendas: sales.map(s => ({
          id: s.id,
          data: s.timestamp,
          loja: s.storeId,
          total: s.totalPrice,
          custo: s.totalCost,
          lucro: s.profit,
          pagamento: s.paymentMethod,
          itens: s.items.map(i => ({ nome: i.name, quantidade: i.quantity, preco: i.salePrice }))
        })),
        despesas: expenses.map(e => ({
          id: e.id,
          data: e.timestamp,
          descricao: e.description,
          valor: e.amount,
          categoria: e.category
        }))
      }, null, 2)}`;

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${systemPrompt}\n\nPergunta do Lojista:\n"${question}"` }
                ]
              }
            ]
          })
        });

        if (!response.ok) {
          throw new Error('Falha na resposta da API');
        }

        const data = await response.json();
        const replyText = data.candidates[0].content.parts[0].text;
        setMessages(prev => [...prev, { sender: 'ai', text: replyText, timestamp: new Date() }]);
      } catch (err) {
        console.error("Erro na chamada do Gemini API, usando fallback offline:", err);
        setMessages(prev => [...prev, {
          sender: 'ai',
          text: `⚠️ **Erro na conexão com a IA Real (Gemini)**. Houve um problema ao conectar com a sua chave de API. Verifique a internet e a chave. \n\n*Ativando resposta de backup local:*\n\n${getLocalFallbackResponse(question)}`,
          timestamp: new Date()
        }]);
      } finally {
        setIsTyping(false);
      }
    } else {
      // FALLBACK LOCAL OFFLINE SE NÃO HOUVER API KEY
      setTimeout(() => {
        const localResponse = getLocalFallbackResponse(question);
        setMessages(prev => [...prev, { sender: 'ai', text: localResponse, timestamp: new Date() }]);
        setIsTyping(false);
      }, 1000);
    }
  };

  // Algoritmo local offline para gerar respostas pré-programadas baseadas no DB real
  const getLocalFallbackResponse = (question) => {
    const normalizedQuestion = question.toLowerCase();

    if (isEstoqueVazio) {
      return 'Atualmente você não possui produtos cadastrados no estoque. Por favor, adicione os produtos na aba de **Administração** primeiro para que eu possa analisar custos e sugerir lucros!';
    }

    if (normalizedQuestion.includes('lucro') || normalizedQuestion.includes('lucrativo') || normalizedQuestion.includes('margem')) {
      const sortedByProfit = [...productListWithSales]
        .sort((a, b) => b.unitProfit - a.unitProfit)
        .slice(0, 3);

      let text = 'Aqui estão os **3 produtos mais lucrativos** (maior lucro unitário) cadastrados na sua loja:\n\n';
      sortedByProfit.forEach((p, idx) => {
        const margin = p.salePrice > 0 ? ((p.unitProfit / p.salePrice) * 100).toFixed(0) : 0;
        text += `${idx + 1}. **${p.name}**\n   * Lucro por unidade: **R$ ${p.unitProfit.toFixed(2)}** (Margem: **${margin}%**)\n   * Preço de Venda: R$ ${p.salePrice.toFixed(2)} / Custo: R$ ${p.costPrice.toFixed(2)}\n   * Giro de Vendas: ${p.qtySold} unidades vendidas.\n\n`;
      });
      text += '💡 **Dica de Construção:** Produtos de acabamento (torneiras) ou elétrica costumam ter margem maior que materiais básicos. Impulsione a venda deles no balcão!';
      return text;
    }
    else if (normalizedQuestion.includes('comprar') || normalizedQuestion.includes('repor') || normalizedQuestion.includes('estoque') || normalizedQuestion.includes('pedido')) {
      if (emAlertaEstoque.length === 0) {
        return 'Parabéns! Todos os produtos da sua loja estão com estoque acima do nível mínimo. **Não há necessidade de reposição urgente** no momento.';
      }

      let text = `Identifiquei **${emAlertaEstoque.length} produtos** abaixo do estoque mínimo. Segue a ordem de compras priorizada por margem de lucro e giro:\n\n`;
      const maxPriority = recomendacoesReposicao.filter(r => r.priorityLabel === 'Alta');
      const medPriority = recomendacoesReposicao.filter(r => r.priorityLabel === 'Média');
      const lowPriority = recomendacoesReposicao.filter(r => r.priorityLabel === 'Baixa');

      if (maxPriority.length > 0) {
        text += '🔥 **Prioridade Máxima (Repor Urgente)**\n';
        maxPriority.forEach(p => {
          text += `* **${p.name}** (Estoque: ${p.stock}/${p.minStock}) — Lucro de R$ ${p.unitProfit.toFixed(2)} por unidade. Vendeu ${p.qtySold} un.\n`;
        });
        text += '\n';
      }
      if (medPriority.length > 0) {
        text += '⚡ **Prioridade Média (Planejar Compra)**\n';
        medPriority.forEach(p => {
          text += `* **${p.name}** (Estoque: ${p.stock}/${p.minStock}) — Lucro de R$ ${p.unitProfit.toFixed(2)}/un.\n`;
        });
        text += '\n';
      }
      if (lowPriority.length > 0) {
        text += '💤 **Prioridade Baixa (Adiar)**\n';
        lowPriority.forEach(p => {
          text += `* **${p.name}** — Margem baixa ou encalhado no histórico.\n`;
        });
      }
      return text;
    }
    else if (normalizedQuestion.includes('encalhado') || normalizedQuestion.includes('parado') || normalizedQuestion.includes('sem venda') || normalizedQuestion.includes('menos vendem')) {
      const parados = productListWithSales
        .filter(p => p.qtySold === 0 && p.stock > 0)
        .sort((a, b) => b.stock - a.stock)
        .slice(0, 3);

      if (parados.length === 0) {
        return 'Excelente! Todos os produtos cadastrados registraram movimentação de vendas recente.';
      }

      let text = 'Identifiquei os seguintes **produtos parados** (sem vendas e com estoque acumulado):\n\n';
      parados.forEach(p => {
        text += `* **${p.name}**\n  * Estoque atual: **${p.stock}** unidades paradas.\n  * Valor de custo parado: **R$ ${(p.stock * p.costPrice).toFixed(2)}**\n\n`;
      });
      text += '📣 **Recomendação da IA:** Crie ofertas do tipo "Combos de Construção". Ex: Na compra de uma lata de Tinta Acrílica, dê 15% de desconto no Rolo de Pintura parado.';
      return text;
    }
    else if (normalizedQuestion.includes('dica') || normalizedQuestion.includes('ideia') || normalizedQuestion.includes('mercado') || normalizedQuestion.includes('aumentar') || normalizedQuestion.includes('vender')) {
      return 'Aqui estão **3 ideias de mercado** focadas para depósitos de materiais de construção:\n\n' +
        '1. **O Combo do Pintor**\n   * Junte **Tinta Coral Branca 18L** com **Rolo de Lã Tigre** e **Fita Isolante** como um pacote promocional de pintura básica. Isso aumenta a saída de acessórios.\n\n' +
        '2. **Incentivo de Caixa para PIX**\n   * Crie um cartaz no balcão: *"3% de desconto em materiais básicos para pagamentos no Pix"*. Como cimento e tijolo têm margem apertada, economizar nas taxas de cartão melhora seu fluxo de caixa.\n\n' +
        '3. **Venda Casada Opcional**\n   * Quem compra **Cimento CP II** geralmente precisa de **Argamassa ACIII** e colheres de pedreiro. Incentive o operador de caixa a perguntar sobre esses materiais complementares a cada venda faturada.';
    }

    const totalRev = sales.reduce((sum, s) => sum + s.totalPrice, 0);
    const totalProf = totalRev - sales.reduce((sum, s) => sum + s.totalCost, 0);

    return `Olá! Sou o analista de IA da loja. Veja um resumo rápido da operação:\n\n` +
      `* **Produtos Cadastrados**: ${products.length} itens\n` +
      `* **Estoque Crítico**: ${emAlertaEstoque.length} itens\n` +
      `* **Total Faturamento**: R$ ${totalRev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `* **Lucro Presumido**: R$ ${totalProf.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
      `Insira uma chave API do Gemini nas configurações do chat para poder fazer qualquer pergunta livre, ou use os botões rápidos abaixo!`;
  };

  // Auxiliar para formatar tags de negrito e listas em HTML real na bolha de chat
  const formatMessageText = (text) => {
    return text.split('\n').map((line, idx) => {
      let content = line;
      let isBullet = false;
      if (line.trim().startsWith('* ')) {
        content = line.trim().slice(2);
        isBullet = true;
      }

      const parts = content.split('**');
      const parsedLine = parts.map((part, pIdx) => {
        if (pIdx % 2 === 1) {
          return <strong key={pIdx}>{part}</strong>;
        }
        return part;
      });

      if (isBullet) {
        return (
          <li key={idx} style={{ marginLeft: '20px', marginBottom: '4px', listStyleType: 'disc' }}>
            {parsedLine}
          </li>
        );
      }

      return <div key={idx} style={{ marginBottom: line ? '6px' : '12px' }}>{parsedLine}</div>;
    });
  };

  return (
    <div className="ai-assistant-layout" style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* Coluna da Esquerda: Relatórios e Estatísticas */}
      <div className="ai-assistant-left-col">

        {isEstoqueVazio ? (
          /* Estado Onboarding se não houver produtos cadastrados */
          <div className="ai-onboarding-card">
            <div className="ai-onboarding-icon">
              <Package size={32} />
            </div>
            <h3 className="ai-onboarding-title">Bem-vindo ao Novo Lar Copilot!</h3>
            <p className="ai-onboarding-desc">
              Esta é a central de Inteligência Comercial da sua loja. No momento, o seu estoque está sem nenhum material cadastrado.
            </p>
            <p className="ai-onboarding-desc" style={{ fontSize: '12.5px', marginTop: '-8px', opacity: 0.85 }}>
              Para começarmos a analisar margens de lucro, classificar prioridades de reposição por canteiro de obras e gerar insights financeiros em tempo real, acesse a aba <strong>Administração &gt; Cadastrar Produtos</strong> e adicione seus materiais (como cimento, fios, tintas e tubos).
            </p>
          </div>
        ) : (
          <>
            {/* PAINEL UNIFICADO 1: Saúde do Estoque e Reposição Comercial */}
            <div className="category-stock-card">
              <div className="ai-glow-header" style={{ marginBottom: '20px' }}>
                <div className="ai-glow-icon">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="ai-glow-title">Setores da Obra & Saúde do Estoque</h3>
                  <p className="ai-glow-subtitle">Acompanhamento e alertas por departamento do depósito</p>
                </div>
              </div>

              <div className="category-stock-grid">
                {categoryStats.map((stat, idx) => (
                  <div className="category-stock-item" key={idx}>
                    <div className="category-stock-header">
                      <span>{stat.category}</span>
                      <span className={`category-stock-badge ${stat.class}`}>
                        {stat.total === 0 ? 'Sem Cadastro' : stat.critical > 0 ? `${stat.critical} em Alerta` : 'Estável'}
                        {stat.total > 0 && ` (${stat.health}%)`}
                      </span>
                    </div>
                    <div className="category-progress-container">
                      <div
                        className={`category-progress-bar ${stat.class}`}
                        style={{ width: stat.total > 0 ? `${stat.health}%` : '0%' }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '22px 0' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Package size={16} style={{ color: 'var(--primary)' }} />
                <h4 style={{ fontSize: '13px', fontWeight: '800', margin: 0 }}>Plano de Compras Sugerido</h4>
              </div>

              {recomendacoesReposicao.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                  <CheckCircle size={20} style={{ color: 'var(--success)', marginBottom: '6px', display: 'block', margin: '0 auto 6px auto' }} />
                  Todos os materiais básicos e acabamentos estão abastecidos acima do estoque mínimo.
                </div>
              ) : (
                <div className="table-responsive" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <table className="products-table" style={{ fontSize: '11.5px' }}>
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th style={{ textAlign: 'center' }}>Qtd (Est./Mín)</th>
                        <th style={{ textAlign: 'right' }}>Lucro Unit.</th>
                        <th style={{ textAlign: 'center' }}>Giro</th>
                        <th style={{ textAlign: 'center' }}>Prioridade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recomendacoesReposicao.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: '600' }}>
                            <span style={{ fontSize: '9px', display: 'block', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                              {item.category}
                            </span>
                            {item.name}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: '600' }}>
                            {item.stock} / {item.minStock}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: '700' }}>
                            R$ {item.unitProfit.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: '600' }}>{item.qtySold} un.</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`priority-badge ${item.priorityClass}`} style={{ fontSize: '9px', padding: '1px 6px' }}>
                              {item.priorityLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* PAINEL UNIFICADO 2: Giro Comercial & Dicas de Negócio */}
            <div className="card" style={{ padding: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <TrendingUp size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '14px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Giro de Estoque e Lucratividade</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                {/* Mais Vendidos */}
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <TrendingUp size={14} style={{ color: 'var(--success)' }} />
                    <span style={{ fontSize: '12px', fontWeight: '700' }}>Líderes de Saída</span>
                  </div>
                  {maisVendidos.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>Aguardando vendas no PDV.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {maisVendidos.map((p, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', paddingBottom: '4px', borderBottom: '1px solid var(--border-color)' }}>
                          <span style={{ fontWeight: '600', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {idx + 1}. {p.name}
                          </span>
                          <strong style={{ color: 'var(--primary)' }}>{p.qtySold} un.</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Encalhados */}
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <AlertTriangle size={14} style={{ color: 'var(--brand-yellow)' }} />
                    <span style={{ fontSize: '12px', fontWeight: '700' }}>Parados no Depósito</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {menosVendidos.slice(0, 5).map((p, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', paddingBottom: '4px', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ fontWeight: '600', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: p.qtySold === 0 ? 'var(--text-muted)' : 'inherit' }}>
                          {idx + 1}. {p.name}
                        </span>
                        <strong style={{ color: p.qtySold === 0 ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                          {p.qtySold === 0 ? 'Sem Saída' : `${p.qtySold} un.`}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '18px 0' }} />

              {/* Diagnóstico Comercial Inteligente (IA) */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                  <Sparkles size={16} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>Diagnóstico Comercial Inteligente (IA)</span>
                </div>

                <div className="ai-diagnostic-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px'
                }}>
                  {/* Card 1: Margem Comercial Média */}
                  <div style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-tertiary)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '120px'
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                          Margem Comercial Média
                        </span>
                        <span style={{ fontSize: '11px' }}>
                          {averageMargin >= 30 ? '🟢 Boa' : averageMargin >= 15 ? '🟡 Regular' : '🔴 Baixa'}
                        </span>
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: averageMargin >= 30 ? 'var(--success)' : averageMargin >= 15 ? 'var(--warning)' : 'var(--danger)', lineHeight: '1.2', marginBottom: '4px' }}>
                        {averageMargin.toFixed(1)}%
                      </div>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.3' }}>
                      Média de lucro líquido percentual sobre o valor das mercadorias vendidas.
                    </p>
                  </div>

                  {/* Card 2: Ticket Médio */}
                  <div style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-tertiary)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '120px'
                  }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.3px' }}>
                        Ticket Médio por Venda
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary)', lineHeight: '1.2', marginBottom: '4px' }}>
                        R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.3' }}>
                      Valor médio gasto por cada cliente em cada compra ({salesCount} vendas no período).
                    </p>
                  </div>

                  {/* Card 3: Capital em Estoque */}
                  <div style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-tertiary)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '120px'
                  }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.3px' }}>
                        Capital Total no Estoque
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1.2', marginBottom: '4px' }}>
                        R$ {totalStockCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.3' }}>
                      Custo total pago para adquirir os produtos atualmente parados no estoque (Giro zero: R$ {deadStockCost.toLocaleString('pt-BR')}).
                    </p>
                  </div>

                  {/* Card 4: Investimento de Reposição */}
                  <div style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-tertiary)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '120px'
                  }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.3px' }}>
                        Investimento de Reposição
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: replacementCost > 0 ? 'var(--warning)' : 'var(--success)', lineHeight: '1.2', marginBottom: '4px' }}>
                        R$ {replacementCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.3' }}>
                      Custo necessário para comprar produtos que estão abaixo do estoque mínimo ({emAlertaEstoque.length} itens).
                    </p>
                  </div>

                  {/* Card 5: Faturamento Potencial */}
                  <div style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-tertiary)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '120px'
                  }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.3px' }}>
                        Faturamento Potencial
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary)', lineHeight: '1.2', marginBottom: '4px' }}>
                        R$ {potentialRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.3' }}>
                      Dinheiro total que entrará no caixa caso você venda todo o estoque atual pelo preço final de balcão.
                    </p>
                  </div>

                  {/* Card 6: Resultado Líquido Operacional */}
                  <div style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-tertiary)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '120px'
                  }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.3px' }}>
                        Resultado Líquido Operacional
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)', lineHeight: '1.2', marginBottom: '4px' }}>
                        R$ {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.3' }}>
                      Lucro bruto das vendas subtraindo todas as despesas comerciais registradas no período.
                    </p>
                  </div>

                </div>
              </div>

            </div>
          </>
        )}

      </div>

      {/* Coluna da Direita: Chat Interativo da IA */}
      <div className="ai-chat-card">

        {/* Cabeçalho do Chat com botão de Configurações da Chave da API */}
        <div className="ai-chat-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="ai-chat-pulse"></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '800', fontSize: '14px' }}>Novo Lar Copilot</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {apiKey ? 'Inteligência Real Gemini Ativa' : 'Modo Assistente Local'}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="chat-quick-btn"
            style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            title="Configurar Chave da API do Gemini"
          >
            <Database size={12} /> Configurar IA
          </button>
        </div>

        {/* Gaveta de Configurações Retrátil */}
        <div className={`ai-key-drawer ${isDrawerOpen ? 'open' : ''}`}>
          <form onSubmit={handleSaveApiKey}>
            <div className="ai-key-drawer-title">
              <span>Chave de API do Gemini (Grátis):</span>
              <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="ai-key-drawer-link">
                Obter Chave Grátis ↗
              </a>
            </div>
            <div className="ai-key-drawer-input-group">
              <input
                type="password"
                placeholder="Insira sua API Key do Gemini aqui..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="chat-input"
                style={{ padding: '8px 12px', fontSize: '12px' }}
              />
              <button type="submit" className="chat-submit-btn" style={{ padding: '8px 14px' }}>
                Salvar
              </button>
            </div>
            {saveStatus && (
              <div style={{ fontSize: '11px', color: 'var(--success)', marginTop: '6px', fontWeight: 'bold' }}>
                {saveStatus}
              </div>
            )}
          </form>
        </div>

        {/* Balão de Mensagens do Chat com Avatares Estilizados */}
        <div className="ai-chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className="chat-avatar-wrapper" style={{ flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row' }}>

              {/* Círculo do Avatar */}
              <div className={`chat-avatar ${msg.sender === 'user' ? 'user' : ''}`}>
                {msg.sender === 'user' ? 'U' : 'N'}
              </div>

              {/* Bolha de Mensagem */}
              <div className="chat-message-container">
                <span className={`chat-sender-name ${msg.sender === 'user' ? 'user' : ''}`}>
                  {msg.sender === 'user' ? 'Lojista' : 'Novo Lar Copilot'}
                </span>
                <div className={`chat-bubble ${msg.sender}`}>
                  {formatMessageText(msg.text)}
                  <div style={{
                    fontSize: '9px',
                    textAlign: msg.sender === 'user' ? 'right' : 'left',
                    opacity: 0.6,
                    marginTop: '4px'
                  }}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

            </div>
          ))}
          {isTyping && (
            <div className="chat-avatar-wrapper">
              <div className="chat-avatar">N</div>
              <div className="chat-message-container">
                <span className="chat-sender-name">Novo Lar Copilot</span>
                <div className="chat-bubble ai">
                  <div className="typing-dots">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Sugestões de Perguntas Rápidas */}
        <div className="chat-quick-questions">
          <button
            className="chat-quick-btn"
            onClick={() => handleAskAI('Quais produtos trazem mais lucro na loja?')}
          >
            📈 Produtos mais Lucrativos
          </button>
          <button
            className="chat-quick-btn"
            onClick={() => handleAskAI('O que preciso comprar para repor estoque hoje?')}
          >
            📋 O que Comprar Hoje?
          </button>
          <button
            className="chat-quick-btn"
            onClick={() => handleAskAI('Quais produtos estão encalhados no estoque?')}
          >
            💤 Produtos Encalhados
          </button>
          <button
            className="chat-quick-btn"
            onClick={() => handleAskAI('Dicas de mercado para aumentar as vendas')}
          >
            💡 Ideias de Mercado
          </button>
        </div>

        {/* Campo de Entrada de Texto */}
        <div className="chat-input-area">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskAI(inputValue);
            }}
            className="chat-form"
          >
            <input
              type="text"
              placeholder="Pergunte ao Assistente IA..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="chat-input"
              disabled={isTyping}
            />
            <button
              type="submit"
              className="chat-submit-btn"
              disabled={isTyping || !inputValue.trim()}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}

// ==========================================
// 6. COMPONENTE: CONTROLE DE ENTREGAS
// ==========================================
function DeliveriesView({ sales, onUpdateDeliveryStatus, onGenerateInvoice }) {
  const [filterStatus, setFilterStatus] = useState('Pendente'); // 'Pendente' | 'Entregue' | 'Todas'
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar apenas as vendas que agendaram entrega
  const deliverySales = sales.filter(s => s.deliveryDetails && s.deliveryDetails.requiresDelivery);

  const filteredDeliveries = deliverySales.filter(s => {
    const matchesStatus = filterStatus === 'Todas' || s.deliveryDetails.status === filterStatus;
    const matchesSearch =
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.deliveryDetails.receiver && s.deliveryDetails.receiver.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.deliveryDetails.address && s.deliveryDetails.address.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="section-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
        <h2 className="card-title">
          <Truck size={20} className="brand-icon" style={{ color: 'var(--primary)' }} />
          Painel de Controle de Entregas
        </h2>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: '1', justifyContent: 'flex-end', maxWidth: '600px' }}>
          <div className="input-group" style={{ maxWidth: '250px', width: '100%' }}>
            <Search className="input-icon" size={18} />
            <input
              type="text"
              className="input-field"
              style={{ padding: '8px 12px 8px 36px', fontSize: '13px' }}
              placeholder="Buscar por ID, recebedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
            {['Pendente', 'Entregue', 'Todas'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`tab-btn-pill ${filterStatus === status ? 'active' : ''}`}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: filterStatus === status ? 'var(--primary)' : 'transparent',
                  color: filterStatus === status ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {status === 'Todas' ? 'Todas' : (status === 'Pendente' ? 'Pendentes ' : 'Entregues ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="table-container">
        {filteredDeliveries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <Truck size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p>Nenhuma entrega programada encontrada para este filtro.</p>
          </div>
        ) : (
          <table className="custom-table table-responsive">
            <thead>
              <tr>
                <th>Venda</th>
                <th>Recebedor / Contato</th>
                <th>Endereço de Entrega</th>
                <th>Data Programada</th>
                <th>Itens a Entregar</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeliveries.map(sale => {
                const det = sale.deliveryDetails;
                const formattedDate = det.date
                  ? new Date(det.date + 'T00:00:00').toLocaleDateString('pt-BR')
                  : 'Não especificada';

                return (
                  <tr key={sale.id}>
                    <td>
                      <div>
                        <strong>{sale.id}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(sale.timestamp).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong>{det.receiver || 'Não informado'}</strong>
                        {det.notes && <div style={{ fontSize: '11px', color: 'var(--brand-yellow)', fontWeight: '500' }}>Obs: {det.notes}</div>}
                      </div>
                    </td>
                    <td><span style={{ fontSize: '12px' }}>{det.address || 'Não informado'}</span></td>
                    <td><strong>{formattedDate}</strong></td>
                    <td>
                      <div style={{ fontSize: '11px', maxHeight: '60px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {sale.items.map((item, idx) => (
                          <span key={idx} style={{ color: 'var(--text-secondary)' }}>
                            • {item.quantity}x {item.name.split(' ').slice(0, 3).join(' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${det.status === 'Entregue' ? 'badge-success' : 'badge-warning'}`} style={{
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: det.status === 'Entregue' ? 'var(--success-glow)' : 'rgba(243, 180, 29, 0.15)',
                        color: det.status === 'Entregue' ? 'var(--success)' : 'var(--brand-yellow)',
                        border: `1px solid ${det.status === 'Entregue' ? 'var(--success)' : 'rgba(243, 180, 29, 0.3)'}`
                      }}>
                        {det.status === 'Entregue' ? 'ENTREGUE' : 'PENDENTE'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {det.status === 'Pendente' && (
                          <button
                            className="btn-success"
                            style={{ padding: '6px 10px', fontSize: '11px', backgroundColor: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => onUpdateDeliveryStatus(sale.id, 'Entregue', new Date().toISOString())}
                          >
                            <CheckCircle size={12} /> Entregar
                          </button>
                        )}
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => onGenerateInvoice(sale)}
                        >
                          <FileText size={12} /> Nota Fiscal
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 8. COMPONENTE: CONTROLE DO COFRE (VAULT)
// ==========================================
function VaultView({ vaultTransactions, onDeleteVaultTransaction, storeId }) {
  const [simulationValue, setSimulationValue] = useState('');
  const filteredTransactions = vaultTransactions.filter(vt => vt.storeId === storeId);

  const totalDeposits = filteredTransactions
    .filter(vt => vt.type === 'deposit')
    .reduce((sum, vt) => sum + vt.amount, 0);

  const totalWithdrawals = filteredTransactions
    .filter(vt => vt.type === 'withdrawal')
    .reduce((sum, vt) => sum + vt.amount, 0);

  const balance = totalDeposits - totalWithdrawals;

  // Gerar dados históricos para o gráfico de linha/barra acumulado do cofre
  const sortedTx = [...filteredTransactions].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  let cumulative = 0;
  const balanceHistory = sortedTx.map(tx => {
    if (tx.type === 'deposit') {
      cumulative += tx.amount;
    } else {
      cumulative -= tx.amount;
    }
    return {
      timestamp: tx.timestamp,
      amount: cumulative,
      label: new Date(tx.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    };
  });

  const chartData = balanceHistory.slice(-10);
  const maxAmount = Math.max(...chartData.map(d => d.amount), 1);

  // Calcular média diária de depósitos (sangrias)
  const depositDates = {};
  filteredTransactions.filter(vt => vt.type === 'deposit').forEach(vt => {
    depositDates[vt.date] = (depositDates[vt.date] || 0) + vt.amount;
  });
  const daysWithDeposits = Object.keys(depositDates).length;
  const avgDailyDeposit = daysWithDeposits > 0 ? (totalDeposits / daysWithDeposits) : 0;

  const currentSimValue = simulationValue === '' 
    ? (avgDailyDeposit > 0 ? parseFloat(avgDailyDeposit.toFixed(2)) : 100) 
    : (parseFloat(simulationValue) || 0);

  const formatCurrency = (val) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Cards de Resumo */}
      <div className="dashboard-summary-grid">
        <div className="kpi-card profit">
          <div className="kpi-icon-wrapper">
            <Lock size={20} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Saldo Disponível no Cofre</span>
            <span className="kpi-value" style={{ color: 'var(--success)' }}>
              R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="kpi-card sales">
          <div className="kpi-icon-wrapper">
            <TrendingUp size={20} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Total Entradas (Sangrias)</span>
            <span className="kpi-value" style={{ color: 'var(--primary)' }}>
              R$ {totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="kpi-card expenses">
          <div className="kpi-icon-wrapper">
            <TrendingDown size={20} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Total Saídas (Retiradas)</span>
            <span className="kpi-value" style={{ color: 'var(--danger)' }}>
              R$ {totalWithdrawals.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Widget de Estimativa/Simulação */}
      <div className="section-card">
        <div className="card-header">
          <h3 className="card-title">
            <Sparkles size={20} className="text-primary" /> Simulador de Acúmulo do Cofre
          </h3>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          Se você continuar guardando dinheiro no cofre, veja quanto acumulará ao longo do tempo (calculado somando o saldo atual com os depósitos diários simulados):
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '12px', alignItems: 'center' }}>
          <div className="form-group">
            <label>Valor Diário de Sangria para Simular (R$):</label>
            <input
              type="number"
              placeholder={avgDailyDeposit > 0 ? avgDailyDeposit.toFixed(2) : "100.00"}
              value={simulationValue}
              onChange={(e) => setSimulationValue(e.target.value)}
              style={{ padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '14px' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Média diária atual registrada: <strong>R$ {formatCurrency(avgDailyDeposit)}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Saldo Atual no Cofre:</span>
              <strong style={{ color: 'var(--text-primary)' }}>R$ {formatCurrency(balance)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Em 7 dias (1 semana):</span>
              <strong style={{ color: 'var(--success)' }}>R$ {formatCurrency(balance + (currentSimValue * 7))}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Em 30 dias (1 mês):</span>
              <strong style={{ color: 'var(--success)' }}>R$ {formatCurrency(balance + (currentSimValue * 30))}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Em 90 dias (1 trimestre):</span>
              <strong style={{ color: 'var(--success)' }}>R$ {formatCurrency(balance + (currentSimValue * 90))}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Em 365 dias (1 ano):</span>
              <strong style={{ color: 'var(--success)' }}>R$ {formatCurrency(balance + (currentSimValue * 365))}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico de Evolução do Saldo do Cofre */}
      <div className="section-card">
        <div className="card-header">
          <h3 className="card-title">
            <TrendingUp size={20} /> Evolução de Saldo do Cofre (Últimos 10 Lançamentos)
          </h3>
        </div>
        {chartData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '14px', fontStyle: 'italic' }}>
            Nenhum dado histórico suficiente para gerar gráfico de saldo.
          </div>
        ) : (
          <div>
            <div className="chart-container" style={{ height: '180px' }}>
              {chartData.map((d, index) => {
                const percentage = Math.min(100, Math.max(5, (d.amount / maxAmount) * 100));
                return (
                  <div key={index} className="chart-bar-wrapper">
                    <div
                      className="chart-bar-fill"
                      style={{ height: `${percentage}%`, backgroundColor: 'var(--success)' }}
                    >
                      <div className="chart-tooltip">R$ {d.amount.toFixed(2)}</div>
                    </div>
                    <span className="chart-label" style={{ fontSize: '10px' }}>{d.label}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', textAlign: 'right' }}>
              *Gráfico gerado em tempo real com base no saldo acumulado das transferências do cofre.
            </div>
          </div>
        )}
      </div>

      {/* Tabela do Histórico */}
      <div className="section-card">
        <div className="card-header" style={{ marginBottom: '8px' }}>
          <h3 className="card-title">
            <History size={20} className="text-primary" /> Histórico Completo de Transferências
          </h3>
        </div>

        {filteredTransactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '14px' }}>
            Nenhuma movimentação registrada no cofre da {storeId === 'loja-1' ? 'Loja 1' : 'Loja 2'}.
          </div>
        ) : (
          <div className="table-container" style={{ maxHeight: '450px', overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Operação</th>
                  <th>Descrição</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((vt) => (
                  <tr key={vt.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(vt.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {vt.type === 'deposit' ? (
                        <span className="badge badge-success" style={{ fontWeight: 'bold' }}>
                          Depósito (Entrada)
                        </span>
                      ) : (
                        <span className="badge badge-danger" style={{ fontWeight: 'bold' }}>
                          Retirada (Saída)
                        </span>
                      )}
                    </td>
                    <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={vt.description}>
                      {vt.description}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: vt.type === 'deposit' ? 'var(--success)' : 'var(--danger)' }}>
                      {vt.type === 'deposit' ? '+' : '-'} R$ {vt.amount.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => onDeleteVaultTransaction(vt.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                        title="Excluir lançamento"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 7. COMPONENTE: MODAL DE NOTA FISCAL (DANFE SIMPLIFICADA)
// ==========================================
function InvoiceModal({ sale, onClose }) {
  if (!sale) return null;

  const total = sale.totalPrice;
  const cnpj = "62.002.153/0001-25";
  const dateFormatted = new Date(sale.timestamp).toLocaleString('pt-BR');

  // Chave de acesso simulada para dar mais realismo
  const accessKey = Array.from({ length: 11 }, () => Math.floor(Math.random() * 9000 + 1000).toString()).join(' ');

  const handlePrint = () => {
    const printContent = document.getElementById('danfe-invoice-print-area').innerHTML;

    const printWindow = window.open('', '_blank', 'width=800,height=800');
    printWindow.document.write(`
      <html>
        <head>
          <title>Nota Fiscal de Consumidor - Novo Lar</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              font-size: 11px;
              color: #000;
              margin: 20px;
              line-height: 1.3;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .border-box {
              border: 1px solid #000;
              padding: 8px;
              margin-bottom: 8px;
              border-radius: 4px;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 8px;
            }
            .header-table td {
              border: 1px solid #000;
              padding: 6px;
              vertical-align: top;
            }
            .title-danfe {
              font-size: 14px;
              font-weight: bold;
              text-align: center;
              margin-bottom: 2px;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 8px 0;
            }
            .items-table th, .items-table td {
              border: 1px solid #000;
              padding: 6px;
              text-align: left;
            }
            .items-table th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            .totals-table {
              width: 50%;
              margin-left: auto;
              border-collapse: collapse;
              margin-top: 8px;
            }
            .totals-table td {
              padding: 4px;
              border: 1px solid #000;
            }
            .qr-code-placeholder {
              width: 90px;
              height: 90px;
              border: 1px solid #000;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 8px;
              font-weight: bold;
              background-color: #eee;
            }
            .footer-notes {
              font-size: 9px;
              color: #555;
              text-align: center;
              margin-top: 15px;
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '650px', width: '90%', padding: '24px' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} style={{ color: 'var(--primary)' }} />
            Visualizar Nota Fiscal (Simulada)
          </h2>
          <button className="close-btn-x" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '500px', overflowY: 'auto', padding: '10px 0' }}>
          <div id="danfe-invoice-print-area" style={{ backgroundColor: '#fff', padding: '15px', color: '#000', border: '1px solid #ccc', borderRadius: '4px' }}>
            <table className="header-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '18%', border: '1px solid #000', padding: '6px', textAlign: 'center', verticalAlign: 'middle' }}>
                    <img
                      src="logo.png"
                      alt="Logo Novo Lar"
                      style={{ maxWidth: '80px', height: 'auto', display: 'block', margin: '0 auto' }}
                    />
                  </td>
                  <td style={{ width: '47%', border: '1px solid #000', padding: '6px', verticalAlign: 'top' }}>
                    <strong style={{ fontSize: '12px' }}>NOVO LAR - CASA &amp; CONSTRUÇÃO</strong><br />
                    <span>CNPJ: {cnpj}</span><br />
                    <span>Rua das Rosas, 1077 - Jardim Novo Eden</span><br />
                    <span>Santa Isabel - SP / CEP: 07500-000</span><br />
                    <span>Tel: (11) 4656-8183</span>
                  </td>
                  <td style={{ width: '35%', border: '1px solid #000', padding: '6px', textAlign: 'center', verticalAlign: 'middle' }}>
                    <div className="title-danfe" style={{ fontSize: '13px', fontWeight: 'bold' }}>DANFE Simplificado</div>
                    <div style={{ fontSize: '8px', color: '#555', marginTop: '2px', lineHeight: '1.2' }}>Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</div>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '6px' }}>Nº da Venda: {sale.id}</div>
                    <div style={{ fontSize: '9px', marginTop: '2px' }}>Emissão: {dateFormatted}</div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="border-box" style={{ border: '1px solid #000', padding: '8px', marginBottom: '8px', borderRadius: '4px' }}>
              <div className="bold" style={{ textTransform: 'uppercase', marginBottom: '4px' }}>Informações de Entrega / Destinatário</div>
              {sale.deliveryDetails && sale.deliveryDetails.requiresDelivery ? (
                <div>
                  <strong>Recebedor:</strong> {sale.deliveryDetails.receiver || 'Não especificado'}<br />
                  <strong>Endereço:</strong> {sale.deliveryDetails.address || 'Não especificado'}<br />
                  <strong>Data Programada:</strong> {sale.deliveryDetails.date ? new Date(sale.deliveryDetails.date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não especificada'}<br />
                  {sale.deliveryDetails.notes && <span><strong>Observações:</strong> {sale.deliveryDetails.notes}</span>}
                </div>
              ) : (
                <div>
                  <span>Retirada imediata no balcão pelo cliente.</span><br />
                  <span>Consumidor não identificado.</span>
                </div>
              )}
            </div>

            <table className="items-table" style={{ width: '100%', borderCollapse: 'collapse', margin: '8px 0' }}>
              <thead>
                <tr style={{ backgroundColor: '#f2f2f2' }}>
                  <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px' }}>Item</th>
                  <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px' }}>Descrição</th>
                  <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', textAlign: 'center' }}>Qtd</th>
                  <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', textAlign: 'right' }}>V. Unit (R$)</th>
                  <th style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', textAlign: 'right' }}>V. Total (R$)</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item, index) => (
                  <tr key={index}>
                    <td style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', textAlign: 'center' }}>{index + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', fontSize: '10px' }}>{item.name}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', textAlign: 'right' }}>{item.salePrice.toFixed(2)}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', textAlign: 'right' }}>{(item.salePrice * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className="totals-table" style={{ width: '60%', marginLeft: 'auto', borderCollapse: 'collapse', marginTop: '8px' }}>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '4px', fontSize: '10px' }}><strong>Valor Total dos Produtos</strong></td>
                  <td style={{ border: '1px solid #000', padding: '4px', fontSize: '10px', textAlign: 'right' }}>R$ {total.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '4px', fontSize: '10px' }}><strong>Desconto</strong></td>
                  <td style={{ border: '1px solid #000', padding: '4px', fontSize: '10px', textAlign: 'right' }}>R$ 0,00</td>
                </tr>
                <tr style={{ backgroundColor: '#eee' }}>
                  <td style={{ border: '1px solid #000', padding: '4px', fontSize: '10px' }}><strong>VALOR TOTAL LÍQUIDO</strong></td>
                  <td style={{ border: '1px solid #000', padding: '4px', fontSize: '10px', textAlign: 'right', fontWeight: 'bold' }}>R$ {total.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '4px', fontSize: '10px' }}><strong>Forma de Pagamento</strong></td>
                  <td style={{ border: '1px solid #000', padding: '4px', fontSize: '10px', textAlign: 'right' }}>{sale.paymentMethod}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', gap: '20px', marginTop: '16px', alignItems: 'center', borderTop: '1px solid #000', paddingTop: '12px' }}>
              <div className="qr-code-placeholder" style={{ width: '90px', height: '90px', border: '1px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 'bold', backgroundColor: '#eee', textAlign: 'center', padding: '4px' }}>
                <span style={{ fontSize: '12px', marginBottom: '4px' }}>QR CODE</span>
                <span style={{ fontSize: '6px' }}>Simulador Auxiliar</span>
                <span style={{ fontSize: '5px', wordBreak: 'break-all', marginTop: '4px' }}>NFC-e Nº {sale.id}</span>
              </div>
              <div style={{ flex: 1, fontSize: '9px' }}>
                <strong>CHAVE DE ACESSO PARA CONSULTA NO PORTAL DA SEFAZ:</strong><br />
                <span style={{ letterSpacing: '0.5px', fontFamily: 'monospace' }}>{accessKey}</span><br />
                <span style={{ display: 'block', marginTop: '6px', fontStyle: 'italic' }}>Consulta pública no portal nacional da NF-e (www.nfe.fazenda.gov.br)</span>
              </div>
            </div>

            <div className="footer-notes" style={{ fontSize: '8px', color: '#555', textAlign: 'center', marginTop: '15px', borderTop: '1px dashed #555', paddingTop: '8px' }}>
              DOCUMENTO AUXILIAR DE NOTA FISCAL DE CONSUMIDOR ELETRÔNICA SIMULADA.<br />
              SEM EFEITOS DE HOMOLOGAÇÃO FISCAL COMERCIAL - USO EXCLUSIVO DO GERENCIADOR DE ESTOQUE NOVO LAR.
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
          <button className="close-btn" style={{ padding: '10px 20px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '600' }} onClick={onClose}>Fechar</button>
          <button className="btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Printer size={16} /> Imprimir Nota Fiscal
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE: MODAL DE FECHAMENTO DE CAIXA
// ==========================================
function ClosureModal({ date, sales, expenses, storeId, vaultTransactions = [], onClose, onSave }) {
  const [actualCash, setActualCash] = useState('');
  const [sangria, setSangria] = useState('');
  const [observations, setObservations] = useState('');

  // Filtrar vendas, despesas e transações do cofre do dia específico para a loja logada
  const dateStr = date; // YYYY-MM-DD
  const daySales = sales.filter(s => s.storeId === storeId && s.timestamp.startsWith(dateStr));
  const dayExpenses = expenses.filter(e => e.storeId === storeId && e.timestamp.startsWith(dateStr));
  const dayVaultTransactions = vaultTransactions.filter(vt => vt.storeId === storeId && vt.date === dateStr);

  const totalSales = daySales.reduce((acc, s) => acc + s.totalPrice, 0);
  const totalCashSales = daySales.filter(s => s.paymentMethod === 'Dinheiro').reduce((acc, s) => acc + s.totalPrice, 0);
  const totalPixSales = daySales.filter(s => s.paymentMethod === 'Pix').reduce((acc, s) => acc + s.totalPrice, 0);
  const totalCardSales = daySales.filter(s => s.paymentMethod.includes('Cartão')).reduce((acc, s) => acc + s.totalPrice, 0);

  const totalExpenses = dayExpenses.reduce((acc, e) => acc + e.amount, 0);

  const totalVaultDeposits = dayVaultTransactions.filter(vt => vt.type === 'deposit').reduce((acc, vt) => acc + vt.amount, 0);
  const totalVaultWithdrawals = dayVaultTransactions.filter(vt => vt.type === 'withdrawal').reduce((acc, vt) => acc + vt.amount, 0);

  // O "dinheiro em caixa esperado" antes de qualquer nova sangria do fechamento
  const expectedCashBeforeSangria = totalCashSales - totalExpenses - totalVaultDeposits + totalVaultWithdrawals;

  const handleSave = () => {
    const cashVal = parseFloat(actualCash.replace(',', '.')) || 0;
    const sangriaVal = parseFloat(sangria.replace(',', '.')) || 0;

    const maxAllowed = Math.max(0, expectedCashBeforeSangria);
    if (sangriaVal > maxAllowed) {
      alert(`A sangria (R$ ${sangriaVal.toFixed(2)}) não pode ser maior do que o dinheiro disponível em caixa (R$ ${maxAllowed.toFixed(2)}).`);
      return;
    }

    const finalExpected = expectedCashBeforeSangria - sangriaVal;
    const diff = cashVal - finalExpected;

    onSave({
      storeId,
      date: dateStr,
      expectedCash: finalExpected,
      actualCash: cashVal,
      difference: diff,
      sangriaAmount: sangriaVal,
      observations
    });
  };

  const cashVal = parseFloat(actualCash.replace(',', '.')) || 0;
  const sangriaVal = parseFloat(sangria.replace(',', '.')) || 0;
  const expectedCash = expectedCashBeforeSangria - sangriaVal;
  const currentDiff = cashVal - expectedCash;

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div className="modal-content glass-card" style={{ width: '100%', maxWidth: '500px', padding: '24px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <CheckCircle size={20} className="text-primary" /> Fechamento de Caixa
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            Resumo do Dia: {dateStr.split('-').reverse().join('/')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Vendas Totais:</span>
            <span style={{ fontWeight: '700' }}>R$ {totalSales.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', paddingLeft: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>- Dinheiro:</span>
            <span style={{ color: 'var(--text-secondary)' }}>R$ {totalCashSales.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', paddingLeft: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>- Pix:</span>
            <span style={{ color: 'var(--text-secondary)' }}>R$ {totalPixSales.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '12px', paddingLeft: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>- Cartão:</span>
            <span style={{ color: 'var(--text-secondary)' }}>R$ {totalCardSales.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Despesas (Retiradas):</span>
            <span style={{ fontWeight: '700', color: 'var(--danger)' }}>- R$ {totalExpenses.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '15px' }}>
            <span style={{ fontWeight: '800' }}>Dinheiro Esperado em Gaveta:</span>
            <span style={{ fontWeight: '800', color: 'var(--primary)' }}>R$ {expectedCash.toFixed(2)}</span>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Valor em Dinheiro Físico na Gaveta (R$)</label>
          <input
            type="number"
            step="0.01"
            className="form-input"
            placeholder="0.00"
            value={actualCash}
            onChange={(e) => setActualCash(e.target.value)}
            style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: '#fff' }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Sangria (Transferir para o Cofre) (R$)</label>
          <input
            type="number"
            step="0.01"
            className="form-input"
            placeholder="0.00"
            value={sangria}
            onChange={(e) => setSangria(e.target.value)}
            style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: '#fff' }}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Máximo disponível para sangria: <strong>R$ {Math.max(0, expectedCashBeforeSangria).toFixed(2)}</strong>
          </span>
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Diferença</label>
          <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: currentDiff === 0 ? 'var(--text-secondary)' : (currentDiff < 0 ? 'var(--danger)' : 'var(--success)'), fontWeight: '700' }}>
            R$ {currentDiff.toFixed(2)} {currentDiff < 0 ? '(Falta)' : (currentDiff > 0 ? '(Sobra)' : '(Exato)')}
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Observações (Opcional)</label>
          <textarea
            className="form-input"
            rows="2"
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: '#fff', resize: 'vertical' }}
          ></textarea>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
          <button onClick={handleSave} className="btn-primary" style={{ padding: '10px 24px', fontWeight: '700' }}>Confirmar Fechamento</button>
        </div>
      </div>
    </div>
  );
}
