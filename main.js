// main.js (VERSÃO FINAL E COMPLETA)
const { app, BrowserWindow, dialog, ipcMain, session } = require('electron');
const path = require('path');
const url = require('url');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            // MUDANÇAS CRÍTICAS PARA SEGURANÇA E COMUNICAÇÃO
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

    // CORREÇÃO PARA JANELA EM BRANCO NO DOWNLOAD
    mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
        event.preventDefault();
        dialog.showSaveDialog({
            title: 'Salvar PDF',
            defaultPath: item.getFilename(),
            filters: [{ name: 'Arquivos PDF', extensions: ['pdf'] }]
        }).then(({ filePath }) => {
            if (filePath) {
                item.setSavePath(filePath);
            }
        }).catch(err => console.log(err));
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

try {
    require('./backend_orcamento/server.js');
} catch (error) {
    console.error('Erro fatal no backend ao iniciar:', error);
    app.on('ready', () => {
        dialog.showErrorBox('Erro Fatal no Backend', `Não foi possível iniciar o servidor interno.\n\nDetalhes: ${error.message}`);
        app.quit();
    });
}

app.on('ready', createWindow);

// CORREÇÃO PARA OS ALERTAS (ReferenceError)
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
