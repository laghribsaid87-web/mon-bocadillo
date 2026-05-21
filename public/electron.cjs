const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;

function createWindow() {
  // Creer la fenêtre dyal l-Caisse (Plein écran)
  mainWindow = new BrowserWindow({
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
  mainWindow.loadURL(startUrl);

  // Bach Electron ykheli l-fenêtres jdad (KDS, TV) yt7ello w may-blockihomch
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
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
  mainWindow.webContents.on('did-create-window', (childWindow) => {
    childWindow.maximize();
  });

  // Minimize and Close window logic
  ipcMain.on('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
  });
  ipcMain.on('close-window', () => {
    if (mainWindow) mainWindow.close();
  });

  // Kaytsenet l-demande dyal l'impression mn React w kay-imprimi f s-skat
  ipcMain.on('print-ticket', (event, htmlContent, printerName = null) => {
    const printWin = new BrowserWindow({
      show: false, // Fenêtre mkhabya
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    
    printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    printWin.webContents.on('did-finish-load', async () => {
      try {
        const printers = await printWin.webContents.getPrintersAsync();
        let deviceName = '';
        
        if (printerName && printers.some(p => p.name === printerName)) {
            deviceName = printerName;
        } else {
            const thermalPrinter = printers.find(p => {
              const n = p.name.toLowerCase();
              return n.includes('pos') || n.includes('xp') || n.includes('80') || n.includes('58') || n.includes('ticket') || n.includes('receipt') || n.includes('thermal') || n.includes('epson') || n.includes('tm-');
            });
            
            deviceName = thermalPrinter ? thermalPrinter.name : '';

            if (!thermalPrinter) {
              const defaultPrinter = printers.find(p => p.isDefault);
              if (!defaultPrinter) {
                console.log("Aucune imprimante détectée. Impression ignorée.");
                printWin.close();
                return;
              }
              const n = defaultPrinter.name.toLowerCase();
              // 🔥 N-blockiw les imprimantes virtuelles (PDF/Fax/XPS)
              if (n.includes('pdf') || n.includes('xps') || n.includes('onenote') || n.includes('fax') || n.includes('desktop') || n.includes('anydesk') || n.includes('microsoft')) {
                console.log("Imprimante virtuelle détectée. Impression ignorée pour ne pas bloquer.");
                printWin.close();
                return;
              }
              deviceName = defaultPrinter.name;
            }
        }

        printWin.webContents.print({ 
          silent: true, 
          printBackground: true, 
          deviceName: deviceName,
          margins: { marginType: 'none' } 
        }, (success, failureReason) => {
          if (!success) console.log('Impression annulée ou échouée:', failureReason);
          printWin.close();
        });
      } catch (err) {
        console.error("Erreur recherche imprimante:", err);
        printWin.close();
      }
    });
  });
}

app.whenReady().then(() => {
  // ✅ L-Khedma 3.1 PRO: Autorisation automatique dyal l-micro
  // Had l-code kayched ay demande dyal permission w kay-acceptiha bla maybiyyen l-popup
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Hna kan-acceptiw rir l-permission dyal l-micro w l-camera ('media')
    if (permission === 'media') {
      // Kan-acceptiwha direct. Bnadm f KDS maghay3ref walo.
      callback(true);
    } else {
      // Ay permission khera, refuséha par sécurité.
      callback(false);
    }
  });

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