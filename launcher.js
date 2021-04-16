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
    curl = require("urllib"),
    fs = require("graceful-fs"),
    loudness = require("loudness"),
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
      } else if ($(this).prop("type") == "text" || $(this).prop("type") == "password" || $(this).prop("type") == "range") {
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
  $("#broadcast1button").on("click", function() {
    $("#videos>div").show();
    $(".streamingVideos").first().parent().hide();
    $("#videoPlayer").hide();
    toggleScreen("videos");
  });
  $("#btnGoHome, #btnGoHome2").on("click", function() {
    toggleScreen("videos");
    $("#lblGoHome2").html("");
  });
  $(".streamingVideos").on("click", ".card:not(#btnGoHome2)", function() {
    $("#videoPlayer").append("<video controls autoplay><source src='" + $(this).data("url") + "' / ></video>").fadeIn();
  });

  $("#link1Button, #link2Button, #link3Button").on("click", async function () {
    var linkButton = $(this).prop("id").replace(/\D/g, "");
    try {
      if ($("#link" + linkButton + "Type").val() == "zoom") {
        shell.openExternal("zoommtg://zoom.us/join?confno=" + $("#link" + linkButton + "Id").val() + "&pwd=" + $("#link" + linkButton + "Password").val() + "&uname=" + username);
      } else {
        $("#videos>div").hide();
        $(".streamingVideos").first().parent().show();
        $(".streamingVideos .card:not(#btnGoHome2)").remove();
        toggleScreen("videos");
        var tempUrl = $("#link" + linkButton + "Url").val();
        var initialUrl = tempUrl;
        var streamReq = await curl.request(tempUrl);
        var cookies = {};
        for (let cookie of streamReq.headers["set-cookie"]) {
          cookies[cookie.split("=")[0]] = cookie.split("=")[1].split(";")[0];
        }

        var tempHeaders = {
          authority: "fle.stream.jw.org",
          "content-length": "0",
          "sec-ch-ua": "\"Google Chrome\";v=\"89\", \"Chromium\";v=\"89\", \";Not A Brand\";v=\"99\"",
          "x-xsrf-token": cookies["XSRF-TOKEN"],
          accept: "application/json, text/plain, */*",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.128 Safari/537.36",
          "x-requested-with": "XMLHttpRequest",
          origin: "https://fle.stream.jw.org",
          referer: decodeURIComponent(tempUrl),
          "accept-language": "en-CA,en;q=0.9,en-US;q=0.8,fr;q=0.7,ru;q=0.6",
          cookie: "sessionstream=" + cookies.sessionstream + "; XSRF-TOKEN=" + cookies["XSRF-TOKEN"] + "; AWSALB=" + cookies.AWSALB + "; AWSALBCORS=" + cookies.AWSALBCORS,
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "cors",
          "sec-fetch-dest": "empty",
          "sec-ch-ua-mobile": "?0",
          dnt: "1"
        };

        tempUrl = "https://fle.stream.jw.org/language/getlanguages";
        streamReq = await curl.request(tempUrl, {
          method: "POST",
          headers: tempHeaders
        });
        for (let cookie of streamReq.headers["set-cookie"]) {
          cookies[cookie.split("=")[0]] = cookie.split("=")[1].split(";")[0];
        }
        var streamLangs = JSON.parse(streamReq.data.toString()).languages;

        for (let cookie of streamReq.headers["set-cookie"]) {
          cookies[cookie.split("=")[0]] = cookie.split("=")[1].split(";")[0];
        }
        delete tempHeaders["content-length"];
        tempHeaders["x-xsrf-token"] = cookies["XSRF-TOKEN"];
        tempHeaders.cookie = "sessionstream=" + cookies.sessionstream + "; XSRF-TOKEN=" + cookies["XSRF-TOKEN"] + "; AWSALB=" + cookies.AWSALB + "; AWSALBCORS=" + cookies.AWSALBCORS;
        var tempContent = JSON.stringify({
          token: decodeURIComponent(initialUrl).split("/").slice(-1)[0]
        });
        tempUrl = "https://fle.stream.jw.org/token/check";
        streamReq = await curl.request(tempUrl, {
          method: "POST",
          headers: tempHeaders,
          content: tempContent
        });

        for (let cookie of streamReq.headers["set-cookie"]) {
          cookies[cookie.split("=")[0]] = cookie.split("=")[1].split(";")[0];
        }
        tempHeaders["content-length"] = "0";
        tempHeaders["x-xsrf-token"] = cookies["XSRF-TOKEN"];
        tempHeaders.cookie = "sessionstream=" + cookies.sessionstream + "; XSRF-TOKEN=" + cookies["XSRF-TOKEN"] + "; AWSALB=" + cookies.AWSALB + "; AWSALBCORS=" + cookies.AWSALBCORS;
        tempUrl = "https://fle.stream.jw.org/member/getinfo";
        streamReq = await curl.request(tempUrl, {
          method: "POST",
          headers: tempHeaders
        });

        var streamLang = JSON.parse(streamReq.data.toString()).data.language;
        for (let cookie of streamReq.headers["set-cookie"]) {
          cookies[cookie.split("=")[0]] = cookie.split("=")[1].split(";")[0];
        }
        delete tempHeaders["content-length"];
        tempHeaders["x-xsrf-token"] = cookies["XSRF-TOKEN"];
        tempHeaders.referer = "https://fle.stream.jw.org/video/" + streamLang;
        tempHeaders.cookie = "sessionstream=" + cookies.sessionstream + "; XSRF-TOKEN=" + cookies["XSRF-TOKEN"] + "; AWSALB=" + cookies.AWSALB + "; AWSALBCORS=" + cookies.AWSALBCORS;
        tempContent = JSON.stringify({
          language: streamLangs.filter(lang => lang.locale == streamLang)[0]
        });
        var langSymbol = streamLangs.filter(lang => lang.locale == streamLang)[0].symbol;
        tempUrl = "https://fle.stream.jw.org/event/languageVideos";
        streamReq = await curl.request(tempUrl, {
          method: "POST",
          headers: tempHeaders,
          content: tempContent
        });
        var streamFiles = JSON.parse(streamReq.data.toString());
        for (let cookie of streamReq.headers["set-cookie"]) {
          cookies[cookie.split("=")[0]] = cookie.split("=")[1].split(";")[0];
        }
        tempHeaders["x-xsrf-token"] = cookies["XSRF-TOKEN"];
        tempHeaders.referer = "https://fle.stream.jw.org/video/";
        tempHeaders.cookie = "sessionstream=" + cookies.sessionstream + "; XSRF-TOKEN=" + cookies["XSRF-TOKEN"] + "; AWSALB=" + cookies.AWSALB + "; AWSALBCORS=" + cookies.AWSALBCORS;
        streamFiles = streamFiles.sort((a, b) => (a.data.origevent > b.data.origevent) ? 1 : -1);
        var streamLabels = await getJson("https://prod-assets.stream.jw.org/translations/" + langSymbol + ".json");
        // button_previous
        $("#lblGoHome2").html(streamLabels.translations[langSymbol]["button_previous"]);
        for (var streamFile of streamFiles) {
          console.log(streamFile);
          var mediaFile = await curl.request(streamFile.vod_firstfile_url, {
            method: "HEAD",
            headers: {
              Cookie: "sessionstream=" + cookies.sessionstream + "; XSRF-TOKEN=" + cookies["XSRF-TOKEN"] + "; AWSALB=" + cookies.AWSALB + "; AWSALBCORS=" + cookies.AWSALBCORS
            },
            followRedirect: true
          });
          $(".streamingVideos").append("\
            <div class=\"card mx-3 rounded\" style=\"width: 18rem;\" data-url=\"" + mediaFile.res.requestUrls.slice(-1)[0] + "\"> \
              <div class=\"card-body\"> \
                <h5 class=\"card-title break-please\"> \
                  " + streamFile.description +" \
                </h5> \
              </div> \
            </div>");
        }
      }
    } catch(err) {
      toggleScreen("overlaySettings", true);
      $("#link" + linkButton + "Id, #link" + linkButton + "Password").addClass("invalid").change();
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
  $("#link1Id, #link2Id, #link3Id").keyup(function (event) {
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
    console.log();
    if (prefs.targetVolume == 0) {
      loudness.setMuted(true);
    } else {
      loudness.setMuted(false);
      loudness.setVolume(prefs.targetVolume);
    }
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
      if ($("#link" + elem + "Desc").val() == "false" || $("#link" + elem + "Desc").val() == "null") {
        $("#link" + elem + "Desc").val("");
      }
      if (!$("#link" + elem + "Desc").val()) {
        $("#link" + elem + "Id, #link" + elem + "Password").prop("disabled", true).val("");
        $("#link" + elem + "Button").fadeOut();
      } else {
        $("#link" + elem + "Button").html($("#link" + elem + "Desc").val());
        if (!$("#link" + elem + "Id").val() || !$("#link" + elem + "Password").val()) {
          $("#link" + elem + "Id, #link" + elem + "Password").addClass("invalid").prop("disabled", false);
          configIsValid = false;
        } else {
          $("#link" + elem + "Button").fadeIn();
        }
      }
      if (!$("#link1Desc").val() && !$("#link2Desc").val() && !$("#link3Desc").val()) {
        $("#link1Desc").addClass("invalid");
        configIsValid = false;
      }
      if ($("#link" + elem + "Type").val() == "zoom") {
        $(".link" + elem + "UrlContainer").hide().removeClass("d-flex");
        $(".link" + elem + "ZoomContainer").addClass("d-flex").show();
      } else {
        $(".link" + elem + "ZoomContainer").hide().removeClass("d-flex");
        $(".link" + elem + "UrlContainer").addClass("d-flex").show();
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
    for (var pref of ["updateUrl", "link1Desc", "link1Type", "link1Url", "link1Id", "link1Password", "link2Desc", "link2Type", "link2Url", "link2Id", "link2Password", "link3Desc", "link3Type", "link3Url", "link3Id", "link3Password", "labelShutdown", "labelRemoteAssistance", "labelSettings", "autoRunAtBoot", "hideShutdown", "hideRemoteAssistance", "targetVolume"]) {
      if (!(Object.keys(prefs).includes(pref)) || !prefs[pref]) {
        prefs[pref] = null;
      }
      if ($("#" + pref)[0].type == "text" || $("#" + pref)[0].type == "select-one" || $("#" + pref)[0].type == "range") {
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
