const axios = require("axios").default;
const net = require("node:net");
const remote = require("@electron/remote");
const fs = require("graceful-fs");
const path = require("node:path");
const powerControl = require("power-control");
const { shell } = require("electron");
const $ = require("jquery");

const { existsSync, readFileSync, writeFileSync } = fs;
const { app } = remote;
const { getVersion, getPath, quit, setLoginItemSettings } = app;
const appPath = getPath("userData");
const { openExternal } = shell;

//          green        pink         blue         deeporange   purple       yellow        cyan        brown
const colors = [
  "#00e676",
  "#ff80ab",
  "#64b5f6",
  "#ffb74d",
  "#ea80fc",
  "#ffff8d",
  "#18ffff",
  "#bcaaa4",
];
const prefsFile = path.join(appPath, "prefs.json");
let scheduledActionInfo = { items: {} };
let broadcastStrings = {};
let prefs = {};

// Map of action key -> jQuery button selector for advanced actions (Shutdown/Remote/Settings/Close)
let actionShortcutMap = new Map();

// Use axios default adapter selection (XHR in renderer, HTTP in Node)
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
  checkInternet(await isReachable("www.jw.org", 443));
};
updateOnlineStatus();
require("electron").ipcRenderer.on("hideThenShow", (event, message) => {
  $("#overlay" + message[1]).fadeIn(400, () => {
    $("#overlay" + message[0]).hide();
  });
});
require("electron").ipcRenderer.on(
  "updateDownloadProgress",
  (event, message) => {
    const dotsDone = Math.floor(Number.parseFloat(message[0]) / 10);
    $("#updatePercent i:nth-of-type(" + dotsDone + ")")
      .addClass("fa-circle text-primary")
      .removeClass("fa-dot-circle");
  },
);
require("electron").ipcRenderer.on("macUpdate", () => {
  $("#btn-mac-update")
    .click(function () {
      openExternal("https://github.com/sircharlo/jw-launcher/releases/latest");
    })
    .parent()
    .fadeIn();
});
require("electron").ipcRenderer.on("goAhead", () => {
  $("#overlayPleaseWait").fadeIn(400, () => {
    $("#overlayUpdateCheck").hide();
    goAhead();
  });
});
$(".links tbody").on("change", "input, select", function () {
  $(".links tbody input:visible, .links tbody select:visible")
    .removeClass("is-invalid")
    .filter(function () {
      return !this.value;
    })
    .addClass("is-invalid");
  $(this)
    .closest("tr")
    .find(".btn-delete-link")
    .toggle($(this).closest("tr").find(".linkType").val() !== "");
  updateScheduleTargets();
});
function goAhead() {
  languageRefresh().then(function () {
    if (existsSync(prefsFile)) {
      try {
        prefs = JSON.parse(readFileSync(prefsFile));
        updateCleanup();
      } catch (err) {
        console.error(err, prefs);
        toggleScreen("overlaySettings", "show");
      }
    }
    prefsInitialize();
    processSettings();
    $("#version span.badge").html("v" + getVersion());
    $("#overlayPleaseWait").fadeOut();
    // Initialize scoped keyboard shortcuts on first load
    setShortcutScope("home");
    scheduleLoader();
  });
}
function isEscapeButton(event) {
  return event.key == "Escape" || event.key == "Esc";
}
function supportKey(event) {
  return (
    !(event.ctrlKey || event.metaKey || event.shiftKey) &&
    (event.code.includes("Key") ||
      /^[a-z]$/i.test(event.key) ||
      isEscapeButton(event))
  );
}
// Centralized, scoped keyboard shortcuts
let currentKeyHandler = null;
let currentShortcutScope = null; // one of: 'home' | 'featured' | 'streaming' | 'player'

function unregisterShortcuts() {
  if (currentKeyHandler) {
    globalThis.removeEventListener("keyup", currentKeyHandler, true);
    currentKeyHandler = null;
  }
}

function setShortcutScope(scope) {
  unregisterShortcuts();
  currentShortcutScope = scope;
  currentKeyHandler = function (event) {
    if (!supportKey(event) || $("#overlayPleaseWait").is(":visible")) return;
    // If any overlay other than videos/video player is visible, ignore shortcuts
    if ($(".overlay:visible").not("#videos, #videoPlayer").length > 0) return;
    const key = isEscapeButton(event)
      ? "escape"
      : String(event.key || "").toLowerCase();

    switch (currentShortcutScope) {
      case "home": {
        if (key === "escape") return; // nothing to do
        // First, check reverse alphabetical shortcuts for advanced actions
        if (actionShortcutMap.has(key)) {
          event.preventDefault();
          const sel = actionShortcutMap.get(key);
          try {
            $(sel).click();
          } catch (error) {
            console.error(error);
            return;
          }
          return;
        }
        const linksCount = $(".links tbody tr").filter(function () {
          return $(this).find(".linkName").val() !== "";
        }).length;
        const broadcastKey = String.fromCodePoint(
          linksCount + 65,
        ).toLowerCase();
        if (key === broadcastKey) {
          event.preventDefault();
          $("#broadcast1button").click();
        } else {
          const idx = key.codePointAt(0) - 97;
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
          const idx = key.codePointAt(0) - 97;
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
          const idx = key.codePointAt(0) - 97;
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
  globalThis.addEventListener("keyup", currentKeyHandler, true);
}
function isReachable(hostname, port) {
  return new Promise((resolve) => {
    try {
      let client = net.createConnection(port, hostname);
      client.setTimeout(5000);
      client.on("timeout", () => {
        client.destroy("Timeout: " + hostname + ":" + port);
      });
      client.on("connect", function () {
        client.destroy();
        resolve(true);
      });
      client.on("error", function (e) {
        console.error(e);
        resolve(false);
      });
    } catch (error) {
      console.error(error);
      resolve(false);
    }
  });
}
$("#overlaySettings tbody").on("click", ".btn-delete", function () {
  let parentTable = $(this).closest("tbody");
  $(this).closest("tr").remove();
  parentTable.find("tr").last().find("input").first().change();
});
$(".links tbody").on("change", ".streamUrl", function () {
  let val = $(this).val();
  // If it's a full URL starting with https://, extract the last part after the last /
  if (val.startsWith("https://")) {
    val = val.split("/").pop();
  }
  // Also remove any existing prefix like https://fle.stream.jw.org/
  val = val.replace("https://fle.stream.jw.org/", "");
  $(this).val(val);
});
$(".links tbody").on("change", ".linkName, .linkDetails input", function () {
  let linkArray = [];
  $(".links tbody tr").each(function () {
    if ($(this).find(".linkType").val().length > 0) {
      linkArray.push(
        $(this)
          .find(".linkType, .linkName, .linkDetails input")
          .map(function () {
            return $(this).val();
          })
          .get(),
      );
    }
  });
  if ($(".links tbody tr .is-invalid:visible").length === 0)
    $("#linkArray").val(JSON.stringify(linkArray)).change();
});
$(".links tbody").on("change", ".linkType", function () {
  let linkType = $(this).val();
  let thisRow = $(this).closest("tr");
  thisRow.find(".linkDetails").empty();
  thisRow.find(".linkName").val("").toggle(!!linkType);
  if (linkType === "zoom") {
    thisRow
      .find(".linkDetails")
      .append(
        "<div class='input-group input-group-sm'><span class='input-group-text'>ID</span><input type='text' class='form-control form-control-sm zoomId dynamic-field' placeholder='Zoom meeting ID' /><span class='input-group-text'>Password</span><input type='text' class='form-control form-control-sm zoomPassword dynamic-field' placeholder='Zoom meeting password' /></div>",
      );
    thisRow
      .find(".zoomId")
      .inputmask(
        ["999 999 999", "999 999 9999", "999 999 9999 9", "999 999 9999 99"],
        { clearIncomplete: true },
      );
  } else if (linkType === "stream") {
    thisRow
      .find(".linkDetails")
      .append(
        "<div class='input-group input-group-sm'><span class='input-group-text'>https://fle.stream.jw.org/</span><input type='text' class='form-control form-control-sm streamUrl dynamic-field' placeholder='t/ABCDEFGHIJKLOMNOPQRSTUVWXYZ' /></div>",
      );
  }
  thisRow.find("input").addClass("is-invalid");
  if (!$(this).hasClass("initializing")) validateSettings();
});
$(".schedule tbody").on("change", "input, select", function () {
  $(".schedule tbody input, .schedule tbody select")
    .removeClass("is-invalid")
    .filter(function () {
      return !this.value;
    })
    .addClass("is-invalid");
  let scheduleArray = [];
  $(".schedule tbody tr").each(function () {
    scheduleArray.push(
      $(this)
        .find("input, select")
        .map(function () {
          return $(this).val();
        })
        .get(),
    );
  });
  if ($(".schedule tbody tr .is-invalid:visible").length === 0) {
    $("#scheduleArray").val(JSON.stringify(scheduleArray)).change();
  } else {
    validateSettings();
  }
});
async function languageRefresh() {
  let availMedia = (
    await getJson(
      "https://b.jw-cdn.org/apis/mediator/v1/categories/E/StudioFeatured",
    )
  ).category.media
    .concat(
      (
        await getJson(
          "https://b.jw-cdn.org/apis/mediator/v1/categories/E/LatestVideos",
        )
      ).category.media,
    )
    .map((item) => item.availableLanguages);
  let availLangs = [...new Set([].concat(...availMedia))];
  for (var lang of Object.values(
    (
      await getJson(
        "https://b.jw-cdn.org/apis/mediator/v1/languages/E/all?clientType=www",
      )
    ).languages,
  ).filter((value) => availLangs.includes(value.code))) {
    $("#broadcastLang").append(
      $("<option>", {
        value: lang.code,
        text: lang.vernacular + " (" + lang.name + ")",
      }),
    );
  }
  $("#broadcastLang").select2();
}
function addNewLink() {
  $(".links tbody").append(
    "<tr draggable='true'><td><select class='form-select form-select-sm linkType dynamic-field'><option value='' hidden>Select a type</option><option value='zoom'>Zoom</option><option value='stream'>JW Stream</option></select></td><td><input type='text' class='form-control form-control-sm linkName dynamic-field' style='display: none;' placeholder='Enter a meaningful description' /></td><td><div class='linkDetails input-group'></div></td><td class='text-end'><button type='button' class='btn btn-light btn-sm btn-sort-schedule me-2 text-dark'><i class='fas fa-sort'></i></button><button type='button' class='btn btn-danger btn-sm btn-delete btn-delete-link' style='display: none;'><i class='fas fa-minus'></i></button></td></tr>",
  );
  $(".links tbody tr").last().find(".linkType").addClass("is-invalid");
}
function addNewSchedule() {
  $(".schedule tbody").append(
    "<tr draggable='true'><td><select class='form-select form-select-sm triggerDay dynamic-field is-invalid'><option value='' hidden></option><option value='1'>Monday</option><option value='2'>Tuesday</option><option value='3'>Wednesday</option><option value='4'>Thursday</option><option value='5'>Friday</option><option value='6'>Saturday</option><option value='0'>Sunday</option></select></td><td><input type='text' class='form-control form-control-sm triggerTime dynamic-field is-invalid' /></td><td><select class='form-select form-select-sm targetAction dynamic-field is-invalid'><option value='' hidden></option></select></td><td class='text-end'><button type='button' class='btn btn-light btn-sm btn-sort-schedule me-2 text-dark'><i class='fas fa-sort'></i></button><button type='button' class='btn btn-danger btn-sm btn-delete btn-delete-schedule'><i class='fas fa-minus'></i></button></td></tr>",
  );
  $(".schedule tbody tr")
    .last()
    .find(".triggerTime")
    .inputmask({ regex: "[0-2]\\d:[0-5]\\d", clearIncomplete: true });
  updateScheduleTargets();
}
function updateScheduleTargets() {
  $(".schedule select.targetAction").each(function () {
    let sel = $(this);
    let links = $(".links tbody tr").filter(function () {
      return $(this).find(".linkName").val() !== "";
    });
    sel
      .find("option")
      .slice(links.length + 1)
      .remove();
    sel.change();
    links.each(function (index) {
      if (sel.find("option[value=" + index + "]").length === 0)
        sel.append(
          $("<option>", {
            value: index,
          }),
        );
      sel
        .find("option[value=" + index + "]")
        .text(
          $(this).find(".linkName").val() +
            " - " +
            $(this).find(".linkType option:selected").text(),
        );
    });
  });
}
async function broadcastLoad() {
  var videos = 0;
  if (prefs.broadcastLang) {
    let req = await getJson(
      buildValidatedUrl("https://b.jw-cdn.org/apis/mediator/v1/translations/", prefs.broadcastLang, null),
    );
    console.log("Broadcast response: ", req);
    broadcastStrings = req.translations[prefs.broadcastLang];
    $("#broadcast1button")
      .css(
        "background-color",
        colors[
          $(
            $(".links tbody tr").filter(function () {
              return $(this).find(".linkName").val() !== "";
            }).length % colors.length,
          )
        ],
      )
      .html(
        "<div><kbd>" +
          String.fromCharCode(
            $(".links tbody tr").filter(function () {
              return $(this).find(".linkName").val() !== "";
            }).length + 65,
          ) +
          "</kbd></div><div class='align-items-center flex-fill' style='display: flex;'>" +
          broadcastStrings.ttlHome +
          "</div>",
      );
    $("#lblGoHome").html(broadcastStrings.btnStillWatchingGoBack);
    $("#lblGoHome2").html(broadcastStrings.btnStillWatchingGoBack);
    try {
      var studioFeatured = (
        await getJson(
          buildValidatedUrl("https://b.jw-cdn.org/apis/mediator/v1/categories/", prefs.broadcastLang, "StudioFeatured"),
        )
      ).category.media;
      var latestVideos = (
        await getJson(
          buildValidatedUrl("https://b.jw-cdn.org/apis/mediator/v1/categories/", prefs.broadcastLang, "LatestVideos"),
        )
      ).category.media;
      let allVideos = studioFeatured
        .concat(latestVideos.filter((item) => !studioFeatured.includes(item)))
        .slice(0, 16);
      allVideos = [
        ...new Map(allVideos.map((item) => [item["guid"], item])).values(),
      ];
      $(".featuredVideos > div:not(:first)").remove();
      for (var featuredVideo of allVideos) {
        videos++;
        var featuredVideoElement = $(
          "<div class='mt-0 pt-2'><div class='flex-column flex-fill h-100 rounded' data-url='" +
            featuredVideo.files.slice(-1)[0].progressiveDownloadURL +
            "' style='display: flex; background-image: url(\"" +
            featuredVideo.images.pnr.lg +
            "\"); background-size: cover; background-position: center;'><div class='flex-column flex-fill p-2' style='display: flex; background: linear-gradient(to right, rgba(0,0,0,0.9), rgba(0,0,0,0.6));'><div><h5 class='kbd'><kbd style='background-color: white; color: black;'>" +
            String.fromCharCode(65 + videos) +
            "</kbd></h5></div><div class='align-items-center flex-fill flex-row' style='display: flex;'><h5 style='color: white; white-space: normal; word-wrap: break-word;'>" +
            featuredVideo.title +
            "</h5></div></div></div></div>",
        ).click(function () {
          $("#videoPlayer")
            .append("<video controls autoplay></video>")
            .fadeIn();
          $("#videoPlayer video").append(
            "<source src='" + $(this).find("div").data("url") + "' / >",
          );
          setShortcutScope("player");
        });
        $(".featuredVideos").append(featuredVideoElement);
      }
      $(".featuredVideos > div").css(
        "height",
        100 / Math.ceil($(".featuredVideos > div").length / 5) + "%",
      );
    } catch (err) {
      console.error(
        "[ERROR] Failed to fetch StudioFeatured data for language: " + prefs.broadcastLang,
      );
    }
    $("#broadcast1button")
      .parent()
      .toggle(videos > 0);
  }
  return videos;
}
function buttonHeight(broadcastVideos) {
  let links = $(".links tbody tr").filter(function () {
      return $(this).find(".linkName").val() !== "";
    }).length,
    broadcast = broadcastVideos > 0 ? 1 : 0;
  $(".actions > div").css(
    "height",
    100 / Math.ceil((broadcast + links) / 3) + "%",
  );
}
async function downloadFile(url, progressElem) {
  try {
    let response = await axios.get(url, {
      responseType: "arraybuffer",
      onDownloadProgress: function (progressEvent) {
        var percent = (progressEvent.loaded / progressEvent.total) * 100;
        progressElem.css("width", percent + "%");
      },
    });
    return response.data;
  } catch (err) {
    console.error(err);
    return err;
  }
}
function generateButtons() {
  $(".actions .buttonContainer").remove();
  let links = $(".links tbody tr").filter(function () {
    return $(this).find(".linkName").val() !== "";
  });
  for (let link = 0; link < links.length; link++) {
    // Build container
    const $container = $("<div>").addClass("buttonContainer pt-2 flex-grow-1");

    // Build button
    const linkType = $(links[link]).find(".linkType").val();
    const linkName = $(links[link]).find(".linkName").val();
    const bgColor = colors[link % colors.length];

    // Collect link details safely
    const linkDetails = $(links[link])
      .find(".linkDetails input")
      .map(function () {
        return $(this).val();
      })
      .get()
      .join(",");

    // Button element
    const $button = $("<button>", {
      type: "button",
    })
      .addClass("align-items-center btn btn-lg flex-column h-100 w-100")
      // add linkType as a class without HTML concatenation
      .addClass("btn-" + linkType)
      // styles via css()
      .css({
        display: "flex",
        backgroundColor: bgColor,
      })
      // data attribute via attr()
      .attr("data-link-details", linkDetails);

    // Keyboard label
    const $kbdWrapper = $("<div>").append(
      $("<kbd>").text(String.fromCharCode(link + 65)),
    );

    // Text label (safe: text(), not html())
    const $label = $("<div>")
      .addClass("align-items-center flex-fill")
      .css("display", "flex")
      .text(linkName);

    // Assemble button
    $button.append($kbdWrapper, $label);
    $container.append($button);

    // Append to actions
    $(".actions").append($container);
  }
  $(".actions").append($(".actions > .broadcastContainer"));
}
function buildValidatedUrl(baseUrl, pathSegment, endpoint) {
  try {
    // Minimal path validation
    if (baseUrl.includes('/../') || /\/%2e%2e\//i.test(baseUrl)) {
      throw new Error('Invalid path');
    }
    
    const url = new URL(baseUrl);
    
    // Protocol + host checks
    const allowedDomains = ['b.jw-cdn.org', 'stream.jw.org']; // add your allowed domains here
    if (!allowedDomains.includes(url.hostname)) {
      throw new Error('Invalid host');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
    
    // Validate path parameters
    if (pathSegment && !/^[A-Za-z0-9_-]+$/.test(pathSegment)) {
      throw new Error('Invalid parameter');
    }
    
    // Rebuild pathname from fixed literals + validated segments
    if (pathSegment) {
      if (baseUrl.includes('/translations/') && !baseUrl.includes('/translations/all/')) {
        url.pathname = `/apis/mediator/v1/translations/${pathSegment}`;
      } else if (baseUrl.includes('/categories/')) {
        if (endpoint === "StudioFeatured") {
          url.pathname = `/apis/mediator/v1/categories/${pathSegment}/StudioFeatured`;
        } else if (endpoint === "LatestVideos") {
          url.pathname = `/apis/mediator/v1/categories/${pathSegment}/LatestVideos`;
        }
      } else if (baseUrl.includes('/translations/all/')) {
        url.pathname = `/assetsbWVkaWEK/translations/all/${pathSegment}.json`;
      }
    }
    
    // Add query parameters for category endpoints
    if (endpoint === "StudioFeatured" || endpoint === "LatestVideos") {
      url.searchParams.set('detailed', '0');
      url.searchParams.set('clientType', 'www');
    } else if (baseUrl.includes('languages/E/all')) {
      url.searchParams.set('clientType', 'www');
    }
    
    return url.href;
  } catch {
    throw new Error('Invalid URL');
  }
}

async function getJson(url) {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (err) {
    console.error(url, err);
    return null;
  }
}
function prefsInitialize() {
  for (var pref of [
    "linkArray",
    "scheduleArray",
    "labelShutdown",
    "labelRemoteAssistance",
    "labelSettings",
    "labelClose",
    "autoRunAtBoot",
    "enableShutdown",
    "enableRemoteAssistance",
    "enableClose",
    "enableShortcutShutdown",
    "enableShortcutRemoteAssistance",
    "enableShortcutSettings",
    "enableShortcutClose",
    // confirm toggles
    "confirmShutdown",
    "confirmRemoteAssistance",
    "confirmSettings",
    "confirmClose",
    "username",
  ]) {
    if (!Object.keys(prefs).includes(pref) || !prefs[pref]) {
      prefs[pref] = null;
    }
    if (
      $("#" + pref)[0].type == "text" ||
      $("#" + pref)[0].type == "select-one" ||
      $("#" + pref)[0].type == "range" ||
      $("#" + pref)[0].type == "hidden"
    ) {
      $("#" + pref).val(prefs[pref]);
    } else if ($("#" + pref)[0].type == "checkbox") {
      $("#" + pref).prop("checked", prefs[pref]);
    }
  }
  $("#broadcastLang")
    .val(prefs.broadcastLang ? prefs.broadcastLang : "")
    .select2();
  if (prefs.linkArray && JSON.parse(prefs.linkArray).length > 0) {
    for (let link of JSON.parse(prefs.linkArray)) {
      addNewLink();
      $(".links tbody tr")
        .last()
        .find(".linkType")
        .addClass("initializing")
        .val(link[0])
        .change()
        .removeClass("initializing is-invalid");
      link.shift();
      for (let linkPart = 0; linkPart < link.length; linkPart++) {
        $(".links tbody tr")
          .last()
          .find("input")
          .eq(linkPart)
          .val(link[linkPart])
          .removeClass("is-invalid");
      }
    }
    $(".links tbody tr").last().find(".linkName").change();
  }
  if (prefs.scheduleArray && JSON.parse(prefs.scheduleArray).length > 0) {
    for (let schedule of JSON.parse(prefs.scheduleArray)) {
      addNewSchedule();
      for (
        let schedulePart = 0;
        schedulePart < schedule.length;
        schedulePart++
      ) {
        $(".schedule tbody tr")
          .last()
          .find("input, select")
          .eq(schedulePart)
          .val(schedule[schedulePart])
          .removeClass("is-invalid");
      }
    }
    $(".schedule tbody tr").last().find("input").first().change();
  }
  processSettings();
}
// Reusable confirmation overlay with keyboard shortcuts
function showConfirm(message) {
  return new Promise((resolve) => {
    const $overlay = $("#overlayConfirm");
    const $msg = $("#overlayConfirmMessage");
    const $yes = $("#overlayConfirmYes");
    const $no = $("#overlayConfirmNo");
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      $yes.off("click", onYes);
      $no.off("click", onNo);
      window.removeEventListener("keyup", onKey, true);
      $overlay.fadeOut("fast");
    };
    const onYes = () => {
      resolve(true);
      cleanup();
    };
    const onNo = () => {
      resolve(false);
      cleanup();
    };
    const onKey = (e) => {
      if (!supportKey(e)) return;
      const key = isEscapeButton(e)
        ? "escape"
        : String(e.key || "").toLowerCase();
      if (key === "y") {
        e.preventDefault();
        onYes();
      } else if (key === "n" || key === "escape") {
        e.preventDefault();
        onNo();
      }
    };
    $msg.text(message);
    $yes.on("click", onYes);
    $no.on("click", onNo);
    window.addEventListener("keyup", onKey, true);
    $overlay.fadeIn("fast");
  });
}
async function confirmIfNeeded(prefKey, actionDesc, proceedFn) {
  if (prefs[prefKey]) {
    const ok = await showConfirm(`Are you sure you want to ${actionDesc}?`);
    if (!ok) return;
  }
  proceedFn();
}
function processSettings() {
  const defaultLabels = {
    Settings: "Settings",
    Shutdown: "Shutdown",
    RemoteAssistance: "Remote assistance",
    Close: "Close",
  };
  for (var label of ["Settings", "Shutdown", "RemoteAssistance", "Close"]) {
    $("#lbl" + label).text(prefs["label" + label] || defaultLabels[label]);
  }
  for (var enableMe of ["Shutdown", "RemoteAssistance"]) {
    $("#btn" + enableMe)
      .parent()
      .toggle(!!prefs["enable" + enableMe]);
  }
  // Close action visibility
  $("#btnCloseContainer").toggle(!!prefs.enableClose);
  setLoginItemSettings({
    openAtLogin: prefs.autoRunAtBoot,
  });
  broadcastLoad().then(function (broadcastVideos) {
    for (var setting of ["broadcastLang", "username"]) {
      $("#" + setting)
        .toggleClass("is-invalid", !prefs[setting])
        .next("span.select2")
        .toggleClass("is-invalid", !prefs[setting]);
    }
    validateSettings();
    buttonHeight(broadcastVideos);
    updateActionShortcuts();
    renderActionShortcutBadges();
  });
}
function updateActionShortcuts() {
  // Build list of visible actions with shortcut enabled, in priority order: Close, Settings, Remote, Shutdown
  const candidates = [];
  if (prefs.enableClose && prefs.enableShortcutClose)
    candidates.push({ key: null, sel: "#btnClose" });
  if (prefs.enableShortcutSettings)
    candidates.push({ key: null, sel: "#btnSettings" });
  if (prefs.enableRemoteAssistance && prefs.enableShortcutRemoteAssistance)
    candidates.push({ key: null, sel: "#btnRemoteAssistance" });
  if (prefs.enableShutdown && prefs.enableShortcutShutdown)
    candidates.push({ key: null, sel: "#btnShutdown" });
  // Assign reverse alphabetical keys starting from 'z'
  actionShortcutMap = new Map();
  let code = "z".charCodeAt(0);
  for (let i = 0; i < candidates.length; i++) {
    const k = String.fromCharCode(code - i);
    actionShortcutMap.set(k, candidates[i].sel);
  }
}
function renderActionShortcutBadges() {
  // Clear existing badges
  $("#kbdShutdown, #kbdRemoteAssistance, #kbdSettings, #kbdClose").each(
    function () {
      $(this).html("").hide();
    },
  );
  // Helper to find key by selector
  const getKeyForSelector = (sel) => {
    for (const [k, v] of actionShortcutMap.entries()) if (v === sel) return k;
    return null;
  };
  const mapping = [
    { sel: "#btnShutdown", kbd: "#kbdShutdown" },
    { sel: "#btnRemoteAssistance", kbd: "#kbdRemoteAssistance" },
    { sel: "#btnSettings", kbd: "#kbdSettings" },
    { sel: "#btnClose", kbd: "#kbdClose" },
  ];
  for (const m of mapping) {
    const key = getKeyForSelector(m.sel);
    if (key)
      $(m.kbd)
        .html("<kbd>" + key.toUpperCase() + "</kbd>")
        .show();
  }
}
function scheduleLoader() {
  let d = new Date();
  let schedules = [];
  $(".schedule tbody tr")
    .filter(function () {
      return $(this).find(".is-invalid").length === 0;
    })
    .each(function () {
      let scheduledItem = {};
      $(this)
        .find("select, input")
        .each(function () {
          scheduledItem[
            Array.from($(this).prop("classList"))
              .filter((str) => new RegExp("trigger|target", "g").test(str))
              .join("")
          ] = $(this).val();
        });
      schedules.push(scheduledItem);
    });
  if (schedules.length > 0 && $("#home:visible").length > 0) {
    for (var s = 0; s < schedules.length; s++) {
      let schedule = schedules[s];
      const sKey =
        schedule.triggerDay +
        "|" +
        schedule.triggerTime +
        "|" +
        schedule.targetAction;

      // Skip if already handled (run or skipped) in the last 12 hours
      if (
        scheduledActionInfo.items &&
        scheduledActionInfo.items[sKey] &&
        (d - scheduledActionInfo.items[sKey]) / 1000 / 60 / 60 < 12
      )
        continue;
      // Skip if currently pending
      if (
        scheduledActionInfo.items &&
        scheduledActionInfo.items[sKey] === "pending"
      )
        continue;

      if (d.getDay() == schedule.triggerDay) {
        let triggerTime = schedule.triggerTime.split(":");
        let targetDate = new Date(d);
        targetDate.setHours(triggerTime[0], triggerTime[1], 0, 0);
        let timeToEvent = (targetDate - d) / 1000 / 60;

        if (timeToEvent >= -105 && timeToEvent <= 30) {
          console.log("[SCHEDULE] Triggering scheduled item: " + sKey);
          if (!scheduledActionInfo.items) scheduledActionInfo.items = {};
          scheduledActionInfo.items[sKey] = "pending";
          $("#actionDesc").text(
            $(".schedule tbody tr .targetAction")
              .eq(s)
              .find("option:selected")
              .text(),
          );
          $("#overlayScheduledAction").data("sKey", sKey);
          $("#overlayScheduledAction")
            .stop()
            .fadeIn()
            .delay(10000)
            .fadeOut(400, function () {
              if (scheduledActionInfo.items[sKey] === "pending") {
                $(".actions button").eq(schedule.targetAction).click();
                scheduledActionInfo.items[sKey] = new Date();
              } else if (scheduledActionInfo.items[sKey] === "skipped") {
                scheduledActionInfo.items[sKey] = new Date();
              }
            });
          let timeLeft = 10;
          let downloadTimer = setInterval(function () {
            if (timeLeft <= 0) clearInterval(downloadTimer);
            $("#scheduledDelayProgress .progress-bar").css(
              "width",
              (10 - timeLeft + 1) * 10 + "%",
            );
            timeLeft -= 1;
          }, 1000);
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
    $(
      "#home" + (screen !== "overlayPleaseWait" ? ", #overlayPleaseWait" : ""),
    ).hide();
  } else if (action == "hide" || visible) {
    $("#home").show();
    $("#" + screen).fadeOut("fast");
  } else {
    $("#" + screen).fadeIn("fast");
    $(
      "#home" + (screen !== "overlayPleaseWait" ? ", #overlayPleaseWait" : ""),
    ).hide();
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
    writeFileSync(
      prefsFile,
      JSON.stringify(
        Object.keys(prefs)
          .sort()
          .reduce((acc, key) => ({ ...acc, [key]: prefs[key] }), {}),
        null,
        2,
      ),
    );
  } catch (err) {
    console.error(err);
  }
}
function validateSettings() {
  let configIsValid = $("#overlaySettings .is-invalid").length === 0;
  $(".btnSettings")
    .prop("disabled", !configIsValid)
    .toggleClass("btn-danger", !configIsValid)
    .toggleClass("btn-secondary", configIsValid);
  $("#settingsIcon")
    .toggleClass("text-danger", !configIsValid)
    .toggleClass("text-muted", configIsValid);
  if (configIsValid) generateButtons();
  if (!configIsValid) toggleScreen("overlaySettings", "show");
  return configIsValid;
}
$(".btnSettings, #btnSettings").on("click", function () {
  toggleScreen("overlaySettings");
});
$("#overlayScheduledAction button").on("click", function () {
  $("#overlayScheduledAction").stop().fadeOut();
  const sKey = $("#overlayScheduledAction").data("sKey");
  if (sKey) {
    if (!scheduledActionInfo.items) scheduledActionInfo.items = {};
    scheduledActionInfo.items[sKey] = "skipped";
  }
});
$(
  "#overlaySettings input:not(.dynamic-field), #overlaySettings select:not(.dynamic-field)",
).on("change", function () {
  if ($(this).prop("tagName") == "INPUT") {
    if ($(this).prop("type") == "checkbox") {
      prefs[$(this).prop("id")] = $(this).prop("checked");
    } else if ($(this).prop("type") == "radio") {
      prefs[$(this).closest("div").prop("id")] = $(this)
        .closest("div")
        .find("input:checked")
        .val();
    } else if (
      $(this).prop("type") == "text" ||
      $(this).prop("type") == "password" ||
      $(this).prop("type") == "range" ||
      $(this).prop("type") == "hidden"
    ) {
      prefs[$(this).prop("id")] = $(this).val();
    }
  } else if ($(this).prop("tagName") == "SELECT") {
    prefs[$(this).prop("id")] = $(this).find("option:selected").val();
  }
  writeFileSync(
    prefsFile,
    JSON.stringify(
      Object.keys(prefs)
        .sort()
        .reduce((acc, key) => ({ ...acc, [key]: prefs[key] }), {}),
      null,
      2,
    ),
  );
  processSettings();
});
$("#autoRunAtBoot").on("change", function () {
  setLoginItemSettings({
    openAtLogin: prefs.autoRunAtBoot,
  });
});
$("#broadcastLang").on("change", function () {
  $(".featuredVideos > div:not(:first-of-type)").remove();
});
$("#btnShutdown").on("click", function () {
  confirmIfNeeded(
    "confirmShutdown",
    (prefs.labelShutdown || "Shutdown").toLowerCase(),
    () => {
      powerControl.powerOff();
    },
  );
});
$("#btnClose").on("click", function () {
  confirmIfNeeded(
    "confirmClose",
    (prefs.labelClose || "Close").toLowerCase(),
    () => {
      try {
        quit();
      } catch (e) {
        console.error(e);
      }
    },
  );
});
$(".btn-add-link").on("click", function () {
  addNewLink();
});
$(".btn-add-schedule").on("click", function () {
  addNewSchedule();
  validateSettings();
});
$("#btnExport").on("click", function () {
  const outPath = remote.dialog.showSaveDialogSync({
    defaultPath: "prefs.json",
  });
  if (outPath) {
    writeFileSync(outPath, JSON.stringify(prefs, null, 2));
  }
});
$("#closeButton").on("click", function () {
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
$("#broadcast1button").on("click", function () {
  toggleScreen("videos", "show");
  $("#videos>div").show();
  $(".streamingVideos").first().parent().hide();
  $("#videoPlayer").hide();
  setShortcutScope("featured");
});
$("#btnGoHome, #btnGoHome2").on("click", function () {
  toggleScreen("videos", "hide");
  setShortcutScope("home");
});
$(".streamingVideos").on(
  "click",
  ".flex-column:not(.lblGoHome2)",
  async function () {
    try {
      toggleScreen("overlayPleaseWait", "show");
      const guid = $(this).data("guid");
      const specialtyGuid = $(this).data("specialty");
      const url = $(this).data("playurl") || $(this).data("url");
      const audioUrl = $(this).data("audiourl") || "";
      const quality = $(this).data("quality") || "undefined";
      await axios.put(
        "https://stream.jw.org/api/v1/libraryBranch/program/presignURL",
        {
          guid,
          specialtyGuid,
          url,
          audioUrl,
          programUrlType: "video",
          quality,
          size: 0,
          legacyQuality: "",
          programType: "vod",
          isHome: true,
          isAudioOnly: false,
        },
        {
          headers: {
            "X-Referer": "https://stream.jw.org/home?playerOpen=true",
          },
        },
      );
      const detail = await axios.get(
        `https://stream.jw.org/api/v1/program/getByGuidForHome/vod/${guid}`,
        { headers: { "content-type": undefined } },
      );
      if (detail && detail.data && Array.isArray(detail.data.downloadUrls)) {
        const dls = detail.data.downloadUrls;
        const preferred =
          dls.find((d) => d.quality === "720") ||
          dls.find((d) => d.quality === "540") ||
          dls.find((d) => d.quality === "360") ||
          dls[0];
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
            category_guid: detail.data.category_guid,
          };
          const presigned = await axios.put(
            "https://stream.jw.org/api/v1/libraryBranch/program/presignURL",
            presignBody,
          );
          console.log(
            "PUT https://stream.jw.org/api/v1/libraryBranch/program/presignURL",
            presigned.status,
            presigned.data,
          );
          const signedUrl =
            presigned &&
            presigned.data &&
            (presigned.data.presignedUrl || presigned.data.url)
              ? presigned.data.presignedUrl || presigned.data.url
              : mp4Url;
          console.log("Signed URL: ", signedUrl);
          $("#videoPlayer")
            .append(
              "<video controls autoplay><source src='" +
                signedUrl +
                "' / ></video>",
            )
            .fadeIn();
          setShortcutScope("player");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      toggleScreen("overlayPleaseWait", "hide");
    }
  },
);
$(".actions").on("click", ".btn-zoom", function () {
  let linkDetails = $(this).data("link-details").split(",");
  openExternal(
    "zoommtg://zoom.us/join?confno=" +
      linkDetails[0].replace(/\D+/g, "") +
      "&pwd=" +
      linkDetails[1] +
      "&uname=" +
      prefs.username,
  );
  let timeLeft = 15;
  let loadZoomTimer = setInterval(function () {
    $("#loadingProgress .progress-bar")
      .css("width", ((15 - timeLeft + 1) * 100) / 15 + "%")
      .closest("div.align-self-center")
      .show();
    if (timeLeft <= 0) {
      clearInterval(loadZoomTimer);
      $("#loadingProgress .progress-bar")
        .css("width", "0%")
        .closest("div.align-self-center")
        .hide();
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
    let linkTokenRaw = decodeURIComponent(
      $(this).data("link-details").split(",")[0],
    );
    let linkToken = linkTokenRaw.split("/").slice(-1)[0];
    console.log("Creating axios client for link token: ", linkToken);
    const loginRes = await axios.post(
      `https://stream.jw.org/api/v1/auth/login/share`,
      { token: linkToken },
      { headers: { "X-Referer": `https://stream.jw.org/${linkToken}` } },
    );
    console.log(
      "POST https://stream.jw.org/api/v1/auth/login/share",
      loginRes.status,
      loginRes.data,
    );
    const whoamiRes = await axios.get(
      `https://stream.jw.org/api/v1/auth/whoami`,
      { headers: { "X-Referer": `https://stream.jw.org/${linkToken}` } },
    );
    console.log(
      "GET https://stream.jw.org/api/v1/auth/whoami",
      whoamiRes.status,
      whoamiRes.data,
    );
    const linkRes = await axios.get(
      `https://stream.jw.org/api/v1/libraryBranch/library/link/${linkToken}`,
      { headers: { "X-Referer": `https://stream.jw.org/${linkToken}` } },
    );
    console.log(
      `GET https://stream.jw.org/api/v1/libraryBranch/library/link/${linkToken}`,
      linkRes.status,
      linkRes.data,
    );
    const categoriesRes = await axios.get(
      `https://stream.jw.org/api/v1/libraryBranch/home/category`,
    );
    console.log(
      "GET https://stream.jw.org/api/v1/libraryBranch/home/category",
      categoriesRes.status,
      categoriesRes.data,
    );
    const categoryList = Array.isArray(categoriesRes.data)
      ? categoriesRes.data
      : categoriesRes.data && Array.isArray(categoriesRes.data.items)
        ? categoriesRes.data.items
        : [];
    const categoryType =
      (categoryList.find((x) => x && x.categoryType) || {}).categoryType ||
      "theocraticProgram";
    const subCatsRes = await axios.get(
      `https://stream.jw.org/api/v1/libraryBranch/home/subCategory/${categoryType}`,
    );
    console.log(
      `GET https://stream.jw.org/api/v1/libraryBranch/home/subCategory/${categoryType}`,
      subCatsRes.status,
      subCatsRes.data,
    );
    let specialtyIds = [];
    if (subCatsRes && subCatsRes.data) {
      if (Array.isArray(subCatsRes.data)) {
        specialtyIds = subCatsRes.data.flatMap((x) =>
          x.specialties.map((s) => s.key).filter(Boolean),
        );
      } else if (Array.isArray(subCatsRes.data.items)) {
        specialtyIds = subCatsRes.data.items.flatMap((x) =>
          x.specialties.map((s) => s.key).filter(Boolean),
        );
      }
    }
    let allPrograms = [];
    for (let i = 0; i < specialtyIds.length; i++) {
      $("#loadingProgress .progress-bar")
        .css("width", ((i + 1) * 100) / specialtyIds.length + "%")
        .closest("div.align-self-center")
        .show();
      try {
        console.log("Fetching program for specialty ID: ", specialtyIds[i]);
        const prog = await axios.get(
          `https://stream.jw.org/api/v1/libraryBranch/home/vodProgram/specialty/${specialtyIds[i]}`,
        );
        console.log(
          `GET https://stream.jw.org/api/v1/libraryBranch/home/vodProgram/specialty/${specialtyIds[i]}`,
          prog.status,
          prog.data,
        );
        if (prog && prog.data) allPrograms.push(prog.data);
      } catch (error) {
        console.error(error);
      }
    }
    $("#loadingProgress .progress-bar")
      .css("width", "0%")
      .closest("div.align-self-center")
      .hide();
    let items = [];
    for (const p of allPrograms) {
      let arr = [];
      if (Array.isArray(p)) arr = p;
      else if (Array.isArray(p.items)) arr = p.items;
      else if (Array.isArray(p.programs)) arr = p.programs;
      for (const it of arr) items.push(it);
    }
    let added = 0;
    for (const it of items) {
      let playUrl = it.playUrl?.url ?? null;
      if (
        !playUrl &&
        Array.isArray(it.downloadUrls) &&
        it.downloadUrls.length > 0
      ) {
        const preferred =
          it.downloadUrls.find((d) => d.quality === "720") ||
          it.downloadUrls.find((d) => d.quality === "540") ||
          it.downloadUrls[0];
        playUrl = preferred?.url ?? null;
      }
      if (!playUrl) continue;
      const thumb =
        typeof it.thumbnail === "string" && it.thumbnail.length > 0
          ? it.thumbnail.startsWith("/")
            ? "https://stream.jw.org" + it.thumbnail
            : it.thumbnail
          : "";
      const pub = it.publishedDate
        ? new Date(Number.parseInt(it.publishedDate)).toLocaleDateString()
        : "";
      let desc = it.title;
      console.log("Additional fields: ", it.additionalFields);
      if (!desc?.length && it.additionalFields) {
        try {
          const jsonObj = JSON.parse(it.additionalFields);
          desc = jsonObj.themeAndSession;
          if (it.languageCode) {
            const validatedUrl = buildValidatedUrl("https://stream.jw.org/assetsbWVkaWEK/translations/all/", it.languageCode, null);
            const i18nRes = await axios.get(validatedUrl);
            console.log(
              `GET ${validatedUrl}`,
              i18nRes.status,
              i18nRes.data,
            );
            const i18n = i18nRes.data;
            desc = i18n[desc];
          }
        } catch (e) {
          console.error(e);
        }
      }
      if (!desc) {
        desc = it.subcategory_name || it.categoryProgramType || "Program";
      }
      console.log("Description: ", desc);
      const guid = it.key || it.guid || (it.playUrl && it.playUrl.guid) || "";
      const specialtyGuid =
        (it.playUrl && it.playUrl.specialtyGuid) || it.specialtyGuid || "";
      const audioUrl = (it.playUrl && it.playUrl.audioUrl) || "";
      const quality = (it.playUrl && it.playUrl.quality) || "undefined";
      $(".streamingVideos").append(
        "<div class='mt-0 pt-2'>" +
          "<div class='flex-column flex-fill h-100 rounded' " +
          "data-url='" +
          playUrl +
          "' " +
          "data-playurl='" +
          playUrl +
          "' " +
          "data-guid='" +
          guid +
          "' " +
          "data-specialty='" +
          specialtyGuid +
          "' " +
          "data-audiourl='" +
          audioUrl +
          "' " +
          "data-quality='" +
          quality +
          "' " +
          "style='display: flex; flex-direction: row; background-image: url(\"" +
          thumb +
          "\"); background-size: cover; background-position: center;'>" +
          "<div class='flex-column flex-fill p-2' style='display: flex; background: linear-gradient(to right, rgba(0,0,0,0.9), rgba(0,0,0,0.6));'>" +
          "<div><h6 class='kbd'><kbd style='background-color: white; color: black;'>" +
          String.fromCharCode(66 + added) +
          "</kbd></h6></div>" +
          "<div class='align-items-center flex-fill flex-row' style='display: flex;'><h6 style='color: white; white-space: normal; word-wrap: break-word;'>" +
          desc +
          "</h6></div>" +
          (pub
            ? "<div><p style='color: white; white-space: normal; word-wrap: break-word;'>" +
              pub +
              "</p></div>"
            : "") +
          "</div>" +
          "</div>" +
          "</div>" +
          "</div>",
      );
      added++;
    }
    $(".streamingVideos > div").css(
      "height",
      100 / Math.ceil($(".streamingVideos > div").length / 4) + "%",
    );
    toggleScreen("videos");
    setShortcutScope("streaming");
  } catch (err) {
    let badLink = $(this).data("link-details");
    $(".streamUrl")
      .filter(function () {
        return $(this).val() === badLink;
      })
      .addClass("is-invalid");
    toggleScreen("overlaySettings", "show");
    console.error(err);
  }
});
$("#btnRemoteAssistance").on("click", async function () {
  const run = async () => {
    $("#loadingProgress .progress-bar").closest("div.align-self-center").show();
    $("#overlayPleaseWait").fadeIn();
    var qsUrl = "https://download.teamviewer.com/download/TeamViewerQS.exe";
    if (process.platform == "darwin") {
      qsUrl = "https://download.teamviewer.com/download/TeamViewerQS.dmg";
    } else if (process.platform == "linux") {
      qsUrl =
        "https://download.teamviewer.com/download/version_11x/teamviewer_qs.tar.gz";
    }
    var initialTriggerText = $(this).html();
    $(this).prop("disabled", true);
    var qs = await downloadFile(qsUrl, $("#loadingProgress .progress-bar"));
    $("#overlayPleaseWait")
      .delay(15000)
      .fadeOut(400, function () {
        $("#loadingProgress .progress-bar")
          .closest("div.align-self-center")
          .hide();
      });
    var qsFilename = path.basename(qsUrl);
    try {
      if (qs && !(qs instanceof Error)) {
        const destPath = path.join(appPath, qsFilename);
        writeFileSync(destPath, Buffer.from(qs));
        openExternal(destPath);
      } else {
        console.error("Failed to download TeamViewer QuickSupport:", qs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      $(this).html(initialTriggerText).prop("disabled", false);
    }
  };
  await confirmIfNeeded(
    "confirmRemoteAssistance",
    (prefs.labelRemoteAssistance || "Remote assistance").toLowerCase(),
    run,
  );
});
$(document).on("select2:open", () => {
  document.querySelector(".select2-search__field").focus();
});
$(".btn-sort-schedules").on("click", function () {
  const getCellValue = (tr, idx) => {
    let val = $(tr).find("td").eq(idx).find("input, select").val();
    return val == 0 ? val + 7 : val;
  };
  const comparer = (idx, asc) => (a, b) =>
    ((v1, v2) =>
      v1 !== "" && v2 !== "" && !isNaN(v1) && !isNaN(v2)
        ? v1 - v2
        : v1.toString().localeCompare(v2))(
      getCellValue(asc ? a : b, idx),
      getCellValue(asc ? b : a, idx),
    );
  const table = $(".schedule tbody").get(0);
  Array.from(table.querySelectorAll("tr"))
    .sort(comparer(1, true))
    .sort(comparer(0, true))
    .forEach((tr) => table.appendChild(tr));
  $(".schedule tbody input, .schedule tbody schedule").last().change();
});
let eventSrcElem, sourceRow;
$(".links tbody, .schedule tbody")
  .on("dragstart", "tr", function () {
    eventSrcElem = $(event.target).closest("tbody").get(0);
    sourceRow = $(event.target).closest("tr");
    if ($(event.target).closest("tr").find(".btn-delete:visible").length === 0)
      return false;
  })
  .on("dragover", "tr", function () {
    event.preventDefault();
    try {
      if (eventSrcElem === $(event.target).closest("tbody").get(0)) {
        let targetRow = $(event.target).closest("tr").get(0);
        let targetTableChildren = Array.from(
          $(event.target).closest("tbody").get(0).children,
        );
        if (
          targetTableChildren.indexOf(targetRow) >
          targetTableChildren.indexOf(sourceRow.get(0))
        ) {
          targetRow.after(sourceRow.get(0));
        } else if (
          targetTableChildren.indexOf(targetRow) <
          targetTableChildren.indexOf(sourceRow.get(0))
        ) {
          targetRow.before(sourceRow.get(0));
        }
      }
    } catch (err) {
      console.error(err);
    }
  })
  .on("dragend", "tr", function () {
    sourceRow.find("input, select").last().change();
  });
