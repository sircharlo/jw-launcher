const axios = require("axios"),
  net = require("net"),
  remote = require("@electron/remote"),
  fs = require("graceful-fs"),
  os = require("os"),
  path = require("path"),
  powerControl = require("power-control"),
  {shell} = require("electron"),
  $ = require("jquery");
const appPath = remote.app.getPath("userData"),
  //          green      pink       blue     deeporange   purple     yellow      cyen      brown
  colors = ["#00e676", "#ff80ab", "#64b5f6", "#ffb74d", "#ea80fc", "#ffff8d", "#18ffff", "#bcaaa4"],
  prefsFile = path.join(appPath, "prefs.json");
var broadcastStrings = {},
  prefs = {};
axios.defaults.adapter = require("axios/lib/adapters/http");
function checkInternet(online) {
  if (online) {
    $("#overlayInternetCheck").fadeIn("fast", () => {
      $("#overlayInternetFail").stop().hide();
    });
    require("electron").ipcRenderer.send("autoUpdate");
  } else {
    $("#overlayInternetFail").fadeIn("fast", () => {
      $("#overlayInternetCheck").stop().hide();
    });
    setTimeout(updateOnlineStatus, 1000);
  }
}
const updateOnlineStatus = async () => {
  checkInternet((await isReachable("www.jw.org", 443)));
};
updateOnlineStatus();
require("electron").ipcRenderer.on("hideThenShow", (event, message) => {
  $("#overlay" + message[1]).fadeIn(400, () => {
    $("#overlay" + message[0]).hide();
  });
});
require("electron").ipcRenderer.on("updateDownloadProgress", (event, message) => {
  var dotsDone = Math.floor(parseFloat(message[0]) / 10);
  $("#updatePercent i:nth-of-type(" + dotsDone + ")").addClass("fa-circle text-primary").removeClass("fa-dot-circle");
});
require("electron").ipcRenderer.on("macUpdate", () => {
  $("#btn-mac-update").click(function() {
    shell.openExternal("https://github.com/sircharlo/jw-launcher/releases/latest");
  }).parent().fadeIn();
});
require("electron").ipcRenderer.on("goAhead", () => {
  $("#overlayPleaseWait").fadeIn(400, () => {
    $("#overlayUpdateCheck").hide();
    goAhead();
  });
});
function goAhead() {
  if (fs.existsSync(prefsFile)) {
    try {
      prefs = JSON.parse(fs.readFileSync(prefsFile));
      updateCleanup();
    } catch (err) {
      console.error(err);
    }
    prefsInitialize();
  }
  processSettings();
  $("#version span.badge").html("v" + remote.app.getVersion());
  $("#overlayPleaseWait").fadeOut();
  if (os.platform() == "linux") {
    $(".notLinux").removeClass("d-flex").fadeOut();
  }
  window.addEventListener("keyup", handleKeyPress, true);
}
function handleKeyPress (event) {
  if (event.code.includes("Key") && !$("#overlayPleaseWait").is(":visible") && !(event.ctrlKey || event.metaKey || event.shiftKey)) {
    if ($("#home").is(":visible")) {
      if (event.key.toLowerCase() == String.fromCharCode($(".links tbody tr").length + 65).toLowerCase()) {
        $("#broadcast1button").click();
      } else {
        $(".actions .buttonContainer button").eq(event.key.toLowerCase().charCodeAt(0) - 97).click();
      }
    } else if ($("#closeButton").is(":visible") && event.key.toLowerCase() == "x") {
      $("#closeButton").click();
    } else if ($(".featuredVideos").is(":visible") && !$("#closeButton").is(":visible")) {
      $(".featuredVideos > div > div").eq(event.key.toLowerCase().charCodeAt(0) - 97).click();
    } else if ($(".streamingVideos").is(":visible") && $("#closeButton").is(":not(:visible)")) {
      $(".streamingVideos > div > div").eq(event.key.toLowerCase().charCodeAt(0) - 97).click();
    }
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
    thisRow.find(".zoomId").inputmask(["999 999 999[9]", "999 9999 9999"]);
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
  $(".actions .buttonContainer").remove();
  let links = $(".links tbody tr");
  for (let link = 0; link <links.length; link++) {
    $(".actions").append("<div class='buttonContainer pt-2 flex-grow-1'><button type='button' class='align-items-center btn btn-lg btn-" + $(links[link]).find(".linkType").val() + " d-flex flex-column h-100 w-100' style='background-color: " + colors[(link % colors.length)] + "' data-link-details='" + $(links[link]).find(".linkDetails input").map(function () { return $(this).val(); }).get() + "'><div><kbd>" + String.fromCharCode(link + 65) + "</kbd></div><div class='align-items-center d-flex flex-fill'>" + $(links[link]).find(".linkName").val() + "</div></button></div>");
  }
  $(".actions > .buttonContainer, .actions > .broadcastContainer").css("height", 100 / Math.ceil($(".actions > .buttonContainer, .actions > .broadcastContainer").length / 3) + "%");
  $(".actions").append($(".actions > .broadcastContainer"));
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
async function prefsInitialize() {
  for (var pref of ["linkArray", "labelShutdown", "labelRemoteAssistance", "labelSettings", "autoRunAtBoot", "hideShutdown", "hideRemoteAssistance", "username"]) {
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
  for (var lang of (await getJson("https://b.jw-cdn.org/apis/mediator/v1/languages/E/all?clientType=www")).languages) {
    $("#broadcastLang").append($("<option>", {
      value: lang.code,
      text: lang.vernacular + " (" + lang.name + ")"
    }));
  }
  if (prefs.broadcastLang) $("#broadcastLang").val(prefs.broadcastLang).select2();
}
async function processSettings() {
  $("#overlaySettings .is-invalid").removeClass("is-invalid");
  var configIsValid = true;
  for (var label of ["Settings", "Shutdown", "RemoteAssistance"]) {
    $("#lbl" + label).html(prefs["label" + label]);
  }
  for (var hideMe of ["Shutdown", "RemoteAssistance"]) {
    if (prefs["hide" + hideMe]) {
      $("#btn" + hideMe).parent().fadeOut();
    } else {
      $("#btn" + hideMe).parent().fadeIn();
    }
  }
  remote.app.setLoginItemSettings({
    openAtLogin: prefs.autoRunAtBoot
  });
  if (prefs.broadcastLang) {
    let req = await getJson("https://b.jw-cdn.org/apis/mediator/v1/translations/" + prefs.broadcastLang);
    broadcastStrings = req.translations[prefs.broadcastLang];
    $("#broadcast1button").css("background-color", colors[($(".links tbody tr").length % colors.length)]).html("<div><kbd>" + String.fromCharCode($(".links tbody tr").length + 65) + "</kbd></div><div class='align-items-center d-flex flex-fill'>" + broadcastStrings.ttlHome + "</div>");
    $("#lblGoHome").html(broadcastStrings.btnStillWatchingGoBack);
    var videos = 0;
    try {
      $(".featuredVideos > div:not(:first)").remove();
      var studioFeatured = (await getJson("https://b.jw-cdn.org/apis/mediator/v1/categories/" + prefs.broadcastLang + "/StudioFeatured?detailed=0&clientType=www")).category.media;
      var latestVideos = (await getJson("https://b.jw-cdn.org/apis/mediator/v1/categories/" + prefs.broadcastLang + "/LatestVideos?detailed=0&clientType=www")).category.media;
      let allVideos = studioFeatured.concat(latestVideos.filter(item => !studioFeatured.includes(item))).slice(0, 16);
      allVideos = [...new Map(allVideos.map(item => [item["guid"], item])).values()];
      for (var featuredVideo of allVideos) {
        videos++;
        var featuredVideoElement = $("<div class='mt-0 pt-2'><div class='bg-light d-flex flex-column h-100 rounded text-dark' data-url='" + featuredVideo.files.slice(-1)[0].progressiveDownloadURL + "'><div class='row'><img style='width: 100%' src='" + featuredVideo.images.pnr.lg + "'/></div><div class='d-flex flex-column flex-fill m-2'><div><h5 class='kbd'><kbd>" + String.fromCharCode(65 + videos) + "</kbd></h5></div><div class='align-items-center d-flex flex-fill flex-row'><h5>" + featuredVideo.title + "</h5></div></div></div></div>").click(function() {
          $("#videoPlayer").append("<video controls autoplay></video>").fadeIn();
          $("#videoPlayer video").append("<source src='" + $(this).find("div").data("url") + "' / >");
        });
        $(".featuredVideos").append(featuredVideoElement);
      }
      $(".featuredVideos > div").css("height", 100 / Math.ceil($(".featuredVideos > div").length / 5) + "%");
    } catch(err) {
      console.error(err);
    }
    $("#broadcast1button").toggle(videos > 0);
  }
  for (var setting of ["broadcastLang", "username"]) {
    if (!prefs[setting]) {
      configIsValid = false;
    }
    $("#" + setting).toggleClass("is-invalid", !prefs[setting]).next("span.select2").toggleClass("is-invalid", !prefs[setting]);
  }
  $(".btnSettings").prop("disabled", !configIsValid).toggleClass("btn-danger", !configIsValid).toggleClass("btn-primary", configIsValid);
  $("#settingsIcon").toggleClass("text-danger", !configIsValid).toggleClass("text-muted", configIsValid);
  if (configIsValid) generateButtons();
  if (!configIsValid) toggleScreen("overlaySettings", true);
  return configIsValid;
}
function toggleScreen(screen, forceShow, forceHide) {
  var visible = $("#" + screen).is(":visible");
  if (forceShow) {
    $("#" + screen).fadeIn("fast");
    $("#home" + (screen !== "overlayPleaseWait" ? ", #overlayPleaseWait" : "")).hide();
  } else if (forceHide || visible) {
    $("#home").show();
    $("#" + screen).fadeOut("fast");
  } else {
    $("#" + screen).fadeIn("fast");
    $("#home" + (screen !== "overlayPleaseWait" ? ", #overlayPleaseWait" : "")).hide();
  }
}
function updateCleanup() {
  try {
    let localPrefsFile = path.join(appPath, "local-prefs.json");
    if (fs.existsSync(localPrefsFile)) {
      let localPrefs = JSON.parse(fs.readFileSync(localPrefsFile));
      prefs.username = localPrefs.username;
      fs.rmSync(localPrefsFile);
    }
    if ("targetVolume" in prefs) delete prefs.targetVolume;
    fs.writeFileSync(prefsFile, JSON.stringify(Object.keys(prefs).sort().reduce((acc, key) => ({...acc, [key]: prefs[key]}), {}), null, 2));
  } catch (err) {
    console.error(err);
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
$("#autoRunAtBoot").on("change", function() {
  remote.app.setLoginItemSettings({
    openAtLogin: prefs.autoRunAtBoot
  });
});
$("#broadcastLang").on("change", function() {
  $(".featuredVideos > div:not(:first-of-type)").remove();
});
$("#btnShutdown").on("click", function() {
  powerControl.powerOff();
});
$("#btnExport").on("click", function() {
  fs.writeFileSync(remote.dialog.showSaveDialogSync({
    defaultPath : "prefs.json"
  }), JSON.stringify(prefs, null, 2));
});
$("#closeButton").on("click", function() {
  $("#videoPlayer").fadeOut().find("video").remove();
});
$("#broadcast1button").on("click", function() {
  $("#videos>div").show();
  $(".streamingVideos").first().parent().hide();
  $("#videoPlayer").hide();
  toggleScreen("videos");
});
$("#btnGoHome, #btnGoHome2").on("click", function() {
  toggleScreen("videos");
});
$(".streamingVideos").on("click", ".flex-column", function() {
  $("#videoPlayer").append("<video controls autoplay><source src='" + $(this).data("url") + "' / ></video>").fadeIn();
});
$(".actions").on("click", ".btn-zoom", function () {
  let linkDetails = $(this).data("link-details").split(",");
  shell.openExternal("zoommtg://zoom.us/join?confno=" + linkDetails[0].replace(/\D+/g, "") + "&pwd=" + linkDetails[1] + "&uname=" + prefs.username);
  $("#overlayPleaseWait").fadeIn().delay(10000).fadeOut();
});
$(".actions").on("click", ".btn-stream", async function () {
  toggleScreen("overlayPleaseWait");
  try {
    $("#videos>div").hide();
    $(".streamingVideos").first().parent().show();
    $(".streamingVideos > div:not(:first)").remove();
    let tempHeaders = { "x-requested-with": "XMLHttpRequest" };
    let streamLangs = (await axios.get("https://fle.stream.jw.org/language/getlanguages", { headers: tempHeaders })).data.languages;
    tempHeaders.cookie = (await axios.post("https://fle.stream.jw.org/token/check", JSON.stringify({ token: decodeURIComponent($(this).data("link-details").split(",")[0]).split("/").slice(-1)[0] }), { headers: tempHeaders })).headers["set-cookie"].join("; ");
    var streamLang = (await axios.get("https://fle.stream.jw.org/member/getinfo", { headers: tempHeaders })).data.data.language;
    var langSymbol = streamLangs.filter(lang => lang.locale == streamLang)[0].symbol;
    $("#lblGoHome2").html((await getJson("https://prod-assets.stream.jw.org/translations/" + langSymbol + ".json")).translations[langSymbol]["button_previous"]);
    for (var streamFile of Object.entries((await axios.post("https://fle.stream.jw.org/event/languageVideos", JSON.stringify({ language: streamLangs.filter(lang => lang.locale == streamLang)[0] }), { headers: tempHeaders })).data)) {
      var mediaFile = await axios.head(streamFile[1].vod_firstfile_url, { headers: { Cookie: tempHeaders.cookie } });
      $(".streamingVideos").append("<div class='mt-0 pt-2'><div class='d-flex flex-column flex-fill h-100 rounded bg-light p-2 text-dark' data-url='" + mediaFile.request.protocol + "//" + mediaFile.request.host + mediaFile.request.path + "'><div class='flex-row'><h5><kbd>" + String.fromCharCode(parseInt(streamFile[0]) + 66) + "</kbd></h5></div><div class='align-items-center d-flex flex-fill flex-row'><h5>" + streamFile[1].description + "</h5></div></div>");
    }
    $(".streamingVideos > div").css("height", 100 / Math.ceil($(".streamingVideos > div").length / 4) + "%");
    toggleScreen("videos");
  } catch(err) {
    let badLink = $(this).data("link-details");
    $(".streamUrl").filter(function() { return $(this).val() ===  badLink; }).addClass("is-invalid");
    toggleScreen("overlaySettings", true);
    console.log(err);
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
