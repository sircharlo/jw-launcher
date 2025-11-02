const { app, BrowserWindow, ipcMain } = require("electron"),
  { autoUpdater } = require("electron-updater"),
  remote = require("@electron/remote/main");
var win = {};
const cookieJar = new Map();
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
  ses.webRequest.onBeforeSendHeaders({ urls: ['https://stream.jw.org/*'] }, (details, callback) => {
    const headers = details.requestHeaders;
    // Set Referer
    if (headers['X-Referer']) {
      headers['Referer'] = headers['X-Referer'];
      delete headers['X-Referer'];
    } else {
      headers['Referer'] = 'https://stream.jw.org/home';
    }
    // Set Cookie
    if (cookieJar.size > 0) {
      headers['Cookie'] = Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
    }
    // Set xsrf-token-stream
    const xsrf = cookieJar.get('xsrf-token-stream');
    if (xsrf) {
      headers['xsrf-token-stream'] = xsrf;
    }
    // Set default headers
    headers['accept'] = headers['accept'] || 'application/json';
    headers['x-requested-with'] = headers['x-requested-with'] || 'XMLHttpRequest';
    if (details.method === 'PUT') {
      headers['content-type'] = headers['content-type'] || 'application/json';
    }
    if ((details.url.includes('/api/v1/libraryBranch/') || details.url.includes('/api/v1/program/')) && !details.url.includes('/auth/')) {
      headers['oidc-domain'] = headers['oidc-domain'] || 'jworg';
    }
    callback({ requestHeaders: headers });
  });
  ses.webRequest.onHeadersReceived({ urls: ['https://stream.jw.org/*'] }, (details, callback) => {
    // Update cookies from set-cookie
    const setCookie = details.responseHeaders['set-cookie'];
    if (setCookie) {
      const sc = Array.isArray(setCookie) ? setCookie : [setCookie];
      for (const c of sc) {
        const parts = c.split(";").map(s => s.trim());
        const pair = parts[0];
        const eq = pair.indexOf("=");
        if (eq > 0) cookieJar.set(pair.substring(0, eq).trim(), pair.substring(eq + 1));
        const maxAgeAttr = parts.find(p => /^Max-Age=/i.test(p));
        if (maxAgeAttr) {
          const maxAge = parseInt(maxAgeAttr.split("=")[1]);
          if (!isNaN(maxAge)) {
            const exp = Math.floor(Date.now() / 1000) + maxAge;
            cookieJar.set("stream-session-expiry", String(exp));
          }
        }
      }
    }
    callback({ responseHeaders: details.responseHeaders });
  });
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
    if (process.platform == "darwin") {
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
