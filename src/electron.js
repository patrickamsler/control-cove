const { app, BrowserWindow } = require('electron');
const path = require('path');

let isDev;
let mainWindow;

async function createWindow() {
  isDev = (await import('electron-is-dev')).default;

  mainWindow = new BrowserWindow({
    width: 610,
    height: 408,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  const startURL = isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startURL);

  // if (isDev) {
  //   mainWindow.webContents.openDevTools();
  // }

  mainWindow.on('closed', () => (mainWindow = null));
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});