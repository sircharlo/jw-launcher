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

  var broadcastStrings = {},
    localPrefs = {},
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
  (async () => {
    var req = await getJson("https://b.jw-cdn.org/apis/mediator/v1/languages/E/all?clientType=www");
    for (var lang of req.languages) {
      $("#broadcastLang").append($("<option>", {
        value: lang.code,
        text: lang.vernacular + " (" + lang.name + ")"
      }));
    }
    $("#broadcastLang").val(prefs.broadcastLang);
    $("#broadcastLang").select2();
  })();
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
  $("#broadcastLang").on("change", function() {
    $(".featuredVideos div:not(#btnGoHome):not(.lblGoHome), .latestVideos div").remove();
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
    fs.writeFileSync(path, JSON.stringify(prefs, null, 2));
  });
  $("#closeButton").on("click", function() {
    $("#videoPlayer").fadeOut();
    $("#videoPlayer video").remove();
  });
  $("#broadcast1button, #btnGoHome").on("click", function() {
    toggleScreen("videos");
  });
  $("#zoom1Button, #zoom2Button, #zoom3Button").on("click", function () {
    var zoomButton = $(this).prop("id").replace(/\D/g, "");
    try {
      shell.openExternal("zoommtg://zoom.us/join?confno=" + $("#zoom" + zoomButton + "Id").val() + "&pwd=" + $("#zoom" + zoomButton + "Password").val() + "&uname=" + username);
    } catch(err) {
      toggleScreen("overlaySettings", true);
      $("#zoom" + zoomButton + "Id, #zoom" + zoomButton + "Password").val("").addClass("invalid").change();
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
  $("#zoom1Id, #zoom2Id, #zoom3Id").keyup(function (event) {
    if (event.which != 8 && event.which != 0 && event.which < 48 || event.which > 57) {
      $(this).val(function (index, value) {
        return value.replace(/\D/g, "");
      });
    }
  });
  function processSettings() {
    var configIsValid = true;
    for (var label of ["Settings", "Shutdown", "RemoteAssistance"]) {
      $("#lbl" + label).html(prefs["label" + label]);
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
    if (prefs.broadcastLang) {
      (async () => {
        let req = await getJson("https://b.jw-cdn.org/apis/mediator/v1/translations/" + prefs.broadcastLang);
        broadcastStrings = req.translations[prefs.broadcastLang];
        $("#broadcast1button").html(broadcastStrings.ttlHome);
        $("#lblGoHome").html(broadcastStrings.btnStillWatchingGoBack);
        var videos = 0;
        try {
          var studioFeatured = await getJson("https://b.jw-cdn.org/apis/mediator/v1/categories/" + prefs.broadcastLang + "/StudioFeatured?detailed=0&clientType=www");
          for (var featuredVideo of studioFeatured.category.media.slice(0, 3)) {
            videos++;
            var featuredVideoElement = $("<div class='col-3 d-flex flex-column bg-light mx-3 rounded' data-url='" + featuredVideo.files.slice(-1)[0].progressiveDownloadURL + "'>" +
            "<div class='row'>" +
                "<img style='width: 100%' src='" + featuredVideo.images.pnr.lg + "'/>" +
            "</div>" +
            "<div class='flex-grow-1 pt-2 d-flex align-items-center'>" +
              "<h5>" + featuredVideo.title + "</h5>" +
            "</div>" +
          "</div>").click(function() {
              $("#videoPlayer").append("<video controls autoplay></video>").fadeIn();
              $("#videoPlayer video").append("<source src='" + $(this).data("url") + "' / >");
            });
            $(".featuredVideos").append(featuredVideoElement);
          }
        } catch(err) {
          console.error(err);
        }
        try {
          var latestVideos = await getJson("https://b.jw-cdn.org/apis/mediator/v1/categories/" + prefs.broadcastLang + "/LatestVideos?detailed=0&clientType=www");
          for (var latestVideo of latestVideos.category.media.slice(0, 12)) {
            videos++;
            var latestVideoElement = $("<div class='col-3 d-inline-flex flex-column py-3' data-url='" + latestVideo.files.slice(-1)[0].progressiveDownloadURL + "'>" +
            "<div class='rounded-top'>" +
                "<img style='width: 100%' src='" + latestVideo.images.pnr.lg + "'/>" +
            "</div>" +
            "<div class='flex-grow-1 pt-2 d-flex align-items-center bg-light text-dark px-3 rounded-bottom'>" +
              "<h6>" + latestVideo.title + "</h6>" +
            "</div>" +
          "</div>").click(function() {
              $("#videoPlayer").append("<video controls autoplay></video>").fadeIn();
              $("#videoPlayer video").append("<source src='" + $(this).data("url") + "' / >");
            });
            $(".latestVideos").append(latestVideoElement);
          }
        } catch(err) {
          console.error(err);
        }
        if (videos > 0) {
          $("#broadcast1button").parent().fadeIn();
        } else {
          $("#broadcast1button").parent().fadeOut();
        }
      })();
    }
    $("#overlaySettings label.text-danger").removeClass("text-danger");
    $("#overlaySettings .invalid").removeClass("invalid").prop("disabled", false);
    for (var elem of ["1", "2", "3"]) {
      if ($("#zoom" + elem + "Desc").val() == "false" || $("#zoom" + elem + "Desc").val() == "null") {
        $("#zoom" + elem + "Desc").val("");
      }
      if (!$("#zoom" + elem + "Desc").val()) {
        $("#zoom" + elem + "Id, #zoom" + elem + "Password").prop("disabled", true).val("");
        $("#zoom" + elem + "Button").fadeOut();
      } else {
        $("#zoom" + elem + "Button").html($("#zoom" + elem + "Desc").val());
        if (!$("#zoom" + elem + "Id").val() || !$("#zoom" + elem + "Password").val()) {
          $("#zoom" + elem + "Id, #zoom" + elem + "Password").addClass("invalid").prop("disabled", false);
          configIsValid = false;
        } else {
          $("#zoom" + elem + "Button").fadeIn();
        }
      }
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
  async function getJson(url) {
    let response = null,
      payload = null;
    try {
      payload = await axios.get(url);
      response = payload.data;
    } catch (err) {
      console.error(err, payload);
    }
    return response;
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
    for (var pref of ["updateUrl", "zoom1Desc", "zoom1Id", "zoom1Password", "zoom2Desc", "zoom2Id", "zoom2Password", "zoom3Desc", "zoom3Id", "zoom3Password", "labelShutdown", "labelRemoteAssistance", "labelSettings", "autoRunAtBoot", "hideShutdown", "hideRemoteAssistance"]) {
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
