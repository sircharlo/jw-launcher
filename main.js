const { app, BrowserWindow, ipcMain } = require("electron"),
  { autoUpdater } = require("electron-updater"),
  os = require("os"),
  remote = require("@electron/remote/main");
var win = {};
remote.initialize();
function createUpdateWindow() {
  win = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    minWidth: 1366,
    minHeight: 768,
    fullscreen: true,
    //  alwaysOnTop: true,
    title: "JW Launcher",
  });
  const ses = win.webContents.session;
  ses.clearCache();
  ses.clearStorageData();
  remote.enable(win.webContents);
  win.setMenuBarVisibility(false);
  win.loadFile("index.html");
  win.maximize();
  win.on("show", () => {
    win.focus();
  });
  win.show();
}
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  ipcMain.on("autoUpdate", () => {
    win.webContents.send("hideThenShow", ["InternetCheck", "UpdateCheck"]);
    autoUpdater.checkForUpdates().then((result) => {
      if (!result) {
        win.webContents.send("goAhead");
      }
    });
  });
  autoUpdater.on("error", () => {
    win.webContents.send("goAhead");
  });
  autoUpdater.on("update-not-available", () => {
    win.webContents.send("goAhead");
  });
  autoUpdater.on("update-available", () => {
    if (os.platform() == "darwin") {
      win.webContents.send("goAhead");
      win.webContents.send("macUpdate");
    } else {
      win.webContents.send("hideThenShow", ["UpdateCheck", "UpdateAvailable"]);
      autoUpdater.downloadUpdate();
    }
  });
  autoUpdater.on("download-progress", (prog) => {
    win.webContents.send("updateDownloadProgress", [prog.percent]);
  });
  autoUpdater.on("update-downloaded", () => {
    win.webContents.send("hideThenShow", [
      "UpdateAvailable",
      "UpdateDownloaded",
    ]);
    setImmediate(() => {
      autoUpdater.quitAndInstall();
    });
  });
  autoUpdater.logger = console;
  autoUpdater.autoDownload = false;
  app.whenReady().then(createUpdateWindow);
  app.on("window-all-closed", () => {
    app.quit();
  });
}
