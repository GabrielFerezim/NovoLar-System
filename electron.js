const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function getDatabasePath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'novo_lar_db.json');
}

function initializeDatabase() {
  const dbPath = getDatabasePath();
  if (!fs.existsSync(dbPath)) {
    // Dados fictícios iniciais para a loja de materiais de construção ter um visual incrível de início
    const initialData = {
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
      sales: [
        {
          id: "V-1001",
          timestamp: new Date(Date.now() - 3600000 * 24 * 3).toISOString(), // 3 dias atrás
          items: [
            { productId: "1", name: "Cimento CP II Mauá 50kg", quantity: 10, salePrice: 38.90, costPrice: 28.50 },
            { productId: "5", name: "Argamassa ACIII 20kg Quartzolit", quantity: 5, salePrice: 27.50, costPrice: 18.20 }
          ],
          totalPrice: 526.50,
          totalCost: 376.00,
          profit: 150.50,
          paymentMethod: "Dinheiro"
        },
        {
          id: "V-1002",
          timestamp: new Date(Date.now() - 3600000 * 12).toISOString(), // 12 horas atrás
          items: [
            { productId: "4", name: "Fio Rígido Flexível 2.5mm² Azul 100m Cobrecom", quantity: 2, salePrice: 169.90, costPrice: 110.00 },
            { productId: "6", name: "Torneira de Parede para Cozinha Metal Deca", quantity: 1, salePrice: 120.00, costPrice: 75.00 }
          ],
          totalPrice: 459.80,
          totalCost: 295.00,
          profit: 164.80,
          paymentMethod: "Pix"
        }
      ],
      expenses: [
        { id: "G-1", timestamp: new Date(Date.now() - 3600000 * 24 * 5).toISOString(), description: "Conta de Energia Elétrica Enel", amount: 245.80, category: "Contas Fixas" },
        { id: "G-2", timestamp: new Date(Date.now() - 3600000 * 24 * 2).toISOString(), description: "Frete de Entrega de Areia", amount: 150.00, category: "Logística" }
      ]
    };
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    icon: fs.existsSync(path.join(__dirname, 'dist', 'app-icon.png'))
      ? path.join(__dirname, 'dist', 'app-icon.png')
      : path.join(__dirname, 'public', 'app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "Novo Lar - Casa & Construção",
    backgroundColor: "#f4f6f8" // Cor de fundo clara correspondente ao tema do app
  });

  mainWindow.setMenuBarVisibility(false);

  const isDev = process.argv.includes('--dev');
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools(); // Pode abrir se necessário
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Inicializar DB antes de abrir a janela
app.whenReady().then(() => {
  initializeDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC IPC Handlers para salvar/ler dados do banco de dados
ipcMain.handle('db:read', async () => {
  try {
    const dbPath = getDatabasePath();
    if (!fs.existsSync(dbPath)) {
      initializeDatabase();
    }
    const data = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Erro ao ler banco de dados:", error);
    throw error;
  }
});

ipcMain.handle('db:write', async (event, data) => {
  try {
    const dbPath = getDatabasePath();
    // Fazer uma escrita atômica simples salvando em um arquivo temporário e depois renomeando
    const tempPath = dbPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, dbPath);
    return { success: true };
  } catch (error) {
    console.error("Erro ao escrever no banco de dados:", error);
    return { success: false, error: error.message };
  }
});
