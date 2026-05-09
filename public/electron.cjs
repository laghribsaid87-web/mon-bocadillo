const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

function createWindow() {
  // Creer la fenêtre dyal l-Caisse (Plein écran)
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    fullscreen: true, // Kiosk mode
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
  });

  // F mode développement kay-chargi localhost, f l-prod kay-chargi l-build (React)
  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, 'index.html')}`;
  win.loadURL(startUrl);

  // Bach Electron ykheli l-fenêtres jdad (KDS, TV) yt7ello w may-blockihomch
  win.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'logo.png'),
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      }
    };
  });

  // Mli yt7el KDS wla TV (fenêtre jdida), khassha tkon kbira (Maximised)
  win.webContents.on('did-create-window', (childWindow) => {
    childWindow.maximize();
  });

  // Kaytsenet l-demande dyal l'impression mn React w kay-imprimi f s-skat
  ipcMain.on('print-ticket', (event, htmlContent) => {
    const printWin = new BrowserWindow({
      show: false, // Fenêtre mkhabya
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    
    printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    printWin.webContents.on('did-finish-load', () => {
      printWin.webContents.print({ 
        silent: true, 
        printBackground: true, 
        margins: { marginType: 'none' } 
      }, () => {
        printWin.close(); 
      });
    });
  });
}

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.on('update-downloaded', (info) => {
  const dialogOpts = {
    type: 'info',
    buttons: ['Redémarrer w Installi', 'Khliha Tal Mn Be3d'],
    title: 'Mise à jour jdida wajda!',
    detail: 'T-téléchargat wa7ed l-version jdida (' + info.version + '). Wach bghiti tre-démari l-application daba bach t-installaha?'
  };
  dialog.showMessageBox(dialogOpts).then((returnValue) => {
    if (returnValue.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});