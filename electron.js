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
    // Banco vazio — dados vêm do Supabase (fonte única de verdade)
    const initialData = {
      products: [],
      sales: [],
      expenses: [],
      closures: [],
      syncQueue: [],
      creditAccounts: []
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
    // Tenta portas em sequência pois o Vite pode usar uma porta diferente se a padrão estiver ocupada
    const tryPorts = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180];
    const http = require('http');

    const tryLoad = (ports) => {
      if (ports.length === 0) {
        mainWindow.loadURL('http://localhost:5173'); // fallback
        return;
      }
      const port = ports[0];
      http.get(`http://localhost:${port}`, (res) => {
        if (res.statusCode < 500) {
          console.log(`Electron conectando na porta ${port}`);
          mainWindow.loadURL(`http://localhost:${port}`);
        } else {
          tryLoad(ports.slice(1));
        }
      }).on('error', () => {
        tryLoad(ports.slice(1));
      });
    };
    tryLoad(tryPorts);
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
