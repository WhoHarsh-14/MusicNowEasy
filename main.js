const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let nextProcess = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false, // Frameless UI
    titleBarStyle: 'hidden', // Required for frameless drag on some OS
    backgroundColor: '#0a0a0a', // Matches Midnight Gold dark background
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'public', 'placeholder.png')
  });

  const loadURL = async () => {
    try {
      await mainWindow.loadURL('http://localhost:3000');
    } catch (e) {
      console.log("Failed to load localhost, retrying...");
      setTimeout(loadURL, 500);
    }
  };
  
  loadURL();

}

function startNextJs() {
  if (isDev) {
    // In dev, we assume 'npm run dev' is running via concurrently
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    // In production, run the Next.js standalone server
    const serverPath = path.join(app.getAppPath(), '.next', 'standalone', 'server.js');
    console.log('Starting standalone Next.js at', serverPath);
    
    // Parse .env.local to manually inject secrets into the Next.js standalone server
    let customEnv = {};
    try {
      const fs = require('fs');
      const envContent = fs.readFileSync(path.join(process.resourcesPath, 'app-env.cfg'), 'utf8');
      envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          customEnv[match[1]] = match[2].replace(/(^['"]|['"]$)/g, '').trim();
        }
      });
    } catch (e) {
      console.log('Could not load .env.local:', e.message);
    }

    // Pass PORT to standalone server
    nextProcess = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        ...customEnv,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: '3000',
        NODE_ENV: 'production',
        YTDLP_PATH: path.join(process.resourcesPath, '..', 'yt-dlp.exe')
      }
    });

    nextProcess.stdout.on('data', (data) => {
      console.log(`[Next.js]: ${data}`);
      if (data.toString().includes('Listening on port')) {
        resolve();
      }
    });

    nextProcess.stderr.on('data', (data) => {
      console.error(`[Next.js Error]: ${data}`);
    });
    
    // Resolve anyway after 3 seconds just in case it's silent
    setTimeout(resolve, 3000);
  });
}

app.whenReady().then(async () => {
  await startNextJs();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  if (nextProcess) {
    nextProcess.kill();
  }
});

// IPC for frameless window controls
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});
