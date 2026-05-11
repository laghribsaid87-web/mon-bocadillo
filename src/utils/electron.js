import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
  // Creer la fenêtre dyal l-Caisse (Plein écran)
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    fullscreen: true, // Kiosk mode (kayghatti l-PC kaml w mkaykhelish l-caissier yl3eb f Windows)
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
  });

  // F mode développement kay-chargi localhost, f l-prod kay-chargi l-build (React)
  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../dist/index.html')}`;
  win.loadURL(startUrl);

  // 🔥 ZEDNA HAD L-CODE: Kaytsenet l-demande dyal l'impression mn React w kay-imprimi f s-skat
  ipcMain.on('print-ticket', (event, htmlContent, printerName = null) => {
    const printWin = new BrowserWindow({
      show: false, // Fenêtre mkhabya (invisible) bach y-imprimi mnha
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
          silent: true, // Impression 100% Silencieuse (bla preview)
          printBackground: true, 
          deviceName: deviceName,
          margins: { marginType: 'none' } 
        }, (success, failureReason) => {
          if (!success) {
            console.log('Impression annulée ou échouée:', failureReason);
          }
          printWin.close(); // Nsedo l-fenêtre l-mkhabya mli ysali
        });
      } catch (err) {
        console.error("Erreur recherche imprimante:", err);
        printWin.close();
      }
    });
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});