const { contextBridge, ipcRenderer } = require("electron");

const listen = (channel) => (callback) => {
  ipcRenderer.on(channel, (_event, ...args) => callback(...args));
};

contextBridge.exposeInMainWorld("launcher", {
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  isOnline: () => ipcRenderer.invoke("net:isOnline"),
  readPrefs: () => ipcRenderer.invoke("prefs:read"),
  writePrefs: (json) => ipcRenderer.send("prefs:write", json),
  exportPrefs: (json) => ipcRenderer.invoke("prefs:export", json),
  setOpenAtLogin: (openAtLogin) =>
    ipcRenderer.send("app:setOpenAtLogin", !!openAtLogin),
  openZoom: (meetingId, password, name) =>
    ipcRenderer.invoke("zoom:join", meetingId, password, name),
  openReleasesPage: () => ipcRenderer.send("shell:openReleasesPage"),
  runQuickSupport: () => ipcRenderer.invoke("quickSupport:run"),
  powerOff: () => ipcRenderer.send("power:off"),
  quit: () => ipcRenderer.send("app:quit"),
  autoUpdate: () => ipcRenderer.send("autoUpdate"),
  onHideThenShow: listen("hideThenShow"),
  onUpdateDownloadProgress: listen("updateDownloadProgress"),
  onMacUpdate: listen("macUpdate"),
  onGoAhead: listen("goAhead"),
  onQuickSupportProgress: listen("quickSupport:progress"),
});
