// main.js 
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

let mainWindow;

// --- INÍCIO DA NOVA LÓGICA PARA PUPPETEER ---

const puppeteerPath = (() => {
    const resourcesPath = process.resourcesPath;
    const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'puppeteer');
    const potentialPath = path.join(unpackedPath, '.cache');
    
    if (fs.existsSync(potentialPath)) {
        return potentialPath;
    }
    return unpackedPath;
})();

// caminho do cache do Puppeteer pra estar dentro da nossa aplicação
process.env.PUPPETEER_CACHE_DIR = puppeteerPath;

// pasta de logs
const logPath = app.getPath('userData');
process.env.APP_LOG_PATH = path.join(logPath, 'logs');

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: path.join(__dirname, 'icon.png')
    });

    const startUrl = url.format({
        pathname: path.join(__dirname, 'site-orcamento/index.html'),
        protocol: 'file:',
        slashes: true
    });

    mainWindow.loadURL(startUrl);

    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }
    
    mainWindow.on('closed', () => { mainWindow = null; });
}

app.on('ready', () => {
    try {
        console.log(`[main.js] Pasta de logs definida em: ${process.env.APP_LOG_PATH}`);
        console.log(`[main.js] Caminho de cache do Puppeteer definido para: ${process.env.PUPPETEER_CACHE_DIR}`);
        require('./backend_orcamento/server.js');
    } catch (error) {
        console.error('Erro fatal no backend ao iniciar:', error);
        dialog.showErrorBox('Erro Fatal no Backend', `Não foi possível iniciar o servidor interno.\n\nDetalhes: ${error.message}`);
        app.quit();
    }
    
    createWindow();
});

ipcMain.on('show-alert', (event, message) => {
    if (mainWindow) {
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Informação',
            message: message
        });
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) createWindow();
});