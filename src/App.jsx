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
  Lock,
  PlusCircle,
  Share2,
  FileSpreadsheet,
  ShoppingCart,
  Copy,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Award,
  Zap,
  BarChart3,
  Filter,
  RotateCcw
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
  deleteCreditAccount,
  addCreditTransaction,
  clearAllDatabase,
  getVaultTransactions,
  saveVaultTransaction,
  deleteVaultTransaction,
  getBills,
  saveBill,
  deleteBill,
  getQuotes,
  saveQuote,
  deleteQuote,
  updateQuoteStatus,
  isElectron
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
  const [bills, setBills] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [createQuoteModalOpen, setCreateQuoteModalOpen] = useState(false);
  const [selectedQuoteToPrint, setSelectedQuoteToPrint] = useState(null);
  const [activeQuoteId, setActiveQuoteId] = useState(null);
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
      return saleDate < targetDate && s.paymentMethod === 'Dinheiro';
    });

    const priorExpenses = filteredExpenses.filter(e => {
      const expDate = new Date(e.timestamp.split('T')[0] + 'T00:00:00');
      return expDate < targetDate && (e.source === 'Caixa Físico' || !e.source);
    });

    const priorVault = vaultTransactions.filter(vt => {
      if (vt.storeId !== storeId) return false;
      const vtDate = new Date(vt.date + 'T00:00:00');
      return vtDate < targetDate;
    });

    const totalPriorSales = priorSales.reduce((sum, s) => sum + s.totalPrice, 0);
    const totalPriorExpenses = priorExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPriorVaultDeposits = priorVault.filter(vt => vt.type === 'deposit').reduce((sum, vt) => sum + vt.amount, 0);
    const totalPriorVaultWithdrawals = priorVault.filter(vt => vt.type === 'withdrawal').reduce((sum, vt) => sum + vt.amount, 0);

    return totalPriorSales - totalPriorExpenses - totalPriorVaultDeposits + totalPriorVaultWithdrawals;
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
          bills: mergeById(currentDb.bills || [], parsedData.bills || []),
          syncQueue: currentDb.syncQueue || []
        };

        await saveDB(updatedDB);
        setProducts(updatedDB.products);
        setSales(updatedDB.sales);
        setExpenses(updatedDB.expenses);
        setCreditAccounts(updatedDB.creditAccounts);
        setVaultTransactions(updatedDB.vaultTransactions || []);
        setBills(updatedDB.bills || []);

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

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');

  const handleResetAllData = () => {
    setResetConfirmInput('');
    setResetModalOpen(true);
  };

  const confirmResetAllData = async () => {
    if (resetConfirmInput.trim() !== 'APAGAR TUDO') {
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
      setBills([]);
      setPendingClosures([]);
      setSyncPendingCount(0);
      setResetModalOpen(false);
      setResetConfirmInput('');

      showScanNotification('Tudo limpo! Todo o sistema e a nuvem foram zerados com sucesso.', 'success');
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
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  // Buscar dados ao iniciar
  const fetchData = async () => {
    setLoading(true);
    try {
      // Carrega dados
      const localDb = await loadDB();
      setProducts(localDb.products || []);
      setSales(localDb.sales || []);
      setExpenses(localDb.expenses || []);
      setCreditAccounts(localDb.creditAccounts || []);
      setVaultTransactions(localDb.vaultTransactions || []);
      setBills(localDb.bills || []);
      setQuotes(localDb.quotes || []);
      setSyncPendingCount(0);

      const pendings = await getPendingClosures(getStoreId());
      setPendingClosures(pendings);

      // Dispara o espelhamento em background inicial
      await executeSync();
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const executeSync = async () => {
    try {
      if (isElectron()) {
        setSyncStatus('Espelhando...');
        const res = await runBackgroundSync();
        if (res.status === 'success') {
          setSyncStatus('Sincronizado');
          // Atualiza estado do React com os dados mais recentes pós-sync
          const freshDb = await loadDB();
          setProducts(freshDb.products || []);
          setSales(freshDb.sales || []);
          setExpenses(freshDb.expenses || []);
          setCreditAccounts(freshDb.creditAccounts || []);
          setVaultTransactions(freshDb.vaultTransactions || []);
          setBills(freshDb.bills || []);
          setQuotes(freshDb.quotes || []);
          const pendings = await getPendingClosures(getStoreId());
          setPendingClosures(pendings);
        } else {
          setSyncStatus('Offline');
        }
      } else {
        // Modo Web: busca os dados mais recentes do NeonDB
        setSyncStatus('Sincronizando...');
        const freshDb = await loadDB();
        setProducts(freshDb.products || []);
        setSales(freshDb.sales || []);
        setExpenses(freshDb.expenses || []);
        setCreditAccounts(freshDb.creditAccounts || []);
        setVaultTransactions(freshDb.vaultTransactions || []);
        setBills(freshDb.bills || []);
        setQuotes(freshDb.quotes || []);
        const pendings = await getPendingClosures(getStoreId());
        setPendingClosures(pendings);
        setSyncStatus('Sincronizado');
      }
    } catch (e) {
      console.warn("Erro no ciclo de sincronização:", e);
      setSyncStatus('Offline');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Sincronização/espelhamento em tempo real a cada 10 segundos
    const timer = setInterval(() => {
      executeSync();
    }, 10000);
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

      if (activeQuoteId) {
        try {
          const updatedQuotes = await updateQuoteStatus(activeQuoteId, 'Aprovado');
          setQuotes(updatedQuotes);
          setActiveQuoteId(null);
        } catch (e) {}
      }

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

      if (activeQuoteId) {
        try {
          const updatedQuotes = await updateQuoteStatus(activeQuoteId, 'Aprovado');
          setQuotes(updatedQuotes);
          setActiveQuoteId(null);
        } catch (e) {}
      }

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

  const handleLoadQuoteIntoCart = (quote) => {
    const loadedCart = (quote.items || []).map(i => ({
      id: i.productId || i.id,
      code: i.code || '',
      name: i.name,
      salePrice: parseFloat(i.salePrice) || 0,
      costPrice: parseFloat(i.costPrice) || 0,
      quantity: parseInt(i.quantity) || 1,
      unit: i.unit || 'Un'
    }));
    setCart(loadedCart);
    setActiveQuoteId(quote.id);
    setActiveTab('pdv');
    showScanNotification(`Orçamento #${quote.id} carregado no PDV!`, "success");
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

  // --- CRUD BOLETOS / CONTAS A PAGAR ---
  const handleSaveBill = async (billData) => {
    try {
      const updatedBills = await saveBill(billData);
      setBills(updatedBills);
      showScanNotification("Boleto salvo com sucesso!");
    } catch (e) {
      console.error(e);
      showScanNotification("Erro ao salvar boleto.", "error");
    }
  };

  const handleDeleteBill = async (billId) => {
    if (window.confirm("Deseja excluir este boleto permanentemente?")) {
      try {
        const updatedBills = await deleteBill(billId);
        setBills(updatedBills);
        showScanNotification("Boleto excluído!");
      } catch (e) {
        console.error(e);
        showScanNotification("Erro ao excluir boleto.", "error");
      }
    }
  };

  const handlePayBill = async (bill, source) => {
    try {
      // 1. Cadastrar a despesa real no sistema
      const expData = {
        id: `exp-${Date.now()}`,
        timestamp: new Date().toISOString(),
        description: `Pagto Boleto: ${bill.description}`,
        amount: bill.amount,
        category: bill.category || 'Boletos',
        storeId: storeId,
        source: source
      };
      const updatedExpenses = await saveExpense(expData);
      setExpenses(updatedExpenses);

      // 2. Se a origem for o Cofre, gerar a retirada
      if (source === 'Cofre') {
        const vtData = {
          id: `vt-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'withdrawal',
          amount: bill.amount,
          description: `Despesa via Cofre: Pagto Boleto ${bill.description}`,
          storeId: storeId,
          date: new Date().toISOString().split('T')[0]
        };
        const updatedVault = await saveVaultTransaction(vtData);
        setVaultTransactions(updatedVault);
      }

      // 3. Atualizar o status do boleto para Pago
      const updatedBill = {
        ...bill,
        status: 'Pago'
      };
      const updatedBills = await saveBill(updatedBill);
      setBills(updatedBills);

      showScanNotification("Boleto baixado com sucesso!");
    } catch (e) {
      console.error(e);
      showScanNotification("Erro ao baixar boleto.", "error");
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

  const handleReturnProduct = async (returnData) => {
    try {
      const { product, storeId: targetStore, quantity, reason, financialAction, customerName, refundAmount } = returnData;
      const db = await loadDB();
      const idx = db.products.findIndex(p => p.id === product.id);
      if (idx !== -1) {
        const prod = db.products[idx];
        prod.stockLoja1 = prod.stockLoja1 ?? prod.stock ?? 0;
        prod.stockLoja2 = prod.stockLoja2 ?? 0;

        if (targetStore === 'loja-1') {
          prod.stockLoja1 += quantity;
        } else {
          prod.stockLoja2 += quantity;
        }
        prod.stock = prod.stockLoja1 + prod.stockLoja2;

        const updatedProducts = await saveProduct(prod);
        setProducts(updatedProducts);

        if (financialAction === 'cash_refund' && refundAmount > 0) {
          const expenseData = {
            description: `Devolução: ${quantity}x ${prod.name} (${reason}${customerName ? ` - ${customerName}` : ''})`,
            amount: refundAmount,
            category: 'Outros',
            source: 'Caixa Físico',
            timestamp: new Date().toISOString(),
            storeId: targetStore
          };
          const updatedExpenses = await saveExpense(expenseData);
          setExpenses(updatedExpenses);
        }

        setIsReturnModalOpen(false);
        showScanNotification(`Devolução de ${quantity}x ${prod.name} registrada com sucesso!`, 'success');
      }
    } catch (e) {
      console.error("Erro na devolução:", e);
      showScanNotification("Erro ao processar devolução de mercadoria.", "error");
    }
  };

  // --- GESTÃO DESPESAS ---
  const handleSaveExpense = async (expenseData) => {
    try {
      const updatedExpenses = await saveExpense(expenseData);
      setExpenses(updatedExpenses);

      if (expenseData.source === 'Cofre') {
        await handleSaveVaultTransaction({
          type: 'withdrawal',
          amount: expenseData.amount,
          description: `Despesa via Cofre: ${expenseData.description}`,
          date: expenseData.timestamp ? expenseData.timestamp.split('T')[0] : new Date().toISOString().split('T')[0],
          storeId: storeId
        });
      }

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

  // --- GESTÃO DE ORÇAMENTOS ---
  const handleDeleteQuote = async (quoteId) => {
    try {
      const updated = await deleteQuote(quoteId);
      setQuotes(updated);
      showScanNotification("Orçamento excluído com sucesso.");
    } catch (e) {
      console.error(e);
      showScanNotification("Erro ao excluir orçamento.", "error");
    }
  };

  const handleApproveQuote = async (quoteId) => {
    try {
      const updated = await updateQuoteStatus(quoteId, 'Aprovado');
      setQuotes(updated);
      showScanNotification("Orçamento aprovado com sucesso!", "success");
    } catch (e) {
      console.error(e);
      showScanNotification("Erro ao aprovar orçamento.", "error");
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

  // 4. Notificações de Boletos / Despesas Fixas Vencendo/Atrasadas
  bills.filter(b => b.storeId === storeId && b.status === 'Pendente').forEach(bill => {
    if (bill.dueDate) {
      if (bill.dueDate === todayStr) {
        notifications.push({
          id: `bill-today-${bill.id}`,
          type: 'bill_today',
          icon: <AlertTriangle size={18} style={{ color: 'var(--brand-yellow)' }} />,
          title: 'Boleto Vence Hoje!',
          message: `${bill.description} - R$ ${bill.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
          onClick: () => {
            setActiveTab('admin-bills');
            setIsNotificationsOpen(false);
          }
        });
      } else if (bill.dueDate < todayStr) {
        notifications.push({
          id: `bill-late-${bill.id}`,
          type: 'bill_late',
          icon: <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />,
          title: 'Boleto Atrasado / Vencido',
          message: `${bill.description} venceu em ${bill.dueDate.split('-').reverse().join('/')} (R$ ${bill.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
          onClick: () => {
            setActiveTab('admin-bills');
            setIsNotificationsOpen(false);
          }
        });
      }
    }
  });

  // 5. Notificações de Estoque Baixo / Crítico
  const lowStockItems = products.filter(p => {
    const curStock = storeId === 'loja-1' ? (p.stockLoja1 ?? p.stock ?? 0) : (p.stockLoja2 ?? 0);
    return curStock <= p.minStock;
  });

  if (lowStockItems.length > 0) {
    if (lowStockItems.length <= 3) {
      lowStockItems.forEach(p => {
        const curStock = storeId === 'loja-1' ? (p.stockLoja1 ?? p.stock ?? 0) : (p.stockLoja2 ?? 0);
        notifications.push({
          id: `low-stock-${p.id}`,
          type: 'low_stock',
          icon: <AlertTriangle size={18} style={{ color: 'var(--brand-red)' }} />,
          title: 'Estoque Baixo!',
          message: `${p.name} tem apenas ${curStock} ${p.unit || 'un'} em estoque (Mínimo: ${p.minStock}).`,
          onClick: () => {
            setActiveTab('admin-products');
            setIsNotificationsOpen(false);
          }
        });
      });
    } else {
      notifications.push({
        id: `low-stock-summary`,
        type: 'low_stock',
        icon: <AlertTriangle size={18} style={{ color: 'var(--brand-red)' }} />,
        title: `${lowStockItems.length} Produtos com Estoque Baixo`,
        message: `Existem ${lowStockItems.length} materiais abaixo do estoque mínimo na ${storeId === 'loja-1' ? 'Loja 1' : 'Loja 2'}.`,
        onClick: () => {
          setActiveTab('admin-products');
          setIsNotificationsOpen(false);
        }
      });
    }
  }

  const totalSalesValue = filteredSales.reduce((sum, s) => sum + s.totalPrice, 0);
  const totalProfitValue = filteredSales.reduce((sum, s) => sum + s.profit, 0);
  const totalExpensesValue = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalVaultDeposits = vaultTransactions.filter(vt => vt.storeId === storeId && vt.type === 'deposit').reduce((sum, vt) => sum + vt.amount, 0);
  const totalVaultWithdrawals = vaultTransactions.filter(vt => vt.storeId === storeId && vt.type === 'withdrawal').reduce((sum, vt) => sum + vt.amount, 0);
  
  const totalCashSalesValue = filteredSales.filter(s => s.paymentMethod === 'Dinheiro').reduce((sum, s) => sum + s.totalPrice, 0);
  const totalCashExpensesValue = filteredExpenses.filter(e => e.source === 'Caixa Físico' || !e.source).reduce((sum, e) => sum + e.amount, 0);
  const netCash = totalCashSalesValue - totalCashExpensesValue - totalVaultDeposits + totalVaultWithdrawals;
  const lowStockCount = lowStockItems.length;

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
              className={`menu-item-btn ${activeTab === 'quotes' ? 'active' : ''}`}
              onClick={() => { setActiveTab('quotes'); setIsMobileMenuOpen(false); }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={20} />
                <span>Orçamentos</span>
              </div>
              {quotes.filter(q => q.status === 'Pendente').length > 0 && (
                <span style={{
                  backgroundColor: 'var(--brand-yellow)',
                  color: '#000',
                  padding: '1px 7px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '800'
                }}>
                  {quotes.filter(q => q.status === 'Pendente').length}
                </span>
              )}
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
                <li>
                  <button
                    className={`submenu-item-btn ${activeTab === 'admin-bills' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('admin-bills'); setIsMobileMenuOpen(false); }}
                  >
                    <FileText size={16} />
                    Controle de Boletos
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
                  {isElectron() ? 'App Desktop Conectado' : 'Web Online Conectado'}
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
              <a
                href="https://github.com/GabrielFerezim/NovoLar-System/releases/download/v1.0.0/ConstruControl-Windows.zip"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '7px 10px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  color: 'var(--brand-yellow)',
                  backgroundColor: 'rgba(243, 180, 29, 0.12)',
                  border: '1px solid rgba(243, 180, 29, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  textDecoration: 'none',
                  marginTop: '4px',
                  transition: 'var(--transition)'
                }}
                title="Baixar pacote do aplicativo para Windows (.zip)"
              >
                <Download size={13} strokeWidth={2.5} /> Baixar App Desktop (.exe)
              </a>
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
              {activeTab === 'quotes' && 'Orçamentos & Cotações Comerciais'}
              {activeTab === 'admin-insights' && 'Insights Comerciais (IA)'}
              {activeTab === 'admin-products' && 'Administração: Produtos & Estoque'}
              {activeTab === 'credit-accounts' && 'Gestão de Contas (Fiados)'}
              {activeTab === 'admin-finance' && 'Administração: Controle Geral & Rede'}
              {activeTab === 'admin-deliveries' && 'Administração: Controle de Entregas'}
              {activeTab === 'admin-vault' && 'Administração: Controle do Cofre'}
              {activeTab === 'admin-bills' && 'Administração: Controle de Boletos'}
            </h1>
            <span className="header-subtitle">
              {activeTab === 'daily-data' && 'Acompanhamento do faturamento, lucros e despesas de hoje'}
              {activeTab === 'calendar' && 'Selecione qualquer data no calendário para extrair relatórios históricos'}
              {activeTab === 'pdv' && 'Adicione produtos bipando ou digitando o código de barras'}
              {activeTab === 'quotes' && 'Cotações de clientes sem alteração de estoque até o fechamento da venda'}
              {activeTab === 'admin-insights' && 'Análise de vendas, priorização de compras por lucro e diagnóstico de mercado'}
              {activeTab === 'admin-products' && 'Cadastrar, edite e gerencie o estoque mínimo dos produtos'}
              {activeTab === 'credit-accounts' && 'Acompanhe as dívidas e pagamentos dos seus clientes de confiança'}
              {activeTab === 'admin-finance' && 'Controle financeiro consolidado de faturamento, lucros, gráficos e rede ao vivo'}
              {activeTab === 'admin-deliveries' && 'Painel de expedição de pedidos para entrega física e geração de Notas Fiscais'}
              {activeTab === 'admin-vault' && 'Rastreamento de sangrias em dinheiro físico enviadas ou retiradas do cofre seguro'}
              {activeTab === 'admin-bills' && 'Gerencie despesas fixas agendadas, contas a pagar e alertas de boletos'}
            </span>
          </div>

          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <a
              href="https://github.com/GabrielFerezim/NovoLar-System/releases/download/v1.0.0/ConstruControl-Windows.zip"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 14px',
                fontSize: '12.5px',
                fontWeight: '800',
                textDecoration: 'none',
                color: '#000',
                backgroundColor: 'var(--brand-yellow)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 2px 8px rgba(243, 180, 29, 0.25)',
                transition: 'all 0.2s ease'
              }}
              title="Baixar pacote do aplicativo para Windows (.zip com ConstruControl.exe)"
            >
              <Download size={15} strokeWidth={2.5} /> Baixar App Desktop
            </a>

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

            {activeTab === 'quotes' && (
              <button
                className="btn-primary"
                style={{
                  padding: '10px 18px',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--brand-yellow)',
                  color: '#000000',
                  fontWeight: '800',
                  boxShadow: '0 2px 8px rgba(243, 180, 29, 0.35)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)'
                }}
                onClick={() => setCreateQuoteModalOpen(true)}
              >
                <Plus size={18} strokeWidth={2.5} /> <span className="btn-text-responsive">Criar Orçamento</span>
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
              onOpenExpenseModal={() => setExpenseModalOpen(true)}
              onSaveQuote={() => setCreateQuoteModalOpen(true)}
              storeId={storeId}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarReportsView
              sales={filteredSales}
              expenses={filteredExpenses}
              vaultTransactions={vaultTransactions}
              storeId={storeId}
              getCashBalanceAtDate={getCashBalanceAtDate}
              bills={bills}
            />
          )}

          {activeTab === 'quotes' && (
            <QuotesView
              quotes={quotes}
              onOpenCreateModal={() => setCreateQuoteModalOpen(true)}
              onDeleteQuote={handleDeleteQuote}
              onApproveQuote={handleApproveQuote}
              onUpdateQuoteStatus={async (id, status) => {
                const updated = await updateQuoteStatus(id, status);
                setQuotes(updated);
              }}
              onPrintQuote={(q) => setSelectedQuoteToPrint(q)}
              onLoadQuoteIntoCart={handleLoadQuoteIntoCart}
              products={products}
              storeId={storeId}
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
              onCreateAccount={handleCreateCreditAccount}
              onUpdateAccount={async (acc) => {
                const updated = await saveCreditAccount(acc);
                setCreditAccounts(updated);
                showScanNotification("Conta atualizada com sucesso!");
              }}
              onDeleteAccount={async (acc) => {
                if (window.confirm(`Excluir conta de ${acc.name}?`)) {
                  const updated = await deleteCreditAccount(acc.id);
                  setCreditAccounts(updated);
                  showScanNotification("Conta excluída com sucesso.");
                }
              }}
              onAddTransaction={async (accountId, type, amount, description, saleId = null, items = [], dueDate = null, customerName = null, paymentMethod = 'Dinheiro') => {
                let fakeItems = items;
                if (!fakeItems || fakeItems.length === 0) {
                  fakeItems = [{
                    id: Date.now().toString(),
                    name: description || (type === 'payment' ? 'Quitação Parcial Fiado' : 'Compra a Prazo'),
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
                  dueDate,
                  customerName,
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
              storeId={storeId}
              onEditProduct={(p) => { setEditingProduct(p); setProductModalOpen(true); }}
              onDeleteProduct={handleDeleteProduct}
              onTransferStock={(p) => setTransferProduct(p)}
              onOpenReturnModal={() => setIsReturnModalOpen(true)}
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
                onOpenExpenseModal={() => setExpenseModalOpen(true)}
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
              onSaveVaultTransaction={handleSaveVaultTransaction}
              onDeleteVaultTransaction={handleDeleteVaultTransaction}
              storeId={storeId}
            />
          )}

          {activeTab === 'admin-bills' && (
            <BillsView
              bills={bills}
              onSaveBill={handleSaveBill}
              onDeleteBill={handleDeleteBill}
              onPayBill={handlePayBill}
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

      {/* MODAL DE DEVOLUÇÃO / TROCA DE PRODUTO */}
      {isReturnModalOpen && (
        <ReturnProductModal
          products={products}
          storeId={storeId}
          onClose={() => setIsReturnModalOpen(false)}
          onConfirmReturn={handleReturnProduct}
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

      {/* MODAL DE CONFIRMAÇÃO PARA ZERAR BANCO DE DADOS */}
      {resetModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '480px', padding: '24px', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--danger, #dc2626)', marginBottom: '16px' }}>
              <AlertTriangle size={30} />
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>Zerar Todo o Sistema e Nuvem</h2>
            </div>
            
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '14px' }}>
              <strong>ATENÇÃO EXTREMA:</strong> Esta ação apagará <strong style={{ color: 'var(--danger, #dc2626)' }}>PERMANENTEMENTE</strong> todos os dados cadastrados (produtos, vendas, despesas, fiados, boletos, fechamentos e movimentações de cofre) tanto localmente quanto no banco em nuvem Neon.
            </p>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                Para confirmar a exclusão total, digite exatamente:
              </label>
              <div style={{ fontSize: '14px', fontWeight: '900', color: 'var(--danger, #dc2626)', letterSpacing: '1px', marginBottom: '8px' }}>
                APAGAR TUDO
              </div>
              <input
                type="text"
                className="input-field"
                placeholder="Digite APAGAR TUDO"
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value.toUpperCase())}
                style={{ width: '100%', padding: '10px 14px', fontSize: '13px', fontWeight: '700' }}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '600' }}
                onClick={() => { setResetModalOpen(false); setResetConfirmInput(''); }}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger"
                style={{
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: resetConfirmInput.trim() === 'APAGAR TUDO' ? 'var(--danger, #dc2626)' : 'var(--text-muted)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: resetConfirmInput.trim() === 'APAGAR TUDO' ? 'pointer' : 'not-allowed',
                  opacity: resetConfirmInput.trim() === 'APAGAR TUDO' ? 1 : 0.6
                }}
                disabled={resetConfirmInput.trim() !== 'APAGAR TUDO' || loading}
                onClick={confirmResetAllData}
              >
                <Trash2 size={16} />
                {loading ? 'Apagando...' : 'Confirmar e Zerar Tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Criar Novo Orçamento Interativo */}
      {createQuoteModalOpen && (
        <CreateQuoteModal
          products={products}
          customers={creditAccounts}
          initialCart={activeTab === 'pdv' ? cart : []}
          storeId={storeId}
          onClose={() => setCreateQuoteModalOpen(false)}
          onSave={async (quoteData) => {
            const updated = await saveQuote(quoteData);
            setQuotes(updated);
            showScanNotification(`Orçamento #${quoteData.id} salvo com sucesso!`, 'success');
          }}
          onPrint={(q) => setSelectedQuoteToPrint(q)}
          onLoadIntoPDV={(q) => handleLoadQuoteIntoCart(q)}
        />
      )}

      {/* Modal: Visualização de Impressão do Orçamento */}
      {selectedQuoteToPrint && (
        <QuotePrintModal
          quote={selectedQuoteToPrint}
          onClose={() => setSelectedQuoteToPrint(null)}
        />
      )}

    </div>
  );
}

// ==========================================
// 1. TELA: DASHBOARD VIEW (CONTROLE GERAL)
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
  const activeProfitMargin = activeTotalSales > 0 ? ((activeTotalProfit / activeTotalSales) * 100).toFixed(1) : '0.0';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Barra de Filtros e Seletores do Painel Financeiro */}
      <div className="finance-toolbar-card">
        
        {/* Lado Esquerdo: Local vs Rede ao vivo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)', display: 'block' }}>
              Terminal / Abrangência:
            </span>
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              {viewMode === 'local' ? 'Dados locais da unidade selecionada' : 'Faturamento ao vivo consolidado em nuvem'}
            </span>
          </div>

          <div className="finance-mode-pill-group">
            <button
              type="button"
              onClick={() => setViewMode('local')}
              className={`finance-mode-pill ${viewMode === 'local' ? 'active' : ''}`}
            >
              Esta Loja (Local)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('consolidated')}
              className={`finance-mode-pill ${viewMode === 'consolidated' ? 'active' : ''}`}
            >
              Rede Completa (Nuvem)
            </button>
          </div>

          {viewMode === 'consolidated' && (
            <div className="finance-mode-pill-group" style={{ borderColor: 'var(--primary)' }}>
              <button
                type="button"
                onClick={() => setCloudStoreFilter('all')}
                className={`finance-mode-pill ${cloudStoreFilter === 'all' ? 'active' : ''}`}
              >
                Todas as Lojas
              </button>
              <button
                type="button"
                onClick={() => setCloudStoreFilter('loja-1')}
                className={`finance-mode-pill ${cloudStoreFilter === 'loja-1' ? 'active' : ''}`}
              >
                Loja 1
              </button>
              <button
                type="button"
                onClick={() => setCloudStoreFilter('loja-2')}
                className={`finance-mode-pill ${cloudStoreFilter === 'loja-2' ? 'active' : ''}`}
              >
                Loja 2
              </button>
            </div>
          )}
        </div>

        {/* Lado Direito: Filtro de Período */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>
            Período:
          </span>
          <div className="finance-mode-pill-group">
            {[
              { id: 'month', label: 'Mês Atual' },
              { id: 'year', label: 'Ano Atual' },
              { id: 'all', label: 'Todo o Histórico' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setTimeRange(p.id)}
                className={`finance-mode-pill ${timeRange === p.id ? 'active' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {loadingCloud && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          padding: '10px 16px',
          color: 'var(--primary)',
          fontWeight: '700',
          fontSize: '13px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)', animation: 'ping 1.5s infinite' }}></div>
          Sincronizando dados consolidados de vendas e despesas em nuvem...
        </div>
      )}

      {/* Grid de 4 KPIs Consolidados */}
      <div className="dashboard-summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        
        {/* Faturamento */}
        <div className="kpi-card sales">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(18, 121, 138, 0.15)', color: 'var(--primary)' }}>
            <TrendingUp size={24} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Faturamento ({timeRange === 'month' ? 'Mês' : timeRange === 'year' ? 'Ano' : 'Total'})</span>
            <span className="kpi-value" style={{ color: 'var(--primary)' }}>
              R$ {activeTotalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{rangedSales.length} vendas registradas</span>
          </div>
        </div>

        {/* Lucro Líquido */}
        <div className="kpi-card profit">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
            <DollarSign size={24} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Lucro Bruto Operacional</span>
            <span className="kpi-value" style={{ color: 'var(--success)' }}>
              R$ {activeTotalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '700' }}>Margem média de {activeProfitMargin}%</span>
          </div>
        </div>

        {/* Despesas & Gastos */}
        <div className="kpi-card expenses">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)' }}>
            <TrendingDown size={24} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Gastos & Despesas</span>
            <span className="kpi-value" style={{ color: 'var(--danger)' }}>
              R$ {activeTotalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{rangedExpenses.length} lançamentos de saída</span>
          </div>
        </div>

        {/* Estoque Baixo / Reposição */}
        <div className="kpi-card low-stock" style={{ borderColor: lowStockCount > 0 ? 'rgba(216, 45, 51, 0.3)' : 'var(--border-color)' }}>
          <div className="kpi-icon-wrapper" style={{ backgroundColor: lowStockCount > 0 ? 'rgba(216, 45, 51, 0.15)' : 'rgba(243, 180, 29, 0.15)', color: lowStockCount > 0 ? 'var(--brand-red)' : 'var(--brand-yellow)' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Estoque Crítico</span>
            <span className="kpi-value" style={{ color: lowStockCount > 0 ? 'var(--brand-red)' : 'inherit' }}>
              {lowStockCount} {lowStockCount === 1 ? 'Produto' : 'Produtos'}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Itens abaixo do estoque mínimo</span>
          </div>
        </div>

      </div>

      {/* Gráfico de Evolução e Painel de Estoque Crítico */}
      <div className="dashboard-details-grid">
        
        {/* Painel Esquerdo: Evolução do Faturamento */}
        <div className="section-card">
          <div className="card-header" style={{ marginBottom: '14px' }}>
            <h2 className="card-title">
              <TrendingUp size={20} className="brand-icon" style={{ color: 'var(--primary)' }} />
              Evolução das Vendas (Faturamento)
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {timeRange === 'month' && 'Distribuição por semana no mês'}
              {timeRange === 'year' && 'Distribuição mensal no ano'}
              {timeRange === 'all' && 'Últimos 6 meses consolidado'}
            </span>
          </div>

          <div className="chart-container" style={{ height: '200px' }}>
            {chartData.map((d, index) => (
              <div key={index} className="chart-bar-wrapper">
                <div
                  className="chart-bar-fill"
                  style={{
                    height: `${Math.max(6, d.percentage)}%`,
                    background: 'linear-gradient(180deg, var(--primary) 0%, #0d5966 100%)',
                    borderRadius: '4px 4px 0 0'
                  }}
                >
                  <div className="chart-tooltip">R$ {d.amount.toFixed(2)}</div>
                </div>
                <span className="chart-label" style={{ fontSize: '10.5px', fontWeight: '600' }}>{d.dayLabel}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
            <span>Saldo Líquido (Vendas - Despesas): <strong style={{ color: activeNetCash >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '14px' }}>R$ {activeNetCash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
            <button className="btn-secondary" style={{ padding: '5px 12px', fontSize: '12px', fontWeight: '700' }} onClick={() => onChangeTab('admin-finance')}>Atualizar Vista</button>
          </div>
        </div>

        {/* Painel Direito: Estoque Crítico / Reposição */}
        <div className="section-card">
          <div className="card-header" style={{ marginBottom: '14px' }}>
            <h2 className="card-title" style={{ color: lowStockCount > 0 ? 'var(--brand-red)' : 'var(--text-primary)' }}>
              <AlertTriangle size={20} />
              Estoque Crítico / Reposição
            </h2>
            <span className="badge badge-danger" style={{ fontWeight: '800' }}>{lowStockCount}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '190px' }}>
            {lowStockItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 10px', color: 'var(--text-muted)' }}>
                <Check size={28} style={{ color: 'var(--success)', marginBottom: '8px' }} />
                <p style={{ fontSize: '13px', margin: 0 }}>Todos os produtos cadastrados estão com estoque saudável!</p>
              </div>
            ) : (
              lowStockItems.map(item => (
                <div key={item.id} className="stock-alert-item" style={{ padding: '8px 12px' }}>
                  <div className="stock-alert-info">
                    <span className="stock-alert-name" style={{ fontSize: '13px' }}>{item.name}</span>
                    <span className="stock-alert-qty" style={{ fontSize: '11.5px' }}>Estoque: <strong>{item.stock} {item.unit}</strong> (Mínimo: {item.minStock})</span>
                  </div>
                  <span className="stock-alert-badge" style={{ fontSize: '11px', fontWeight: '800' }}>Repor</span>
                </div>
              ))
            )}
          </div>

          {lowStockItems.length > 0 && (
            <button
              className="btn-secondary"
              onClick={() => onChangeTab('admin-products')}
              style={{ width: '100%', fontSize: '12.5px', marginTop: '12px', fontWeight: '700' }}
            >
              Ir para Gestão de Estoque
            </button>
          )}
        </div>

      </div>

      {/* Painel de Vendas Recentes da Rede (Apenas modo Consolidado) */}
      {viewMode === 'consolidated' && (
        <div className="section-card">
          <div className="card-header" style={{ marginBottom: '14px' }}>
            <h2 className="card-title">
              <History size={20} className="brand-icon" style={{ color: 'var(--primary)' }} />
              Vendas Recentes na Rede (Ao Vivo)
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Últimas transações sincronizadas entre matriz e filiais
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
            {activeSales.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                Nenhuma venda registrada na rede para os filtros atuais.
              </div>
            ) : (
              [...activeSales]
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 8)
                .map((sale, idx) => {
                  const saleDate = new Date(sale.timestamp);
                  const storeName = sale.storeId === 'loja-1' ? 'Loja 1 (Matriz)' : sale.storeId === 'loja-2' ? 'Loja 2 (Filial)' : sale.storeId;
                  const storeColor = sale.storeId === 'loja-1' ? 'var(--primary)' : 'var(--brand-yellow)';
                  const itemsCount = sale.items ? sale.items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0;
                  return (
                    <div key={idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', color: 'var(--primary)' }}>
                          <ShoppingBag size={18} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>{sale.id}</span>
                            <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: storeColor, border: `1px solid ${storeColor}40` }}>
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

      {/* Painel de Backups e Segurança do Terminal */}
      <div className="section-card">
        <div className="card-header" style={{ marginBottom: '14px' }}>
          <h2 className="card-title">
            <Database size={20} className="brand-icon" style={{ color: 'var(--primary)' }} />
            Segurança & Backup do Terminal
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mantenha seus dados seguros contra falhas de hardware ou troca de computador</span>
        </div>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '240px' }}>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
              Baixe uma cópia completa contendo <strong>produtos, vendas, despesas, fiados e fechamentos de caixa</strong>. Recomendamos salvar semanalmente em um pendrive ou pasta segura.
            </p>
            <button
              onClick={onExportBackup}
              className="btn-primary"
              style={{ marginTop: '12px', width: 'auto', padding: '9px 18px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700' }}
            >
              <Download size={16} /> Fazer Backup (Exportar JSON)
            </button>
          </div>
          <div style={{ width: '1px', backgroundColor: 'var(--border-color)', alignSelf: 'stretch' }}></div>
          <div style={{ flex: '1', minWidth: '240px' }}>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
              Importe um backup para <strong>mesclar</strong> os dados com os já existentes (nenhum dado atual é apagado). Ideal para migrar dados entre dispositivos.
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
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '700' }}
              >
                <Upload size={16} /> Escolher Arquivo de Backup
              </label>
            </div>
          </div>
          <div style={{ width: '1px', backgroundColor: 'var(--border-color)', alignSelf: 'stretch' }}></div>
          <div style={{ flex: '1', minWidth: '240px' }}>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
              <strong>Zerar Banco de Dados:</strong> Apague todos os produtos, vendas, despesas, fiados e fechamentos de caixa para reiniciar o sistema limpo.
            </p>
            <button
              onClick={onResetAllData}
              className="btn-danger"
              style={{
                marginTop: '12px',
                width: 'auto',
                padding: '9px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--danger)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={16} /> Zerar Sistema e Nuvem
            </button>
          </div>
        </div>
      </div>

    </div>
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
  setCheckoutInstallments,
  onOpenExpenseModal,
  onSaveQuote,
  storeId = 'loja-1'
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
      } else if (e.key === 'F6') {
        e.preventDefault();
        if (cart.length > 0 && onSaveQuote) {
          onSaveQuote();
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
  }, [cart, paymentMethod, onCheckout, onRemoveFromCart, onSaveQuote]);

  // Pesquisar produtos manualmente (Apenas produtos com estoque disponível nesta loja)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    const cleanTerm = searchTerm.toLowerCase();
    const filtered = products.filter(p => {
      const currentStoreStock = storeId === 'loja-1' ? (p.stockLoja1 ?? p.stock ?? 0) : (p.stockLoja2 ?? 0);
      if (currentStoreStock <= 0) return false; // Mostra apenas produtos com estoque positivo nesta loja

      return (
        (p.name && p.name.toLowerCase().includes(cleanTerm)) ||
        (p.code && String(p.code).includes(cleanTerm)) ||
        (p.category && p.category.toLowerCase().includes(cleanTerm))
      );
    });
    setSearchResults(filtered.slice(0, 6)); // limita a 6 resultados rápidos
  }, [searchTerm, products, storeId]);

  const selectProductManual = (product) => {
    const currentStock = storeId === 'loja-1' ? (product.stockLoja1 ?? product.stock ?? 0) : (product.stockLoja2 ?? 0);
    if (currentStock <= 0) {
      alert(`Produto '${product.name}' está sem estoque na ${storeId === 'loja-1' ? 'Loja 1 (Matriz)' : 'Loja 2 (Filial)'}!`);
      return;
    }
    const existing = cart.find(item => item.id === product.id);
    if (existing && existing.quantity >= currentStock) {
      alert(`Estoque máximo disponível nesta unidade atingido (${currentStock} ${product.unit || 'un'})!`);
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
              placeholder={`Digite o código ou nome (Estoque ${storeId === 'loja-1' ? 'Loja 1 - Matriz' : 'Loja 2 - Filial'})... [F2]`}
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
              {searchResults.map(p => {
                const storeStock = storeId === 'loja-1' ? (p.stockLoja1 ?? p.stock ?? 0) : (p.stockLoja2 ?? 0);
                return (
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
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Cód: {p.code} | Estoque {storeId === 'loja-1' ? 'Loja 1' : 'Loja 2'}: <span style={{ color: 'var(--success)', fontWeight: '700' }}>{storeStock} {p.unit || 'un'}</span>
                      </div>
                    </div>
                    <strong>R$ {(p.salePrice || 0).toFixed(2)}</strong>
                  </div>
                );
              })}
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
        
        {/* 1. Header Integrado: Título + Badge de Caixa + Botão de Despesa */}
        <div className="pdv-checkout-top-header">
          <div className="pdv-checkout-header-title">
            <span className="pdv-checkout-badge">CHECKOUT</span>
            <h2>Resumo & Pagamento</h2>
          </div>

          <div className="pdv-caixa-action-pill">
            <div className="pdv-caixa-info" title="Saldo acumulado em caixa no momento">
              <Coins size={15} className="pdv-caixa-icon" />
              <span className="pdv-caixa-val">R$ {currentCashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <button
              type="button"
              onClick={onOpenExpenseModal}
              className="pdv-expense-quick-btn"
              title="Registrar Despesa / Saída de Caixa"
            >
              <TrendingDown size={14} />
              <span>Saída</span>
            </button>
          </div>
        </div>

        {/* 2. Corpo do Checkout (Subtotal, Desconto, Forma de Pgto, Entrega) */}
        <div className="pdv-checkout-body">
          
          {/* Subtotal & Desconto Box */}
          <div className="pdv-receipt-card">
            <div className="pdv-receipt-line">
              <span className="label">Subtotal</span>
              <strong className="value">R$ {totalCart.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>

            <div className="pdv-receipt-line">
              <span className="label">Desconto</span>
              <div className="pdv-discount-val-wrap">
                {discount > 0 && (
                  <button
                    type="button"
                    className="pdv-clear-discount-btn"
                    onClick={() => setDiscount(0)}
                    title="Remover desconto"
                  >
                    <X size={12} /> Zerar
                  </button>
                )}
                <strong className={`value ${discount > 0 ? 'has-discount' : ''}`}>
                  {discount > 0 ? `- R$ ${discount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ 0,00'}
                </strong>
              </div>
            </div>

            {/* Sugestões Rápidas de Desconto (Pills) */}
            {totalCart > 0 && (
              <div className="pdv-discount-suggestions">
                <span className="hint-label">💡 Sugestão à vista:</span>
                <div className="pdv-discount-pills">
                  {[3, 5, 10].map(pct => {
                    const val = parseFloat((totalCart * (pct / 100)).toFixed(2));
                    const isCurrent = Math.abs(discount - val) < 0.01;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDiscount(isCurrent ? 0 : val)}
                        className={`pdv-discount-pill ${isCurrent ? 'active' : ''}`}
                        title={`Aplicar ${pct}% de desconto (R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
                      >
                        {pct}% (R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Seletor de Forma de Pagamento */}
          <div className="pdv-payment-section">
            <div className="pdv-section-title">
              <CreditCard size={13} />
              <span>Forma de Pagamento</span>
            </div>

            <div className="pdv-payment-selector-grid">
              <button
                type="button"
                className={`pdv-pay-btn ${paymentMethod === 'Pix' ? 'active pix' : ''}`}
                onClick={() => setPaymentMethod('Pix')}
              >
                <Smartphone size={15} />
                <span>Pix</span>
              </button>
              
              <button
                type="button"
                className={`pdv-pay-btn ${paymentMethod === 'Dinheiro' ? 'active money' : ''}`}
                onClick={() => setPaymentMethod('Dinheiro')}
              >
                <Coins size={15} />
                <span>Dinheiro</span>
              </button>

              <button
                type="button"
                className={`pdv-pay-btn ${paymentMethod === 'Débito' ? 'active card' : ''}`}
                onClick={() => setPaymentMethod('Débito')}
              >
                <CreditCard size={15} />
                <span>Débito</span>
              </button>

              <button
                type="button"
                className={`pdv-pay-btn ${paymentMethod === 'Crédito' ? 'active card' : ''}`}
                onClick={() => setPaymentMethod('Crédito')}
              >
                <CreditCard size={15} />
                <span>Crédito</span>
              </button>

              <button
                type="button"
                className={`pdv-pay-btn ${paymentMethod === 'Fiado' ? 'active fiado' : ''}`}
                onClick={() => setPaymentMethod('Fiado')}
              >
                <BookOpen size={15} />
                <span>Fiado</span>
              </button>
            </div>

            {/* Condicional: Parcelamento no Crédito */}
            {paymentMethod === 'Crédito' && (
              <div className="pdv-credit-installments-box">
                <label>Parcelamento:</label>
                <select
                  value={checkoutInstallments}
                  onChange={(e) => setCheckoutInstallments(e.target.value)}
                  className="pdv-select-field"
                >
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
            )}

            {/* Condicional: Troco no Dinheiro */}
            {paymentMethod === 'Dinheiro' && (
              <div className="pdv-cash-change-box">
                <div className="pdv-cash-row">
                  <div className="pdv-cash-input-wrap">
                    <label>Valor Pago:</label>
                    <div className="pdv-cash-field">
                      <span>R$</span>
                      <input
                        ref={amountPaidInputRef}
                        type="text"
                        placeholder="0,00"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                      />
                    </div>
                  </div>

                  {numericPaid > 0 && (
                    <div className="pdv-change-badge">
                      <span className="change-lbl">Troco:</span>
                      <strong className="change-val">R$ {change.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Agendamento de Entrega (Compacto com Switch / Accordion) */}
          <div className={`pdv-delivery-card ${requiresDelivery ? 'expanded' : ''}`}>
            <div
              className="pdv-delivery-header"
              onClick={() => setRequiresDelivery(!requiresDelivery)}
            >
              <div className="pdv-delivery-title">
                <Truck size={15} className="pdv-delivery-icon" />
                <span className="pdv-delivery-label">Agendar entrega deste pedido?</span>
              </div>
              <input
                type="checkbox"
                checked={requiresDelivery}
                onChange={(e) => setRequiresDelivery(e.target.checked)}
                className="pdv-custom-checkbox"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {requiresDelivery && (
              <div className="pdv-delivery-fields">
                <div className="pdv-field-group">
                  <label>Recebedor / Contato</label>
                  <input
                    type="text"
                    placeholder="Nome do contato..."
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                  />
                </div>
                <div className="pdv-field-group">
                  <label>Endereço de Entrega</label>
                  <input
                    type="text"
                    placeholder="Rua, número, bairro..."
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                  />
                </div>
                <div className="pdv-fields-row">
                  <div className="pdv-field-group">
                    <label>Data Programada</label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </div>
                  <div className="pdv-field-group">
                    <label>Observações</label>
                    <input
                      type="text"
                      placeholder="Instruções..."
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* 3. Rodapé Fixo / Pinned Footer (Total + Botões de Ação) */}
        <div className="pdv-checkout-footer-pinned">
          
          {/* Card Total */}
          <div className="pdv-total-banner">
            <div className="pdv-total-left">
              <span className="pdv-total-caption">TOTAL DA VENDA</span>
              <div className="pdv-total-stats">
                <span>{cart.reduce((sum, i) => sum + i.quantity, 0)} itens</span>
                <span className="dot">•</span>
                <span>Lucro: R$ {profit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="pdv-total-right">
              <span className="pdv-total-currency">R$</span>
              <span className="pdv-total-amount">{totalCartWithDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className={`pdv-actions-grid ${cart.length > 0 ? 'two-buttons' : 'single-button'}`}>
            {cart.length > 0 && (
              <button
                type="button"
                className="pdv-btn-quote"
                onClick={onSaveQuote}
                title="Salvar como Orçamento Comercial sem baixar estoque (F6)"
              >
                <FileSpreadsheet size={15} />
                <span>Orçamento (F6)</span>
              </button>
            )}

            <button
              type="button"
              className="pdv-btn-finalize"
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
              <Check size={18} />
              <span>Finalizar Venda (F4)</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. TELA: CADASTRO PRODUTOS / INVENTÁRIO
// ==========================================
function ProductsView({ products, onEditProduct, onDeleteProduct, onTransferStock, onOpenReturnModal, storeId = 'loja-1' }) {
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
        <div>
          <h2 className="card-title" style={{ margin: 0 }}>
            <Package size={20} className="brand-icon" style={{ color: 'var(--primary)' }} />
            Lista de Produtos em Estoque
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Gerenciamento de materiais, estoque por unidade e trocas/devoluções
          </span>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Botão de Devolução / Troca */}
          {onOpenReturnModal && (
            <button
              type="button"
              onClick={() => onOpenReturnModal()}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: '700',
                borderColor: 'var(--brand-yellow)',
                color: 'var(--brand-yellow)',
                backgroundColor: 'rgba(243, 180, 29, 0.12)'
              }}
              title="Registrar devolução de mercadoria ou troca com ajuste de estoque e caixa"
            >
              <RotateCcw size={15} /> Devolução / Troca
            </button>
          )}

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
              placeholder="Pesquisar produto..."
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
                <th style={{ width: '140px', textAlign: 'right' }}>Ações</th>
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
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {onOpenReturnModal && (
                          <button
                            className="delete-btn"
                            style={{ color: 'var(--brand-yellow)', padding: '4px' }}
                            onClick={() => onOpenReturnModal(p)}
                            title="Devolução / Troca deste produto"
                          >
                            <RotateCcw size={15} />
                          </button>
                        )}
                        <button
                          className="delete-btn"
                          style={{ color: 'var(--primary)', padding: '4px' }}
                          onClick={() => onTransferStock(p)}
                          title="Transferir Estoque entre Lojas"
                        >
                          <ArrowRightLeft size={15} />
                        </button>
                        <button
                          className="delete-btn"
                          style={{ color: 'var(--text-secondary)', padding: '4px' }}
                          onClick={() => onEditProduct(p)}
                          title="Editar Produto"
                        >
                          <Edit3 size={15} />
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
// 4. TELA: HISTÓRICO DE VENDAS E CONTROLE DE DESPESAS
// ==========================================
function HistoryExpensesView({ sales, expenses, onDeleteExpense, onOpenExpenseModal }) {
  const [subTab, setSubTab] = useState('expenses'); // 'expenses' | 'sales'
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [salesSearch, setSalesSearch] = useState('');
  const [salesPaymentFilter, setSalesPaymentFilter] = useState('all');

  // Cálculos de Despesas
  const totalExpensesValue = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const avgExpense = expenses.length > 0 ? (totalExpensesValue / expenses.length) : 0;

  // Filtragem de despesas
  const filteredExpenses = expenses.filter(exp => {
    const term = expenseSearch.toLowerCase();
    const descMatch = (exp.description || '').toLowerCase().includes(term);
    const catMatch = (exp.category || '').toLowerCase().includes(term);
    const amountMatch = (exp.amount || '').toString().includes(term);
    const matchesSearch = descMatch || catMatch || amountMatch;

    const matchesCategory = expenseCategoryFilter === 'all' || exp.category === expenseCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Categorias disponíveis e totais por categoria
  const expenseCategories = ['Contas Fixas', 'Fornecedores', 'Logística', 'Funcionários', 'Infraestrutura', 'Outros'];

  // Filtragem de vendas
  const filteredSales = sales.filter(sale => {
    const term = salesSearch.toLowerCase();
    const idMatch = (sale.id || '').toLowerCase().includes(term);
    const itemMatch = sale.items && sale.items.some(i => (i.name || '').toLowerCase().includes(term));
    const payMatch = (sale.paymentMethod || '').toLowerCase().includes(term);
    const matchesSearch = idMatch || itemMatch || payMatch;

    const matchesPayment = salesPaymentFilter === 'all' || (sale.paymentMethod || '').toLowerCase() === salesPaymentFilter.toLowerCase();
    return matchesSearch && matchesPayment;
  });

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Contas Fixas': return { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
      case 'Fornecedores': return { bg: 'rgba(243, 180, 29, 0.12)', text: '#f3b41d', border: 'rgba(243, 180, 29, 0.3)' };
      case 'Logística': return { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' };
      case 'Funcionários': return { bg: 'rgba(168, 85, 247, 0.12)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' };
      case 'Infraestrutura': return { bg: 'rgba(20, 184, 166, 0.12)', text: '#14b8a6', border: 'rgba(20, 184, 166, 0.3)' };
      default: return { bg: 'rgba(107, 114, 128, 0.12)', text: '#9ca3af', border: 'rgba(107, 114, 128, 0.3)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Sub-Navegação interna com Abas Estilizadas */}
      <div className="finance-history-tabs">
        <button
          type="button"
          className={`finance-tab-btn ${subTab === 'expenses' ? 'active-expenses' : ''}`}
          onClick={() => setSubTab('expenses')}
        >
          <DollarSign size={18} />
          Controle & Gestão de Despesas ({expenses.length})
        </button>
        <button
          type="button"
          className={`finance-tab-btn ${subTab === 'sales' ? 'active-sales' : ''}`}
          onClick={() => setSubTab('sales')}
        >
          <History size={18} />
          Histórico Geral de Vendas ({sales.length})
        </button>
      </div>

      {subTab === 'expenses' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 3 Mini-KPIs de Despesas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div className="stat-card" style={{ padding: '14px 18px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)', borderRadius: 'var(--radius-md)' }}>
                <TrendingDown size={22} />
              </div>
              <div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>Total em Despesas</span>
                <strong style={{ fontSize: '18px', color: 'var(--danger)', display: 'block', marginTop: '2px' }}>
                  R$ {totalExpensesValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            <div className="stat-card" style={{ padding: '14px 18px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '10px', backgroundColor: 'rgba(243, 180, 29, 0.12)', color: 'var(--brand-yellow)', borderRadius: 'var(--radius-md)' }}>
                <FileText size={22} />
              </div>
              <div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>Lançamentos</span>
                <strong style={{ fontSize: '18px', color: 'var(--text-primary)', display: 'block', marginTop: '2px' }}>
                  {expenses.length} registros
                </strong>
              </div>
            </div>

            <div className="stat-card" style={{ padding: '14px 18px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '10px', backgroundColor: 'rgba(18, 121, 138, 0.12)', color: 'var(--primary)', borderRadius: 'var(--radius-md)' }}>
                <Coins size={22} />
              </div>
              <div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>Ticket Médio de Saída</span>
                <strong style={{ fontSize: '18px', color: 'var(--text-primary)', display: 'block', marginTop: '2px' }}>
                  R$ {avgExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          </div>

          {/* Seção Principal de Despesas */}
          <div className="section-card">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>
                  <DollarSign size={20} className="brand-icon" style={{ color: 'var(--danger)' }} />
                  Fluxo de Despesas Comerciais & Saídas
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Gerencie todas as contas, custos fixos, logística e compras da empresa
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="input-group" style={{ maxWidth: '240px' }}>
                  <Search className="input-icon" size={16} />
                  <input
                    type="text"
                    className="input-field"
                    style={{ padding: '7px 10px 7px 34px', fontSize: '12.5px' }}
                    placeholder="Buscar despesa ou valor..."
                    value={expenseSearch}
                    onChange={(e) => setExpenseSearch(e.target.value)}
                  />
                </div>

                {onOpenExpenseModal && (
                  <button
                    type="button"
                    onClick={onOpenExpenseModal}
                    className="btn-primary"
                    style={{
                      padding: '8px 16px',
                      fontSize: '12.5px',
                      fontWeight: '800',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'var(--danger)',
                      borderColor: 'var(--danger)'
                    }}
                  >
                    <Plus size={16} /> + Registrar Despesa
                  </button>
                )}
              </div>
            </div>

            {/* Pílulas de Filtro por Categoria */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginRight: '4px' }}>Categorias:</span>
              <button
                type="button"
                onClick={() => setExpenseCategoryFilter('all')}
                className={`tab-btn-pill ${expenseCategoryFilter === 'all' ? 'active' : ''}`}
                style={{
                  padding: '4px 10px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: expenseCategoryFilter === 'all' ? 'var(--primary)' : 'var(--bg-secondary)',
                  color: expenseCategoryFilter === 'all' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Todas ({expenses.length})
              </button>
              {expenseCategories.map(cat => {
                const count = expenses.filter(e => e.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setExpenseCategoryFilter(cat)}
                    className={`tab-btn-pill ${expenseCategoryFilter === cat ? 'active' : ''}`}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: expenseCategoryFilter === cat ? 'var(--primary)' : 'var(--bg-secondary)',
                      color: expenseCategoryFilter === cat ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>

            {/* Tabela de Despesas */}
            <div className="table-container">
              {filteredExpenses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <DollarSign size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>Nenhuma despesa encontrada para este filtro.</p>
                  {onOpenExpenseModal && (
                    <button
                      type="button"
                      onClick={onOpenExpenseModal}
                      className="btn-secondary"
                      style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '700' }}
                    >
                      + Cadastrar Primeira Despesa
                    </button>
                  )}
                </div>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Data & Hora</th>
                      <th>Categoria</th>
                      <th>Origem dos Recursos</th>
                      <th>Descrição / Fornecedor</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                      <th style={{ width: '80px', textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredExpenses].reverse().map(exp => {
                      const catStyle = getCategoryColor(exp.category);
                      const formattedDate = exp.timestamp
                        ? new Date(exp.timestamp).toLocaleString('pt-BR')
                        : 'Data não informada';

                      return (
                        <tr key={exp.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                              <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                              {formattedDate}
                            </div>
                          </td>
                          <td>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '700',
                              backgroundColor: catStyle.bg,
                              color: catStyle.text,
                              border: `1px solid ${catStyle.border}`
                            }}>
                              {exp.category || 'Geral'}
                            </span>
                          </td>
                          <td>
                            <span className="expense-source-badge">
                              {exp.source || 'Caixa Físico'}
                            </span>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{exp.description}</strong>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <strong style={{ color: 'var(--danger)', fontSize: '14px' }}>
                              - R$ {parseFloat(exp.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </strong>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="delete-btn"
                              title="Excluir Despesa"
                              onClick={() => {
                                if (confirm(`Deseja realmente excluir o lançamento "${exp.description}" de R$ ${exp.amount}?`)) {
                                  onDeleteExpense(exp.id);
                                }
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </div>
      ) : (
        /* Aba de Histórico de Vendas */
        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>
                <History size={20} className="brand-icon" style={{ color: 'var(--primary)' }} />
                Histórico Geral de Vendas
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Relatório de todas as entradas, cupons fiscais e margens apuradas
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div className="input-group" style={{ maxWidth: '240px' }}>
                <Search className="input-icon" size={16} />
                <input
                  type="text"
                  className="input-field"
                  style={{ padding: '7px 10px 7px 34px', fontSize: '12.5px' }}
                  placeholder="Buscar por ID, item..."
                  value={salesSearch}
                  onChange={(e) => setSalesSearch(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-secondary)', padding: '3px', borderRadius: 'var(--radius-sm)' }}>
                {['all', 'Dinheiro', 'Pix', 'Cartão', 'Fiado'].map(pm => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setSalesPaymentFilter(pm)}
                    className={`tab-btn-pill ${salesPaymentFilter === pm ? 'active' : ''}`}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: salesPaymentFilter === pm ? 'var(--primary)' : 'transparent',
                      color: salesPaymentFilter === pm ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    {pm === 'all' ? 'Todas' : pm}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="table-container">
            {filteredSales.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <History size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p style={{ margin: 0, fontSize: '14px' }}>Nenhuma venda registrada para este filtro.</p>
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Data & Hora</th>
                    <th>ID Venda</th>
                    <th>Itens Vendidos</th>
                    <th>Forma Pagto</th>
                    <th style={{ textAlign: 'right' }}>Custo</th>
                    <th style={{ textAlign: 'right' }}>Faturamento</th>
                    <th style={{ textAlign: 'right' }}>Lucro Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filteredSales].reverse().map(sale => (
                    <tr key={sale.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                          <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                          {new Date(sale.timestamp).toLocaleString('pt-BR')}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: '700', color: 'var(--primary)' }}>
                        {sale.id}
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '60px', overflowY: 'auto' }}>
                          {sale.items && sale.items.map((it, idx) => (
                            <span key={idx} style={{ color: 'var(--text-secondary)' }}>
                              • {it.quantity}x {it.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ fontWeight: '700', fontSize: '11px' }}>
                          {sale.paymentMethod || 'Dinheiro'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>
                        R$ {(sale.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '700', fontSize: '13px' }}>
                        R$ {(sale.totalPrice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong style={{ color: 'var(--success)', fontSize: '13px' }}>
                          + R$ {(sale.profit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </strong>
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
// MODAL: DEVOLUÇÃO DE MERCADORIA / TROCA
// ==========================================
function ReturnProductModal({ products, storeId, onClose, onConfirmReturn, initialProduct = null }) {
  const [selectedProductId, setSelectedProductId] = useState(initialProduct ? initialProduct.id : '');
  const [returnStore, setReturnStore] = useState(storeId || 'loja-1');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('Defeito / Avaria de Fábrica');
  const [financialAction, setFinancialAction] = useState('none'); // 'none' ou 'cash_refund'
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [productSearch, setProductSearch] = useState(initialProduct ? initialProduct.name : '');

  const filteredProducts = (!selectedProductId && productSearch.trim())
    ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || String(p.code).includes(productSearch)).slice(0, 6)
    : [];

  const selectedProduct = products.find(p => String(p.id) === String(selectedProductId));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      alert("Por favor, selecione um produto do catálogo para devolver.");
      return;
    }
    const qty = parseInt(quantity) || 0;
    if (qty <= 0) {
      alert("Informe uma quantidade válida maior que zero.");
      return;
    }

    onConfirmReturn({
      product: selectedProduct,
      storeId: returnStore,
      quantity: qty,
      reason,
      financialAction,
      customerName: customerName.trim(),
      notes: notes.trim(),
      refundAmount: (selectedProduct.salePrice || 0) * qty
    });
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div className="modal-content glass-card" style={{ maxWidth: '560px', width: '95%', padding: '24px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(243, 180, 29, 0.15)', borderRadius: 'var(--radius-sm)', color: 'var(--brand-yellow)' }}>
              <RotateCcw size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                Devolução de Mercadoria / Troca
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Retorno de itens ao inventário da loja e ajuste financeiro
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Seleção do Produto */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: '700' }}>Produto a Devolver *</label>
            <div className="input-group" style={{ position: 'relative' }}>
              <Search className="input-icon" size={16} />
              <input
                type="text"
                placeholder="Buscar produto por nome ou código de barras..."
                value={selectedProduct ? selectedProduct.name : productSearch}
                onChange={e => {
                  setSelectedProductId('');
                  setProductSearch(e.target.value);
                }}
                style={{ width: '100%', padding: '9px 12px 9px 36px', fontSize: '13px' }}
              />
              {selectedProduct && (
                <button
                  type="button"
                  onClick={() => { setSelectedProductId(''); setProductSearch(''); }}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {filteredProducts.length > 0 && !selectedProduct && (
              <div style={{ marginTop: '6px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', maxHeight: '160px', overflowY: 'auto', boxShadow: 'var(--shadow-md)' }}>
                {filteredProducts.map(p => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedProductId(p.id);
                      setProductSearch(p.name);
                    }}
                    style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    className="search-item-hover"
                  >
                    <div>
                      <strong style={{ fontSize: '13px', color: 'var(--primary)' }}>{p.name}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cód: {p.code} | Custo: R$ {(p.costPrice || 0).toFixed(2)} | Venda: R$ {(p.salePrice || 0).toFixed(2)}</div>
                    </div>
                    <span style={{ fontSize: '11px', backgroundColor: 'var(--primary)', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontWeight: '700' }}>Selecionar</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Loja de Destino & Quantidade */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: '700' }}>Loja que Recebe o Item *</label>
              <select
                value={returnStore}
                onChange={e => setReturnStore(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', fontSize: '13px' }}
              >
                <option value="loja-1">Loja 1 (Matriz)</option>
                <option value="loja-2">Loja 2 (Filial)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: '700' }}>Qtd Devolvida *</label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', fontSize: '13px' }}
              />
            </div>
          </div>

          {/* Motivo da Devolução */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: '700' }}>Motivo da Devolução *</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{ width: '100%', padding: '9px 10px', fontSize: '13px' }}
            >
              <option value="Defeito / Avaria de Fábrica">Defeito / Avaria de Fábrica</option>
              <option value="Desistência do Cliente">Desistência / Arrependimento do Cliente</option>
              <option value="Troca por outro material">Troca por outro material</option>
              <option value="Erro de Separação / Quantidade">Erro de Separação / Quantidade</option>
              <option value="Outro">Outro Motivo</option>
            </select>
          </div>

          {/* Destino Financeiro */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: '700' }}>Ajuste Financeiro</label>
            <select
              value={financialAction}
              onChange={e => setFinancialAction(e.target.value)}
              style={{ width: '100%', padding: '9px 10px', fontSize: '13px' }}
            >
              <option value="none">Apenas Repor Estoque (Sem saída financeira do caixa)</option>
              <option value="cash_refund">Reembolso em Dinheiro (Registrar Saída/Despesa no Caixa Físico)</option>
            </select>
          </div>

          {financialAction === 'cash_refund' && selectedProduct && (
            <div style={{ padding: '10px 14px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>
                Será gerada uma despesa no caixa físico de <strong>R$ {((selectedProduct.salePrice || 0) * (parseInt(quantity) || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> correspondente ao reembolso ao cliente.
              </span>
            </div>
          )}

          {/* Nome do Cliente e Observações */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: '700' }}>Cliente / Solicitante (Opcional)</label>
              <input
                type="text"
                placeholder="Ex: João da Silva"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '12.5px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: '700' }}>Observações</label>
              <input
                type="text"
                placeholder="Detalhes adicionais..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '12.5px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ padding: '10px 16px', fontWeight: '600' }}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!selectedProduct}
              className="btn-primary"
              style={{ padding: '10px 22px', fontWeight: '800', backgroundColor: 'var(--brand-yellow)', color: '#000' }}
            >
              Confirmar Devolução
            </button>
          </div>
        </form>
      </div>
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
  const [source, setSource] = useState('Caixa Físico');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description || !amount) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    onSave({
      description: description.trim(),
      amount: parseFloat(amount.replace(',', '.')),
      category,
      source
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

          <div className="form-group">
            <label>Origem dos Recursos (De onde sai o dinheiro?)</label>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="Caixa Físico">Caixa Físico (Gaveta do Terminal)</option>
              <option value="Cofre">Cofre Seguro (Fundo Reserva)</option>
              <option value="Banco / Pix">Banco / Pix (Conta Digital)</option>
            </select>
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

  const totalCashSales = todaySales.filter(s => s.paymentMethod === 'Dinheiro').reduce((sum, s) => sum + s.totalPrice, 0);
  const totalCashExpenses = todayExpenses.filter(e => e.source === 'Caixa Físico' || !e.source).reduce((sum, e) => sum + e.amount, 0);

  const netCash = totalCashSales - totalCashExpenses - totalVaultDeposits + totalVaultWithdrawals;

  // Calculando saldos de abertura e fechamento
  const openingCash = getCashBalanceAtDate ? getCashBalanceAtDate(todayStr) : 0;
  const closingCash = openingCash + netCash;

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
function CalendarReportsView({ sales, expenses, vaultTransactions = [], storeId, getCashBalanceAtDate, bills = [] }) {
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

  const dayVaultTransactions = reportMode === 'single'
    ? vaultTransactions.filter(vt => vt.storeId === storeId && vt.date === startDate)
    : vaultTransactions.filter(vt => vt.storeId === storeId && vt.date >= startDate && vt.date <= endDate);

  const periodBills = reportMode === 'single'
    ? bills.filter(b => b.storeId === storeId && b.dueDate === startDate)
    : bills.filter(b => b.storeId === storeId && b.dueDate >= startDate && b.dueDate <= endDate);

  const totalSales = daySales.reduce((sum, s) => sum + s.totalPrice, 0);
  const totalProfit = daySales.reduce((sum, s) => sum + s.profit, 0);
  const totalExpenses = dayExpenses.reduce((sum, e) => sum + e.amount, 0);

  const totalVaultDeposits = dayVaultTransactions.filter(vt => vt.type === 'deposit').reduce((sum, vt) => sum + vt.amount, 0);
  const totalVaultWithdrawals = dayVaultTransactions.filter(vt => vt.type === 'withdrawal').reduce((sum, vt) => sum + vt.amount, 0);

  const totalCashSales = daySales.filter(s => s.paymentMethod === 'Dinheiro').reduce((sum, s) => sum + s.totalPrice, 0);
  const totalCashExpenses = dayExpenses.filter(e => e.source === 'Caixa Físico' || !e.source).reduce((sum, e) => sum + e.amount, 0);

  const netCash = totalSales - totalExpenses;
  const drawerChange = totalCashSales - totalCashExpenses - totalVaultDeposits + totalVaultWithdrawals;

  // Calculando saldos de abertura e fechamento da gaveta
  const openingCash = getCashBalanceAtDate ? getCashBalanceAtDate(startDate) : 0;
  const closingCash = openingCash + drawerChange;

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

  const handlePrintStatement = () => {
    const printWindow = window.open('', '_blank', 'width=850,height=900');
    const storeLabel = storeId === 'loja-1' ? 'Loja 1 (Matriz)' : 'Loja 2 (Filial)';
    const dateLabel = reportMode === 'single'
      ? new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')
      : `${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}`;

    const salesRows = daySales.map(s => {
      const time = new Date(s.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const itemsList = (s.items || []).map(i => `${i.quantity}x ${i.name} (R$ ${(parseFloat(i.salePrice || 0) * (parseInt(i.quantity) || 1)).toFixed(2)})`).join(', ');
      return `
        <tr>
          <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px;">#${s.id}</td>
          <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px;">${time}</td>
          <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px;">${s.paymentMethod || 'Dinheiro'}</td>
          <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px;">${itemsList || '-'}</td>
          <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; text-align: right; font-weight: bold;">R$ ${(s.totalPrice || 0).toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const expenseRows = dayExpenses.map(e => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px;">${e.category || 'Geral'}</td>
        <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px;">${e.source || 'Caixa Físico'}</td>
        <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px;">${e.description}</td>
        <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; text-align: right; color: #dc2626; font-weight: bold;">- R$ ${(e.amount || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Extrato de Fechamento de Caixa - Novo Lar</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; margin: 20px; line-height: 1.4; }
            .header-box { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #12798a; padding-bottom: 12px; margin-bottom: 16px; }
            .store-title { font-size: 18px; font-weight: 800; color: #12798a; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
            .kpi-card { border: 1px solid #ccc; padding: 10px; border-radius: 6px; background: #fafafa; }
            .kpi-label { font-size: 10px; text-transform: uppercase; color: #666; font-weight: bold; }
            .kpi-value { font-size: 16px; font-weight: bold; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th { background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; text-align: left; }
            .section-title { font-size: 13px; font-weight: bold; color: #333; margin: 14px 0 6px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; text-align: center; font-size: 11px; }
            .sign-line { border-top: 1px solid #333; padding-top: 4px; margin-top: 30px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header-box">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${window.location.origin}/logo.png" alt="Logo Novo Lar" style="max-height: 52px; width: auto; object-fit: contain;" onerror="this.style.display='none';" />
              <div>
                <div class="store-title">NOVO LAR - CASA & CONSTRUÇÃO</div>
                <div style="font-size: 11.5px; color: #555;">CNPJ: 62.002.153/0001-25 • Tel: (11) 4656-8183</div>
                <div style="font-size: 10.5px; color: #777;">Rua das Rosas, 1077 - Jardim Novo Eden - Santa Isabel / SP</div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 15px; font-weight: bold;">EXTRATO DE FECHAMENTO DE CAIXA</div>
              <div style="font-size: 12px; color: #333; font-weight: 600;">Data: ${dateLabel}</div>
              <div style="font-size: 11px; color: #666;">Unidade: <strong>${storeLabel}</strong></div>
            </div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">Faturamento Total</div>
              <div class="kpi-value" style="color: #12798a;">R$ ${totalSales.toFixed(2)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Lucro do Período</div>
              <div class="kpi-value" style="color: #16a34a;">R$ ${totalProfit.toFixed(2)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Despesas no Caixa</div>
              <div class="kpi-value" style="color: #dc2626;">R$ ${totalCashExpenses.toFixed(2)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Saldo Gaveta (Fechamento)</div>
              <div class="kpi-value" style="color: #111;">R$ ${closingCash.toFixed(2)}</div>
            </div>
          </div>

          <div class="section-title">Detalhamento por Meio de Pagamento</div>
          <table>
            <thead>
              <tr>
                <th>Forma de Pagamento</th>
                <th style="text-align: right;">Total Recebido</th>
                <th style="text-align: right;">Participação</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px;">💵 Dinheiro (Espécie em Gaveta)</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; text-align: right; font-weight: bold;">R$ ${cashAmount.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; text-align: right;">${totalSales > 0 ? ((cashAmount / totalSales) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px;">📱 PIX Instantâneo</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; text-align: right; font-weight: bold;">R$ ${pixAmount.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; text-align: right;">${totalSales > 0 ? ((pixAmount / totalSales) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px;">💳 Cartões (Débito e Crédito)</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; text-align: right; font-weight: bold;">R$ ${cardAmount.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; text-align: right;">${totalSales > 0 ? ((cardAmount / totalSales) * 100).toFixed(1) : 0}%</td>
              </tr>
              ${otherAmount > 0 ? `
              <tr>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px;">📖 Fiado / Outros</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; text-align: right; font-weight: bold;">R$ ${otherAmount.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 6px; font-size: 11px; text-align: right;">${totalSales > 0 ? ((otherAmount / totalSales) * 100).toFixed(1) : 0}%</td>
              </tr>` : ''}
              <tr style="background-color: #f8fafc; font-weight: bold;">
                <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 11px;">TOTAL GERAL BRUTO</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 11px; text-align: right; color: #12798a;">R$ ${totalSales.toFixed(2)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 11px; text-align: right;">100%</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Movimentações de Gaveta & Cofre Seguro</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11px; margin-bottom: 16px;">
            <div style="border: 1px solid #ddd; padding: 8px; border-radius: 4px;">
              <div>• Fundo de Abertura: <strong>R$ ${openingCash.toFixed(2)}</strong></div>
              <div>• Vendas em Dinheiro: <strong>+ R$ ${totalCashSales.toFixed(2)}</strong></div>
              <div>• Despesas pagas pelo Caixa: <strong>- R$ ${totalCashExpenses.toFixed(2)}</strong></div>
            </div>
            <div style="border: 1px solid #ddd; padding: 8px; border-radius: 4px;">
              <div>• Sangrias p/ Cofre: <strong>- R$ ${totalVaultDeposits.toFixed(2)}</strong></div>
              <div>• Retiradas do Cofre p/ Caixa: <strong>+ R$ ${totalVaultWithdrawals.toFixed(2)}</strong></div>
              <div style="color: #12798a; font-weight: bold; margin-top: 4px;">• Saldo Final em Gaveta: R$ ${closingCash.toFixed(2)}</div>
            </div>
          </div>

          <div class="section-title">Relação de Vendas do Período (${daySales.length} vendas)</div>
          <table>
            <thead>
              <tr>
                <th>Venda</th>
                <th>Hora</th>
                <th>Pagto</th>
                <th>Itens Vendidos</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${salesRows || '<tr><td colspan="5" style="text-align: center; padding: 12px; color: #888;">Nenhuma venda registrada nesta data.</td></tr>'}
            </tbody>
          </table>

          ${dayExpenses.length > 0 ? `
          <div class="section-title">Relação de Despesas do Período (${dayExpenses.length} lançamentos)</div>
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Origem</th>
                <th>Descrição</th>
                <th style="text-align: right;">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${expenseRows}
            </tbody>
          </table>` : ''}

          <div class="signatures">
            <div>
              <div class="sign-line">Operador de Caixa</div>
              <div style="color: #666; font-size: 9px; margin-top: 2px;">Responsável pela conferência dos valores</div>
            </div>
            <div>
              <div class="sign-line">Gerente / Supervisor</div>
              <div style="color: #666; font-size: 9px; margin-top: 2px;">Visto e aprovação do fechamento</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
            const hasBills = bills.some(b => b.storeId === storeId && b.dueDate === formattedDate && b.status === 'Pendente');

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
                {(hasSales || hasExpenses || hasBills) && (
                  <div style={{
                    display: 'flex',
                    gap: '2px',
                    position: 'absolute',
                    bottom: '3px'
                  }}>
                    {hasSales && <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isSelected ? '#ffffff' : 'var(--success)' }}></div>}
                    {hasExpenses && <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isSelected ? '#ffffff' : 'var(--danger)' }}></div>}
                    {hasBills && <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isSelected ? '#ffffff' : 'var(--brand-yellow)' }}></div>}
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
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 className="card-title" style={{ margin: 0 }}>
                {reportMode === 'single'
                  ? `Relatório Diário — ${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')}`
                  : `Relatório de Período — ${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} até ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}`
                }
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Demonstrativo de fechamento de caixa e movimentações financeiras
              </span>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={handlePrintStatement}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                width: 'auto'
              }}
              title="Imprimir ou baixar extrato completo de fechamento de caixa com todas as vendas e itens"
            >
              <Printer size={15} /> Imprimir / Baixar Extrato de Caixa
            </button>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Sangria para Cofre</div>
              <strong style={{ fontSize: '13px', color: 'var(--success)', marginTop: '2px', display: 'block' }}>
                R$ {totalVaultDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Retirado do Cofre</div>
              <strong style={{ fontSize: '13px', color: 'var(--danger)', marginTop: '2px', display: 'block' }}>
                R$ {totalVaultWithdrawals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
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

        <div className="section-card">
          <div className="card-header">
            <h3 className="card-title">Boletos do Período ({periodBills.length})</h3>
          </div>
          <div className="table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {periodBills.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: '14px' }}>Nenhum boleto vencendo neste período.</p>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Vencimento</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {periodBills.map(bill => (
                    <tr key={bill.id}>
                      <td>{new Date(bill.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                      <td style={{ fontWeight: '700' }}>{bill.description}</td>
                      <td>{bill.category}</td>
                      <td>
                        <span className={`badge ${bill.status === 'Pago' ? 'badge-success' : 'badge-danger'}`} style={{
                          padding: '2px 6px',
                          fontSize: '10px',
                          fontWeight: '700',
                          backgroundColor: bill.status === 'Pago' ? 'var(--success-glow)' : 'rgba(239, 68, 68, 0.1)',
                          color: bill.status === 'Pago' ? 'var(--success)' : 'var(--danger)',
                          border: `1px solid ${bill.status === 'Pago' ? 'var(--success)' : 'var(--danger)'}`
                        }}>
                          {bill.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-primary)' }}>R$ {bill.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="card-header">
            <h3 className="card-title">Movimentações do Cofre ({dayVaultTransactions.length})</h3>
          </div>
          <div className="table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {dayVaultTransactions.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: '14px' }}>Nenhuma movimentação de cofre registrada nesta data.</p>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Horário</th>
                    <th>Operação</th>
                    <th>Descrição</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {dayVaultTransactions.map(vt => (
                    <tr key={vt.id}>
                      <td>{new Date(vt.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>
                        {vt.type === 'deposit' ? (
                          <span className="badge badge-success">Sangria (Entrada)</span>
                        ) : (
                          <span className="badge badge-danger">Retirada (Saída)</span>
                        )}
                      </td>
                      <td>{vt.description}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: vt.type === 'deposit' ? 'var(--success)' : 'var(--danger)' }}>
                        {vt.type === 'deposit' ? '+' : '-'} R$ {vt.amount.toFixed(2)}
                      </td>
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
// 10. TELA: ASSISTENTE DE IA E INTELIGÊNCIA COMERCIAL (INFORMATIVOS & BI)
// ==========================================
function AIAssistantView({ products, sales, expenses }) {
  // Verifica se o estoque está vazio
  const isEstoqueVazio = products.length === 0;

  // Lógica de análise de categorias para materiais de construção
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

  // Diagnóstico Comercial Inteligente - Métricas Reais
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

  // Produtos mais lucrativos para o card de estratégia
  const topLucrativos = [...productListWithSales]
    .sort((a, b) => b.unitProfit - a.unitProfit)
    .slice(0, 3);

  if (isEstoqueVazio) {
    return (
      <div className="ai-insights-dashboard">
        <div className="ai-onboarding-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div className="ai-onboarding-icon" style={{ margin: '0 auto 16px auto' }}>
            <Package size={40} />
          </div>
          <h3 className="ai-onboarding-title" style={{ fontSize: '20px' }}>Central de Inteligência Comercial (IA)</h3>
          <p className="ai-onboarding-desc" style={{ maxWidth: '600px', margin: '0 auto 12px auto' }}>
            No momento o seu estoque está sem nenhum material cadastrado. Para gerarmos análises de margens de lucro, classificação de prioridades de reposição e diagnósticos de mercado, cadastre seus primeiros produtos na aba de <strong>Administração</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-insights-dashboard">

      {/* Banner Hero de Inteligência Comercial */}
      <div className="ai-hero-banner">
        <div className="ai-hero-left">
          <div className="ai-hero-icon">
            <Sparkles size={28} />
          </div>
          <div>
            <h2 className="ai-hero-title">Painel de Diagnóstico & Inteligência Comercial</h2>
            <p className="ai-hero-subtitle">
              Análise em tempo real de margens de lucro, giro de estoque e recomendações para o depósito Novo Lar
            </p>
          </div>
        </div>

        <div className="ai-hero-chips">
          <div className="ai-chip active">
            <CheckCircle size={14} /> Inteligência Ativa
          </div>
          <div className="ai-chip">
            <Package size={14} /> {products.length} Materiais Analisados
          </div>
          <div className="ai-chip">
            <DollarSign size={14} /> {salesCount} Vendas Registradas
          </div>
        </div>
      </div>

      {/* Grid de 6 KPIs de Diagnóstico Financeiro e Margens */}
      <div className="ai-kpi-grid">
        
        {/* Card 1: Margem Comercial Média */}
        <div className="ai-kpi-card">
          <div className="ai-kpi-top">
            <span className="ai-kpi-label">Margem Comercial</span>
            <span className={`ai-kpi-badge ${averageMargin >= 30 ? 'badge-success' : averageMargin >= 15 ? 'badge-warning' : 'badge-danger'}`} style={{ backgroundColor: averageMargin >= 30 ? 'rgba(16, 185, 129, 0.15)' : averageMargin >= 15 ? 'rgba(243, 180, 29, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: averageMargin >= 30 ? 'var(--success)' : averageMargin >= 15 ? 'var(--warning)' : 'var(--danger)' }}>
              {averageMargin >= 30 ? '🟢 Excelente' : averageMargin >= 15 ? '🟡 Regular' : '🔴 Baixa'}
            </span>
          </div>
          <div>
            <div className="ai-kpi-value" style={{ color: averageMargin >= 30 ? 'var(--success)' : averageMargin >= 15 ? 'var(--warning)' : 'var(--danger)' }}>
              {averageMargin.toFixed(1)}%
            </div>
            <p className="ai-kpi-desc">
              Média de lucro líquido percentual apurado sobre as mercadorias vendidas.
            </p>
          </div>
        </div>

        {/* Card 2: Ticket Médio */}
        <div className="ai-kpi-card">
          <div className="ai-kpi-top">
            <span className="ai-kpi-label">Ticket Médio</span>
            <span className="ai-kpi-badge" style={{ backgroundColor: 'rgba(18, 121, 138, 0.1)', color: 'var(--primary)' }}>
              {salesCount} vendas
            </span>
          </div>
          <div>
            <div className="ai-kpi-value" style={{ color: 'var(--primary)' }}>
              R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="ai-kpi-desc">
              Valor médio desembolsado por cliente em cada pedido concluído.
            </p>
          </div>
        </div>

        {/* Card 3: Capital em Estoque */}
        <div className="ai-kpi-card">
          <div className="ai-kpi-top">
            <span className="ai-kpi-label">Capital no Depósito</span>
            <span className="ai-kpi-badge" style={{ backgroundColor: 'rgba(100, 116, 139, 0.1)', color: 'var(--text-secondary)' }}>
              Preço de Custo
            </span>
          </div>
          <div>
            <div className="ai-kpi-value" style={{ color: 'var(--text-primary)' }}>
              R$ {totalStockCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="ai-kpi-desc">
              Total investido em mercadorias estocadas (Parados: R$ {deadStockCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).
            </p>
          </div>
        </div>

        {/* Card 4: Investimento de Reposição */}
        <div className="ai-kpi-card">
          <div className="ai-kpi-top">
            <span className="ai-kpi-label">Reposição Necessária</span>
            <span className={`ai-kpi-badge ${emAlertaEstoque.length > 0 ? 'badge-warning' : 'badge-success'}`} style={{ backgroundColor: emAlertaEstoque.length > 0 ? 'rgba(243, 180, 29, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: emAlertaEstoque.length > 0 ? 'var(--warning)' : 'var(--success)' }}>
              {emAlertaEstoque.length} em falta
            </span>
          </div>
          <div>
            <div className="ai-kpi-value" style={{ color: replacementCost > 0 ? 'var(--brand-yellow)' : 'var(--success)' }}>
              R$ {replacementCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="ai-kpi-desc">
              Valor para recompor materiais que atingiram ou caíram do estoque mínimo.
            </p>
          </div>
        </div>

        {/* Card 5: Faturamento Potencial */}
        <div className="ai-kpi-card">
          <div className="ai-kpi-top">
            <span className="ai-kpi-label">Faturamento Potencial</span>
            <span className="ai-kpi-badge" style={{ backgroundColor: 'rgba(18, 121, 138, 0.1)', color: 'var(--primary)' }}>
              Preço Balcão
            </span>
          </div>
          <div>
            <div className="ai-kpi-value" style={{ color: 'var(--primary)' }}>
              R$ {potentialRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="ai-kpi-desc">
              Previsão de entrada bruta caso todo o estoque atual seja vendido.
            </p>
          </div>
        </div>

        {/* Card 6: Resultado Líquido Operacional */}
        <div className="ai-kpi-card">
          <div className="ai-kpi-top">
            <span className="ai-kpi-label">Resultado Líquido</span>
            <span className={`ai-kpi-badge ${netProfit >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ backgroundColor: netProfit >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {netProfit >= 0 ? 'Positivo' : 'Negativo'}
            </span>
          </div>
          <div>
            <div className="ai-kpi-value" style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              R$ {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="ai-kpi-desc">
              Lucro bruto deduzindo as despesas comerciais registradas no período.
            </p>
          </div>
        </div>

      </div>

      {/* Seção 2: Departamentos da Obra & Giro de Vendas (Grid de 2 Colunas) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        
        {/* Setores da Obra & Saúde do Estoque */}
        <div className="category-stock-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ padding: '8px', backgroundColor: 'rgba(18, 121, 138, 0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--primary)' }}>
                <Layers size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Setores da Obra & Saúde do Estoque</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Acompanhamento e alertas por departamento do depósito</span>
              </div>
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
        </div>

        {/* Giro Comercial: Líderes de Saída vs Parados */}
        <div className="category-stock-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--success)' }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Giro Comercial & Velocidade de Venda</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Produtos com maior saída versus mercadorias retidas</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            
            {/* Mais Vendidos */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <TrendingUp size={16} style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>Líderes de Saída</span>
              </div>
              {maisVendidos.length === 0 ? (
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'center', padding: '14px 0' }}>Aguardando vendas no PDV.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {maisVendidos.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ fontWeight: '600', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {idx + 1}. {p.name}
                      </span>
                      <strong style={{ color: 'var(--primary)' }}>{p.qtySold} un.</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Parados / Menos Vendidos */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <AlertTriangle size={16} style={{ color: 'var(--brand-yellow)' }} />
                <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>Parados no Depósito</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {menosVendidos.slice(0, 5).map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ fontWeight: '600', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: p.qtySold === 0 ? 'var(--text-muted)' : 'inherit' }}>
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
        </div>

      </div>

      {/* Seção 3: Plano de Compras Sugerido por Lucro e Giro */}
      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(243, 180, 29, 0.15)', borderRadius: 'var(--radius-sm)', color: 'var(--brand-yellow)' }}>
              <Package size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                Plano de Compras & Reposição Inteligente
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Priorização de reposição calculada com base na margem de lucro unitária multiplicada pelo giro de vendas
              </span>
            </div>
          </div>
          <span style={{ fontSize: '12px', fontWeight: '700', color: emAlertaEstoque.length > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {emAlertaEstoque.length} itens abaixo do estoque mínimo
          </span>
        </div>

        {recomendacoesReposicao.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
            <CheckCircle size={32} style={{ color: 'var(--success)', marginBottom: '8px', display: 'block', margin: '0 auto 8px auto' }} />
            <strong>Excelente abastecimento!</strong> Todos os materiais básicos e acabamentos estão com estoque acima do nível de segurança.
          </div>
        ) : (
          <div className="table-responsive" style={{ maxHeight: '280px', overflowY: 'auto' }}>
            <table className="custom-table" style={{ fontSize: '12.5px' }}>
              <thead>
                <tr>
                  <th>Material / Categoria</th>
                  <th style={{ textAlign: 'center' }}>Estoque Atual / Mínimo</th>
                  <th style={{ textAlign: 'right' }}>Preço Custo / Venda</th>
                  <th style={{ textAlign: 'right' }}>Lucro Unitário</th>
                  <th style={{ textAlign: 'center' }}>Giro Vendas</th>
                  <th style={{ textAlign: 'center' }}>Prioridade de Compra</th>
                </tr>
              </thead>
              <tbody>
                {recomendacoesReposicao.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: '600' }}>
                      <span style={{ fontSize: '9.5px', display: 'block', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>
                        {item.category}
                      </span>
                      {item.name}
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: '700' }}>
                      {item.stock} / {item.minStock} {item.unit || 'un'}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                      R$ {item.costPrice.toFixed(2)} / R$ {item.salePrice.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: '800' }}>
                      + R$ {item.unitProfit.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: '700' }}>{item.qtySold} un.</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`priority-badge ${item.priorityClass}`}>
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

      {/* Seção 4: Recomendações e Estratégias Comerciais Automáticas da IA */}
      <div className="ai-strategy-grid">
        
        {/* Card 1: Top Produtos Lucrativos */}
        <div className="ai-strategy-card">
          <div className="ai-strategy-header">
            <div className="ai-strategy-icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
              🏆
            </div>
            <div>
              <h4 className="ai-strategy-title">Líderes de Margem & Lucratividade</h4>
              <p className="ai-strategy-subtitle">Produtos com maior ganho financeiro por unidade</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topLucrativos.map((p, idx) => {
              const margin = p.salePrice > 0 ? ((p.unitProfit / p.salePrice) * 100).toFixed(0) : 0;
              return (
                <div key={idx} style={{ padding: '10px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{idx + 1}. {p.name}</strong>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--success)' }}>+ R$ {p.unitProfit.toFixed(2)}/un</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    Venda: R$ {p.salePrice.toFixed(2)} | Margem: <strong>{margin}%</strong> | {p.qtySold} unidades vendidas
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', lineHeight: '1.4' }}>
            💡 <strong>Dica de Venda:</strong> Itens elétricos, ferragens e torneiras costumam oferecer margens superiores a materiais brutos. Treine a equipe para ofertá-los como complementares no caixa.
          </div>
        </div>

        {/* Card 2: Liquidação de Estoque Parado */}
        <div className="ai-strategy-card">
          <div className="ai-strategy-header">
            <div className="ai-strategy-icon-box" style={{ backgroundColor: 'rgba(243, 180, 29, 0.15)', color: 'var(--warning)' }}>
              💤
            </div>
            <div>
              <h4 className="ai-strategy-title">Alerta de Estoque Parado & Combos</h4>
              <p className="ai-strategy-subtitle">Estratégias para liberar capital retido em depósito</p>
            </div>
          </div>
          {deadStockProducts.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              Nenhum produto cadastrado com estoque encalhado no momento.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {deadStockProducts.slice(0, 3).map((p, idx) => (
                <div key={idx} style={{ padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ fontWeight: '600' }}>{p.name}</span>
                  <span style={{ color: 'var(--brand-yellow)', fontWeight: '700' }}>{p.stock} un. (R$ {(p.stock * p.costPrice).toFixed(2)})</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', lineHeight: '1.4' }}>
            📣 <strong>Sugestão de Combo:</strong> Crie promoções combinadas de balcão (Ex: Ao levar uma lata de Tinta Acrílica, ofereça 15% de desconto no rolo de pintura ou fita crepe parados).
          </div>
        </div>

        {/* Card 3: Ideias de Mercado e Fluxo de Caixa */}
        <div className="ai-strategy-card">
          <div className="ai-strategy-header">
            <div className="ai-strategy-icon-box" style={{ backgroundColor: 'rgba(18, 121, 138, 0.15)', color: 'var(--primary)' }}>
              💡
            </div>
            <div>
              <h4 className="ai-strategy-title">Práticas Recomendadas para o Depósito</h4>
              <p className="ai-strategy-subtitle">Ações comerciais práticas para acelerar o caixa</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
            <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <strong>1. Incentivo ao PIX:</strong> Como cimento e ferragens têm margens reduzidas, incentive o pagamento via Pix no balcão para economizar em taxas de cartão.
            </div>
            <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <strong>2. Venda Casada de Obra:</strong> Clientes que compram Cimento geralmente necessitam de Argamassa ACIII e colher de pedreiro. Incentive o caixa a sempre perguntar.
            </div>
            <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <strong>3. Cotações Rápidas:</strong> Use a aba de <em>Orçamentos</em> para responder orçamentos de obras via WhatsApp em menos de 1 minuto.
            </div>
          </div>
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
function VaultView({ vaultTransactions, onSaveVaultTransaction, onDeleteVaultTransaction, storeId }) {
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalDesc, setWithdrawalDesc] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'deposit' | 'withdrawal'
  const [historySearch, setHistorySearch] = useState('');

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

  const formatCurrency = (val) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Filtragem da tabela de histórico
  const displayedHistory = filteredTransactions.filter(vt => {
    const matchesFilter = historyFilter === 'all' || vt.type === historyFilter;
    const matchesSearch = !historySearch || (vt.description && vt.description.toLowerCase().includes(historySearch.toLowerCase())) || String(vt.amount).includes(historySearch);
    return matchesFilter && matchesSearch;
  });

  const handleWithdrawConfirm = (e) => {
    e.preventDefault();
    const amt = parseFloat(String(withdrawalAmount).replace(',', '.')) || 0;
    if (amt <= 0) {
      alert("Por favor, digite um valor válido maior que zero.");
      return;
    }
    if (amt > balance) {
      alert(`Você não pode retirar mais do que o saldo atual do cofre (R$ ${balance.toFixed(2)}).`);
      return;
    }

    onSaveVaultTransaction({
      type: 'withdrawal',
      amount: amt,
      description: withdrawalDesc.trim() || 'Retirada manual do cofre',
      date: new Date().toISOString().split('T')[0],
      storeId
    });

    setWithdrawalAmount('');
    setWithdrawalDesc('');
    setShowWithdrawModal(false);
  };

  const parsedWithdrawal = parseFloat(String(withdrawalAmount).replace(',', '.')) || 0;
  const remainingAfterWithdraw = balance - parsedWithdrawal;

  return (
    <div className="vault-container">
      
      {/* Hero Card do Cofre Seguro */}
      <div className="vault-hero-card">
        <div className="vault-hero-info">
          <div className="vault-lock-icon">
            <Lock size={30} />
          </div>
          <div>
            <div className="vault-balance-label">
              <ShieldCheck size={16} style={{ color: 'var(--brand-yellow)' }} />
              Saldo em Cofre Seguro • {storeId === 'loja-1' ? 'Loja 1 (Matriz)' : 'Loja 2 (Filial)'}
            </div>
            <div className="vault-balance-value">
              R$ {formatCurrency(balance)}
            </div>
          </div>
        </div>

        <div className="vault-actions-group">
          <button
            type="button"
            onClick={() => setShowWithdrawModal(true)}
            className="btn-vault-withdraw"
          >
            <TrendingDown size={18} /> Registrar Retirada do Cofre
          </button>
        </div>
      </div>

      {/* Grid de 4 Cards de Resumo Financeiro */}
      <div className="dashboard-summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        
        <div className="kpi-card profit">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
            <Lock size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Saldo Disponível</span>
            <span className="kpi-value" style={{ color: 'var(--success)' }}>
              R$ {formatCurrency(balance)}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fundo reserva físico</span>
          </div>
        </div>

        <div className="kpi-card sales">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(18, 121, 138, 0.15)', color: 'var(--primary)' }}>
            <TrendingUp size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Total Entradas (Sangrias)</span>
            <span className="kpi-value" style={{ color: 'var(--primary)' }}>
              R$ {formatCurrency(totalDeposits)}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{filteredTransactions.filter(vt => vt.type === 'deposit').length} depósitos</span>
          </div>
        </div>

        <div className="kpi-card expenses">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)' }}>
            <TrendingDown size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Total Saídas (Retiradas)</span>
            <span className="kpi-value" style={{ color: 'var(--danger)' }}>
              R$ {formatCurrency(totalWithdrawals)}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{filteredTransactions.filter(vt => vt.type === 'withdrawal').length} retiradas</span>
          </div>
        </div>

        <div className="kpi-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: 'var(--shadow-sm)' }}>
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(243, 180, 29, 0.15)', color: 'var(--brand-yellow)' }}>
            <Coins size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Média Diária Guardada</span>
            <span className="kpi-value" style={{ color: 'var(--brand-yellow)', fontSize: '20px' }}>
              R$ {formatCurrency(avgDailyDeposit)}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{daysWithDeposits} dias com sangrias</span>
          </div>
        </div>

      </div>

      {/* Simulador de Acúmulo Automático do Cofre */}
      <div className="section-card">
        <div className="card-header" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(18, 121, 138, 0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--primary)' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="card-title" style={{ margin: 0 }}>
                Simulador de Acúmulo Automático do Cofre
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Estimativa de crescimento financeiro com base no saldo atual de <strong>R$ {formatCurrency(balance)}</strong> e depósitos periódicos
              </span>
            </div>
          </div>
        </div>

        <div className="table-container" style={{ overflowX: 'auto', marginBottom: '14px' }}>
          <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '12px 14px' }}>Cenário de Sangria / Depósito</th>
                <th style={{ padding: '12px 14px' }}>Em 7 dias (1 sem.)</th>
                <th style={{ padding: '12px 14px' }}>Em 30 dias (1 mês)</th>
                <th style={{ padding: '12px 14px' }}>Em 90 dias (1 trim.)</th>
                <th style={{ padding: '12px 14px' }}>Em 365 dias (1 ano)</th>
              </tr>
            </thead>
            <tbody>
              {/* Linha com a Média Real */}
              <tr style={{ backgroundColor: 'rgba(18, 121, 138, 0.08)', borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 14px' }}>
                  <strong style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={14} /> Sua Média Real (R$ {formatCurrency(avgDailyDeposit)}/dia)
                  </strong>
                </td>
                <td style={{ padding: '12px 14px', color: 'var(--success)', fontWeight: '800' }}>R$ {formatCurrency(balance + (avgDailyDeposit * 7))}</td>
                <td style={{ padding: '12px 14px', color: 'var(--success)', fontWeight: '800' }}>R$ {formatCurrency(balance + (avgDailyDeposit * 30))}</td>
                <td style={{ padding: '12px 14px', color: 'var(--success)', fontWeight: '800' }}>R$ {formatCurrency(balance + (avgDailyDeposit * 90))}</td>
                <td style={{ padding: '12px 14px', color: 'var(--success)', fontWeight: '800' }}>R$ {formatCurrency(balance + (avgDailyDeposit * 365))}</td>
              </tr>
              {/* R$ 50/dia */}
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 14px', fontWeight: '600' }}>Guardando R$ 50,00/dia</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>R$ {formatCurrency(balance + (50 * 7))}</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>R$ {formatCurrency(balance + (50 * 30))}</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>R$ {formatCurrency(balance + (50 * 90))}</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>R$ {formatCurrency(balance + (50 * 365))}</td>
              </tr>
              {/* R$ 100/dia */}
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 14px', fontWeight: '600' }}>Guardando R$ 100,00/dia</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>R$ {formatCurrency(balance + (100 * 7))}</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>R$ {formatCurrency(balance + (100 * 30))}</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>R$ {formatCurrency(balance + (100 * 90))}</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>R$ {formatCurrency(balance + (100 * 365))}</td>
              </tr>
              {/* R$ 200/dia */}
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 14px', fontWeight: '600' }}>Guardando R$ 200,00/dia</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>R$ {formatCurrency(balance + (200 * 7))}</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>R$ {formatCurrency(balance + (200 * 30))}</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>R$ {formatCurrency(balance + (200 * 90))}</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>R$ {formatCurrency(balance + (200 * 365))}</td>
              </tr>
              {/* R$ 500/dia */}
              <tr>
                <td style={{ padding: '12px 14px', fontWeight: '600' }}>Guardando R$ 500,00/dia</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>R$ {formatCurrency(balance + (500 * 7))}</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>R$ {formatCurrency(balance + (500 * 30))}</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>R$ {formatCurrency(balance + (500 * 90))}</td>
                <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>R$ {formatCurrency(balance + (500 * 365))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span>
            <strong>Dica Estratégica:</strong> Transferir pequenas sangrias do fechamento de caixa diariamente para o cofre seguro protege seu fluxo de caixa contra imprevistos e possibilita compras de materiais à vista com descontos de fornecedores.
          </span>
        </div>
      </div>

      {/* Gráfico de Evolução do Saldo do Cofre */}
      <div className="section-card">
        <div className="card-header" style={{ marginBottom: '14px' }}>
          <h3 className="card-title">
            <TrendingUp size={20} className="text-primary" /> Evolução do Saldo do Cofre (Últimos 10 Lançamentos)
          </h3>
        </div>
        {chartData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '14px', fontStyle: 'italic' }}>
            Nenhum dado histórico suficiente para gerar gráfico de evolução do cofre.
          </div>
        ) : (
          <div>
            <div className="chart-container" style={{ height: '190px' }}>
              {chartData.map((d, index) => {
                const percentage = Math.min(100, Math.max(8, (d.amount / maxAmount) * 100));
                return (
                  <div key={index} className="chart-bar-wrapper">
                    <div
                      className="chart-bar-fill"
                      style={{
                        height: `${percentage}%`,
                        background: 'linear-gradient(180deg, var(--success) 0%, #059669 100%)',
                        borderRadius: '4px 4px 0 0'
                      }}
                    >
                      <div className="chart-tooltip">R$ {formatCurrency(d.amount)}</div>
                    </div>
                    <span className="chart-label" style={{ fontSize: '11px', fontWeight: '600' }}>{d.label}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '10px', textAlign: 'right' }}>
              *Gráfico atualizado dinamicamente com base no histórico consolidado de depósitos e retiradas.
            </div>
          </div>
        )}
      </div>

      {/* Histórico Completo de Transferências com Filtros */}
      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <h3 className="card-title" style={{ margin: 0 }}>
              <History size={20} className="text-primary" /> Histórico de Transferências do Cofre
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Registro cronológico de todas as sangrias recebidas e retiradas autorizadas
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="input-group" style={{ maxWidth: '220px' }}>
              <Search className="input-icon" size={16} />
              <input
                type="text"
                placeholder="Buscar lançamento..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                style={{ padding: '7px 10px 7px 32px', fontSize: '12.5px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-secondary)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
              {[
                { id: 'all', label: `Todas (${filteredTransactions.length})` },
                { id: 'deposit', label: 'Entradas' },
                { id: 'withdrawal', label: 'Retiradas' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setHistoryFilter(f.id)}
                  style={{
                    padding: '5px 10px',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: historyFilter === f.id ? 'var(--primary)' : 'transparent',
                    color: historyFilter === f.id ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {displayedHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13.5px' }}>
            Nenhuma movimentação de cofre encontrada para estes filtros.
          </div>
        ) : (
          <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <table className="custom-table" style={{ fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 14px' }}>Data e Hora</th>
                  <th style={{ padding: '12px 14px' }}>Operação</th>
                  <th style={{ padding: '12px 14px' }}>Descrição / Origem</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Valor (R$)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {displayedHistory.map((vt) => (
                  <tr key={vt.id}>
                    <td style={{ whiteSpace: 'nowrap', padding: '12px 14px' }}>
                      {new Date(vt.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', padding: '12px 14px' }}>
                      {vt.type === 'deposit' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
                          <ArrowDownRight size={13} /> Depósito (Sangria)
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)' }}>
                          <ArrowUpRight size={13} /> Retirada (Saída)
                        </span>
                      )}
                    </td>
                    <td style={{ maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '12px 14px' }} title={vt.description}>
                      {vt.description}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '800', padding: '12px 14px', color: vt.type === 'deposit' ? 'var(--success)' : 'var(--danger)' }}>
                      {vt.type === 'deposit' ? '+' : '-'} R$ {formatCurrency(vt.amount)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                      <button
                        onClick={() => {
                          if (confirm(`Deseja excluir permanentemente este lançamento de R$ ${formatCurrency(vt.amount)} do cofre?`)) {
                            onDeleteVaultTransaction(vt.id);
                          }
                        }}
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

      {/* Modal de Retirada do Cofre */}
      {showWithdrawModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="modal-content glass-card" style={{ width: '100%', maxWidth: '480px', padding: '24px', borderRadius: 'var(--radius-lg)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ padding: '8px', backgroundColor: 'rgba(216, 45, 51, 0.15)', borderRadius: 'var(--radius-sm)', color: 'var(--brand-red)' }}>
                  <TrendingDown size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                    Registrar Retirada do Cofre
                  </h2>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    Saída física de valores do fundo reserva
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setShowWithdrawModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleWithdrawConfirm}>
              
              {/* Saldo Atual & Restante */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Saldo Atual:</span>
                  <strong style={{ fontSize: '16px', color: 'var(--success)' }}>R$ {formatCurrency(balance)}</strong>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Saldo Restante:</span>
                  <strong style={{ fontSize: '16px', color: remainingAfterWithdraw < 0 ? 'var(--danger)' : 'var(--primary)' }}>
                    R$ {formatCurrency(Math.max(0, remainingAfterWithdraw))}
                  </strong>
                </div>
              </div>

              {/* Botões Rápidos de Valor */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Valores Rápidos:</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[50, 100, 200, 500].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setWithdrawalAmount(String(val))}
                      className="vault-preset-btn"
                    >
                      R$ {val}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setWithdrawalAmount(String(balance))}
                    className="vault-preset-btn"
                    style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
                  >
                    Saldo Total
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700' }}>Valor da Retirada (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={balance}
                  required
                  placeholder="0.00"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  style={{ width: '100%', fontSize: '15px', fontWeight: '700', padding: '10px 12px' }}
                />
                {parsedWithdrawal > balance && (
                  <span style={{ fontSize: '11.5px', color: 'var(--danger)', marginTop: '4px', display: 'block', fontWeight: '600' }}>
                    ⚠️ Valor maior que o saldo disponível no cofre!
                  </span>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700' }}>Motivo / Descrição</label>
                <textarea
                  rows="2"
                  placeholder="Ex: Pagamento de fornecedor, depósito bancário em conta ou despesa urgente"
                  value={withdrawalDesc}
                  onChange={(e) => setWithdrawalDesc(e.target.value)}
                  style={{ width: '100%', resize: 'vertical', padding: '8px 12px', fontSize: '12.5px' }}
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="btn-secondary"
                  style={{ padding: '10px 16px', fontWeight: '600' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={parsedWithdrawal <= 0 || parsedWithdrawal > balance}
                  className="btn-primary"
                  style={{
                    padding: '10px 22px',
                    fontWeight: '800',
                    backgroundColor: 'var(--brand-red)',
                    opacity: (parsedWithdrawal <= 0 || parsedWithdrawal > balance) ? 0.5 : 1,
                    cursor: (parsedWithdrawal <= 0 || parsedWithdrawal > balance) ? 'not-allowed' : 'pointer'
                  }}
                >
                  Confirmar Retirada
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

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
  const totalCreditCardSales = daySales.filter(s => s.paymentMethod && s.paymentMethod.includes('Crédito')).reduce((acc, s) => acc + s.totalPrice, 0);
  const totalDebitCardSales = daySales.filter(s => s.paymentMethod && s.paymentMethod.includes('Débito')).reduce((acc, s) => acc + s.totalPrice, 0);
  const totalCardSales = daySales.filter(s => s.paymentMethod && (s.paymentMethod.includes('Cartão') || s.paymentMethod.includes('Crédito') || s.paymentMethod.includes('Débito'))).reduce((acc, s) => acc + s.totalPrice, 0);

  const totalExpenses = dayExpenses.reduce((acc, e) => acc + e.amount, 0);
  const totalCashExpenses = dayExpenses.filter(e => e.source === 'Caixa Físico' || !e.source).reduce((acc, e) => acc + e.amount, 0);

  const totalVaultDeposits = dayVaultTransactions.filter(vt => vt.type === 'deposit').reduce((acc, vt) => acc + vt.amount, 0);
  const totalVaultWithdrawals = dayVaultTransactions.filter(vt => vt.type === 'withdrawal').reduce((acc, vt) => acc + vt.amount, 0);

  // Dinheiro esperado na gaveta
  const expectedCashBeforeSangria = totalCashSales - totalCashExpenses - totalVaultDeposits + totalVaultWithdrawals;

  const cashVal = parseFloat(String(actualCash).replace(',', '.')) || 0;
  const sangriaVal = parseFloat(String(sangria).replace(',', '.')) || 0;
  const expectedCash = expectedCashBeforeSangria - sangriaVal;
  const currentDiff = cashVal - expectedCash;

  const handleSave = () => {
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

  const handlePrintClosureStatement = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=850');
    const storeLabel = storeId === 'loja-1' ? 'Loja 1 (Matriz)' : 'Loja 2 (Filial)';
    const dateFormatted = dateStr.split('-').reverse().join('/');
    const logoUrl = `${window.location.origin}/logo.png`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Comprovante de Fechamento de Caixa - Novo Lar</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; margin: 24px; line-height: 1.4; }
            .header { border-bottom: 2px solid #12798a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
            .title { font-size: 18px; font-weight: bold; color: #12798a; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
            .box { border: 1px solid #ddd; padding: 10px; border-radius: 6px; background: #fafafa; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 12px; }
            th { background: #f1f5f9; text-align: left; }
            .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 40px; text-align: center; font-size: 11px; }
            .line { border-top: 1px solid #333; padding-top: 4px; margin-top: 30px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${logoUrl}" alt="Logo Novo Lar" style="max-height: 52px; width: auto; object-fit: contain;" onerror="this.style.display='none';" />
              <div>
                <div class="title">NOVO LAR - CASA & CONSTRUÇÃO</div>
                <div style="font-size: 11.5px; color: #555;">CNPJ: 62.002.153/0001-25 • Tel: (11) 4656-8183</div>
                <div style="font-size: 10.5px; color: #777;">Rua das Rosas, 1077 - Jardim Novo Eden - Santa Isabel / SP</div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 14px; font-weight: bold;">FECHAMENTO DE CAIXA</div>
              <div style="font-size: 12px; color: #444;">Data: <strong>${dateFormatted}</strong> | <strong>${storeLabel}</strong></div>
            </div>
          </div>

          <div class="grid">
            <div class="box">
              <div style="font-size: 11px; color: #666; text-transform: uppercase;">Total Vendas do Dia</div>
              <div style="font-size: 18px; font-weight: bold; color: #12798a;">R$ ${totalSales.toFixed(2)}</div>
            </div>
            <div class="box">
              <div style="font-size: 11px; color: #666; text-transform: uppercase;">Dinheiro Contado em Gaveta</div>
              <div style="font-size: 18px; font-weight: bold; color: #16a34a;">R$ ${cashVal.toFixed(2)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr><th>Resumo por Meio de Pagamento</th><th style="text-align: right;">Valor</th></tr>
            </thead>
            <tbody>
              <tr><td>💵 Dinheiro em Espécie</td><td style="text-align: right; font-weight: bold;">R$ ${totalCashSales.toFixed(2)}</td></tr>
              <tr><td>📱 PIX</td><td style="text-align: right; font-weight: bold;">R$ ${totalPixSales.toFixed(2)}</td></tr>
              <tr><td>💳 Cartões de Crédito / Débito</td><td style="text-align: right; font-weight: bold;">R$ ${totalCardSales.toFixed(2)}</td></tr>
              <tr><td>🔻 Despesas Pagas pelo Caixa</td><td style="text-align: right; color: #dc2626; font-weight: bold;">- R$ ${totalCashExpenses.toFixed(2)}</td></tr>
              <tr><td>🔒 Sangria Destinada ao Cofre</td><td style="text-align: right; color: #2563eb; font-weight: bold;">R$ ${sangriaVal.toFixed(2)}</td></tr>
              <tr style="background: #f8fafc; font-weight: bold;">
                <td>Diferença / Apuração de Caixa</td>
                <td style="text-align: right; color: ${currentDiff === 0 ? '#16a34a' : currentDiff < 0 ? '#dc2626' : '#2563eb'};">
                  ${currentDiff >= 0 ? '+' : ''} R$ ${currentDiff.toFixed(2)} (${currentDiff === 0 ? 'Exato' : currentDiff < 0 ? 'Quebra' : 'Sobra'})
                </td>
              </tr>
            </tbody>
          </table>

          ${observations ? `<div style="font-size: 11px; border: 1px solid #ddd; padding: 8px; border-radius: 4px; margin-bottom: 16px;"><strong>Observações:</strong> ${observations}</div>` : ''}

          <div class="sign">
            <div><div class="line">Operador de Caixa</div></div>
            <div><div class="line">Gerente Responsável</div></div>
          </div>

          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, backdropFilter: 'blur(5px)' }}>
      <div className="modal-content glass-card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid var(--border-color)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(18, 121, 138, 0.15)', borderRadius: 'var(--radius-sm)', color: 'var(--primary)' }}>
              <CheckCircle size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                Fechamento de Caixa Diário
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Conferência de gaveta, sangrias e apuração financeira
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
        </div>

        {/* Card Resumo do Dia */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '18px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
              Data: {dateStr.split('-').reverse().join('/')}
            </span>
            <span style={{ fontSize: '11px', backgroundColor: 'var(--primary)', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontWeight: '700' }}>
              {storeId === 'loja-1' ? 'Loja 1 (Matriz)' : 'Loja 2 (Filial)'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Vendas Totais do Dia</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--primary)', marginTop: '2px' }}>R$ {totalSales.toFixed(2)}</div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Entradas em Dinheiro</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--success)', marginTop: '2px' }}>+ R$ {totalCashSales.toFixed(2)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px', color: 'var(--text-secondary)', padding: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>• Vendas em PIX:</span>
              <strong style={{ color: 'var(--text-primary)' }}>R$ {totalPixSales.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>• Vendas em Cartões (Crédito/Débito):</span>
              <strong style={{ color: 'var(--text-primary)' }}>R$ {totalCardSales.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>• Despesas Pagas pelo Caixa:</span>
              <strong style={{ color: 'var(--danger)' }}>- R$ {totalCashExpenses.toFixed(2)}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontWeight: '800', fontSize: '13.5px', color: 'var(--text-primary)' }}>Dinheiro Esperado em Gaveta:</span>
            <span style={{ fontWeight: '900', fontSize: '19px', color: 'var(--brand-yellow)' }}>R$ {expectedCash.toFixed(2)}</span>
          </div>
        </div>

        {/* Campo Único e Direto de Contagem de Gaveta */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700' }}>
            Valor Total em Dinheiro Físico Contado na Gaveta (R$) *
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '14px', fontWeight: '800', color: 'var(--text-muted)' }}>R$</span>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={actualCash}
              onChange={(e) => setActualCash(e.target.value)}
              style={{ width: '100%', paddingLeft: '44px', fontWeight: '800', fontSize: '16px' }}
              autoFocus
            />
          </div>
        </div>

        {/* Sangria para o Cofre */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: '700' }}>
            Sangria de Fechamento (Transferir para o Cofre Seguro) (R$)
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '14px', fontWeight: '800', color: 'var(--text-muted)' }}>R$</span>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={sangria}
              onChange={(e) => setSangria(e.target.value)}
              style={{ width: '100%', paddingLeft: '44px', fontSize: '14px' }}
            />
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
            Máximo disponível para sangria: <strong>R$ {Math.max(0, expectedCashBeforeSangria).toFixed(2)}</strong>
          </span>
        </div>

        {/* Status da Diferença / Quebra */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: '700' }}>
            Conferência / Apuração de Caixa
          </label>
          <div style={{ 
            padding: '12px 16px', 
            borderRadius: 'var(--radius-md)', 
            backgroundColor: currentDiff === 0 ? 'rgba(34, 197, 94, 0.12)' : (currentDiff < 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(18, 121, 138, 0.12)'),
            border: `1px solid ${currentDiff === 0 ? 'rgba(34, 197, 94, 0.35)' : (currentDiff < 0 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(18, 121, 138, 0.35)')}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted)' }}>Resultado</div>
              <div style={{ fontWeight: '800', fontSize: '13.5px', color: currentDiff === 0 ? 'var(--success)' : (currentDiff < 0 ? 'var(--danger)' : 'var(--primary)') }}>
                {currentDiff === 0 ? 'Caixa Bateu Exato (Sem Diferença)' : (currentDiff < 0 ? 'Falta de Caixa (Quebra)' : 'Sobra de Caixa')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted)' }}>Diferença</div>
              <div style={{ fontWeight: '900', fontSize: '16px', color: currentDiff === 0 ? 'var(--success)' : (currentDiff < 0 ? 'var(--danger)' : 'var(--primary)') }}>
                {currentDiff >= 0 ? '+' : ''} R$ {currentDiff.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Observações */}
        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '12.5px', fontWeight: '700' }}>Observações do Operador (Opcional)</label>
          <textarea
            rows="2"
            placeholder="Ex: Tudo conferido e comprovantes anexados..."
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            style={{ width: '100%', resize: 'vertical', fontSize: '12.5px' }}
          ></textarea>
        </div>

        {/* Botões de Ação */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handlePrintClosureStatement}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', fontSize: '12.5px', fontWeight: '700' }}
          >
            <Printer size={15} /> Imprimir Comprovante
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ padding: '10px 16px', fontWeight: '600' }}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn-primary"
              style={{ padding: '10px 22px', fontWeight: '800', backgroundColor: 'var(--brand-yellow)', color: '#000', border: 'none' }}
            >
              Confirmar Fechamento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE: CONTROLE DE BOLETOS / DESPESAS FIXAS (BILLS)
// ==========================================
function BillsView({ bills, onSaveBill, onDeleteBill, onPayBill, storeId }) {
  const [filterStatus, setFilterStatus] = useState('Pendente'); // 'Pendente' | 'Pago' | 'Todas'
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(null); // bill to pay

  // Novos campos do boleto
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Boletos');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Campo de quitação
  const [paySource, setPaySource] = useState('Banco / Pix');

  const filteredBills = bills.filter(b => b.storeId === storeId).filter(b => {
    const matchesStatus = filterStatus === 'Todas' || b.status === filterStatus;
    const matchesSearch =
      b.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.category && b.category.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const todayStr = new Date().toISOString().split('T')[0];

  const totalPending = bills
    .filter(b => b.storeId === storeId && b.status === 'Pendente')
    .reduce((sum, b) => sum + b.amount, 0);

  const totalOverdue = bills
    .filter(b => b.storeId === storeId && b.status === 'Pendente' && b.dueDate < todayStr)
    .reduce((sum, b) => sum + b.amount, 0);

  const handleSave = () => {
    if (!description.trim() || !amount) {
      alert("Por favor, preencha a descrição e o valor.");
      return;
    }
    const bill = {
      description,
      amount: parseFloat(amount) || 0,
      category,
      dueDate,
      status: 'Pendente',
      storeId
    };
    onSaveBill(bill);
    // Reset form
    setDescription('');
    setAmount('');
    setCategory('Boletos');
    setDueDate(new Date().toISOString().split('T')[0]);
    setShowAddModal(false);
  };

  const handleConfirmPayment = () => {
    if (!showPayModal) return;
    onPayBill(showPayModal, paySource);
    setShowPayModal(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Cards de Resumo */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: '1', minWidth: '220px', display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: 'var(--radius-md)' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Total Atrasado</div>
            <strong style={{ fontSize: '22px', color: 'var(--danger)', display: 'block', marginTop: '4px' }}>
              R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </strong>
          </div>
        </div>

        <div className="stat-card" style={{ flex: '1', minWidth: '220px', display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ padding: '12px', backgroundColor: 'rgba(243, 180, 29, 0.1)', color: 'var(--brand-yellow)', borderRadius: 'var(--radius-md)' }}>
            <Calendar size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Total Pendente</div>
            <strong style={{ fontSize: '22px', color: 'var(--brand-yellow)', display: 'block', marginTop: '4px' }}>
              R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </strong>
          </div>
        </div>
      </div>

      {/* Tabela de Controle */}
      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <h2 className="card-title">
            <FileText size={20} className="brand-icon" style={{ color: 'var(--primary)' }} />
            Controle de Boletos & Despesas Fixas
          </h2>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: '1', justifyContent: 'flex-end', maxWidth: '600px' }}>
            <div className="input-group" style={{ maxWidth: '240px', width: '100%' }}>
              <Search className="input-icon" size={18} />
              <input
                type="text"
                className="input-field"
                style={{ padding: '8px 12px 8px 36px', fontSize: '13px' }}
                placeholder="Buscar boleto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
              {['Pendente', 'Pago', 'Todas'].map(status => (
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
                  {status === 'Todas' ? 'Todos' : (status === 'Pendente' ? 'Pendentes' : 'Pagos')}
                </button>
              ))}
            </div>

            <button className="btn-primary" style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px' }} onClick={() => setShowAddModal(true)}>
              <Plus size={16} /> Agendar Boleto
            </button>
          </div>
        </div>

        <div className="table-container">
          {filteredBills.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <FileText size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p>Nenhum boleto encontrado para este filtro.</p>
            </div>
          ) : (
            <table className="custom-table table-responsive">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map(bill => {
                  const isLate = bill.status === 'Pendente' && bill.dueDate < todayStr;
                  const formattedDate = bill.dueDate
                    ? new Date(bill.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')
                    : 'Não especificada';

                  return (
                    <tr key={bill.id}>
                      <td>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{bill.description}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '11px', fontWeight: '600', backgroundColor: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}>
                          {bill.category}
                        </span>
                      </td>
                      <td style={{ color: isLate ? 'var(--danger)' : 'var(--text-primary)', fontWeight: isLate ? '700' : '500' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {isLate && <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />}
                          {formattedDate} {isLate && <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--danger)' }}>(Atrasado)</span>}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${bill.status === 'Pago' ? 'badge-success' : 'badge-danger'}`} style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: '700',
                          backgroundColor: bill.status === 'Pago' ? 'var(--success-glow)' : 'rgba(239, 68, 68, 0.1)',
                          color: bill.status === 'Pago' ? 'var(--success)' : 'var(--danger)',
                          border: `1px solid ${bill.status === 'Pago' ? 'var(--success)' : 'var(--danger)'}`
                        }}>
                          {bill.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '800', fontSize: '14px', color: 'var(--text-primary)' }}>
                        R$ {bill.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          {bill.status === 'Pendente' && (
                            <button
                              className="btn-success"
                              style={{ padding: '6px 12px', fontSize: '11px', backgroundColor: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => setShowPayModal(bill)}
                            >
                              Dar Baixa (Pagar)
                            </button>
                          )}
                          <button
                            className="btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--danger)', borderColor: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => onDeleteBill(bill.id)}
                          >
                            Excluir
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

      {/* Modal: Agendar Boleto / Despesa Fixa */}
      {showAddModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="modal-content glass-card" style={{ width: '100%', maxWidth: '420px', padding: '24px', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', margin: 0 }}>
                <PlusCircle size={20} className="text-primary" /> Agendar Boleto / Gasto Fixo
              </h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Descrição / Boleto *</label>
                <input
                  type="text"
                  placeholder="Ex: Energia CPFL, Aluguel Galpão"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Valor (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Categoria</label>
                <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%' }}>
                  <option value="Boletos">Boletos a Pagar</option>
                  <option value="Aluguel">Aluguel & Condomínio</option>
                  <option value="Utilidades">Água, Luz e Internet</option>
                  <option value="Impostos">Impostos & Tributos</option>
                  <option value="Fornecedores">Fornecedores de Mercadoria</option>
                  <option value="Salários">Salários & Pro-labore</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Data de Vencimento *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setShowAddModal(false)} style={{ padding: '10px 16px', backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
              <button onClick={handleSave} className="btn-primary" style={{ padding: '10px 24px', fontWeight: '700' }}>Salvar Boleto</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Pagamento / Baixa de Boleto */}
      {showPayModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="modal-content glass-card" style={{ width: '100%', maxWidth: '420px', padding: '24px', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', margin: 0 }}>
                <CheckCircle size={20} className="text-primary" /> Dar Baixa (Quitar Boleto)
              </h2>
              <button onClick={() => setShowPayModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Boleto:</span>
                <span style={{ fontWeight: '700' }}>{showPayModal.description}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Vencimento:</span>
                <span style={{ fontWeight: '700' }}>{new Date(showPayModal.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '8px' }}>
                <span style={{ fontWeight: '800' }}>Valor a Pagar:</span>
                <span style={{ fontWeight: '800', color: 'var(--primary)' }}>R$ {showPayModal.amount.toFixed(2)}</span>
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Origem dos Recursos (De onde sai o dinheiro?)</label>
              <select value={paySource} onChange={e => setPaySource(e.target.value)} style={{ width: '100%' }}>
                <option value="Banco / Pix">Banco / Pix (Conta Digital)</option>
                <option value="Caixa Físico">Caixa Físico (Gaveta do Terminal)</option>
                <option value="Cofre">Cofre Seguro (Fundo Reserva)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => setShowPayModal(null)} style={{ padding: '10px 16px', backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
              <button onClick={handleConfirmPayment} className="btn-primary" style={{ padding: '10px 24px', fontWeight: '700', backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}>Confirmar Pagamento</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ==========================================
// 10. MÓDULO: ORÇAMENTOS E COTAÇÕES
// ==========================================

export const generateWhatsAppQuoteLink = (quote) => {
  const phone = (quote.customerPhone || '').replace(/\D/g, '');
  const items = quote.items || [];
  const itemsText = items.map((i, idx) => `  ${idx + 1}. *${i.quantity}x* ${i.name} - R$ ${(i.salePrice * i.quantity).toFixed(2)}`).join('\n');
  const validDate = quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('pt-BR') : '7 dias';

  const text = `*NOVO LAR - CASA & CONSTRUÇÃO*\n` +
    `_Rua das Rosas, 1077 - Tel: (11) 4656-8183_\n\n` +
    `Olá *${quote.customerName || 'Cliente'}*, tudo bem?\n` +
    `Segue o seu orçamento solicitado:\n\n` +
    `*Orçamento Nº:* #${quote.id}\n` +
    `*Validade da Proposta:* ${validDate}\n\n` +
    `*ITENS COTADOS:*\n` +
    `${itemsText}\n\n` +
    `*VALOR TOTAL:* *R$ ${(parseFloat(quote.totalPrice) || 0).toFixed(2)}*\n\n` +
    (quote.notes ? `*Observações:* ${quote.notes}\n\n` : '') +
    `_Valores sujeitos à alteração e disponibilidade de estoque no fechamento da compra._\n\n` +
    `Para aprovar ou tirar dúvidas, basta responder esta mensagem!`;

  const encoded = encodeURIComponent(text);
  if (phone.length >= 10) {
    const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
    return `https://wa.me/${fullPhone}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
};

export function QuotesView({
  quotes = [],
  onOpenCreateModal,
  onLoadQuoteIntoCart,
  onDeleteQuote,
  onUpdateQuoteStatus,
  onPrintQuote
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'Pendente' | 'Aprovado' | 'Cancelado'

  const filteredQuotes = quotes.filter(q => {
    const nameMatch = (q.customerName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const idMatch = (q.id || '').toLowerCase().includes(searchTerm.toLowerCase());
    const phoneMatch = (q.customerPhone || '').includes(searchTerm);
    const matchesSearch = nameMatch || idMatch || phoneMatch;

    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && q.status === statusFilter;
  });

  const totalQuotesCount = quotes.length;
  const pendingCount = quotes.filter(q => q.status === 'Pendente').length;
  const approvedCount = quotes.filter(q => q.status === 'Aprovado').length;
  const cancelledCount = quotes.filter(q => q.status === 'Cancelado').length;
  const totalQuotedValue = quotes.reduce((acc, q) => acc + (parseFloat(q.totalPrice) || 0), 0);
  const pendingQuotedValue = quotes.filter(q => q.status === 'Pendente').reduce((acc, q) => acc + (parseFloat(q.totalPrice) || 0), 0);
  const conversionRate = totalQuotesCount > 0 ? ((approvedCount / totalQuotesCount) * 100).toFixed(0) : 0;

  return (
    <div className="quotes-dashboard-container">
      
      {/* Top KPI Metrics Cards */}
      <div className="quotes-kpi-grid">
        
        <div className="quotes-kpi-card">
          <div className="quotes-kpi-icon" style={{ backgroundColor: 'rgba(243, 180, 29, 0.15)', color: 'var(--brand-yellow)' }}>
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <div className="quotes-kpi-title">Cotações em Aberto</div>
            <div className="quotes-kpi-val" style={{ color: 'var(--brand-yellow)' }}>{pendingCount}</div>
            <div className="quotes-kpi-sub">
              R$ {pendingQuotedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em negociação
            </div>
          </div>
        </div>

        <div className="quotes-kpi-card">
          <div className="quotes-kpi-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <div className="quotes-kpi-title">Convertidos em Venda</div>
            <div className="quotes-kpi-val" style={{ color: 'var(--success)' }}>{approvedCount}</div>
            <div className="quotes-kpi-sub">
              Taxa de conversão de <strong>{conversionRate}%</strong>
            </div>
          </div>
        </div>

        <div className="quotes-kpi-card">
          <div className="quotes-kpi-icon" style={{ backgroundColor: 'rgba(18, 121, 138, 0.15)', color: 'var(--primary)' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div className="quotes-kpi-title">Volume Total Cotado</div>
            <div className="quotes-kpi-val" style={{ color: 'var(--primary)' }}>
              R$ {totalQuotedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="quotes-kpi-sub">{totalQuotesCount} orçamentos registrados</div>
          </div>
        </div>

      </div>

      {/* Tabela de Orçamentos e Filtros */}
      <div className="section-card">
        
        {/* Header do Card com Título e Filtros */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={20} className="brand-icon" style={{ color: 'var(--primary)' }} />
              Central de Orçamentos & Cotações
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
              Cotações comerciais de clientes e obras sem reserva imediata de estoque
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: '1', justifyContent: 'flex-end', maxWidth: '650px' }}>
            <div className="input-group" style={{ maxWidth: '280px', width: '100%' }}>
              <Search className="input-icon" size={18} />
              <input
                type="text"
                className="input-field"
                style={{ padding: '8px 12px 8px 36px', fontSize: '13px' }}
                placeholder="Buscar por cliente, fone ou Nº..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              {[
                { id: 'all', label: `Todos (${totalQuotesCount})` },
                { id: 'Pendente', label: `Pendentes (${pendingCount})` },
                { id: 'Aprovado', label: `Convertidos (${approvedCount})` },
                { id: 'Cancelado', label: `Cancelados (${cancelledCount})` }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: statusFilter === f.id ? 'var(--primary)' : 'transparent',
                    color: statusFilter === f.id ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'var(--transition)'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabela de Registros */}
        {filteredQuotes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
            <FileSpreadsheet size={48} style={{ opacity: 0.25, marginBottom: '12px', color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
              Nenhum orçamento encontrado
            </h3>
            <p style={{ fontSize: '13px', maxWidth: '420px', margin: '0 auto', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {searchTerm || statusFilter !== 'all'
                ? 'Nenhuma cotação corresponde aos filtros de busca atuais.'
                : 'Utilize o botão amarelo "Criar Orçamento" no cabeçalho superior para cadastrar uma nova proposta para o cliente.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 14px', fontWeight: '700' }}>Orçamento / Data</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700' }}>Cliente & Contato</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700' }}>Validade</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700' }}>Itens Cotados</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700' }}>Total (R$)</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700' }}>Status</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map(q => {
                  const isExpired = q.validUntil && new Date(q.validUntil) < new Date() && q.status === 'Pendente';
                  const itemsCount = (q.items || []).reduce((sum, item) => sum + (parseInt(item.quantity) || 1), 0);

                  return (
                    <tr key={q.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <strong style={{ color: 'var(--primary)', display: 'block', fontSize: '13.5px' }}>#{q.id}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {q.timestamp ? new Date(q.timestamp).toLocaleDateString('pt-BR') : '-'}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{q.customerName || 'Cliente Balcão'}</div>
                        {q.customerPhone ? (
                          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>📞 {q.customerPhone}</span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sem telefone</span>
                        )}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11.5px',
                          color: isExpired ? 'var(--danger)' : 'var(--text-secondary)',
                          fontWeight: isExpired ? '700' : '500'
                        }}>
                          {q.validUntil ? new Date(q.validUntil).toLocaleDateString('pt-BR') : '7 dias'}
                          {isExpired && <span style={{ fontSize: '10px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>Vencido</span>}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '700' }}>{itemsCount} {itemsCount === 1 ? 'item' : 'itens'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(q.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ')}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <strong style={{ fontSize: '14.5px', color: 'var(--text-primary)' }}>
                          R$ {(parseFloat(q.totalPrice) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <select
                          value={q.status || 'Pendente'}
                          onChange={(e) => onUpdateQuoteStatus(q.id, e.target.value)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '11.5px',
                            fontWeight: '800',
                            border: '1px solid var(--border-color)',
                            backgroundColor: q.status === 'Aprovado' ? 'rgba(16, 185, 129, 0.15)' : q.status === 'Cancelado' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(243, 180, 29, 0.15)',
                            color: q.status === 'Aprovado' ? 'var(--success)' : q.status === 'Cancelado' ? 'var(--danger)' : 'var(--brand-yellow)',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="Pendente" style={{ background: '#1e293b', color: '#fff' }}>Pendente</option>
                          <option value="Aprovado" style={{ background: '#1e293b', color: '#fff' }}>Aprovado</option>
                          <option value="Cancelado" style={{ background: '#1e293b', color: '#fff' }}>Cancelado</option>
                        </select>
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {q.status === 'Pendente' && (
                            <button
                              type="button"
                              onClick={() => onLoadQuoteIntoCart(q)}
                              className="btn-primary"
                              style={{
                                padding: '6px 10px',
                                fontSize: '11.5px',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Lançar itens no PDV para finalizar venda"
                            >
                              <ShoppingCart size={13} />
                              Lançar no PDV
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onPrintQuote(q)}
                            className="btn-secondary"
                            style={{
                              padding: '6px 8px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Imprimir Orçamento"
                          >
                            <Printer size={14} />
                          </button>

                          <a
                            href={generateWhatsAppQuoteLink(q)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '6px 8px',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--success)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              textDecoration: 'none'
                            }}
                            title="Enviar Orçamento via WhatsApp"
                          >
                            <Share2 size={14} />
                          </a>

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Deseja excluir permanentemente o orçamento #${q.id}?`)) {
                                onDeleteQuote(q.id);
                              }
                            }}
                            style={{
                              padding: '6px 8px',
                              backgroundColor: 'transparent',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--danger)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Excluir Orçamento"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

export function CreateQuoteModal({
  products = [],
  customers = [],
  initialCart = [],
  storeId = 'loja-1',
  onClose,
  onSave,
  onPrint,
  onLoadIntoPDV
}) {
  const [customerName, setCustomerName] = useState('Cliente Balcão');
  const [customerPhone, setCustomerPhone] = useState('');
  const [validDays, setValidDays] = useState(7);
  const [notes, setNotes] = useState('');
  
  // Itens do orçamento
  const [quoteItems, setQuoteItems] = useState(() => {
    if (initialCart && initialCart.length > 0) {
      return initialCart.map(i => ({
        id: i.id,
        code: i.code || '',
        name: i.name,
        quantity: parseInt(i.quantity) || 1,
        salePrice: parseFloat(i.salePrice) || 0,
        costPrice: parseFloat(i.costPrice) || 0,
        unit: i.unit || 'Un'
      }));
    }
    return [];
  });

  // Busca rápida de produtos do catálogo
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [savedQuote, setSavedQuote] = useState(null);

  // Modo de inclusão de item avulso
  const [showCustomItemForm, setShowCustomItemForm] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemQty, setCustomItemQty] = useState('1');
  const [customItemUnit, setCustomItemUnit] = useState('Un');

  useEffect(() => {
    if (!productSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const term = productSearch.toLowerCase();
    const matches = products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      (p.code && String(p.code).toLowerCase().includes(term))
    );
    setSearchResults(matches.slice(0, 8));
  }, [productSearch, products]);

  const handleSelectCustomer = (name) => {
    setCustomerName(name);
    const found = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (found && found.phone) {
      setCustomerPhone(found.phone);
    }
  };

  const handleAddProductToQuote = (prod) => {
    const existingIndex = quoteItems.findIndex(i => String(i.id) === String(prod.id));
    if (existingIndex !== -1) {
      const updated = [...quoteItems];
      updated[existingIndex].quantity += 1;
      setQuoteItems(updated);
    } else {
      setQuoteItems([...quoteItems, {
        id: prod.id,
        code: prod.code || '',
        name: prod.name,
        quantity: 1,
        salePrice: parseFloat(prod.salePrice) || 0,
        costPrice: parseFloat(prod.costPrice) || 0,
        unit: prod.unit || 'Un'
      }]);
    }
    setProductSearch('');
    setSearchResults([]);
  };

  const handleAddCustomItem = (e) => {
    e.preventDefault();
    if (!customItemName.trim() || !customItemPrice) {
      alert("Por favor, preencha o nome e o preço do item.");
      return;
    }
    const newItem = {
      id: 'custom-' + Date.now(),
      code: 'AVULSO',
      name: customItemName.trim(),
      quantity: parseInt(customItemQty) || 1,
      salePrice: parseFloat(String(customItemPrice).replace(',', '.')) || 0,
      costPrice: 0,
      unit: customItemUnit || 'Un'
    };
    setQuoteItems([...quoteItems, newItem]);
    setCustomItemName('');
    setCustomItemPrice('');
    setCustomItemQty('1');
    setShowCustomItemForm(false);
  };

  const handleUpdateItemQty = (index, delta) => {
    const updated = [...quoteItems];
    const newQty = (parseInt(updated[index].quantity) || 1) + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].quantity = newQty;
    }
    setQuoteItems(updated);
  };

  const handleUpdateItemPrice = (index, newPrice) => {
    const updated = [...quoteItems];
    const val = parseFloat(String(newPrice).replace(',', '.')) || 0;
    updated[index].salePrice = val;
    setQuoteItems(updated);
  };

  const handleRemoveItem = (index) => {
    const updated = [...quoteItems];
    updated.splice(index, 1);
    setQuoteItems(updated);
  };

  const totalQuoteValue = quoteItems.reduce((acc, i) => acc + ((parseFloat(i.salePrice) || 0) * (parseInt(i.quantity) || 1)), 0);
  const totalItemCount = quoteItems.reduce((acc, i) => acc + (parseInt(i.quantity) || 1), 0);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (quoteItems.length === 0) {
      alert("Por favor, adicione pelo menos um produto ao orçamento.");
      return;
    }

    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + parseInt(validDays));

    const quoteData = {
      id: `ORC-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      validUntil: validUntilDate.toISOString(),
      customerName: customerName.trim() || 'Cliente Balcão',
      customerPhone: customerPhone.trim(),
      storeId: storeId,
      totalPrice: totalQuoteValue,
      items: quoteItems,
      notes: notes.trim(),
      status: 'Pendente'
    };

    setSavedQuote(quoteData);
    if (onSave) {
      await onSave(quoteData);
    }
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, backdropFilter: 'blur(5px)' }}>
      <div className="modal-content glass-card" style={{ maxWidth: '840px', width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-lg)', overflow: 'hidden', padding: 0, border: '1px solid var(--border-color)', boxShadow: '0 25px 50px rgba(0,0,0,0.45)' }}>
        
        {!savedQuote ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            
            {/* Modal Header */}
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', backgroundColor: 'rgba(243, 180, 29, 0.15)', borderRadius: 'var(--radius-sm)', color: 'var(--brand-yellow)' }}>
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                    Criar Novo Orçamento Comercial
                  </h2>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    Monte a proposta para o cliente sem reservar ou baixar estoque da loja
                  </span>
                </div>
              </div>
              <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Dados do Cliente e Validade */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>Cliente / Solicitante *</label>
                  <input
                    type="text"
                    list="registered-quote-customers"
                    placeholder="Nome do cliente ou construtora..."
                    value={customerName}
                    onChange={e => handleSelectCustomer(e.target.value)}
                    required
                  />
                  <datalist id="registered-quote-customers">
                    {customers.map(c => (
                      <option key={c.id || c.name} value={c.name}>{c.phone ? `${c.name} (${c.phone})` : c.name}</option>
                    ))}
                  </datalist>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>WhatsApp / Telefone</label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>Validade da Proposta</label>
                  <select
                    value={validDays}
                    onChange={e => setValidDays(e.target.value)}
                  >
                    <option value={3}>3 dias</option>
                    <option value={7}>7 dias (Padrão)</option>
                    <option value={15}>15 dias</option>
                    <option value={30}>30 dias</option>
                  </select>
                </div>
              </div>

              {/* Busca e Inclusão de Produtos do Estoque */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Search size={15} style={{ color: 'var(--primary)' }} /> Adicionar Produtos do Estoque:
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCustomItemForm(!showCustomItemForm)}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={14} /> {showCustomItemForm ? 'Fechar Item Avulso' : '+ Item Avulso / Frete / Serviço'}
                  </button>
                </div>

                {showCustomItemForm && (
                  <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)', marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>Novo Item Avulso / Frete / Serviço:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '8px', alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px', marginBottom: '3px' }}>Descrição</label>
                        <input
                          type="text"
                          placeholder="Ex: Frete p/ obra..."
                          value={customItemName}
                          onChange={e => setCustomItemName(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px', marginBottom: '3px' }}>Preço Unit (R$)</label>
                        <input
                          type="text"
                          placeholder="0.00"
                          value={customItemPrice}
                          onChange={e => setCustomItemPrice(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px', marginBottom: '3px' }}>Qtd</label>
                        <input
                          type="number"
                          placeholder="1"
                          min="1"
                          value={customItemQty}
                          onChange={e => setCustomItemQty(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px', marginBottom: '3px' }}>Unidade</label>
                        <select
                          value={customItemUnit}
                          onChange={e => setCustomItemUnit(e.target.value)}
                        >
                          <option value="Un">Un</option>
                          <option value="Saco">Saco</option>
                          <option value="Metro">Metro</option>
                          <option value="Kg">Kg</option>
                          <option value="Lata">Lata</option>
                          <option value="Serv">Serviço</option>
                        </select>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={handleAddCustomItem}
                          className="btn-primary"
                          style={{ padding: '8px 14px', fontSize: '12px', fontWeight: '700' }}
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="input-group" style={{ position: 'relative' }}>
                  <Search className="input-icon" size={16} />
                  <input
                    type="text"
                    placeholder="Digite o nome do produto ou código de barras para incluir..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    style={{ paddingLeft: '38px' }}
                  />
                </div>

                {searchResults.length > 0 && (
                  <div style={{
                    marginTop: '8px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    maxHeight: '190px',
                    overflowY: 'auto',
                    boxShadow: 'var(--shadow-lg)'
                  }}>
                    {searchResults.map(p => {
                      const currentStoreStock = storeId === 'loja-1' ? (p.stockLoja1 ?? p.stock ?? 0) : (p.stockLoja2 ?? 0);
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleAddProductToQuote(p)}
                          style={{
                            padding: '10px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            transition: 'background 0.15s'
                          }}
                          className="search-item-hover"
                        >
                          <div>
                            <strong style={{ fontSize: '13px', color: 'var(--primary)' }}>{p.name}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Cód: {p.code || '-'} | Estoque: <span style={{ color: currentStoreStock > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '700' }}>{currentStoreStock} {p.unit || 'un'}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>R$ {(parseFloat(p.salePrice) || 0).toFixed(2)}</strong>
                            <span style={{ fontSize: '11px', backgroundColor: 'var(--brand-yellow)', color: '#000', padding: '4px 10px', borderRadius: '4px', fontWeight: '800' }}>
                              + Adicionar
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Lista dos Itens Selecionados */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    Itens da Cotação ({quoteItems.length} {quoteItems.length === 1 ? 'produto' : 'produtos'}):
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Total de Itens: <strong>{totalItemCount} unidades</strong>
                  </span>
                </div>

                {quoteItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 20px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Nenhum produto adicionado ainda. Pesquise no campo acima para montar a lista.
                  </div>
                ) : (
                  <div style={{ maxHeight: '230px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {quoteItems.map((item, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          backgroundColor: 'var(--bg-secondary)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-color)'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                            <span>Preço Unit: R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={item.salePrice}
                              onChange={e => handleUpdateItemPrice(index, e.target.value)}
                              style={{ width: '80px', padding: '3px 6px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: '700' }}
                            />
                            <span>/ {item.unit || 'un'}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(index, -1)}
                              style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              -
                            </button>
                            <span style={{ fontSize: '13px', fontWeight: '800', minWidth: '28px', textAlign: 'center' }}>
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(index, 1)}
                              style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              +
                            </button>
                          </div>

                          <strong style={{ fontSize: '14px', minWidth: '90px', textAlign: 'right', color: 'var(--text-primary)' }}>
                            R$ {((parseFloat(item.salePrice) || 0) * (parseInt(item.quantity) || 1)).toFixed(2)}
                          </strong>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                            title="Remover Item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Observações */}
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>Observações / Condições de Pagamento e Entrega (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Entrega inclusa em 2 dias úteis, pagamento 50% de entrada no Pix"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              {/* Card de Resumo Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                <div>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'block', fontWeight: '600' }}>Valor Total da Cotação:</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{quoteItems.length} produtos • {totalItemCount} unidades no total</span>
                </div>
                <strong style={{ fontSize: '22px', fontWeight: '900', color: 'var(--brand-yellow)' }}>
                  R$ {totalQuoteValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: 'var(--bg-secondary)' }}>
              <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '10px 18px', fontWeight: '600' }}>
                Cancelar
              </button>
              <button
                type="submit"
                disabled={quoteItems.length === 0}
                className="btn-primary"
                style={{
                  padding: '10px 24px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--brand-yellow)',
                  color: '#000000',
                  border: 'none',
                  opacity: quoteItems.length === 0 ? 0.5 : 1,
                  cursor: quoteItems.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                <Check size={18} strokeWidth={2.5} /> Salvar Orçamento
              </button>
            </div>

          </form>
        ) : (
          /* Tela de Sucesso */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '17px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--success)' }}>
                <CheckCircle size={20} /> Orçamento Salvo com Sucesso!
              </h2>
              <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center', padding: '28px 24px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--success)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}>
                <CheckCircle size={38} />
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                Orçamento #{savedQuote.id} Gravado!
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
                Cliente: <strong>{savedQuote.customerName}</strong> • Total: <strong style={{ color: 'var(--brand-yellow)' }}>R$ {(parseFloat(savedQuote.totalPrice) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => onPrint(savedQuote)}
                  className="btn-secondary"
                  style={{
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: '700',
                    fontSize: '13.5px'
                  }}
                >
                  <Printer size={17} /> Imprimir Cotação
                </button>

                <a
                  href={generateWhatsAppQuoteLink(savedQuote)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontWeight: '700',
                    fontSize: '13.5px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--success)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: 'var(--radius-md)',
                    textDecoration: 'none'
                  }}
                >
                  <Share2 size={17} /> Enviar no WhatsApp
                </a>
              </div>

              <button
                type="button"
                onClick={() => {
                  onLoadIntoPDV(savedQuote);
                  onClose();
                }}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '13.5px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--brand-yellow)',
                  color: '#000000',
                  border: 'none'
                }}
              >
                <ShoppingCart size={17} />
                Lançar Itens no Caixa (PDV) Agora
              </button>
            </div>

            <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
              <button type="button" className="btn-secondary" onClick={onClose} style={{ width: '100%', padding: '10px' }}>
                Concluir e Fechar
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export function QuotePrintModal({ quote, onClose }) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=850,height=900');
    const items = quote.items || [];
    const dateFormatted = quote.timestamp ? new Date(quote.timestamp).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
    const validUntilFormatted = quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('pt-BR') : '7 dias';
    const logoUrl = `${window.location.origin}/logo.png`;

    const itemsRows = items.map((i, idx) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 11.5px;">${idx + 1}. ${i.name}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 11.5px; text-align: center;">${i.quantity} ${i.unit || 'un'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 11.5px; text-align: right;">R$ ${(parseFloat(i.salePrice) || 0).toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 11.5px; text-align: right; font-weight: bold;">R$ ${((parseFloat(i.salePrice) || 0) * (parseInt(i.quantity) || 1)).toFixed(2)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Orçamento Comercial #${quote.id} - Novo Lar</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; margin: 24px; line-height: 1.4; }
            .header-box { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #12798a; padding-bottom: 12px; margin-bottom: 16px; }
            .store-title { font-size: 18px; font-weight: 800; color: #12798a; }
            .quote-badge { font-size: 15px; font-weight: bold; color: #333; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 16px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th { background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; font-size: 11.5px; text-align: left; }
            .total-box { display: flex; justify-content: space-between; align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px 16px; border-radius: 6px; font-size: 16px; font-weight: bold; margin-bottom: 16px; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; text-align: center; font-size: 11px; }
            .sign-line { border-top: 1px solid #333; padding-top: 4px; margin-top: 30px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header-box">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${logoUrl}" alt="Logo Novo Lar" style="max-height: 52px; width: auto; object-fit: contain;" onerror="this.style.display='none';" />
              <div>
                <div class="store-title">NOVO LAR - CASA & CONSTRUÇÃO</div>
                <div style="font-size: 11.5px; color: #555;">CNPJ: 62.002.153/0001-25 • Tel: (11) 4656-8183</div>
                <div style="font-size: 10.5px; color: #777;">Rua das Rosas, 1077 - Jardim Novo Eden - Santa Isabel / SP</div>
              </div>
            </div>
            <div style="text-align: right;">
              <div class="quote-badge">ORÇAMENTO COMERCIAL</div>
              <div style="font-size: 14px; font-weight: 800; color: #12798a;">#${quote.id}</div>
              <div style="font-size: 11px; color: #666;">Data: ${dateFormatted}</div>
            </div>
          </div>

          <div class="info-grid">
            <div>
              <div><strong>Cliente / Solicitante:</strong> ${quote.customerName || 'Cliente Balcão'}</div>
              ${quote.customerPhone ? `<div><strong>Telefone / WhatsApp:</strong> ${quote.customerPhone}</div>` : ''}
            </div>
            <div>
              <div><strong>Validade da Proposta:</strong> ${validUntilFormatted}</div>
              <div><strong>Status:</strong> ${quote.status || 'Pendente'}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 50%;">Item / Descrição</th>
                <th style="text-align: center;">Qtd</th>
                <th style="text-align: right;">Valor Unitário</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="total-box">
            <span>VALOR TOTAL DO ORÇAMENTO:</span>
            <span style="color: #16a34a; font-size: 19px;">R$ ${(parseFloat(quote.totalPrice) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          ${quote.notes ? `
            <div style="padding: 10px; background: #fafafa; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; margin-bottom: 16px;">
              <strong>Observações / Condições:</strong> ${quote.notes}
            </div>
          ` : ''}

          <div class="signatures">
            <div>
              <div class="sign-line">Vendedor / Consultor Comercial</div>
              <div style="color: #666; font-size: 9px; margin-top: 2px;">Novo Lar Casa & Construção</div>
            </div>
            <div>
              <div class="sign-line">Cliente / Aprovador</div>
              <div style="color: #666; font-size: 9px; margin-top: 2px;">De acordo com os itens e valores</div>
            </div>
          </div>

          <div style="text-align: center; font-size: 10px; color: #777; margin-top: 30px; border-top: 1px dashed #ccc; padding-top: 10px;">
            * Cotação comercial de preços sujeita à disponibilidade de estoque e confirmação no momento do fechamento. *
          </div>

          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const items = quote.items || [];
  const dateFormatted = quote.timestamp ? new Date(quote.timestamp).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
  const validUntilFormatted = quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('pt-BR') : '7 dias';

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, backdropFilter: 'blur(5px)' }}>
      <div className="modal-content glass-card" style={{ maxWidth: '680px', width: '95%', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px rgba(0,0,0,0.45)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(243, 180, 29, 0.15)', borderRadius: 'var(--radius-sm)', color: 'var(--brand-yellow)' }}>
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                Orçamento #{quote.id}
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Cliente: {quote.customerName || 'Cliente Balcão'} • Validade: {validUntilFormatted}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ maxHeight: '60vh', overflowY: 'auto', marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Data de Emissão:</span> <strong>{dateFormatted}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span> <span style={{ color: quote.status === 'Aprovado' ? 'var(--success)' : 'var(--brand-yellow)', fontWeight: '800' }}>{quote.status || 'Pendente'}</span>
            </div>
          </div>

          <table className="custom-table" style={{ width: '100%', fontSize: '12.5px' }}>
            <thead>
              <tr>
                <th>Item / Descrição</th>
                <th style={{ textAlign: 'center' }}>Qtd</th>
                <th style={{ textAlign: 'right' }}>V. Unit</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td><strong>{item.name}</strong></td>
                  <td style={{ textAlign: 'center' }}>{item.quantity} {item.unit || 'un'}</td>
                  <td style={{ textAlign: 'right' }}>R$ {(parseFloat(item.salePrice) || 0).toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: '800' }}>R$ {((parseFloat(item.salePrice) || 0) * (parseInt(item.quantity) || 1)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>Total da Cotação:</span>
            <strong style={{ fontSize: '20px', fontWeight: '900', color: 'var(--brand-yellow)' }}>
              R$ {(parseFloat(quote.totalPrice) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>

          {quote.notes && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <strong>Observações:</strong> {quote.notes}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', paddingTop: '14px', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
          <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '10px 16px', fontWeight: '600' }}>
            Fechar
          </button>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <a
              href={generateWhatsAppQuoteLink(quote)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '10px 16px',
                fontWeight: '700',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                textDecoration: 'none',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                color: 'var(--success)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <Share2 size={15} /> WhatsApp
            </a>

            <button
              type="button"
              onClick={handlePrint}
              className="btn-primary"
              style={{
                padding: '10px 20px',
                fontWeight: '800',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--brand-yellow)',
                color: '#000',
                border: 'none'
              }}
            >
              <Printer size={15} /> Imprimir Cotação
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

