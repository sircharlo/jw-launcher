const isPortReachable = require("is-port-reachable"),
  remoteApp = require("@electron/remote").app,
  remoteDialog = require("@electron/remote").dialog,
  {shell} = require("electron"),
  $ = require("jquery");
async function checkInternet() {
  try {
    let zoomUs = await isPortReachable(443, {
      host: "www.zoom.us"
    });
    if (zoomUs) {
      require("electron").ipcRenderer.send("autoUpdate");
    } else {
      require("electron").ipcRenderer.send("noInternet");
    }
  } catch (err) {
    console.error(err);
  }
}

checkInternet();

require("electron").ipcRenderer.on("checkInternet", () => {
  checkInternet();
});

require("electron").ipcRenderer.on("hideThenShow", (event, message) => {
  $("#overlay" + message[1]).fadeIn(400, () => {
    $("#overlay" + message[0]).fadeOut();
  });
});

require("electron").ipcRenderer.on("updateDownloadProgress", (event, message) => {
  var dotsDone = Math.floor(parseFloat(message[0]) / 10);
  $("#updatePercent i:nth-of-type(" + dotsDone + ")").addClass("fa-circle text-primary").removeClass("fa-dot-circle");
});

require("electron").ipcRenderer.on("macUpdate", () => {
  $("#btn-mac-update").fadeIn().click(function() {
    shell.openExternal("https://github.com/sircharlo/jw-launcher/releases/latest");
  });
});

require("electron").ipcRenderer.on("goAhead", () => {
  $("#overlayPleaseWait").fadeIn(400, () => {
    $("#overlayUpdateCheck").fadeOut();
    goAhead();
  });
});

function goAhead() {
  const axios = require("axios"),
    fs = require("graceful-fs"),
    os = require("os"),
    path = require("path"),
    powerControl = require("power-control"),
    appPath = remoteApp.getPath("userData"),
    localPrefsFile = path.join(appPath, "local-prefs.json"),
    prefsFile = path.join(appPath, "prefs.json");

  var localPrefs = {},
    prefs = {},
    username = "User";

  if (fs.existsSync(prefsFile)) {
    try {
      prefs = JSON.parse(fs.readFileSync(prefsFile));
    } catch (err) {
      console.error(err);
    }
    prefsInitialize();
  }
  if (fs.existsSync(localPrefsFile)) {
    try {
      localPrefs = JSON.parse(fs.readFileSync(localPrefsFile));
      console.log(localPrefsFile);
    } catch (err) {
      console.error(err);
    }
    localPrefsInitialize();
  }
  processSettings();
  if (prefs.updateUrl) {
    $(".syncedSettings input").prop("disabled", true);
    syncPrefs();
  }
  $("#version span.badge").html("v" + remoteApp.getVersion());
  $("#overlayPleaseWait").fadeOut();
  if (os.platform() == "linux") {
    $(".notLinux").removeClass("d-flex").fadeOut();
  }
  $(".btnSettings, #btnSettings").on("click", function() {
    toggleScreen("overlaySettings");
  });
  $(".syncedSettings input, .syncedSettings select").on("change", function() {
    if ($(this).prop("tagName") == "INPUT") {
      if ($(this).prop("type") == "checkbox") {
        prefs[$(this).prop("id")] = $(this).prop("checked");
      } else if ($(this).prop("type") == "radio") {
        prefs[$(this).closest("div").prop("id")] = $(this).closest("div").find("input:checked").val();
      } else if ($(this).prop("type") == "text" || $(this).prop("type") == "password") {
        prefs[$(this).prop("id")] = $(this).val();
      }
    } else if ($(this).prop("tagName") == "SELECT") {
      prefs[$(this).prop("id")] = $(this).find("option:selected").val();
    }
    fs.writeFileSync(prefsFile, JSON.stringify(prefs, null, 2));
    processSettings();
  });
  $(".localSettings input, .localSettings select").on("change", function() {
    if ($(this).prop("tagName") == "INPUT") {
      if ($(this).prop("type") == "checkbox") {
        localPrefs[$(this).prop("id")] = $(this).prop("checked");
      } else if ($(this).prop("type") == "radio") {
        localPrefs[$(this).closest("div").prop("id")] = $(this).closest("div").find("input:checked").val();
      } else if ($(this).prop("type") == "text" || $(this).prop("type") == "password") {
        localPrefs[$(this).prop("id")] = $(this).val();
      }
    } else if ($(this).prop("tagName") == "SELECT") {
      localPrefs[$(this).prop("id")] = $(this).find("option:selected").val();
    }
    fs.writeFileSync(localPrefsFile, JSON.stringify(localPrefs, null, 2));
    processSettings();
  });
  $("#autoRunAtBoot").on("change", function() {
    remoteApp.setLoginItemSettings({
      openAtLogin: prefs.autoRunAtBoot
    });
  });
  $("#updateUrl").on("change", function() {
    if ($(this).val().length > 0) {
      $(".syncedSettings input").prop("disabled", true);
      syncPrefs();
    } else {
      prefs.updateUrl = $(this).val();
      fs.writeFileSync(prefsFile, JSON.stringify(prefs, null, 2));
      $(".syncedSettings input").prop("disabled", false);
    }
  });
  $("#btnShutdown").on("click", function() {
    powerControl.powerOff();
  });
  $("#btnExport").on("click", function() {
    var path = remoteDialog.showSaveDialogSync({
      defaultPath : "prefs.json"
    });
    console.log(path);
    fs.writeFileSync(path, JSON.stringify(prefs, null, 2));

  });
  $("#zoom1Button, #zoom2Button, #zoom3Button").on("click", function () {
    var zoomButton = $(this).prop("id").replace(/\D/g, "");
    try {
      var zoomUrl = $("#zoom" + zoomButton + "Url").val();
      var zoomArr = zoomUrl.split("/").pop().split("?");
      var zoomId = zoomArr[0];
      var zoomEncodedPwd = zoomArr[1].split("=").pop();
      shell.openExternal("zoommtg://zoom.us/join?confno=" + zoomId + "&pwd=" + zoomEncodedPwd + "&uname=" + username);
    } catch(err) {
      toggleScreen("overlaySettings", true);
      $("#zoom" + zoomButton + "Url").val("").addClass("invalid").change();
      console.error(err);
    }
  });
  $("#btnRemoteAssistance").on("click", async function() {
    var qsUrl = "https://download.teamviewer.com/download/TeamViewerQS.exe";
    if (os.platform() == "darwin") {
      qsUrl = "https://download.teamviewer.com/download/TeamViewerQS.dmg";
    } else if (os.platform() == "linux") {
      qsUrl = "https://download.teamviewer.com/download/version_11x/teamviewer_qs.tar.gz";
    }
    var initialTriggerText = $(this).html();
    $(this).prop("disabled", true);
    var qs = await downloadFile(qsUrl, this);
    var qsFilename = path.basename(qsUrl);
    fs.writeFileSync(path.join(appPath, qsFilename), new Buffer(qs));
    shell.openExternal(path.join(appPath, qsFilename));
    $(this).html(initialTriggerText).prop("disabled", false);

  });
  function processSettings() {
    var configIsValid = true;
    console.log(prefs, localPrefs);
    for (var label of ["Settings", "Shutdown", "RemoteAssistance"]) {
      $("#lbl" + label).html(prefs["label" + label]);
      console.log("#lbl" + label, prefs["label" + label]);
    }
    for (var hideMe of ["Shutdown", "RemoteAssistance"]) {
      if (prefs["hide" + hideMe]) {
        $("#btn" + hideMe).fadeOut();
      } else {
        $("#btn" + hideMe).fadeIn();
      }
    }
    remoteApp.setLoginItemSettings({
      openAtLogin: prefs.autoRunAtBoot
    });
    if (localPrefs.username) {
      username = localPrefs.username;
    }
    $("#overlaySettings label.text-danger").removeClass("text-danger");
    $("#overlaySettings .invalid").removeClass("invalid").prop("disabled", false);
    for (var elem of ["1", "2", "3"]) {
      if ($("#zoom" + elem + "Desc").val() == "false" || $("#zoom" + elem + "Desc").val() == "null") {
        $("#zoom" + elem + "Desc").val("");
      }
      if (!$("#zoom" + elem + "Desc").val()) {
        $("#zoom" + elem + "Url").prop("disabled", true).val("");
        $("#zoom" + elem + "Button").fadeOut();
      } else {
        $("#zoom" + elem + "Button").html($("#zoom" + elem + "Desc").val());
        if (!$("#zoom" + elem + "Url").val()) {
          $("#zoom" + elem + "Url").addClass("invalid").prop("disabled", false);
          configIsValid = false;
        } else {
          $("#zoom" + elem + "Button").fadeIn();
        }
      }
      //  }
      if (!$("#zoom1Desc").val() && !$("#zoom2Desc").val() && !$("#zoom3Desc").val()) {
        $("#zoom1Desc").addClass("invalid");
        configIsValid = false;
      }
      $("#overlaySettings .invalid").each(function() {
        $(this).closest("div.flex-row").find("label").addClass("text-danger");
      });
    }
    if (configIsValid) {
      $(".btnSettings").prop("disabled", false).addClass("btn-primary").removeClass("btn-danger");
      $("#settingsIcon").addClass("text-muted").removeClass("text-danger");
      return true;
    } else {
      $(".btnSettings").prop("disabled", true).addClass("btn-danger").removeClass("btn-primary");
      $("#settingsIcon").addClass("text-danger").removeClass("text-muted");
      console.log(prefs);
      toggleScreen("overlaySettings", true);
      return false;
    }
  }
  async function downloadFile(url, triggerElem) {
    try {
      let response = await axios.get(url, {
        responseType: "arraybuffer",
        onDownloadProgress: function(progressEvent) {
          var percent = progressEvent.loaded / progressEvent.total * 100;
          $(triggerElem).html(percent.toFixed(0) + "%");
        }
      });
      return response.data;
    } catch (err) {
      console.error(err);
      return err;
    }
  }
  function localPrefsInitialize() {
    for (var localPref of ["username"]) {
      if (!(Object.keys(localPrefs).includes(localPref)) || !localPrefs[localPref]) {
        localPrefs[localPref] = null;
      }
      if ($("#" + localPref)[0].type == "text") {
        $("#" + localPref).val(localPrefs[localPref]);
      } else if ($("#" + localPref)[0].type == "checkbox") {
        $("#" + localPref).prop("checked", localPref[localPref]);
      }
    }
  }
  function prefsInitialize() {
    for (var pref of ["updateUrl", "zoom1Desc", "zoom1Url", "zoom2Desc", "zoom2Url", "zoom3Desc", "zoom3Url", "labelShutdown", "labelRemoteAssistance", "labelSettings", "autoRunAtBoot", "hideShutdown", "hideRemoteAssistance"]) {
      if (!(Object.keys(prefs).includes(pref)) || !prefs[pref]) {
        prefs[pref] = null;
      }
      if ($("#" + pref)[0].type == "text") {
        $("#" + pref).val(prefs[pref]);
      } else if ($("#" + pref)[0].type == "checkbox") {
        $("#" + pref).prop("checked", prefs[pref]);
      }
    }
  }
  function syncPrefs() {
    axios.get($("#updateUrl").val()).then((res) => {
      prefs = res.data;
      fs.writeFileSync(prefsFile, JSON.stringify(prefs, null, 2));
      prefsInitialize();
      processSettings();
    }).catch((error) => {
      console.error(error);
      $("#updateUrl").addClass("invalid");
    });
  }
  function toggleScreen(screen, forceShow, forceHide) {
    var visible = $("#" + screen).is(":visible");
    if (forceShow) {
      $("#" + screen).slideDown("fast");
    } else if (forceHide) {
      $("#" + screen).slideUp("fast");
    } else if (visible) {
      $("#" + screen).slideUp("fast");
    } else {
      $("#" + screen).slideDown("fast");
    }
  }
}
