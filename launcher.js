const axios = require("axios"),
  net = require("net"),
  remote = require("@electron/remote"),
  fs = require("graceful-fs"),
  loudness = require("loudness"),
  os = require("os"),
  path = require("path"),
  powerControl = require("power-control"),
  {shell} = require("electron"),
  $ = require("jquery");
const appPath = remote.app.getPath("userData"),
  localPrefsFile = path.join(appPath, "local-prefs.json"),
  prefsFile = path.join(appPath, "prefs.json");
var broadcastStrings = {},
  localPrefs = {},
  prefs = {},
  username = "User";
axios.defaults.adapter = require("axios/lib/adapters/http");
async function checkInternet() {
  try {
    if (await isReachable("www.zoom.us", 443)) {
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
  // if (prefs.updateUrl) {
  //   $(".syncedSettings input").prop("disabled", true);
  //   syncPrefs();
  // }
  updateCleanup();
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
  $("#version span.badge").html("v" + remote.app.getVersion());
  $("#overlayPleaseWait").fadeOut();
  if (os.platform() == "linux") {
    $(".notLinux").removeClass("d-flex").fadeOut();
  }
}
function isReachable(hostname, port) {
  return new Promise(resolve => {
    try {
      let client = net.createConnection(port, hostname);
      client.setTimeout(5000);
      client.on("timeout", () => {
        client.destroy("Timeout: " + hostname + ":" + port);
      });
      client.on("connect", function() {
        client.destroy();
        resolve(true);
      });
      client.on("error", function(e) {
        console.error(e);
        resolve(false);
      });
    } catch(err) {
      resolve(false);
    }
  });
}
$(".btn-add-link").on("click", function() {
  addNewLink();
  $(".links tbody tr").last().find(".linkType").change();
});
$(".links").on("click", ".btn-delete-link", function() {
  $(this).closest("tr").remove();
  if ($(".links tbody tr").length == 0) addNewLink();
  $(".links tbody tr").last().find(".linkName").change();
});
$(".links tbody").on("change", ".streamUrl", function() {
  $(this).val($(this).val().replace("https://fle.stream.jw.org/", ""));
});
$(".links tbody").on("change", ".linkName, .linkDetails input", function() {
  $(".btn-add-link").prop("disabled", !($(".linkType").filter(function() {
    return $(this).val().length === 0;
  }).length === 0 && $(".linkName:visible, .linkDetails:visible input").filter(function() {
    return !this.value;
  }).length === 0));
  let linkArray = [];
  $(".links tbody tr").each(function () {
    if ($(this).find(".linkType").val().length > 0) {
      linkArray.push($(this).find(".linkType, .linkName, .linkDetails input").map(function () { return $(this).val(); }).get());
    }
  });
  $("#linkArray").val(JSON.stringify(linkArray)).change();
});
$(".links tbody").on("change", ".linkType", function() {
  let linkType = $(this).val();
  let thisRow = $(this).closest("tr");
  thisRow.find(".linkDetails").empty();
  thisRow.find(".linkName").toggle(!!linkType);
  if (linkType === "zoom") {
    thisRow.find(".linkDetails").append("<input type='text' class='form-control form-control-sm zoomId' placeholder='Zoom meeting ID' /><input type='text' class='form-control form-control-sm zoomPassword' placeholder='Zoom meeting password' />");
  } else if (linkType === "stream") {
    thisRow.find(".linkDetails").append("<div class='input-group input-group-sm'><span class='input-group-text'>https://fle.stream.jw.org/</span><input type='text' class='form-control form-control-sm streamUrl' placeholder='t/ABCDEFGHIJKLOMNOPQRSTUVWXYZ' /></div>");
  }
});
function addNewLink() {
  $(".links tbody").append("<tr><td><button type='button' class='btn btn-danger btn-sm btn-delete-link'><i class='fas fa-minus'></i></button></td><td><select class='form-select form-select-sm linkType'><option value=''>Select a type</option><option value='zoom'>Zoom</option><option value='stream'>JW Stream</option></select></td><td><input type='text' class='form-control form-control-sm linkName' style='display: none;' placeholder='Enter a meaningful description' /></td><td><div class='linkDetails input-group'></div></td></tr>");
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
function generateButtons() {
  var colors = ["#03a9f4", "#d500f9", "#4caf50", "#f9a825", "#e64a19", "#ff4081", "#78909c", "#00bcd4"];
  $(".actions").empty();
  let links = $(".links tbody tr");
  for (let link = 0; link <links.length; link++) {
    $(".actions").append("<div class='buttonContainer py-2'><button type='button' class='align-items-center btn btn-lg btn-" + $(links[link]).find(".linkType").val() + " h-100 w-100' style='background-color: " + colors[(link % colors.length)] + "' data-link-details='" + $(links[link]).find(".linkDetails input").map(function () { return $(this).val(); }).get() + "'>" + $(links[link]).find(".linkName").val() + "</button></div>");
  }
  $(".actions .buttonContainer").css("height", 100 / Math.ceil($(".linkType").length / 3) + "%");
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
  for (var pref of [/*"updateUrl",*/ "linkArray", "labelShutdown", "labelRemoteAssistance", "labelSettings", "autoRunAtBoot", "hideShutdown", "hideRemoteAssistance", "targetVolume"]) {
    if (!(Object.keys(prefs).includes(pref)) || !prefs[pref]) {
      prefs[pref] = null;
    }
    if ($("#" + pref)[0].type == "text" || $("#" + pref)[0].type == "select-one" || $("#" + pref)[0].type == "range" || $("#" + pref)[0].type == "hidden") {
      $("#" + pref).val(prefs[pref]);
      if (pref == "linkArray") {
        if (prefs[pref]) {
          for (let link of JSON.parse(prefs[pref])) {
            addNewLink();
            $(".links tbody tr").last().find(".linkType").val(link[0]).change();
            link.shift();
            for (let linkPart = 0; linkPart < link.length; linkPart++) {
              $(".links tbody tr").last().find("input").eq(linkPart).val(link[linkPart]);
            }
          }
        } else {
          addNewLink();
        }
      }
    } else if ($("#" + pref)[0].type == "checkbox") {
      $("#" + pref).prop("checked", prefs[pref]);
    }
  }
}
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
  remote.app.setLoginItemSettings({
    openAtLogin: prefs.autoRunAtBoot
  });
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
        $(".featuredVideos .col:not(:first)").remove();
        var studioFeatured = (await getJson("https://b.jw-cdn.org/apis/mediator/v1/categories/" + prefs.broadcastLang + "/StudioFeatured?detailed=0&clientType=www")).category.media;
        var latestVideos = (await getJson("https://b.jw-cdn.org/apis/mediator/v1/categories/" + prefs.broadcastLang + "/LatestVideos?detailed=0&clientType=www")).category.media;
        let allVideos = studioFeatured.concat(latestVideos.filter(item => !studioFeatured.includes(item))).slice(0, 16);
        allVideos = [...new Map(allVideos.map(item => [item["guid"], item])).values()];
        for (var featuredVideo of allVideos) {
          videos++;
          var featuredVideoElement = $("<div class='col p-2'><div class='d-flex flex-column h-100 rounded bg-light' data-url='" + featuredVideo.files.slice(-1)[0].progressiveDownloadURL + "'><div class='row'><img style='width: 100%' src='" + featuredVideo.images.pnr.lg + "'/></div><div class='flex-grow-1 pt-2 px-2 d-flex align-items-center'><h5>" + featuredVideo.title + "</h5></div></div></div>").click(function() {
            $("#videoPlayer").append("<video controls autoplay></video>").fadeIn();
            $("#videoPlayer video").append("<source src='" + $(this).find("div").data("url") + "' / >");
          });
          $(".featuredVideos").append(featuredVideoElement);
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
  if (configIsValid) {
    generateButtons();
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
// function syncPrefs() {
//   axios.get($("#updateUrl").val()).then((res) => {
//     prefs = res.data;
//     fs.writeFileSync(prefsFile, JSON.stringify(prefs, null, 2));
//     prefsInitialize();
//     processSettings();
//   }).catch((error) => {
//     console.error(error);
//     $("#updateUrl").addClass("invalid");
//   });
// }
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
function updateCleanup() {
  if (prefs.link1Type) {
    let oldPrefs = [], newPrefs = [];
    for (let num of [1,2,3]) {
      let oldPref = {};
      for (let type of ["Type", "Desc", "Id", "Password", "Url"]) {
        if ("link" + num + type in prefs) {
          oldPref[type] = prefs["link" + num + type];
          delete prefs["link" + num + type];
        }
      }
      oldPrefs.push(oldPref);
    }
    for (let oldPref of oldPrefs) {
      let newPref = [oldPref.Type, oldPref.Desc];
      if (oldPref.Type == "zoom") newPref.push(oldPref.Id, oldPref.Password);
      if (oldPref.Type == "stream") newPref.push([oldPref.Url.replace("https://fle.stream.jw.org/", "")]);
      newPrefs.push(newPref);
    }
    prefs.linkArray = JSON.stringify(newPrefs);
    fs.writeFileSync(prefsFile, JSON.stringify(Object.keys(prefs).sort().reduce((acc, key) => ({...acc, [key]: prefs[key]}), {}), null, 2));
    remote.app.relaunch();
    remote.app.quit();
  }
}
$(".btnSettings, #btnSettings").on("click", function() {
  toggleScreen("overlaySettings");
});
$(".syncedSettings input, .syncedSettings select, input.syncedSettings").on("change", function() {
  if ($(this).prop("tagName") == "INPUT") {
    if ($(this).prop("type") == "checkbox") {
      prefs[$(this).prop("id")] = $(this).prop("checked");
    } else if ($(this).prop("type") == "radio") {
      prefs[$(this).closest("div").prop("id")] = $(this).closest("div").find("input:checked").val();
    } else if ($(this).prop("type") == "text" || $(this).prop("type") == "password" || $(this).prop("type") == "range" || $(this).prop("type") == "hidden") {
      prefs[$(this).prop("id")] = $(this).val();
    }
  } else if ($(this).prop("tagName") == "SELECT") {
    prefs[$(this).prop("id")] = $(this).find("option:selected").val();
  }
  fs.writeFileSync(prefsFile, JSON.stringify(Object.keys(prefs).sort().reduce((acc, key) => ({...acc, [key]: prefs[key]}), {}), null, 2));
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
  fs.writeFileSync(localPrefsFile, JSON.stringify(Object.keys(localPrefs).sort().reduce((acc, key) => ({...acc, [key]: localPrefs[key]}), {}), null, 2));
  processSettings();
});
$("#autoRunAtBoot").on("change", function() {
  remote.app.setLoginItemSettings({
    openAtLogin: prefs.autoRunAtBoot
  });
});
$("#broadcastLang").on("change", function() {
  $(".featuredVideos div:not(#btnGoHome):not(.lblGoHome)").remove();
});
// $("#updateUrl").on("change", function() {
//   if ($(this).val().length > 0) {
//     $(".syncedSettings input").prop("disabled", true);
//     syncPrefs();
//   } else {
//     prefs.updateUrl = $(this).val();
//     fs.writeFileSync(prefsFile, JSON.stringify(Object.keys(prefs).sort().reduce((acc, key) => ({...acc, [key]: prefs[key]}), {}), null, 2));
//     $(".syncedSettings input").prop("disabled", false);
//   }
// });
$("#btnShutdown").on("click", function() {
  powerControl.powerOff();
});
$("#btnExport").on("click", function() {
  var path = remote.dialog.showSaveDialogSync({
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
$(".streamingVideos").on("click", ".flex-column", function() {
  $("#videoPlayer").append("<video controls autoplay><source src='" + $(this).data("url") + "' / ></video>").fadeIn();
});
$(".actions").on("click", ".btn-zoom", function () {
  let linkDetails = $(this).data("link-details").split(",");
  shell.openExternal("zoommtg://zoom.us/join?confno=" + linkDetails[0] + "&pwd=" + linkDetails[1] + "&uname=" + username);
});
$(".actions").on("click", ".btn-stream", async function () {
  let linkDetails = "https://fle.stream.jw.org/" + $(this).data("link-details").split(",")[0];
  try {
    $("#videos>div").hide();
    $(".streamingVideos").first().parent().show();
    $(".streamingVideos .col:not(:first)").remove();
    toggleScreen("videos");
    var initialUrl = linkDetails;
    var streamReq = await axios.head(linkDetails);
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
      referer: decodeURIComponent(linkDetails),
      "accept-language": "en-CA,en;q=0.9,en-US;q=0.8,fr;q=0.7,ru;q=0.6",
      cookie: "sessionstream=" + cookies.sessionstream + "; XSRF-TOKEN=" + cookies["XSRF-TOKEN"] + "; AWSALB=" + cookies.AWSALB + "; AWSALBCORS=" + cookies.AWSALBCORS,
      "sec-fetch-site": "same-origin",
      "sec-fetch-mode": "cors",
      "sec-fetch-dest": "empty",
      "sec-ch-ua-mobile": "?0",
      dnt: "1"
    };
    streamReq = await axios.get("https://fle.stream.jw.org/language/getlanguages", {
      headers: tempHeaders
    });
    for (let cookie of streamReq.headers["set-cookie"]) {
      cookies[cookie.split("=")[0]] = cookie.split("=")[1].split(";")[0];
    }
    var streamLangs = streamReq.data.languages;
    for (let cookie of streamReq.headers["set-cookie"]) {
      cookies[cookie.split("=")[0]] = cookie.split("=")[1].split(";")[0];
    }
    delete tempHeaders["content-length"];
    tempHeaders["x-xsrf-token"] = cookies["XSRF-TOKEN"];
    tempHeaders.cookie = "sessionstream=" + cookies.sessionstream + "; XSRF-TOKEN=" + cookies["XSRF-TOKEN"] + "; AWSALB=" + cookies.AWSALB + "; AWSALBCORS=" + cookies.AWSALBCORS;
    var tempContent = JSON.stringify({
      token: decodeURIComponent(initialUrl).split("/").slice(-1)[0]
    });
    streamReq = await axios.post("https://fle.stream.jw.org/token/check", tempContent, {
      headers: tempHeaders,
    });
    for (let cookie of streamReq.headers["set-cookie"]) {
      cookies[cookie.split("=")[0]] = cookie.split("=")[1].split(";")[0];
    }
    tempHeaders["content-length"] = "0";
    tempHeaders["x-xsrf-token"] = cookies["XSRF-TOKEN"];
    tempHeaders.cookie = "sessionstream=" + cookies.sessionstream + "; XSRF-TOKEN=" + cookies["XSRF-TOKEN"] + "; AWSALB=" + cookies.AWSALB + "; AWSALBCORS=" + cookies.AWSALBCORS;
    streamReq = await axios.get("https://fle.stream.jw.org/member/getinfo", {
      headers: tempHeaders
    });
    var streamLang = streamReq.data.data.language;
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
    streamReq = await axios.post("https://fle.stream.jw.org/event/languageVideos", tempContent, {
      headers: tempHeaders
    });
    var streamFiles = streamReq.data;
    for (let cookie of streamReq.headers["set-cookie"]) {
      cookies[cookie.split("=")[0]] = cookie.split("=")[1].split(";")[0];
    }
    tempHeaders["x-xsrf-token"] = cookies["XSRF-TOKEN"];
    tempHeaders.referer = "https://fle.stream.jw.org/video/";
    tempHeaders.cookie = "sessionstream=" + cookies.sessionstream + "; XSRF-TOKEN=" + cookies["XSRF-TOKEN"] + "; AWSALB=" + cookies.AWSALB + "; AWSALBCORS=" + cookies.AWSALBCORS;
    //streamFiles = streamFiles.sort((a, b) => (a.data.origevent > b.data.origevent) ? 1 : -1);
    var streamLabels = await getJson("https://prod-assets.stream.jw.org/translations/" + langSymbol + ".json");
    $("#lblGoHome2").html(streamLabels.translations[langSymbol]["button_previous"]);
    for (var streamFile of streamFiles) {
      var mediaFile = await axios.head(streamFile.vod_firstfile_url, {
        headers: {
          Cookie: "sessionstream=" + cookies.sessionstream + "; XSRF-TOKEN=" + cookies["XSRF-TOKEN"] + "; AWSALB=" + cookies.AWSALB + "; AWSALBCORS=" + cookies.AWSALBCORS
        }
      });
      $(".streamingVideos").append("<div class='col p-2'><div class='d-flex flex-column h-100 rounded bg-light' data-url='" + mediaFile.request.protocol + "//" + mediaFile.request.host + mediaFile.request.path + "'><div class='flex-grow-1 pt-2 px-2 d-flex align-items-center'><h2>" + streamFile.description + "</h2></div></div></div>");
    }
  } catch(err) {
    toggleScreen("overlaySettings", true);
    console.error(linkDetails, err);
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
$(".links").on("keypress", ".zoomId", function(e){ // cmd/ctrl || arrow keys || delete key || numbers
  return e.metaKey || e.which <= 0 || e.which === 8 || /[0-9]/.test(String.fromCharCode(e.which));
});
