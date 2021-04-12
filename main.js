const {
    app,
    BrowserWindow,
    ipcMain
  } = require("electron"), {
    autoUpdater
  } = require("electron-updater"),
  os = require("os");
require("@electron/remote/main").initialize();
var win = {};

function createUpdateWindow() {
  win = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
      contextIsolation: false
    },
    width: 600,
    height: 600,
    //  fullscreen: true,
    //  alwaysOnTop: true,
    title: "JW Launcher"
  });
  const ses = win.webContents.session;
  ses.clearCache();
  ses.clearStorageData();
  win.setMenuBarVisibility(false);
  win.loadFile("index.html");
  win.maximize();
}

ipcMain.on("autoUpdate", () => {
  win.webContents.send("hideThenShow", ["InternetCheck", "UpdateCheck"]);
  autoUpdater.checkForUpdates();
});

ipcMain.on("noInternet", () => {
  win.webContents.send("hideThenShow", ["InternetCheck", "InternetFail"]);
  setInterval(() => {
    win.webContents.send("checkInternet");
  }, 10000);
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
  win.webContents.send("hideThenShow", ["UpdateAvailable", "UpdateDownloaded"]);
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
