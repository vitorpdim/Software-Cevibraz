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

    // --- REVISÃO DA LÓGICA DE DOWNLOAD ---
    mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
        // ESSA LINHA É CRÍTICA PARA PEGAR O CONTROLE DO DOWNLOAD
        event.preventDefault(); 

        console.log(`[DOWNLOAD] Will-download acionado para: ${item.getFilename()}`);

        dialog.showSaveDialog(mainWindow, { // Passe mainWindow para que o diálogo seja modal à janela principal
            title: 'Salvar PDF',
            defaultPath: item.getFilename(),
            filters: [{ name: 'Arquivos PDF', extensions: ['pdf'] }]
        }).then(({ filePath }) => {
            if (filePath) {
                console.log(`[DOWNLOAD] Caminho de salvamento selecionado: ${filePath}`);
                item.setSavePath(filePath);
                item.on('updated', (updateEvent, state) => {
                    console.log(`[DOWNLOAD] Item '${item.getFilename()}' atualizado. Estado: ${state}`);
                    if (state === 'interrupted') {
                        console.warn(`[DOWNLOAD] Download interrompido para ${item.getFilename()}. Motivo: ${item.getLastError()}`);
                    }
                });
                
                item.on('done', (doneEvent, state) => {
                    if (state === 'completed') {
                        console.log(`[DOWNLOAD] Download de '${item.getFilename()}' COMPLETO em: ${item.getSavePath()}`);
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Download Concluído',
                            message: `O PDF foi salvo em:\n${item.getSavePath()}`
                        });
                    } else {
                        console.error(`[DOWNLOAD] Download de '${item.getFilename()}' FALHOU. Estado: ${state}. Erro: ${item.getLastError()}`);
                        dialog.showErrorBox('Erro no Download', `Não foi possível salvar o PDF.\nStatus: ${state}\nErro: ${item.getLastError()}`);
                    }
                });

                // Se o item.on('done') não estiver sendo chamado, é porque o fluxo de dados não está fluindo.
                // Este é um problema fundamental de como o Electron lida com o download de Blob/fetch.
                // O download via Base64 é a forma mais robusta de contornar isso.

            } else {
                console.log(`[DOWNLOAD] Diálogo de salvamento cancelado pelo usuário para ${item.getFilename()}.`);
                item.cancel(); // Cancela o item de download, importante!
            }
        }).catch(err => console.error(`[DOWNLOAD] Erro no diálogo showSaveDialog: ${err}`));
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