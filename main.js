const { app, BrowserWindow, dialog, ipcMain, net, shell } = require("electron"),
  { autoUpdater } = require("electron-updater"),
  fs = require("node:fs"),
  path = require("node:path"),
  { createConnection } = require("node:net"),
  { pathToFileURL } = require("node:url"),
  powerControl = require("power-control");
var win = {};
const cookieJar = new Map();
const indexUrl = pathToFileURL(path.join(__dirname, "index.html")).href;
const prefsFile = path.join(app.getPath("userData"), "prefs.json");
const quickSupportUrls = {
  darwin: "https://download.teamviewer.com/download/TeamViewerQS.dmg",
  linux:
    "https://download.teamviewer.com/download/version_11x/teamviewer_qs.tar.gz",
  win32: "https://download.teamviewer.com/download/TeamViewerQS.exe",
};
// Only answer IPC coming from our own page, never from other frames or origins
function fromApp(event) {
  return !!event.senderFrame && event.senderFrame.url.split("#")[0] === indexUrl;
}
function handle(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!fromApp(event)) throw new Error("Blocked IPC from untrusted sender");
    return listener(event, ...args);
  });
}
function on(channel, listener) {
  ipcMain.on(channel, (event, ...args) => {
    if (fromApp(event)) listener(event, ...args);
  });
}
function isOnline() {
  return new Promise((resolve) => {
    const client = createConnection(443, "www.jw.org");
    client.setTimeout(5000);
    client.on("timeout", () => {
      client.destroy();
      resolve(false);
    });
    client.on("connect", () => {
      client.destroy();
      resolve(true);
    });
    client.on("error", (e) => {
      console.error(e);
      resolve(false);
    });
  });
}
async function runQuickSupport(event) {
  const url = quickSupportUrls[process.platform];
  if (!url) return false;
  try {
    const response = await net.fetch(url);
    if (!response.ok) throw new Error("HTTP " + response.status);
    const total = Number(response.headers.get("content-length")) || 0;
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      if (total) event.sender.send("quickSupport:progress", (loaded / total) * 100);
    }
    const destPath = path.join(app.getPath("userData"), path.basename(url));
    fs.writeFileSync(destPath, Buffer.concat(chunks));
    const err = await shell.openPath(destPath);
    if (err) throw new Error(err);
    return true;
  } catch (e) {
    console.error("Failed to run TeamViewer QuickSupport:", e);
    return false;
  }
}
function registerIpc() {
  handle("app:getVersion", () => app.getVersion());
  handle("net:isOnline", () => isOnline());
  handle("prefs:read", () =>
    fs.existsSync(prefsFile) ? fs.readFileSync(prefsFile, "utf8") : null,
  );
  on("prefs:write", (_event, json) => {
    if (typeof json !== "string") return;
    try {
      fs.writeFileSync(prefsFile, json);
    } catch (e) {
      console.error(e);
    }
  });
  handle("prefs:export", async (_event, json) => {
    if (typeof json !== "string") return false;
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: "prefs.json",
    });
    if (canceled || !filePath) return false;
    fs.writeFileSync(filePath, json);
    return true;
  });
  on("app:setOpenAtLogin", (_event, openAtLogin) => {
    app.setLoginItemSettings({ openAtLogin: !!openAtLogin });
  });
  handle("shell:openExternal", (_event, url) => {
    const { protocol } = new URL(url);
    if (protocol !== "https:" && protocol !== "zoommtg:") {
      throw new Error("Blocked external URL: " + url);
    }
    return shell.openExternal(url);
  });
  handle("quickSupport:run", (event) => runQuickSupport(event));
  on("power:off", () => powerControl.powerOff());
  on("app:quit", () => app.quit());
}
function createUpdateWindow() {
  win = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
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
  registerIpc();
  on("autoUpdate", () => {
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
