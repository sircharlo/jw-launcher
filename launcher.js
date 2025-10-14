const axios = require('axios').default,
  net = require("net"),
  remote = require("@electron/remote"),
  fs = require("graceful-fs"),
  os = require("os"),
  path = require("path"),
  powerControl = require("power-control"),
  {shell} = require("electron"),
  $ = require("jquery");
const appPath = remote.app.getPath("userData"),
  //          green      pink       blue     deeporange   purple     yellow      cyan      brown
  colors = ["#00e676", "#ff80ab", "#64b5f6", "#ffb74d", "#ea80fc", "#ffff8d", "#18ffff", "#bcaaa4"],
  prefsFile = path.join(appPath, "prefs.json");
var scheduledActionInfo = {},
  broadcastStrings = {},
  prefs = {},
  streamAuth = {};
axios.defaults.adapter = "http";
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
$(".links tbody").on("change", "input, select", function() {
  $(".links tbody input:visible, .links tbody select:visible").removeClass("is-invalid").filter(function() {
    return !this.value;
  }).addClass("is-invalid");
  $(this).closest("tr").find(".btn-delete-link").toggle($(this).closest("tr").find(".linkType").val() !== "");
  updateScheduleTargets();
});
function goAhead() {
  languageRefresh().then(function() {
    if (fs.existsSync(prefsFile)) {
      try {
        prefs = JSON.parse(fs.readFileSync(prefsFile));
        updateCleanup();
      } catch (err) {
        console.error(err, prefs);
        toggleScreen("overlaySettings", "show");
      }
    }
    prefsInitialize();
    processSettings();
    $("#version span.badge").html("v" + remote.app.getVersion());
    $("#overlayPleaseWait").fadeOut();
    // Initialize scoped keyboard shortcuts on first load
    setShortcutScope("home");
    scheduleLoader();
  });
}
function isEscapeButton(event) {
  return event.key == "Escape" || event.key == "Esc"
}
function supportKey(event) {
  return !(event.ctrlKey || event.metaKey || event.shiftKey) && (event.code.includes("Key") || /^[a-z]$/i.test(event.key) || isEscapeButton(event));
}
// Centralized, scoped keyboard shortcuts
let currentKeyHandler = null;
let currentShortcutScope = null; // one of: 'home' | 'featured' | 'streaming' | 'player'

function unregisterShortcuts() {
  if (currentKeyHandler) {
    window.removeEventListener("keyup", currentKeyHandler, true);
    currentKeyHandler = null;
  }
}

function setShortcutScope(scope) {
  unregisterShortcuts();
  currentShortcutScope = scope;
  currentKeyHandler = function(event) {
    if (!supportKey(event) || $("#overlayPleaseWait").is(":visible")) return;
    // If any overlay other than videos/video player is visible, ignore shortcuts
    if ($(".overlay:visible").not("#videos, #videoPlayer").length > 0) return;
    const key = isEscapeButton(event) ? "escape" : String(event.key || "").toLowerCase();

    switch (currentShortcutScope) {
      case "home": {
        if (key === "escape") return; // nothing to do
        const linksCount = $(".links tbody tr").filter(function() { return $(this).find(".linkName").val() !== ""; }).length;
        const broadcastKey = String.fromCharCode(linksCount + 65).toLowerCase();
        if (key === broadcastKey) {
          event.preventDefault();
          $("#broadcast1button").click();
        } else {
          const idx = key.charCodeAt(0) - 97;
          if (idx >= 0) {
            event.preventDefault();
            $(".actions .buttonContainer button").eq(idx).click();
          }
        }
        break;
      }
      case "featured": {
        if (key === "escape") {
          event.preventDefault();
          $("#btnGoHome").click();
          return;
        }
        if (!$("#closeButton").is(":visible")) {
          const idx = key.charCodeAt(0) - 97;
          if (idx >= 0) {
            event.preventDefault();
            $(".featuredVideos > div > div").eq(idx).click();
          }
        }
        break;
      }
      case "streaming": {
        if (key === "escape") {
          event.preventDefault();
          $("#btnGoHome2").click();
          return;
        }
        if (!$("#closeButton").is(":visible")) {
          const idx = key.charCodeAt(0) - 97;
          if (idx >= 0) {
            event.preventDefault();
            $(".streamingVideos > div > div").eq(idx).click();
          }
        }
        break;
      }
      case "player": {
        if (key === "x" || key === "escape") {
          event.preventDefault();
          $("#closeButton").click();
        }
        break;
      }
    }
  };
  window.addEventListener("keyup", currentKeyHandler, true);
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
$("#overlaySettings tbody").on("click", ".btn-delete", function() {
  let parentTable = $(this).closest("tbody");
  $(this).closest("tr").remove();
  parentTable.find("tr").last().find("input").first().change();
});
$(".links tbody").on("change", ".streamUrl", function() {
  $(this).val($(this).val().replace("https://fle.stream.jw.org/", ""));
});
$(".links tbody").on("change", ".linkName, .linkDetails input", function() {
  let linkArray = [];
  $(".links tbody tr").each(function () {
    if ($(this).find(".linkType").val().length > 0) {
      linkArray.push($(this).find(".linkType, .linkName, .linkDetails input").map(function () { return $(this).val(); }).get());
    }
  });
  if ($(".links tbody tr .is-invalid:visible").length ===0) $("#linkArray").val(JSON.stringify(linkArray)).change();
});
$(".links tbody").on("change", ".linkType", function() {
  let linkType = $(this).val();
  let thisRow = $(this).closest("tr");
  thisRow.find(".linkDetails").empty();
  thisRow.find(".linkName").val("").toggle(!!linkType);
  if (linkType === "zoom") {
    thisRow.find(".linkDetails").append("<div class='input-group input-group-sm'><span class='input-group-text'>ID</span><input type='text' class='form-control form-control-sm zoomId dynamic-field' placeholder='Zoom meeting ID' /><span class='input-group-text'>Password</span><input type='text' class='form-control form-control-sm zoomPassword dynamic-field' placeholder='Zoom meeting password' /></div>");
    thisRow.find(".zoomId").inputmask([
      "999 999 999",
      "999 999 9999",
      "999 999 9999 9",
      "999 999 9999 99"
    ], { "clearIncomplete": true });
  } else if (linkType === "stream") {
    thisRow.find(".linkDetails").append("<div class='input-group input-group-sm'><span class='input-group-text'>https://fle.stream.jw.org/</span><input type='text' class='form-control form-control-sm streamUrl dynamic-field' placeholder='t/ABCDEFGHIJKLOMNOPQRSTUVWXYZ' /></div>");
  }
  thisRow.find("input").addClass("is-invalid");
  if (!$(this).hasClass("initializing")) validateSettings();
});
$(".schedule tbody").on("change", "input, select", function() {
  $(".schedule tbody input, .schedule tbody select").removeClass("is-invalid").filter(function() {
    return !this.value;
  }).addClass("is-invalid");
  let scheduleArray = [];
  $(".schedule tbody tr").each(function () {
    scheduleArray.push($(this).find("input, select").map(function () { return $(this).val(); }).get());
  });
  if ($(".schedule tbody tr .is-invalid:visible").length ===0) {
    $("#scheduleArray").val(JSON.stringify(scheduleArray)).change();
  } else {
    validateSettings();
  }
});
async function languageRefresh() {
  let availMedia = (await getJson("https://b.jw-cdn.org/apis/mediator/v1/categories/E/StudioFeatured")).category.media.concat((await getJson("https://b.jw-cdn.org/apis/mediator/v1/categories/E/LatestVideos")).category.media).map(item => item.availableLanguages);
  let availLangs = [...new Set([].concat(...availMedia))];
  for (var lang of Object.values((await getJson("https://b.jw-cdn.org/apis/mediator/v1/languages/E/all?clientType=www")).languages).filter(value => availLangs.includes(value.code))) {
    $("#broadcastLang").append($("<option>", {
      value: lang.code,
      text: lang.vernacular + " (" + lang.name + ")"
    }));
  }
  $("#broadcastLang").select2();
}
function addNewLink() {
  $(".links tbody").append("<tr draggable='true'><td><select class='form-select form-select-sm linkType dynamic-field'><option value='' hidden>Select a type</option><option value='zoom'>Zoom</option><option value='stream'>JW Stream</option></select></td><td><input type='text' class='form-control form-control-sm linkName dynamic-field' style='display: none;' placeholder='Enter a meaningful description' /></td><td><div class='linkDetails input-group'></div></td><td class='text-end'><button type='button' class='btn btn-light btn-sm btn-sort-schedule me-2 text-dark'><i class='fas fa-sort'></i></button><button type='button' class='btn btn-danger btn-sm btn-delete btn-delete-link' style='display: none;'><i class='fas fa-minus'></i></button></td></tr>");
  $(".links tbody tr").last().find(".linkType").addClass("is-invalid");
}
function addNewSchedule() {
  $(".schedule tbody").append("<tr draggable='true'><td><select class='form-select form-select-sm triggerDay dynamic-field is-invalid'><option value='' hidden></option><option value='1'>Monday</option><option value='2'>Tuesday</option><option value='3'>Wednesday</option><option value='4'>Thursday</option><option value='5'>Friday</option><option value='6'>Saturday</option><option value='0'>Sunday</option></select></td><td><input type='text' class='form-control form-control-sm triggerTime dynamic-field is-invalid' /></td><td><select class='form-select form-select-sm targetAction dynamic-field is-invalid'><option value='' hidden></option></select></td><td class='text-end'><button type='button' class='btn btn-light btn-sm btn-sort-schedule me-2 text-dark'><i class='fas fa-sort'></i></button><button type='button' class='btn btn-danger btn-sm btn-delete btn-delete-schedule'><i class='fas fa-minus'></i></button></td></tr>");
  $(".schedule tbody tr").last().find(".triggerTime").inputmask({ regex: "[0-2]\\d:[0-5]\\d", "clearIncomplete": true });
  updateScheduleTargets();
}
function updateScheduleTargets() {
  $(".schedule select.targetAction").each(function() {
    let sel = $(this);
    let links = $(".links tbody tr").filter(function() {
      return $(this).find(".linkName").val() !== "";
    });
    sel.find("option").slice(links.length + 1).remove();
    sel.change();
    links.each(function(index) {
      if (sel.find("option[value=" + index + "]").length === 0) sel.append($("<option>", {
        value: index
      }));
      sel.find("option[value=" + index + "]").text($(this).find(".linkName").val() + " - " + $(this).find(".linkType option:selected").text());
    });
  });
}
async function broadcastLoad() {
  var videos = 0;
  if (prefs.broadcastLang) {
    let req = await getJson("https://b.jw-cdn.org/apis/mediator/v1/translations/" + prefs.broadcastLang);
    console.log("Broadcast response: ", req);
    broadcastStrings = req.translations[prefs.broadcastLang];
    $("#broadcast1button").css("background-color", colors[$($(".links tbody tr").filter(function() {
      return $(this).find(".linkName").val() !== "";
    }).length % colors.length)]).html("<div><kbd>" + String.fromCharCode($(".links tbody tr").filter(function() {
      return $(this).find(".linkName").val() !== "";
    }).length + 65) + "</kbd></div><div class='align-items-center flex-fill' style='display: flex;'>" + broadcastStrings.ttlHome + "</div>");
    $("#lblGoHome").html(broadcastStrings.btnStillWatchingGoBack);
    $("#lblGoHome2").html(broadcastStrings.btnStillWatchingGoBack);
    try {
      var studioFeatured = (await getJson("https://b.jw-cdn.org/apis/mediator/v1/categories/" + prefs.broadcastLang + "/StudioFeatured?detailed=0&clientType=www")).category.media;
      var latestVideos = (await getJson("https://b.jw-cdn.org/apis/mediator/v1/categories/" + prefs.broadcastLang + "/LatestVideos?detailed=0&clientType=www")).category.media;
      let allVideos = studioFeatured.concat(latestVideos.filter(item => !studioFeatured.includes(item))).slice(0, 16);
      allVideos = [...new Map(allVideos.map(item => [item["guid"], item])).values()];
      $(".featuredVideos > div:not(:first)").remove();
      for (var featuredVideo of allVideos) {
        videos++;
        var featuredVideoElement = $("<div class='mt-0 pt-2'><div class='bg-light flex-column h-100 rounded text-dark' data-url='" + featuredVideo.files.slice(-1)[0].progressiveDownloadURL + "' style='display: flex;'><div class='row'><img style='width: 100%' src='" + featuredVideo.images.pnr.lg + "'/></div><div class='flex-column flex-fill m-2' style='display: flex;'><div><h5 class='kbd'><kbd>" + String.fromCharCode(65 + videos) + "</kbd></h5></div><div class='align-items-center flex-fill flex-row' style='display: flex;'><h5>" + featuredVideo.title + "</h5></div></div></div></div>").click(function() {
          $("#videoPlayer").append("<video controls autoplay></video>").fadeIn();
          $("#videoPlayer video").append("<source src='" + $(this).find("div").data("url") + "' / >");
          setShortcutScope("player");
        });
        $(".featuredVideos").append(featuredVideoElement);
      }
      $(".featuredVideos > div").css("height", 100 / Math.ceil($(".featuredVideos > div").length / 5) + "%");
    } catch(err) {
      console.error("[ERROR] https://b.jw-cdn.org/apis/mediator/v1/categories/" + prefs.broadcastLang + "/StudioFeatured?detailed=0&clientType=www");
    }
    $("#broadcast1button").parent().toggle(videos > 0);
  }
  return videos;
}
function buttonHeight(broadcastVideos) {
  let links = $(".links tbody tr").filter(function() {
      return $(this).find(".linkName").val() !== "";
    }).length,
    broadcast = (broadcastVideos > 0 ? 1 : 0);
  $(".actions > div").css("height", 100 / Math.ceil((broadcast + links) / 3) + "%");
}
async function downloadFile(url, progressElem) {
  try {
    let response = await axios.get(url, {
      adapter: require("axios/lib/adapters/xhr"),
      responseType: "arraybuffer",
      onDownloadProgress: function(progressEvent) {
        var percent = progressEvent.loaded / progressEvent.total * 100;
        progressElem.css("width", percent + "%");
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
  let links = $(".links tbody tr").filter(function() {
    return $(this).find(".linkName").val() !== "";
  });
  for (let link = 0; link <links.length; link++) {
    $(".actions").append("<div class='buttonContainer pt-2 flex-grow-1'><button type='button' class='align-items-center btn btn-lg btn-" + $(links[link]).find(".linkType").val() + " flex-column h-100 w-100' style='display: flex; background-color: " + colors[(link % colors.length)] + "' data-link-details='" + $(links[link]).find(".linkDetails input").map(function () { return $(this).val(); }).get() + "'><div><kbd>" + String.fromCharCode(link + 65) + "</kbd></div><div class='align-items-center flex-fill' style='display: flex;'>" + $(links[link]).find(".linkName").val() + "</div></button></div>");
  }
  $(".actions").append($(".actions > .broadcastContainer"));
}
async function getJson(url) {
  let response = null,
    payload = null;
  try {
    payload = await axios.get(url);
    response = payload.data;
  } catch (err) {
    console.error(url, err, payload);
  }
  return response;
}
function prefsInitialize() {
  for (var pref of ["linkArray", "scheduleArray", "labelShutdown", "labelRemoteAssistance", "labelSettings", "autoRunAtBoot", "enableShutdown", "enableRemoteAssistance", "username"]) {
    if (!(Object.keys(prefs).includes(pref)) || !prefs[pref]) {
      prefs[pref] = null;
    }
    if ($("#" + pref)[0].type == "text" || $("#" + pref)[0].type == "select-one" || $("#" + pref)[0].type == "range" || $("#" + pref)[0].type == "hidden") {
      $("#" + pref).val(prefs[pref]);
    } else if ($("#" + pref)[0].type == "checkbox") {
      $("#" + pref).prop("checked", prefs[pref]);
    }
  }
  $("#broadcastLang").val(prefs.broadcastLang ? prefs.broadcastLang : "").select2();
  if (prefs.linkArray && JSON.parse(prefs.linkArray).length > 0) {
    for (let link of JSON.parse(prefs.linkArray)) {
      addNewLink();
      $(".links tbody tr").last().find(".linkType").addClass("initializing").val(link[0]).change().removeClass("initializing is-invalid");
      link.shift();
      for (let linkPart = 0; linkPart < link.length; linkPart++) {
        $(".links tbody tr").last().find("input").eq(linkPart).val(link[linkPart]).removeClass("is-invalid");
      }
    }
    $(".links tbody tr").last().find(".linkName").change();
  }
  if (prefs.scheduleArray && JSON.parse(prefs.scheduleArray).length > 0) {
    for (let schedule of JSON.parse(prefs.scheduleArray)) {
      addNewSchedule();
      for (let schedulePart = 0; schedulePart < schedule.length; schedulePart++) {
        $(".schedule tbody tr").last().find("input, select").eq(schedulePart).val(schedule[schedulePart]).removeClass("is-invalid");
      }
    }
    $(".schedule tbody tr").last().find("input").first().change();
  }
  processSettings();
}
function processSettings() {
  for (var label of ["Settings", "Shutdown", "RemoteAssistance"]) {
    $("#lbl" + label).html(prefs["label" + label]);
  }
  for (var enableMe of ["Shutdown", "RemoteAssistance"]) {
    $("#btn" + enableMe).parent().toggle(!!prefs["enable" + enableMe]);
  }
  remote.app.setLoginItemSettings({
    openAtLogin: prefs.autoRunAtBoot
  });
  broadcastLoad().then(function(broadcastVideos) {
    for (var setting of ["broadcastLang", "username"]) {
      $("#" + setting).toggleClass("is-invalid", !prefs[setting]).next("span.select2").toggleClass("is-invalid", !prefs[setting]);
    }
    validateSettings();
    buttonHeight(broadcastVideos);
  });
}
function scheduleLoader() {
  let d = new Date();
  let schedules = [];
  $(".schedule tbody tr").filter(function() {
    return $(this).find(".is-invalid").length === 0;
  }).each(function () {
    let scheduledItem = {};
    $(this).find("select, input").each(function () {
      scheduledItem[Array.from($(this).prop("classList")).filter(str => new RegExp("trigger|target", "g").test(str)).join("")] = $(this).val();
    });
    schedules.push(scheduledItem);
  });
  if (schedules.length > 0 && (!scheduledActionInfo.lastExecution || (d - scheduledActionInfo.lastExecution) / 1000 / 60 / 60 > 12) && (!scheduledActionInfo.lastSkip || (d - scheduledActionInfo.lastSkip) / 1000 / 60 / 60 > 12)) {
    if ($("#home:visible").length > 0) {
      for (var s = 0; s < schedules.length; s++) {
        let schedule = schedules[s];
        if (d.getDay() == schedule.triggerDay) {
          let triggerTime = schedule.triggerTime.split(":");
          let targetDate = new Date(d);
          targetDate.setHours(triggerTime[0], triggerTime[1], 0, 0);
          let timeToEvent = (targetDate - d) / 1000 / 60;
          if (timeToEvent >=-105 && timeToEvent <= 30) {
            console.log("[SCHEDULE] Triggering scheduled item, as we are within the acceptable timeframe");
            $("#actionDesc").text($(".schedule tbody tr .targetAction").eq(s).find("option:selected").text());
            $("#overlayScheduledAction").stop().fadeIn().delay(10000).fadeOut(400, function() {
              if (!scheduledActionInfo.lastSkip || (d - scheduledActionInfo.lastSkip) / 1000 / 60 / 60 > 12) $(".actions button").eq(schedule.targetAction).click();
            });
            let timeLeft = 10;
            let downloadTimer = setInterval(function(){
              if(timeLeft <= 0) clearInterval(downloadTimer);
              $("#scheduledDelayProgress .progress-bar").css("width", (10 - timeLeft + 1) * 10 + "%");
              timeLeft -= 1;
            }, 1000);
          }
        }
      }
    }
  }
  setTimeout(scheduleLoader, 15000);
}
function toggleScreen(screen, action = "") {
  var visible = $("#" + screen).is(":visible");
  if (action == "show") {
    $("#" + screen).fadeIn("fast");
    $("#home" + (screen !== "overlayPleaseWait" ? ", #overlayPleaseWait" : "")).hide();
  } else if (action == "hide" || visible) {
    $("#home").show();
    $("#" + screen).fadeOut("fast");
  } else {
    $("#" + screen).fadeIn("fast");
    $("#home" + (screen !== "overlayPleaseWait" ? ", #overlayPleaseWait" : "")).hide();
  }
}
function updateCleanup() {
  try {
    for (var oldHidePref of ["Shutdown", "RemoteAssistance"]) {
      if ("hide" + oldHidePref in prefs) {
        prefs["enable" + oldHidePref] = !prefs["hide" + oldHidePref];
        delete prefs["hide" + oldHidePref];
      }
    }
    fs.writeFileSync(prefsFile, JSON.stringify(Object.keys(prefs).sort().reduce((acc, key) => ({...acc, [key]: prefs[key]}), {}), null, 2));
  } catch (err) {
    console.error(err);
  }
}
function validateSettings() {
  let configIsValid = $("#overlaySettings .is-invalid").length === 0;
  $(".btnSettings").prop("disabled", !configIsValid).toggleClass("btn-danger", !configIsValid).toggleClass("btn-secondary", configIsValid);
  $("#settingsIcon").toggleClass("text-danger", !configIsValid).toggleClass("text-muted", configIsValid);
  if (configIsValid) generateButtons();
  if (!configIsValid) toggleScreen("overlaySettings", "show");
  return configIsValid;
}
$(".btnSettings, #btnSettings").on("click", function() {
  toggleScreen("overlaySettings");
});
$("#overlayScheduledAction button").on("click", function() {
  $("#overlayScheduledAction").stop().fadeOut;
  scheduledActionInfo.lastSkip = new Date();
});
$("#overlaySettings input:not(.dynamic-field), #overlaySettings select:not(.dynamic-field)").on("change", function() {
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
$(".btn-add-link").on("click", function() {
  addNewLink();
});
$(".btn-add-schedule").on("click", function() {
  addNewSchedule();
  validateSettings();
});
$("#btnExport").on("click", function() {
  fs.writeFileSync(remote.dialog.showSaveDialogSync({
    defaultPath : "prefs.json"
  }), JSON.stringify(prefs, null, 2));
});
$("#closeButton").on("click", function() {
  $("#videoPlayer").fadeOut().find("video").remove();
  // Return to the appropriate shortcuts scope after closing player
  if ($("#videos").is(":visible")) {
    if ($(".streamingVideos").first().parent().is(":visible")) {
      setShortcutScope("streaming");
    } else if ($(".featuredVideos").first().parent().is(":visible")) {
      setShortcutScope("featured");
    }
  } else if ($("#home").is(":visible")) {
    setShortcutScope("home");
  }
});
$("#broadcast1button").on("click", function() {
  toggleScreen("videos", "show");
  $("#videos>div").show();
  $(".streamingVideos").first().parent().hide();
  $("#videoPlayer").hide();
  setShortcutScope("featured");
});
$("#btnGoHome, #btnGoHome2").on("click", function() {
  toggleScreen("videos", "hide");
  setShortcutScope("home");
});
$(".streamingVideos").on("click", ".flex-column:not(.lblGoHome2)", async function() {
  try {
    toggleScreen("overlayPleaseWait", "show");
    const guid = $(this).data("guid");
    const specialtyGuid = $(this).data("specialty");
    const url = $(this).data("playurl") || $(this).data("url");
    const audioUrl = $(this).data("audiourl") || "";
    const quality = $(this).data("quality") || "undefined";
    const client = axios.create({ baseURL: "https://stream.jw.org", withCredentials: true });
    let headers = {
      "accept": "application/json",
      "content-type": "application/json",
      "oidc-domain": "jworg",
      "xsrf-token-stream": streamAuth.xsrfToken || "",
      Cookie: streamAuth.cookieHeader || "",
      Referer: "https://stream.jw.org/home?playerOpen=true"
    };
    await client.put("/api/v1/libraryBranch/program/presignURL", { guid, specialtyGuid, url, audioUrl, programUrlType: "video", quality, size: 0, legacyQuality: "", programType: "vod", isHome: true, isAudioOnly: false }, { headers });
    const detail = await client.get(`/api/v1/program/getByGuidForHome/vod/${guid}`, { headers: { ...headers, "content-type": undefined } });
    if (detail && detail.data && Array.isArray(detail.data.downloadUrls)) {
      const dls = detail.data.downloadUrls;
      const preferred = dls.find(d => d.quality === "720") || dls.find(d => d.quality === "540") || dls.find(d => d.quality === "360") || dls[0];
      const mp4Url = preferred && preferred.url ? preferred.url : null;
      if (mp4Url) {
        const presignBody = {
          guid,
          specialtyGuid,
          url: mp4Url,
          quality: preferred.quality || "undefined",
          size: preferred.size || 0,
          legacyQuality: preferred.legacyQuality || "",
          programType: detail.data.programType || "vod",
          isHome: true,
          isAudioOnly: false,
          category_categoryType: detail.data.category_categoryType,
          category_guid: detail.data.category_guid
        };
        const presigned = await client.put("/api/v1/libraryBranch/program/presignURL", presignBody, { headers });
        console.log("Presigned response: ", presigned);
        const signedUrl = (presigned && presigned.data && (presigned.data.presignedUrl || presigned.data.url)) ? (presigned.data.presignedUrl || presigned.data.url) : mp4Url;
        console.log("Signed URL: ", signedUrl);
        $("#videoPlayer").append("<video controls autoplay><source src='" + signedUrl + "' / ></video>").fadeIn();
        setShortcutScope("player");
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    toggleScreen("overlayPleaseWait", "hide");
  }
});
$(".actions").on("click", ".btn-zoom", function () {
  let linkDetails = $(this).data("link-details").split(",");
  shell.openExternal("zoommtg://zoom.us/join?confno=" + linkDetails[0].replace(/\D+/g, "") + "&pwd=" + linkDetails[1] + "&uname=" + prefs.username);
  scheduledActionInfo.lastExecution = new Date();
  let timeLeft = 15;
  let loadZoomTimer = setInterval(function(){
    $("#loadingProgress .progress-bar").css("width", (15 - timeLeft + 1) * 100 / 15 + "%").closest("div.align-self-center").show();
    if(timeLeft <= 0) {
      clearInterval(loadZoomTimer);
      $("#loadingProgress .progress-bar").css("width", "0%").closest("div.align-self-center").hide();
    }
    timeLeft -= 1;
  }, 1000);
  $("#overlayPleaseWait").fadeIn().delay(15000).fadeOut();
});
$(".actions").on("click", ".btn-stream", async function () {
  // Ensure we are in the videos overlay (streaming list view)
  $("#videos>div").hide();
  $(".streamingVideos").first().parent().show();
  toggleScreen("videos", "hide");
  toggleScreen("overlayPleaseWait", "show");
  try {
    $(".streamingVideos > div:not(:first)").remove();
    let linkTokenRaw = decodeURIComponent($(this).data("link-details").split(",")[0]);
    let linkToken = linkTokenRaw.split("/").slice(-1)[0];
    console.log("Creating axios client for link token: ", linkToken);
    const client = axios.create({
      baseURL: "https://stream.jw.org",
      withCredentials: true,
      xsrfCookieName: "xsrf-token-stream",
      xsrfHeaderName: "xsrf-token-stream",
      headers: {
        "accept": "application/json",
        "x-requested-with": "XMLHttpRequest"
      }
    });
    console.log("Created axios client for link token: ", linkToken, client);
    const loginRes = await client.post("/api/v1/auth/login/share", { token: linkToken }, { headers: { Referer: `https://stream.jw.org/${linkToken}` } });
    console.log("Login response: ", loginRes);
    const cookieJar = new Map();
    const setFrom = (res) => {
      let sc = res && res.headers ? res.headers["set-cookie"] : null;
      if (!sc) return;
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
    };
    setFrom(loginRes);
    let xsrfToken = cookieJar.get("xsrf-token-stream");
    let cookieHeader = Array.from(cookieJar.entries()).map(e => e[0] + "=" + e[1]).join("; ");
    const whoamiRes = await client.get("/api/v1/auth/whoami", { headers: { Referer: `https://stream.jw.org/${linkToken}`, "xsrf-token-stream": xsrfToken, Cookie: cookieHeader } });
    console.log("Whoami response: ", whoamiRes);
    setFrom(whoamiRes);
    xsrfToken = cookieJar.get("xsrf-token-stream") || xsrfToken;
    cookieHeader = Array.from(cookieJar.entries()).map(e => e[0] + "=" + e[1]).join("; ");
    const linkRes = await client.get(`/api/v1/libraryBranch/library/link/${linkToken}`, { headers: { Referer: `https://stream.jw.org/${linkToken}`, "xsrf-token-stream": xsrfToken, Cookie: cookieHeader } });
    console.log("Link response: ", linkRes);
    setFrom(linkRes);
    xsrfToken = cookieJar.get("xsrf-token-stream") || xsrfToken;
    cookieHeader = Array.from(cookieJar.entries()).map(e => e[0] + "=" + e[1]).join("; ");
    const categoriesRes = await client.get("/api/v1/libraryBranch/home/category", { headers: { "oidc-domain": "jworg", Referer: "https://stream.jw.org/home", "xsrf-token-stream": xsrfToken, Cookie: cookieHeader } });
    console.log("Categories response: ", categoriesRes);
    setFrom(categoriesRes);
    xsrfToken = cookieJar.get("xsrf-token-stream") || xsrfToken;
    cookieHeader = Array.from(cookieJar.entries()).map(e => e[0] + "=" + e[1]).join("; ");
    const categoryList = Array.isArray(categoriesRes.data) ? categoriesRes.data : (categoriesRes.data && Array.isArray(categoriesRes.data.items) ? categoriesRes.data.items : []);
    const categoryType = (categoryList.find(x => x && x.categoryType) || {}).categoryType || "theocraticProgram";
    const subCatsRes = await client.get(`/api/v1/libraryBranch/home/subCategory/${categoryType}`, { headers: { "oidc-domain": "jworg", Referer: "https://stream.jw.org/home", "xsrf-token-stream": xsrfToken, Cookie: cookieHeader } });
    console.log("Subcategories response: ", subCatsRes);
    streamAuth = { xsrfToken, cookieHeader };
    let specialtyIds = [];
    if (subCatsRes && subCatsRes.data) {
      if (Array.isArray(subCatsRes.data)) {
        specialtyIds = subCatsRes.data.map(x => x.id).filter(Boolean);
      } else if (Array.isArray(subCatsRes.data.items)) {
        specialtyIds = subCatsRes.data.items.map(x => x.id).filter(Boolean);
      }
    }
    if (specialtyIds.length === 0) specialtyIds = ["49ef88c8-3212-49ef-a810-b26a60217d35"];
    let allPrograms = [];
    for (let i = 0; i < specialtyIds.length; i++) {
      $("#loadingProgress .progress-bar").css("width", ((i + 1) * 100) / specialtyIds.length + "%").closest("div.align-self-center").show();
      try {
        console.log("Fetching program for specialty ID: ", specialtyIds[i]);
        const prog = await client.get(`/api/v1/libraryBranch/home/vodProgram/specialty/${specialtyIds[i]}`, { headers: { "oidc-domain": "jworg", Referer: "https://stream.jw.org/home", "xsrf-token-stream": xsrfToken, Cookie: cookieHeader } });
        console.log("Program response: ", prog);
        if (prog && prog.data) allPrograms.push(prog.data);
      } catch(e) { }
    }
    $("#loadingProgress .progress-bar").css("width", "0%").closest("div.align-self-center").hide();
    let items = [];
    for (const p of allPrograms) {
      let arr = [];
      if (Array.isArray(p)) arr = p;
      else if (Array.isArray(p.items)) arr = p.items;
      else if (Array.isArray(p.programs)) arr = p.programs;
      for (const it of arr) items.push(it);
    }
    let added = 0;
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx] || {};
      let playUrl = (it.playUrl && it.playUrl.url) ? it.playUrl.url : null;
      if (!playUrl && Array.isArray(it.downloadUrls) && it.downloadUrls.length > 0) {
        const preferred = it.downloadUrls.find(d => d.quality === "720") || it.downloadUrls.find(d => d.quality === "540") || it.downloadUrls[0];
        playUrl = preferred && preferred.url ? preferred.url : null;
      }
      if (!playUrl) continue;
      const thumb = (typeof it.thumbnail === "string" && it.thumbnail.length > 0) ? (it.thumbnail.startsWith("/") ? ("https://stream.jw.org" + it.thumbnail) : it.thumbnail) : "";
      const pub = it.publishedDate ? new Date(parseInt(it.publishedDate)).toLocaleDateString() : "";
      const desc = it.title || it.subcategory_name || it.categoryProgramType || "Program";
      const guid = it.key || it.guid || (it.playUrl && it.playUrl.guid) || "";
      const specialtyGuid = (it.playUrl && it.playUrl.specialtyGuid) || it.specialtyGuid || "";
      const audioUrl = (it.playUrl && it.playUrl.audioUrl) || "";
      const quality = (it.playUrl && it.playUrl.quality) || "undefined";
      $(".streamingVideos").append(
        "<div class='mt-0 pt-2'>" +
          "<div class='flex-column flex-fill h-100 rounded bg-light text-dark' " +
            "data-url='" + playUrl + "' " +
            "data-playurl='" + playUrl + "' " +
            "data-guid='" + guid + "' " +
            "data-specialty='" + specialtyGuid + "' " +
            "data-audiourl='" + audioUrl + "' " +
            "data-quality='" + quality + "' " +
            "style='display: flex;'>" +
              "<div class='thumb-16x9'><img src='" + thumb + "'/></div>" +
              "<div class='flex-column flex-fill m-2' style='display: flex;'>" +
                "<div><h5 class='kbd'><kbd>" + String.fromCharCode(66 + added) + "</kbd></h5></div>" +
                "<div class='align-items-center flex-fill flex-row' style='display: flex;'><h5>" + desc + "</h5></div>" +
                (pub ? ("<div><h6>" + pub + "</h6></div>") : "") +
              "</div>" +
          "</div>" +
        "</div>"
      );
      added++;
    }
    $(".streamingVideos > div").css("height", 100 / Math.ceil($(".streamingVideos > div").length / 4) + "%");
    scheduledActionInfo.lastExecution = new Date();
    toggleScreen("videos");
    setShortcutScope("streaming");
  } catch(err) {
    let badLink = $(this).data("link-details");
    $(".streamUrl").filter(function() { return $(this).val() ===  badLink; }).addClass("is-invalid");
    toggleScreen("overlaySettings", "show");
    console.error(err);
  }
});
$("#btnRemoteAssistance").on("click", async function() {
  $("#loadingProgress .progress-bar").closest("div.align-self-center").show();
  $("#overlayPleaseWait").fadeIn();
  var qsUrl = "https://download.teamviewer.com/download/TeamViewerQS.exe";
  if (os.platform() == "darwin") {
    qsUrl = "https://download.teamviewer.com/download/TeamViewerQS.dmg";
  } else if (os.platform() == "linux") {
    qsUrl = "https://download.teamviewer.com/download/version_11x/teamviewer_qs.tar.gz";
  }
  var initialTriggerText = $(this).html();
  $(this).prop("disabled", true);
  var qs = await downloadFile(qsUrl, $("#loadingProgress .progress-bar"));
  $("#overlayPleaseWait").delay(15000).fadeOut(400, function() {
    $("#loadingProgress .progress-bar").closest("div.align-self-center").hide();
  });
  var qsFilename = path.basename(qsUrl);
  fs.writeFileSync(path.join(appPath, qsFilename), new Buffer(qs));
  shell.openExternal(path.join(appPath, qsFilename));
  $(this).html(initialTriggerText).prop("disabled", false);
});
$("#overlaySettings tr.onOffToggle").on("click", function() {
  $(this).find("input.optional-action-enabled").click();
});
$("#overlaySettings tr.onOffToggle input.optional-action-enabled").click(function(e) {
  e.stopPropagation();
});
$(document).on("select2:open", () => {
  document.querySelector(".select2-search__field").focus();
});
$(".btn-sort-schedules").on("click", function() {
  const getCellValue = (tr, idx) => {
    let val = $(tr).find("td").eq(idx).find("input, select").val();
    return (val == 0 ? val + 7 : val);
  };
  const comparer = (idx, asc) => (a, b) => ((v1, v2) =>
    v1 !== "" && v2 !== "" && !isNaN(v1) && !isNaN(v2) ? v1 - v2 : v1.toString().localeCompare(v2)
  )(getCellValue(asc ? a : b, idx), getCellValue(asc ? b : a, idx));
  const table = $(".schedule tbody").get(0);
  Array.from(table.querySelectorAll("tr")).sort(comparer(1, true)).sort(comparer(0, true)).forEach(tr => table.appendChild(tr));
  $(".schedule tbody input, .schedule tbody schedule").last().change();
});
let eventSrcElem, sourceRow;
$(".links tbody, .schedule tbody").on("dragstart", "tr", function() {
  eventSrcElem = $(event.target).closest("tbody").get(0);
  sourceRow = $(event.target).closest("tr");
  if ($(event.target).closest("tr").find(".btn-delete:visible").length === 0) return false;
}).on("dragover", "tr", function(){
  event.preventDefault();
  try {
    if (eventSrcElem === $(event.target).closest("tbody").get(0)) {
      let targetRow = $(event.target).closest("tr").get(0);
      let targetTableChildren = Array.from($(event.target).closest("tbody").get(0).children);
      if (targetTableChildren.indexOf(targetRow) > targetTableChildren.indexOf(sourceRow.get(0))) {
        targetRow.after(sourceRow.get(0));
      } else if (targetTableChildren.indexOf(targetRow) < targetTableChildren.indexOf(sourceRow.get(0))) {
        targetRow.before(sourceRow.get(0));
      }
    }
  } catch(err) {
    console.error(err);
  }
}).on("dragend", "tr", function() {
  sourceRow.find("input, select").last().change();
});
