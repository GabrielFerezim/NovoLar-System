const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

app.name = 'constru-control';
app.setPath('userData', path.join(app.getPath('appData'), app.name));

let mainWindow;
let db;

function getDatabasePath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'novo_lar_db.sqlite');
}

function initializeDatabase() {
  const dbPath = getDatabasePath();
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Erro ao abrir banco SQLite:', err.message);
    } else {
      console.log('Conectado ao banco SQLite em:', dbPath);
      createTables();
      migrateJsonToSqlite();
    }
  });
}

function createTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT,
        description TEXT,
        costPrice REAL,
        salePrice REAL,
        stockLoja1 INTEGER,
        stockLoja2 INTEGER,
        stock INTEGER,
        minStock INTEGER,
        category TEXT,
        unit TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        totalPrice REAL,
        totalCost REAL,
        profit REAL,
        paymentMethod TEXT,
        storeId TEXT,
        items TEXT,
        deliveryDetails TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        description TEXT,
        amount REAL,
        category TEXT,
        storeId TEXT,
        source TEXT DEFAULT 'Caixa Físico'
      )
    `);

    db.run("ALTER TABLE expenses ADD COLUMN source TEXT DEFAULT 'Caixa Físico'", (err) => {
      // Ignorar erro se a coluna já existir
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS closures (
        id TEXT PRIMARY KEY,
        storeId TEXT,
        date TEXT,
        closedAt TEXT,
        expectedCash REAL,
        actualCash REAL,
        difference REAL,
        observations TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS credit_accounts (
        id TEXT PRIMARY KEY,
        name TEXT,
        role TEXT DEFAULT 'Cliente',
        address TEXT,
        phone TEXT,
        balance REAL,
        history TEXT
      )
    `);

    db.run("ALTER TABLE credit_accounts ADD COLUMN role TEXT DEFAULT 'Cliente'", (err) => {
      // Ignorar erro se a coluna já existir
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS vault_transactions (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        type TEXT,
        amount REAL,
        description TEXT,
        storeId TEXT,
        date TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS bills (
        id TEXT PRIMARY KEY,
        description TEXT,
        amount REAL,
        category TEXT,
        dueDate TEXT,
        status TEXT DEFAULT 'Pendente',
        storeId TEXT
      )
    `);
  });
}

function migrateJsonToSqlite() {
  const jsonPath = path.join(app.getPath('userData'), 'novo_lar_db.json');
  if (fs.existsSync(jsonPath)) {
    console.log('Detectado banco JSON antigo. Iniciando migração para SQLite...');
    try {
      const dataStr = fs.readFileSync(jsonPath, 'utf-8');
      const data = JSON.parse(dataStr);
      
      db.serialize(() => {
        // 1. Migrar produtos
        if (Array.isArray(data.products)) {
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO products (id, code, name, description, costPrice, salePrice, stockLoja1, stockLoja2, stock, minStock, category, unit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          data.products.forEach(p => {
            stmt.run(
              String(p.id),
              String(p.code || ''),
              String(p.name || ''),
              String(p.description || ''),
              parseFloat(p.costPrice) || 0,
              parseFloat(p.salePrice) || 0,
              parseInt(p.stockLoja1) || 0,
              parseInt(p.stockLoja2) || 0,
              parseInt(p.stock) || 0,
              parseInt(p.minStock) || 0,
              String(p.category || 'Materiais Básicos'),
              String(p.unit || 'Unidade')
            );
          });
          stmt.finalize();
        }

        // 2. Migrar vendas
        if (Array.isArray(data.sales)) {
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO sales (id, timestamp, totalPrice, totalCost, profit, paymentMethod, storeId, items, deliveryDetails)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          data.sales.forEach(s => {
            stmt.run(
              String(s.id),
              String(s.timestamp || ''),
              parseFloat(s.totalPrice) || 0,
              parseFloat(s.totalCost) || 0,
              parseFloat(s.profit) || 0,
              String(s.paymentMethod || ''),
              String(s.storeId || 'loja-1'),
              JSON.stringify(s.items || []),
              s.deliveryDetails ? JSON.stringify(s.deliveryDetails) : null
            );
          });
          stmt.finalize();
        }

        // 3. Migrar despesas
        if (Array.isArray(data.expenses)) {
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO expenses (id, timestamp, description, amount, category, storeId)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          data.expenses.forEach(e => {
            stmt.run(
              String(e.id),
              String(e.timestamp || ''),
              String(e.description || ''),
              parseFloat(e.amount) || 0,
              String(e.category || ''),
              String(e.storeId || 'loja-1')
            );
          });
          stmt.finalize();
        }

        // 4. Migrar fechamentos
        if (Array.isArray(data.closures)) {
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO closures (id, storeId, date, closedAt, expectedCash, actualCash, difference, observations)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          data.closures.forEach(c => {
            stmt.run(
              String(c.id),
              String(c.storeId || 'loja-1'),
              String(c.date || ''),
              String(c.closedAt || ''),
              parseFloat(c.expectedCash) || 0,
              parseFloat(c.actualCash) || 0,
              parseFloat(c.difference) || 0,
              String(c.observations || '')
            );
          });
          stmt.finalize();
        }

        // 5. Migrar fiados
        if (Array.isArray(data.creditAccounts)) {
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO credit_accounts (id, name, address, phone, balance, history)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          data.creditAccounts.forEach(ca => {
            stmt.run(
              String(ca.id),
              String(ca.name || ''),
              String(ca.address || ''),
              String(ca.phone || ''),
              parseFloat(ca.balance) || 0,
              JSON.stringify(ca.history || [])
            );
          });
          stmt.finalize();
        }
      });

      // Renomear banco JSON antigo para backup
      fs.renameSync(jsonPath, jsonPath + '.bak');
      console.log('✅ Migração para SQLite concluída com sucesso e backup criado!');
    } catch (err) {
      console.error('Erro durante a migração para SQLite:', err.message);
    }
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
    backgroundColor: "#f4f6f8"
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.openDevTools();

  const isDev = process.argv.includes('--dev');
  if (isDev) {
    const tryPorts = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180];
    const http = require('http');

    const tryLoad = (ports) => {
      if (ports.length === 0) {
        mainWindow.loadURL('http://localhost:5173');
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

app.whenReady().then(() => {
  initializeDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) {
      db.close((err) => {
        if (err) console.error('Erro ao fechar SQLite:', err.message);
        else console.log('Conexão SQLite fechada com sucesso.');
        app.quit();
      });
    } else {
      app.quit();
    }
  }
});

// IPC Handlers para consultas SQLite
ipcMain.handle('db:run', (event, sql, params = []) => {
  return new Promise((resolve) => {
    db.run(sql, params, function(err) {
      if (err) {
        console.error('Erro no db:run:', err.message, 'SQL:', sql);
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, lastID: this.lastID, changes: this.changes });
      }
    });
  });
});

ipcMain.handle('db:all', (event, sql, params = []) => {
  return new Promise((resolve) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Erro no db:all:', err.message, 'SQL:', sql);
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, data: rows });
      }
    });
  });
});

ipcMain.handle('db:get', (event, sql, params = []) => {
  return new Promise((resolve) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('Erro no db:get:', err.message, 'SQL:', sql);
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, data: row });
      }
    });
  });
});
