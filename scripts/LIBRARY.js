// DCP v1.6.3 - LIBRARY.js
// Includes DCP profiles and DCPTime in one Library file.
(function () {
  "use strict";

  var SECTIONS = [
    "behavior", "speech", "capabilities", "reactions"
  ];
  var LEGACY_SECTION_MAP = {
    appearance: "behavior",
    personality: "behavior",
    history: "behavior",
    abilities: "capabilities",
    quirks: "behavior",
    relationships: "reactions",
    mannerisms: "behavior",
    species: "behavior",
    other: "behavior",
    speech: "speech"
  };
  var MAX_SECTIONS_PER_PROFILE = 2;
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var WIDGET_IDS = ["dcp_active", "dcp_budget", "dcp_focus"];
  var EXTRACT_COMMAND_TOKENS = ["/profile", "/remind", "/time", "/waituntil", "/wait", "/sleep", "/nap", "/rest", "/tomorrow", "/now", "/pause", "/resume"];
  var TIME_COMMAND_TOKENS = ["/remind", "/time", "/waituntil", "/wait", "/sleep", "/nap", "/rest", "/tomorrow", "/now", "/pause", "/resume"];

  function trimStr(s) {
    return String(s || "").replace(/^\s+|\s+$/g, "");
  }

  function lowerStr(s) {
    return trimStr(s).toLowerCase();
  }

  function normalizeName(name) {
    return lowerStr(name);
  }

  function safeText(value) {
    return (typeof value === "string") ? value : "";
  }

  function pad2(n) {
    n = parseInt(n, 10);
    if (isNaN(n)) n = 0;
    return (n < 10 ? "0" : "") + String(n);
  }

  function ensurePlainObject(value) {
    return (value && typeof value === "object" && !Array.isArray(value)) ? value : {};
  }

  function isWordBoundary(ch) {
    return !ch || " \t\n\r.,!?;:'\"-()[]{}/<>@#$%^&*~`+=|\\".indexOf(ch) !== -1;
  }

  function containsWord(source, word) {
    source = String(source || "").toLowerCase();
    word = String(word || "").toLowerCase();
    if (!word) return false;
    var idx = 0;
    while (true) {
      idx = source.indexOf(word, idx);
      if (idx === -1) return false;
      var before = (idx === 0) || isWordBoundary(source.charAt(idx - 1));
      var after = (idx + word.length >= source.length) || isWordBoundary(source.charAt(idx + word.length));
      if (before && after) return true;
      idx += 1;
    }
  }

  function startsWithCommand(raw, token) {
    raw = lowerStr(raw);
    token = lowerStr(token);
    return raw.indexOf(token) === 0 && (raw.length === token.length || raw.charAt(token.length) === " ");
  }

  function startsWithAnyCommand(raw, tokens) {
    for (var i = 0; i < tokens.length; i++) {
      if (startsWithCommand(raw, tokens[i])) return true;
    }
    return false;
  }

  function isCommandBoundary(ch) {
    return !ch || " \t\r\n\"'`([{<".indexOf(ch) !== -1;
  }

  function stripOuterQuotes(s) {
    s = trimStr(s);
    while (s && "\"'`".indexOf(s.charAt(0)) !== -1) s = trimStr(s.substring(1));
    while (s && "\"'`".indexOf(s.charAt(s.length - 1)) !== -1) s = trimStr(s.substring(0, s.length - 1));
    return s;
  }

  function stripTrailingCommandNoise(s) {
    s = trimStr(s);
    while (s && "\"'`".indexOf(s.charAt(s.length - 1)) !== -1) s = trimStr(s.substring(0, s.length - 1));
    while (s && ".!?".indexOf(s.charAt(s.length - 1)) !== -1) s = trimStr(s.substring(0, s.length - 1));
    while (s && "\"'`".indexOf(s.charAt(s.length - 1)) !== -1) s = trimStr(s.substring(0, s.length - 1));
    return s;
  }

  function canonicalizeCommandPrefix(raw, token) {
    raw = String(raw || "");
    token = lowerStr(token);
    return (lowerStr(raw).indexOf(token) === 0) ? (token + raw.substring(token.length)) : raw;
  }

  function findEmbeddedCommand(raw, token) {
    raw = String(raw || "");
    token = lowerStr(token);
    var lower = raw.toLowerCase();
    var idx = lower.indexOf(token);
    while (idx !== -1) {
      if (idx === 0 || isCommandBoundary(raw.charAt(idx - 1))) {
        return {
          index: idx,
          command: stripTrailingCommandNoise(stripOuterQuotes(canonicalizeCommandPrefix(raw.substring(idx), token)))
        };
      }
      idx = lower.indexOf(token, idx + 1);
    }
    return null;
  }

  function extractEmbeddedCommand(raw, token) {
    var found = findEmbeddedCommand(raw, token);
    return found ? found.command : "";
  }

  function findAnyCommand(raw) {
    var best = null;
    for (var i = 0; i < EXTRACT_COMMAND_TOKENS.length; i++) {
      var found = findEmbeddedCommand(raw, EXTRACT_COMMAND_TOKENS[i]);
      if (!found) continue;
      if (!best || found.index < best.index) best = found;
    }
    return best;
  }

  function extractAnyCommand(raw) {
    var found = findAnyCommand(raw);
    return found ? found.command : "";
  }

  function profileSize(profile) {
    var total = 0;
    var sections = (profile && profile.sections) || {};
    for (var key in sections) {
      if (sections.hasOwnProperty(key) && typeof sections[key] === "string") total += sections[key].length;
    }
    return total;
  }

  function parseKeywords(str) {
    var source = String(str || "");
    var parts = (source.indexOf(",") !== -1) ? source.split(",") : source.split(/\s+/);
    var out = [];
    var seen = {};
    for (var i = 0; i < parts.length; i++) {
      var word = lowerStr(parts[i]);
      if (word && !seen[word]) {
        seen[word] = true;
        out.push(word);
      }
    }
    return out;
  }

  function normalizeSectionName(section) {
    var clean = lowerStr(section);
    if (SECTIONS.indexOf(clean) !== -1) return clean;
    if (LEGACY_SECTION_MAP.hasOwnProperty(clean)) return LEGACY_SECTION_MAP[clean];
    return "";
  }

  function appendSectionText(existing, addition) {
    existing = trimStr(existing);
    addition = trimStr(addition);
    if (!addition) return existing;
    if (!existing) return addition;
    if (existing.indexOf(addition) !== -1) return existing;
    return existing + " " + addition;
  }

  function appendMappedSection(targetSections, rawSection, value) {
    var mapped = normalizeSectionName(rawSection);
    var cleanValue = trimStr(value);
    if (!mapped || !cleanValue) return;
    targetSections[mapped] = appendSectionText(targetSections[mapped], cleanValue);
  }

  function migrateProfileSections(profile) {
    if (!profile || typeof profile !== "object") return;
    var incoming = ensurePlainObject(profile.sections);
    var migrated = {};
    for (var rawSection in incoming) {
      if (!incoming.hasOwnProperty(rawSection)) continue;
      if (typeof incoming[rawSection] !== "string") continue;
      appendMappedSection(migrated, rawSection, incoming[rawSection]);
    }
    profile.sections = migrated;
  }

  function defaultSectionKeywords() {
    return {
      behavior: [
        "approach","approaches","approached","step closer","steps closer","close the distance",
        "pulls back","retreat","retreats","keeps distance","leans against","crosses arms",
        "crosses her arms","crosses his arms","pushes off","watches you","holds your gaze",
        "stays close","nudges your arm","tilts her head","tilts his head","goes still",
        "fidget","fidgets","hovers near"
      ],
      speech: [
        "says","said","asks","asked","replies","replied","answers","answered",
        "voice low","voice flat","voice quiet","after a pause","murmurs","mutter",
        "mutters","muttered","whisper","whispers","whispered","snaps","snapped",
        "drawls","dryly"
      ],
      capabilities: [
        "takes the wheel","take the wheel","drives","drive","driving","shoot","shoots",
        "fight","fights","draw","draws","drawn","scan","scanner","spoof","spoofs",
        "unlock","unlocks","ram","rams","kick","kicks","carry","carries","notice",
        "notices","noticed","remember","remembers","remembered"
      ],
      reactions: [
        "jaw tightens","breath hitches","expression softens","looks away","goes still",
        "doesn't flinch","doesnt flinch","doesn't move away","doesnt move away",
        "pulls back","voice loses","softens slightly","stares at the floor","slumps",
        "blush","blushes","blushing","jealous","hurt","afraid","scared","flustered",
        "tremble","trembles","trembling","defensive","protective","possessive","territorial"
      ]
    };
  }

  function getSectionKeywords(overrides) {
    var base = defaultSectionKeywords();
    var custom = ensurePlainObject(overrides);
    for (var section in custom) {
      if (!custom.hasOwnProperty(section)) continue;
      var mapped = normalizeSectionName(section);
      if (!mapped) continue;
      if (!custom[section] || !custom[section].length) continue;
      for (var i = 0; i < custom[section].length; i++) {
        var keyword = lowerStr(custom[section][i]);
        if (keyword && base[mapped].indexOf(keyword) === -1) base[mapped].push(keyword);
      }
    }
    return base;
  }

  function stripBDTags(str) {
    return String(str || "").replace(/\[\[BD:[\s\S]*?:BD\]\]/g, "");
  }

  function bdMessage(payload) {
    return "[[BD:" + JSON.stringify(payload) + ":BD]]";
  }

  function bdDestroy(id) {
    return bdMessage({ type: "widget", widgetId: id, action: "destroy" });
  }

  function destroyDebugWidgets() {
    var out = "";
    for (var i = 0; i < WIDGET_IDS.length; i++) out += bdDestroy(WIDGET_IDS[i]);
    return out;
  }

  function buildDebugWidgets(S, runtime) {
    if (!S.config.widgets || !S.config.debug) return "";
    runtime = runtime || {};
    var out = "";
    out += bdMessage({ type: "widget", widgetId: "dcp_active", action: "create", config: { type: "stat", label: "Active", value: runtime.activeCount || 0, align: "left", order: 1, color: "#22c55e" } });
    out += bdMessage({ type: "widget", widgetId: "dcp_budget", action: "create", config: { type: "stat", label: "Inject", value: String(runtime.used || 0) + "/" + String((runtime.activeCount || 0) * (S.config.budget || 0)), align: "right", order: 1, color: "#60a5fa" } });
    if (runtime.top && runtime.top.length) {
      out += bdMessage({ type: "widget", widgetId: "dcp_focus", action: "create", config: { type: "badge", text: "Focus: " + runtime.top.join(", "), variant: "subtle", align: "center", order: 1, color: "#f59e0b" } });
    }
    return out;
  }

  function normalizeBase64Input(input) {
    var s = String(input || "").replace(/\r|\n|\t/g, "").replace(/-/g, "+").replace(/_/g, "/");
    if (s.indexOf(" ") !== -1 && s.indexOf("+") === -1) s = s.replace(/ /g, "+");
    s = s.replace(/\s+/g, "");
    while (s && (s.length % 4) !== 0) s += "=";
    return s;
  }

  function bytesToBase64(bytes) {
    if (!bytes || !bytes.length) return "";
    var out = "";
    for (var i = 0; i < bytes.length; i += 3) {
      var a = bytes[i] & 255;
      var b = (i + 1 < bytes.length) ? (bytes[i + 1] & 255) : NaN;
      var c = (i + 2 < bytes.length) ? (bytes[i + 2] & 255) : NaN;
      var triplet = (a << 16) | ((isNaN(b) ? 0 : b) << 8) | (isNaN(c) ? 0 : c);
      out += B64.charAt((triplet >> 18) & 63);
      out += B64.charAt((triplet >> 12) & 63);
      out += isNaN(b) ? "=" : B64.charAt((triplet >> 6) & 63);
      out += isNaN(c) ? "=" : B64.charAt(triplet & 63);
    }
    return out;
  }

  function base64ToBytes(input) {
    var clean = String(input || "").replace(/\s+/g, "");
    if (!clean) return [];
    if ((clean.length % 4) !== 0) return null;
    var map = {};
    for (var i = 0; i < B64.length; i++) map[B64.charAt(i)] = i;
    var out = [];
    for (var j = 0; j < clean.length; j += 4) {
      var c1 = clean.charAt(j), c2 = clean.charAt(j + 1), c3 = clean.charAt(j + 2), c4 = clean.charAt(j + 3);
      if (c1 === "=" || c2 === "=") return null;
      var v1 = map[c1], v2 = map[c2], pad3 = (c3 === "="), pad4 = (c4 === "="), v3 = 0, v4 = 0;
      if (v1 === undefined || v2 === undefined) return null;
      if (!pad3) { v3 = map[c3]; if (v3 === undefined) return null; } else if (!pad4) return null;
      if (!pad4) { v4 = map[c4]; if (v4 === undefined) return null; }
      var triplet = (v1 << 18) | (v2 << 12) | (v3 << 6) | v4;
      out.push((triplet >> 16) & 255);
      if (!pad3) out.push((triplet >> 8) & 255);
      if (!pad4) out.push(triplet & 255);
      if ((pad3 || pad4) && (j + 4 < clean.length)) return null;
    }
    return out;
  }

  function utf8ToBytes(str) {
    if (typeof TextEncoder === "function") {
      try {
        var enc = new TextEncoder().encode(str);
        var out = [];
        for (var i = 0; i < enc.length; i++) out.push(enc[i]);
        return out;
      } catch (e) {}
    }
    var utf8 = unescape(encodeURIComponent(str));
    var arr = [];
    for (var j = 0; j < utf8.length; j++) arr.push(utf8.charCodeAt(j));
    return arr;
  }

  function bytesToUtf8(bytes) {
    if (typeof TextDecoder === "function") {
      try {
        return new TextDecoder().decode(new Uint8Array(bytes));
      } catch (e) {}
    }
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    try {
      return decodeURIComponent(escape(bin));
    } catch (e2) {
      return null;
    }
  }

  function toBase64(str) {
    if (!str) return "";
    str = String(str);
    var out = "";
    if (typeof btoa === "function") {
      try { out = btoa(unescape(encodeURIComponent(str))); } catch (e) {}
    }
    if (!out && typeof Buffer !== "undefined" && Buffer && typeof Buffer.from === "function") {
      try { out = Buffer.from(str, "utf8").toString("base64"); } catch (e2) {}
    }
    if (!out) out = bytesToBase64(utf8ToBytes(str));
    return out.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function fromBase64(str) {
    if (!str) return "";
    var input = normalizeBase64Input(str);
    if (!input) return "";
    if (typeof atob === "function") {
      try { return decodeURIComponent(escape(atob(input))); } catch (e) {}
    }
    if (typeof Buffer !== "undefined" && Buffer && typeof Buffer.from === "function") {
      try { return Buffer.from(input, "base64").toString("utf8"); } catch (e2) {}
    }
    var bytes = base64ToBytes(input);
    if (bytes === null) return null;
    return bytesToUtf8(bytes);
  }

  function ensureDcpState() {
    if (!state.dcp || typeof state.dcp !== "object" || Array.isArray(state.dcp)) state.dcp = {};
    var S = state.dcp;
    if (!S.profiles || typeof S.profiles !== "object" || Array.isArray(S.profiles)) S.profiles = {};
    if (!S.config || typeof S.config !== "object" || Array.isArray(S.config)) S.config = {};
    if (typeof S._pending !== "string") S._pending = "";
    if (typeof S._pendingSource !== "string") S._pendingSource = "";
    if (typeof S._widgetClearPending !== "boolean") S._widgetClearPending = false;
    if (typeof S._widgetActive !== "boolean") S._widgetActive = false;
    if (!S.importBuffer || typeof S.importBuffer !== "object" || Array.isArray(S.importBuffer)) S.importBuffer = { active: false, mode: "merge", payload: "" };

    S.config.budget = parseInt(S.config.budget, 10);
    if (isNaN(S.config.budget) || S.config.budget < 100) S.config.budget = 800;
    S.config.fallback = normalizeSectionName(S.config.fallback || "behavior");
    if (SECTIONS.indexOf(S.config.fallback) === -1) S.config.fallback = "behavior";
    S.config.debug = !!S.config.debug;
    S.config.widgets = !!S.config.widgets;
    S.config.maxActive = parseInt(S.config.maxActive, 10);
    if (isNaN(S.config.maxActive) || S.config.maxActive < 0) S.config.maxActive = 0;
    if (!S.config.sectionKeywords || typeof S.config.sectionKeywords !== "object" || Array.isArray(S.config.sectionKeywords)) S.config.sectionKeywords = {};

    if (typeof S.importBuffer.active !== "boolean") S.importBuffer.active = false;
    if (S.importBuffer.mode !== "replace") S.importBuffer.mode = "merge";
    if (typeof S.importBuffer.payload !== "string") S.importBuffer.payload = "";
    for (var name in S.profiles) {
      if (!S.profiles.hasOwnProperty(name)) continue;
      if (!S.profiles[name] || typeof S.profiles[name] !== "object") {
        S.profiles[name] = { keywords: [name], sections: {} };
      }
      if (!Array.isArray(S.profiles[name].keywords) || !S.profiles[name].keywords.length) S.profiles[name].keywords = [name];
      migrateProfileSections(S.profiles[name]);
    }
    return S;
  }

  function setPendingMessage(S, source, msg) {
    msg = String(msg || "");
    if (S._pending) S._pending += "\n---\n" + msg;
    else S._pending = msg;
    state.message = S._pending;
    S._pendingSource = source;
    globalThis.text = " ";
    globalThis.stop = false;
  }

  function clearPendingMessage(S) {
    S._pending = "";
    S._pendingSource = "";
  }

  function ensureTimeState() {
    if (!state.dcpTime || typeof state.dcpTime !== "object" || Array.isArray(state.dcpTime)) state.dcpTime = {};
    var T = state.dcpTime;
    if (typeof T.enabled !== "boolean") T.enabled = true;
    if (typeof T.paused !== "boolean") T.paused = false;
    if (typeof T.showContext !== "boolean") T.showContext = true;
    if (typeof T.showOutput !== "boolean") T.showOutput = true;
    if (typeof T.showStateMessage !== "boolean") T.showStateMessage = false;
    if (typeof T.timeFormat !== "string") T.timeFormat = "24h";
    if (typeof T.displayMode !== "string") T.displayMode = "full";
    if (typeof T.minutesPerAction !== "number") T.minutesPerAction = 10;
    if (typeof T.defaultSleepHour !== "number") T.defaultSleepHour = 8;
    if (typeof T.defaultSleepMinute !== "number") T.defaultSleepMinute = 0;
    if (typeof T.defaultNapMinutes !== "number") T.defaultNapMinutes = 60;
    if (typeof T.defaultRestMinutes !== "number") T.defaultRestMinutes = 240;
    if (typeof T.day !== "number") T.day = 1;
    if (typeof T.hour !== "number") T.hour = 8;
    if (typeof T.minute !== "number") T.minute = 0;
    if (typeof T.phase !== "string") T.phase = "Morning";
    if (typeof T.lastInput !== "string") T.lastInput = "";
    if (typeof T.lastAdvanceAction !== "number") T.lastAdvanceAction = -1;
    if (typeof T.startYear !== "number") T.startYear = NaN;
    if (typeof T.startMonth !== "number") T.startMonth = NaN;
    if (typeof T.startDay !== "number") T.startDay = NaN;
    if (!Array.isArray(T.reminders)) T.reminders = [];
    if (!Array.isArray(T.pendingReminderCues)) T.pendingReminderCues = [];
    if (typeof T.nextReminderId !== "number") T.nextReminderId = 1;
    normalizeTime(T);
    normalizeAnchorDate(T);
    return T;
  }

  function normalizeTime(T) {
    T.minutesPerAction = parseInt(T.minutesPerAction, 10);
    if (isNaN(T.minutesPerAction) || T.minutesPerAction < 1 || T.minutesPerAction > 60) T.minutesPerAction = 10;
    T.day = parseInt(T.day, 10);
    if (isNaN(T.day) || T.day < 1) T.day = 1;
    T.hour = parseInt(T.hour, 10);
    if (isNaN(T.hour)) T.hour = 8;
    T.minute = parseInt(T.minute, 10);
    if (isNaN(T.minute)) T.minute = 0;

    var totalMinutes = ((T.day - 1) * 1440) + (T.hour * 60) + T.minute;
    if (totalMinutes < 0) totalMinutes = 0;
    T.day = Math.floor(totalMinutes / 1440) + 1;
    totalMinutes = totalMinutes % 1440;
    T.hour = Math.floor(totalMinutes / 60);
    T.minute = totalMinutes % 60;

    if (T.hour >= 6 && T.hour < 12) T.phase = "Morning";
    else if (T.hour >= 12 && T.hour < 17) T.phase = "Afternoon";
    else if (T.hour >= 17 && T.hour < 20) T.phase = "Evening";
    else T.phase = "Night";

    T.enabled = (T.enabled !== false);
    T.paused = !!T.paused;
    T.showContext = (T.showContext !== false);
    T.showOutput = (T.showOutput !== false);
    T.showStateMessage = !!T.showStateMessage;
    T.timeFormat = normalizeTimeFormat(T.timeFormat) || "24h";
    T.displayMode = normalizeDisplayMode(T.displayMode) || "full";
    T.defaultSleepHour = boundInt(parseInt(T.defaultSleepHour, 10), 0, 23, 8);
    T.defaultSleepMinute = boundInt(parseInt(T.defaultSleepMinute, 10), 0, 59, 0);
    T.defaultNapMinutes = boundInt(parseInt(T.defaultNapMinutes, 10), 1, 10080, 60);
    T.defaultRestMinutes = boundInt(parseInt(T.defaultRestMinutes, 10), 1, 10080, 240);
    if (!Array.isArray(T.reminders)) T.reminders = [];
    if (!Array.isArray(T.pendingReminderCues)) T.pendingReminderCues = [];
    T.nextReminderId = parseInt(T.nextReminderId, 10);
    if (isNaN(T.nextReminderId) || T.nextReminderId < 1) T.nextReminderId = 1;
    T.lastInput = String(T.lastInput || "");
    T.lastAdvanceAction = parseInt(T.lastAdvanceAction, 10);
    if (isNaN(T.lastAdvanceAction)) T.lastAdvanceAction = -1;
  }

  function boundInt(value, lower, upper, fallback) {
    if (isNaN(value)) value = fallback;
    if (value < lower) value = lower;
    if (value > upper) value = upper;
    return value;
  }

  function parseOnOff(value) {
    value = lowerStr(value);
    if (value === "on" || value === "true" || value === "1" || value === "yes") return true;
    if (value === "off" || value === "false" || value === "0" || value === "no") return false;
    return null;
  }

  function parseHHMM(raw) {
    var match = trimStr(raw).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    var hh = parseInt(match[1], 10);
    var mm = parseInt(match[2], 10);
    return (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) ? null : [hh, mm];
  }

  function parseClockTime(raw) {
    var clean = trimStr(raw);
    var parsed = parseHHMM(clean);
    if (parsed) return parsed;
    var match = clean.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
    if (!match) return null;
    var hh = parseInt(match[1], 10);
    var mm = parseInt(match[2], 10);
    var suffix = match[3].toUpperCase();
    if (isNaN(hh) || isNaN(mm) || hh < 1 || hh > 12 || mm < 0 || mm > 59) return null;
    if (suffix === "AM") hh = (hh === 12) ? 0 : hh;
    else hh = (hh === 12) ? 12 : (hh + 12);
    return [hh, mm];
  }

  function normalizeTimeFormat(value) {
    var clean = lowerStr(value).replace(/\s+/g, "");
    if (clean === "24h" || clean === "24" || clean === "military" || clean === "militarytime") return "24h";
    if (clean === "12h" || clean === "12" || clean === "standard" || clean === "ampm" || clean === "am/pm") return "12h";
    return "";
  }

  function normalizeDisplayMode(value) {
    var clean = lowerStr(value).replace(/\s+/g, "");
    if (clean === "full" || clean === "default") return "full";
    if (clean === "compact" || clean === "hide" || clean === "minimal") return "compact";
    return "";
  }

  function formatClockParts(hour, minute, format) {
    if ((normalizeTimeFormat(format) || "24h") === "12h") {
      var suffix = (hour >= 12) ? "PM" : "AM";
      var displayHour = hour % 12;
      if (displayHour === 0) displayHour = 12;
      return String(displayHour) + ":" + pad2(minute) + " " + suffix;
    }
    return pad2(hour) + ":" + pad2(minute);
  }

  function parseDuration(raw) {
    var out = { d: 0, h: 0, m: 0, ok: false };
    var toks = trimStr(raw).toLowerCase().split(/\s+/);
    for (var i = 0; i < toks.length; i++) {
      var x = null;
      if ((x = toks[i].match(/^(\d+)d$/))) { out.d += parseInt(x[1], 10); out.ok = true; }
      else if ((x = toks[i].match(/^(\d+)h$/))) { out.h += parseInt(x[1], 10); out.ok = true; }
      else if ((x = toks[i].match(/^(\d+)m$/))) { out.m += parseInt(x[1], 10); out.ok = true; }
      else if ((x = toks[i].match(/^(\d+)$/))) { out.m += parseInt(x[1], 10); out.ok = true; }
    }
    return out;
  }

  function parseLeadingDuration(text) {
    var source = trimStr(text);
    if (!source) return { minutes: 0, ok: false, rest: "" };
    var tokens = source.split(/\s+/);
    var used = [];
    for (var i = 0; i < tokens.length; i++) {
      if (/^\d+(?:d|h|m)$/i.test(tokens[i])) used.push(tokens[i]);
      else break;
    }
    if (!used.length) return { minutes: 0, ok: false, rest: source };
    var parsed = parseDuration(used.join(" "));
    return {
      minutes: durationToMinutes(parsed),
      ok: parsed.ok,
      rest: trimStr(tokens.slice(used.length).join(" "))
    };
  }

  function durationToMinutes(duration) {
    duration = duration || {};
    return ((parseInt(duration.d, 10) || 0) * 1440) + ((parseInt(duration.h, 10) || 0) * 60) + (parseInt(duration.m, 10) || 0);
  }

  function minutesToDurationText(totalMinutes) {
    totalMinutes = parseInt(totalMinutes, 10);
    if (isNaN(totalMinutes) || totalMinutes < 0) totalMinutes = 0;
    var days = Math.floor(totalMinutes / 1440);
    totalMinutes = totalMinutes % 1440;
    var hours = Math.floor(totalMinutes / 60);
    var minutes = totalMinutes % 60;
    var parts = [];
    if (days > 0) parts.push(days + "d");
    if (hours > 0) parts.push(hours + "h");
    if (minutes > 0 || !parts.length) parts.push(minutes + "m");
    return parts.join(" ");
  }

  function applyTimeMacros(_T, _lowerInput) {
    return;
  }

  function applyDurationAdvance(T, duration) {
    var previousMs = getWorldTimestampMs(T);
    duration = duration || {};
    T.day += parseInt(duration.d, 10) || 0;
    T.hour += parseInt(duration.h, 10) || 0;
    T.minute += parseInt(duration.m, 10) || 0;
    normalizeTime(T);
    processReminderEvents(T, previousMs, getWorldTimestampMs(T));
  }

  function advanceToNextDayTime(T, hour, minute) {
    var previousMs = getWorldTimestampMs(T);
    normalizeTime(T);
    T.day += 1;
    T.hour = hour;
    T.minute = minute;
    normalizeTime(T);
    processReminderEvents(T, previousMs, getWorldTimestampMs(T));
  }

  function advanceToNextOccurrenceTime(T, hour, minute) {
    var previousMs = getWorldTimestampMs(T);
    normalizeTime(T);
    var currentMinutes = (T.hour * 60) + T.minute;
    var targetMinutes = (hour * 60) + minute;
    if (currentMinutes >= targetMinutes) T.day += 1;
    T.hour = hour;
    T.minute = minute;
    normalizeTime(T);
    processReminderEvents(T, previousMs, getWorldTimestampMs(T));
  }

  function getActionCount() {
    return (typeof info !== "undefined" && info && typeof info.actionCount === "number") ? Math.abs(parseInt(info.actionCount, 10)) : -1;
  }

  function advanceTurnTime(T) {
    var previousMs = getWorldTimestampMs(T);
    var delta = parseInt(T.minutesPerAction, 10);
    var baseMinute = parseInt(T.minute, 10);
    if (isNaN(delta) || delta < 1) delta = 10;
    if (isNaN(baseMinute)) baseMinute = 0;
    T.minute = baseMinute + delta;
    normalizeTime(T);
    processReminderEvents(T, previousMs, getWorldTimestampMs(T));
  }

  function normalizeAnchorDate(T) {
    var now = new Date();
    var year = parseInt(T.startYear, 10);
    var month = parseInt(T.startMonth, 10);
    var day = parseInt(T.startDay, 10);

    if (isNaN(year)) year = now.getFullYear();
    if (isNaN(month)) month = now.getMonth() + 1;
    if (isNaN(day)) day = now.getDate();

    var anchor = new Date(Date.UTC(year, month - 1, day));
    if (isNaN(anchor.getTime())) anchor = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    T.startYear = anchor.getUTCFullYear();
    T.startMonth = anchor.getUTCMonth() + 1;
    T.startDay = anchor.getUTCDate();
  }

  function parseCalendarDate(raw) {
    var text = trimStr(raw);
    var match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      var mm = parseInt(match[1], 10);
      var dd = parseInt(match[2], 10);
      var yyyy = parseInt(match[3], 10);
      var probe = new Date(Date.UTC(yyyy, mm - 1, dd));
      if (!isNaN(probe.getTime()) && probe.getUTCFullYear() === yyyy && (probe.getUTCMonth() + 1) === mm && probe.getUTCDate() === dd) {
        return [mm, dd, yyyy];
      }
      return null;
    }
    match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    var year = parseInt(match[1], 10);
    var month = parseInt(match[2], 10);
    var day = parseInt(match[3], 10);
    var check = new Date(Date.UTC(year, month - 1, day));
    if (!isNaN(check.getTime()) && check.getUTCFullYear() === year && (check.getUTCMonth() + 1) === month && check.getUTCDate() === day) {
      return [month, day, year];
    }
    return null;
  }

  function setDisplayedCalendarDate(T, month, day, year) {
    normalizeTime(T);
    var current = new Date(Date.UTC(year, month - 1, day));
    current.setUTCDate(current.getUTCDate() - (T.day - 1));
    T.startYear = current.getUTCFullYear();
    T.startMonth = current.getUTCMonth() + 1;
    T.startDay = current.getUTCDate();
    normalizeAnchorDate(T);
  }

  function monthToSeason(month) {
    if (month === 12 || month === 1 || month === 2) return "Winter";
    if (month >= 3 && month <= 5) return "Spring";
    if (month >= 6 && month <= 8) return "Summer";
    return "Autumn";
  }

  function getCalendarParts(T) {
    normalizeAnchorDate(T);
    var current = new Date(Date.UTC(T.startYear, T.startMonth - 1, T.startDay));
    current.setUTCDate(current.getUTCDate() + (T.day - 1));
    var month = current.getUTCMonth() + 1;
    var day = current.getUTCDate();
    var year = current.getUTCFullYear();
    return {
      month: month,
      day: day,
      year: year,
      season: monthToSeason(month),
      dateText: pad2(month) + "/" + pad2(day) + "/" + String(year)
    };
  }

  function formatCalendarStamp(T) {
    var parts = getCalendarParts(T);
    return parts.dateText + " (" + parts.season + ")";
  }

  function formatClockDisplay(T) {
    normalizeTime(T);
    return formatClockParts(T.hour, T.minute, T.timeFormat);
  }

  function formatTimeWithPhase(T) {
    return formatClockDisplay(T) + " (" + T.phase + ")";
  }

  function formatCurrentTimeStamp(T) {
    return formatTimeWithPhase(T) + ", " + formatCalendarStamp(T);
  }

  function formatVisibleTimeStamp(T) {
    return ((normalizeDisplayMode(T.displayMode) || "full") === "compact")
      ? formatTimeWithPhase(T)
      : formatCurrentTimeStamp(T);
  }

  function getWorldTimestampMs(T) {
    normalizeTime(T);
    var parts = getCalendarParts(T);
    return Date.UTC(parts.year, parts.month - 1, parts.day, T.hour, T.minute, 0, 0);
  }

  function getDueTimestampMs(reminder) {
    return Date.UTC(reminder.year, reminder.month - 1, reminder.day, reminder.hour, reminder.minute, 0, 0);
  }

  function getReminderDefaultLeadMinutes(source) {
    source = lowerStr(source);
    if (source === "alarm") return 0;
    return 30;
  }

  function getReminderSourceLabel(source) {
    source = lowerStr(source);
    if (source === "alarm") return "Alarm";
    return "Phone reminder";
  }

  function queueReminderCue(T, reminder) {
    var prefix = getReminderSourceLabel(reminder.source);
    var detail = reminder.message;
    if ((parseInt(reminder.leadMinutes, 10) || 0) > 0) {
      detail += ". Due in " + minutesToDurationText(reminder.leadMinutes) + ".";
    }
    T.pendingReminderCues.push("[" + prefix + ": " + detail + "]");
  }

  function processReminderEvents(T, previousMs, nextMs) {
    if (!Array.isArray(T.reminders) || !T.reminders.length) return;
    if (typeof previousMs !== "number" || typeof nextMs !== "number" || nextMs < previousMs) return;
    for (var i = T.reminders.length - 1; i >= 0; i--) {
      var reminder = T.reminders[i];
      if (!reminder || typeof reminder !== "object") {
        T.reminders.splice(i, 1);
        continue;
      }
      var dueMs = getDueTimestampMs(reminder);
      var triggerMs = dueMs - ((parseInt(reminder.leadMinutes, 10) || 0) * 60000);
      if (previousMs < triggerMs && triggerMs <= nextMs) {
        queueReminderCue(T, reminder);
        T.reminders.splice(i, 1);
      }
    }
  }

  function maybeFireReminderImmediately(T, reminder) {
    var nowMs = getWorldTimestampMs(T);
    var dueMs = getDueTimestampMs(reminder);
    var triggerMs = dueMs - ((parseInt(reminder.leadMinutes, 10) || 0) * 60000);
    if (dueMs <= nowMs) return false;
    if (triggerMs <= nowMs) {
      queueReminderCue(T, reminder);
      return true;
    }
    return false;
  }

  function parseReminderSource(raw) {
    var source = lowerStr(raw);
    return (source === "phone" || source === "alarm") ? source : "";
  }

  function splitClockPrefix(text) {
    var clean = trimStr(text);
    if (!clean) return null;
    var parts = clean.split(/\s+/);
    if (!parts.length) return null;
    var two = (parts.length > 1) ? (parts[0] + " " + parts[1]) : "";
    var parsedTwo = two ? parseClockTime(two) : null;
    if (parsedTwo) return { hour: parsedTwo[0], minute: parsedTwo[1], rest: trimStr(parts.slice(2).join(" ")) };
    var parsedOne = parseClockTime(parts[0]);
    if (parsedOne) return { hour: parsedOne[0], minute: parsedOne[1], rest: trimStr(parts.slice(1).join(" ")) };
    return null;
  }

  function addDaysToDate(year, month, day, amount) {
    var date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + amount);
    return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
  }

  function resolveReminderWhen(T, raw) {
    var text = trimStr(raw);
    var currentParts = getCalendarParts(T);
    var currentMinutes = (T.hour * 60) + T.minute;
    var dateMatch = text.match(/^(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\s+([\s\S]+)$/);
    if (dateMatch) {
      var parsedDate = parseCalendarDate(dateMatch[1]);
      var parsedClock = splitClockPrefix(dateMatch[2]);
      if (!parsedDate || !parsedClock) return null;
      return {
        year: parsedDate[2],
        month: parsedDate[0],
        day: parsedDate[1],
        hour: parsedClock.hour,
        minute: parsedClock.minute,
        rest: parsedClock.rest
      };
    }
    if (/^tomorrow\b/i.test(text)) {
      var tomorrowClock = splitClockPrefix(text.replace(/^tomorrow\b/i, ""));
      if (!tomorrowClock) return null;
      var tomorrowDate = addDaysToDate(currentParts.year, currentParts.month, currentParts.day, 1);
      return {
        year: tomorrowDate[0],
        month: tomorrowDate[1],
        day: tomorrowDate[2],
        hour: tomorrowClock.hour,
        minute: tomorrowClock.minute,
        rest: tomorrowClock.rest
      };
    }
    var clockOnly = splitClockPrefix(text);
    if (!clockOnly) return null;
    var targetMinutes = (clockOnly.hour * 60) + clockOnly.minute;
    var resolvedDate = (currentMinutes < targetMinutes)
      ? [currentParts.year, currentParts.month, currentParts.day]
      : addDaysToDate(currentParts.year, currentParts.month, currentParts.day, 1);
    return {
      year: resolvedDate[0],
      month: resolvedDate[1],
      day: resolvedDate[2],
      hour: clockOnly.hour,
      minute: clockOnly.minute,
      rest: clockOnly.rest
    };
  }

  function formatReminderDue(reminder, format) {
    return pad2(reminder.month) + "/" + pad2(reminder.day) + "/" + String(reminder.year) + " " + formatClockParts(reminder.hour, reminder.minute, format);
  }

  function buildReminderFromCommand(T, source, raw) {
    var resolved = resolveReminderWhen(T, raw);
    if (!resolved) return null;
    var lead = parseLeadingDuration(resolved.rest);
    var message = lead.ok ? lead.rest : resolved.rest;
    message = trimStr(message);
    if (!message) return null;
    return {
      id: T.nextReminderId++,
      source: source,
      year: resolved.year,
      month: resolved.month,
      day: resolved.day,
      hour: resolved.hour,
      minute: resolved.minute,
      leadMinutes: lead.ok ? lead.minutes : getReminderDefaultLeadMinutes(source),
      message: message
    };
  }

  function parseClockWithNextday(raw) {
    var text = trimStr(raw);
    var nextday = false;
    if (/\s+nextday$/i.test(text)) {
      nextday = true;
      text = trimStr(text.replace(/\s+nextday$/i, ""));
    }
    var parsed = parseClockTime(text);
    if (!parsed) return null;
    return { hour: parsed[0], minute: parsed[1], nextday: nextday };
  }

  function parseOptionalTargetClock(raw, defaultHour, defaultMinute) {
    var text = trimStr(raw);
    if (!text) return [defaultHour, defaultMinute];
    if (/^until\s+/i.test(text)) text = trimStr(text.replace(/^until\s+/i, ""));
    return parseClockTime(text);
  }

  function quickTimeUsage(name) {
    var map = {
      "/nap": "Usage: /nap [duration]",
      "/rest": "Usage: /rest [duration]",
      "/wait": "Usage: /wait <duration> | /wait until <time>",
      "/waituntil": "Usage: /waituntil <time>",
      "/sleep": "Usage: /sleep [time] | /sleep until <time>",
      "/tomorrow": "Usage: /tomorrow [time]",
      "/time set": "Usage: /time set <time> [nextday]",
      "/remind add": "Usage: /remind add <phone|alarm> <time|tomorrow <time>|MM/DD/YYYY <time>> [lead] <message>"
    };
    return map[name] || ("Usage: " + name);
  }

  function profileHelpText() {
    return [
      "=== DCP Commands ===",
      "/profile add <name>",
      "/profile remove <name>",
      "/profile show <name>",
      "/profile list",
      "/profile set <name> <section> <text>",
      "/profile append <name> <section> <text>",
      "/profile keywords <name> <word1,word2,...>",
      "/profile import <name> [section] text...",
      "/profile importb64 <name> [section] <base64>...",
      "/profile importallb64 [merge|replace] <base64>",
      "/profile importallb64 begin [merge|replace]",
      "/profile importallb64 chunk <base64-part>",
      "/profile importallb64 finish",
      "/profile exportallchunks [merge|replace] [chunkSize]",
      "/profile export <name>",
      "/profile exportb64 <name>",
      "/profile exportallb64",
      "/profile config [budget|fallback|debug|maxActive|keywords|widgets] [value]",
      "/profile sections",
      "Batch: separate commands with ;;"
    ].join("\n");
  }

  function remindHelpText() {
    return [
      "=== Reminder Commands ===",
      "/remind add <phone|alarm> <time> [lead] <message>",
      "/remind add <phone|alarm> tomorrow <time> [lead] <message>",
      "/remind add <phone|alarm> <MM/DD/YYYY> <time> [lead] <message>",
      "/remind list",
      "/remind remove <id>",
      "",
      "Examples:",
      "/remind add phone 6:00 PM Meet Hakari",
      "/remind add phone tomorrow 6:00 PM 30m Meet Hakari",
      "/remind add alarm 03/20/2026 8:00 AM Wake up",
      "",
      "Reminder sources: phone, alarm",
      "Lead examples: 15m, 30m, 1h, 1d"
    ].join("\n");
  }

  function timeHelpText() {
    return [
      "=== DCP Time Commands ===",
      "Quick commands:",
      "/now",
      "/sleep [time]",
      "/sleep until <time>",
      "/nap [duration]",
      "/rest [duration]",
      "/wait <duration>",
      "/wait until <time>",
      "/waituntil <time>",
      "/tomorrow [time]",
      "/pause",
      "/resume",
      "",
      "Reminder commands:",
      "/remind help",
      "/remind add <phone|alarm> <when> [lead] <message>",
      "/remind list",
      "/remind remove <id>",
      "",
      "Admin commands:",
      "/time help",
      "/time show",
      "/time set <time> [nextday]",
      "/time add <Nd Nh Nm>",
      "/time config",
      "/time config date <MM/DD/YYYY>",
      "/time config display <full|compact>",
      "/time config format <12h|24h>",
      "/time config sleep <time>",
      "/time config nap <duration>",
      "/time config rest <duration>",
      "/time config enabled <on|off>",
      "/time config context <on|off>",
      "/time config output <on|off>",
      "/time config message <on|off>",
      "/time config minutes <1-60>",
      "",
      "Examples:",
      "/sleep until 8:30 AM",
      "/wait 30m",
      "/time config display compact",
      "/time config nap 90m",
      "/remind add phone 6:00 PM Meet Hakari",
      "",
      "Time values accept 20:23 or 8:23 PM."
    ].join("\n");
  }

  function handleRemindCommand(cmd, T) {
    var argStr = trimStr(cmd.substring("/remind".length));
    var sp = argStr.indexOf(" ");
    var action = lowerStr(sp === -1 ? argStr : argStr.substring(0, sp));
    var rest = trimStr(sp === -1 ? "" : argStr.substring(sp + 1));
    if (!action || action === "help") return remindHelpText();

    if (action === "add") {
      var sourceSplit = rest.indexOf(" ");
      var source = parseReminderSource(sourceSplit === -1 ? rest : rest.substring(0, sourceSplit));
      if (!source || sourceSplit === -1) return quickTimeUsage("/remind add");
      var reminder = buildReminderFromCommand(T, source, trimStr(rest.substring(sourceSplit + 1)));
      if (!reminder) return quickTimeUsage("/remind add");
      if (getDueTimestampMs(reminder) <= getWorldTimestampMs(T)) {
        return "Reminder time has already passed.";
      }
      if (maybeFireReminderImmediately(T, reminder)) {
        return "Reminder queued now: #" + reminder.id + " | " + getReminderSourceLabel(reminder.source) + " | " + reminder.message;
      }
      T.reminders.push(reminder);
      return "Reminder added: #" + reminder.id + " | " + getReminderSourceLabel(reminder.source) + " | " + formatReminderDue(reminder, T.timeFormat) + " | lead " + minutesToDurationText(reminder.leadMinutes) + " | " + reminder.message;
    }

    if (action === "list") {
      if (!T.reminders.length) return "No active reminders.";
      var items = T.reminders.slice();
      items.sort(function (a, b) { return getDueTimestampMs(a) - getDueTimestampMs(b); });
      var lines = [];
      for (var i = 0; i < items.length; i++) {
        lines.push("#" + items[i].id + " | " + getReminderSourceLabel(items[i].source) + " | " + formatReminderDue(items[i], T.timeFormat) + " | lead " + minutesToDurationText(items[i].leadMinutes) + " | " + items[i].message);
      }
      return lines.join("\n");
    }

    if (action === "remove" || action === "delete") {
      var id = parseInt(rest, 10);
      if (isNaN(id) || id < 1) return "Usage: /remind remove <id>";
      for (var r = 0; r < T.reminders.length; r++) {
        if (parseInt(T.reminders[r].id, 10) === id) {
          var removed = T.reminders.splice(r, 1)[0];
          return "Reminder removed: #" + removed.id + " | " + removed.message;
        }
      }
      return "Reminder not found: #" + id;
    }

    return "Unknown /remind command: " + action + ". Try /remind help";
  }

  function handleQuickTimeCommand(cmd, T) {
    var text = trimStr(cmd);
    if (!text) return null;

    if (startsWithCommand(text, "/now")) {
      normalizeTime(T);
      return "Time: " + formatVisibleTimeStamp(T) + " | paused=" + (T.paused ? "on" : "off");
    }

    if (startsWithCommand(text, "/pause")) {
      T.paused = true;
      normalizeTime(T);
      return "Time paused: " + formatVisibleTimeStamp(T);
    }

    if (startsWithCommand(text, "/resume")) {
      T.paused = false;
      normalizeTime(T);
      return "Time resumed: " + formatVisibleTimeStamp(T);
    }

    if (startsWithCommand(text, "/nap")) {
      var napRest = trimStr(text.substring("/nap".length));
      var napDuration = napRest ? parseDuration(napRest) : { d: 0, h: 0, m: T.defaultNapMinutes, ok: true };
      if (!napDuration.ok) return quickTimeUsage("/nap");
      applyDurationAdvance(T, napDuration);
      return "Time advanced: " + formatVisibleTimeStamp(T);
    }

    if (startsWithCommand(text, "/rest")) {
      var restText = trimStr(text.substring("/rest".length));
      var restDuration = restText ? parseDuration(restText) : { d: 0, h: 0, m: T.defaultRestMinutes, ok: true };
      if (!restDuration.ok) return quickTimeUsage("/rest");
      applyDurationAdvance(T, restDuration);
      return "Time advanced: " + formatVisibleTimeStamp(T);
    }

    if (startsWithCommand(text, "/waituntil")) {
      var waitUntilText = trimStr(text.substring("/waituntil".length));
      var waitUntilTime = parseClockTime(waitUntilText);
      if (!waitUntilTime) return quickTimeUsage("/waituntil");
      advanceToNextOccurrenceTime(T, waitUntilTime[0], waitUntilTime[1]);
      return "Time advanced: " + formatVisibleTimeStamp(T);
    }

    if (startsWithCommand(text, "/wait")) {
      var waitRest = trimStr(text.substring("/wait".length));
      if (!waitRest) return quickTimeUsage("/wait");
      if (/^until\s+/i.test(waitRest)) {
        var waitTarget = parseOptionalTargetClock(waitRest, 0, 0);
        if (!waitTarget) return quickTimeUsage("/wait");
        advanceToNextOccurrenceTime(T, waitTarget[0], waitTarget[1]);
        return "Time advanced: " + formatVisibleTimeStamp(T);
      }
      var waitDuration = parseDuration(waitRest);
      if (!waitDuration.ok) return quickTimeUsage("/wait");
      applyDurationAdvance(T, waitDuration);
      return "Time advanced: " + formatVisibleTimeStamp(T);
    }

    if (startsWithCommand(text, "/sleep")) {
      var sleepRest = trimStr(text.substring("/sleep".length));
      var sleepTarget = parseOptionalTargetClock(sleepRest, T.defaultSleepHour, T.defaultSleepMinute);
      if (!sleepTarget) return quickTimeUsage("/sleep");
      advanceToNextDayTime(T, sleepTarget[0], sleepTarget[1]);
      return "Time advanced: " + formatVisibleTimeStamp(T);
    }

    if (startsWithCommand(text, "/tomorrow")) {
      var tomorrowRest = trimStr(text.substring("/tomorrow".length));
      var tomorrowTarget = parseOptionalTargetClock(tomorrowRest, T.defaultSleepHour, T.defaultSleepMinute);
      if (!tomorrowTarget) return quickTimeUsage("/tomorrow");
      advanceToNextDayTime(T, tomorrowTarget[0], tomorrowTarget[1]);
      return "Time advanced: " + formatVisibleTimeStamp(T);
    }

    return null;
  }

  function importAllProfiles(S, payloadB64, mode, results) {
    var decoded = fromBase64(payloadB64);
    if (decoded === null) { results.push("Invalid base64 payload."); return false; }
    var parsed = null;
    try { parsed = JSON.parse(decoded); } catch (e) { results.push("Invalid payload JSON."); return false; }
    var source = parsed && (parsed.p || parsed.profiles);
    if (!source || typeof source !== "object") { results.push("Payload missing profiles."); return false; }
    if (mode === "replace") S.profiles = {};
    var created = 0, updated = 0, skipped = 0;
    for (var rawName in source) {
      if (!source.hasOwnProperty(rawName)) continue;
      var name = normalizeName(rawName);
      if (!name) { skipped += 1; continue; }
      var srcProfile = ensurePlainObject(source[rawName]);
      var srcSections = ensurePlainObject(srcProfile.sections);
      var cleanSections = {};
      for (var rawSection in srcSections) {
        if (!srcSections.hasOwnProperty(rawSection)) continue;
        if (typeof srcSections[rawSection] !== "string" || !trimStr(srcSections[rawSection])) continue;
        appendMappedSection(cleanSections, rawSection, srcSections[rawSection]);
      }
      var cleanKeywords = [];
      if (srcProfile.keywords && srcProfile.keywords.length) {
        for (var k = 0; k < srcProfile.keywords.length; k++) {
          var keyword = normalizeName(srcProfile.keywords[k]);
          if (keyword && cleanKeywords.indexOf(keyword) === -1) cleanKeywords.push(keyword);
        }
      }
      if (!cleanKeywords.length) cleanKeywords.push(name);
      if (S.profiles[name]) updated += 1; else created += 1;
      S.profiles[name] = { keywords: cleanKeywords, sections: cleanSections };
    }
    results.push("Imported all profiles (" + mode + "): created=" + created + ", updated=" + updated + ", skipped=" + skipped + ", total=" + (created + updated));
    return true;
  }

  function handleProfileCommand(cmd, S, results) {
    var argStr = trimStr(cmd.substring("/profile".length));
    var sp = argStr.indexOf(" ");
    var action = lowerStr(sp === -1 ? argStr : argStr.substring(0, sp));
    var rest = trimStr(sp === -1 ? "" : argStr.substring(sp + 1));

    if (!action || action === "help") {
      results.push(profileHelpText());
      return;
    }

    if (action === "sections") {
      results.push("Sections: " + SECTIONS.join(", "));
      return;
    }

    if (action === "list") {
      var names = [];
      for (var key in S.profiles) {
        if (S.profiles.hasOwnProperty(key)) names.push(key + " (" + profileSize(S.profiles[key]) + ")");
      }
      results.push(names.length ? ("Profiles: " + names.join(", ")) : "No profiles stored.");
      return;
    }

    if (action === "add") {
      var addName = normalizeName(rest.split(" ")[0]);
      if (!addName) { results.push("Usage: /profile add <name>"); return; }
      if (S.profiles[addName]) { results.push(addName + " already exists."); return; }
      S.profiles[addName] = { keywords: [addName], sections: {} };
      results.push("Created " + addName + ".");
      return;
    }

    if (action === "remove" || action === "delete") {
      var removeName = normalizeName(rest.split(" ")[0]);
      if (!removeName || !S.profiles[removeName]) { results.push("Not found: " + (removeName || "?")); return; }
      delete S.profiles[removeName];
      results.push("Removed " + removeName + ".");
      return;
    }

    if (action === "show") {
      var showName = normalizeName(rest.split(" ")[0]);
      if (!showName || !S.profiles[showName]) { results.push("Not found: " + (showName || "?")); return; }
      var profile = S.profiles[showName];
      var lines = ["= " + showName + " =", "Keywords: " + (profile.keywords || []).join(", ")];
      var total = 0;
      for (var s = 0; s < SECTIONS.length; s++) {
        var sec = SECTIONS[s];
        if (profile.sections && profile.sections[sec]) {
          lines.push("  " + sec + ": " + profile.sections[sec].length + " chars");
          total += profile.sections[sec].length;
        }
      }
      lines.push("Total: " + total + " chars");
      results.push(lines.join("\n"));
      return;
    }

    if (action === "set" || action === "append") {
      var p1 = rest.indexOf(" ");
      if (p1 === -1) { results.push("Usage: /profile " + action + " <name> <section> <text>"); return; }
      var name = normalizeName(rest.substring(0, p1));
      var after = trimStr(rest.substring(p1 + 1));
      var p2 = after.indexOf(" ");
      if (p2 === -1) { results.push("Usage: /profile " + action + " <name> <section> <text>"); return; }
      var rawSection = after.substring(0, p2);
      var section = normalizeSectionName(rawSection);
      var value = trimStr(after.substring(p2 + 1));
      if (!S.profiles[name]) { results.push("Not found: " + name + (action === "set" ? ". Use /profile add first." : "")); return; }
      if (SECTIONS.indexOf(section) === -1) { results.push("Bad section: " + rawSection + (action === "set" ? ". Use /profile sections" : "")); return; }
      if (action === "set") S.profiles[name].sections[section] = value;
      else S.profiles[name].sections[section] = trimStr(safeText(S.profiles[name].sections[section]) + " " + value);
      results.push(name + "." + section + " " + (action === "set" ? "set" : "appended") + " (" + S.profiles[name].sections[section].length + " chars)");
      return;
    }

    if (action === "keywords") {
      var kp = rest.indexOf(" ");
      if (kp === -1) {
        var only = normalizeName(rest);
        if (!only || !S.profiles[only]) { results.push("Not found: " + (only || "?")); return; }
        results.push("Keywords for " + only + ": " + (S.profiles[only].keywords || []).join(", "));
        return;
      }
      var keyName = normalizeName(rest.substring(0, kp));
      var kwText = trimStr(rest.substring(kp + 1));
      if (!S.profiles[keyName]) { results.push("Not found: " + keyName); return; }
      S.profiles[keyName].keywords = parseKeywords(kwText);
      results.push("Keywords for " + keyName + ": " + S.profiles[keyName].keywords.join(", "));
      return;
    }

    if (action === "import") {
      var i1 = rest.indexOf(" ");
      if (i1 === -1) { results.push("Usage: /profile import <name> [section] text [section] text..."); return; }
      var importName = normalizeName(rest.substring(0, i1));
      var body = trimStr(rest.substring(i1 + 1));
      if (!S.profiles[importName]) S.profiles[importName] = { keywords: [importName], sections: {} };
      var count = 0, current = null, start = -1, pos = 0;
      while (pos < body.length) {
        var ob = body.indexOf("[", pos), cb = body.indexOf("]", ob);
        if (ob === -1 || cb === -1) break;
        var rawTag = lowerStr(body.substring(ob + 1, cb));
        var tag = (rawTag === "keywords") ? "keywords" : normalizeSectionName(rawTag);
        if (tag === "keywords" || SECTIONS.indexOf(tag) !== -1) {
          if (current !== null && start >= 0) {
            var content = trimStr(body.substring(start, ob));
            if (content) {
              if (current === "keywords") S.profiles[importName].keywords = parseKeywords(content);
              else { S.profiles[importName].sections[current] = appendSectionText(S.profiles[importName].sections[current], content); count += 1; }
            }
          }
          current = tag;
          start = cb + 1;
        }
        pos = cb + 1;
      }
      if (current !== null && start >= 0 && start <= body.length) {
        var last = trimStr(body.substring(start));
        if (last) {
          if (current === "keywords") S.profiles[importName].keywords = parseKeywords(last);
          else { S.profiles[importName].sections[current] = appendSectionText(S.profiles[importName].sections[current], last); count += 1; }
        }
      }
      results.push("Imported " + count + " sections for " + importName + " (" + profileSize(S.profiles[importName]) + " chars)");
      return;
    }

    if (action === "importb64") {
      var b1 = rest.indexOf(" ");
      if (b1 === -1) { results.push("Usage: /profile importb64 <name> [section] <base64>..."); return; }
      var bName = normalizeName(rest.substring(0, b1));
      var bBody = trimStr(rest.substring(b1 + 1));
      if (!S.profiles[bName]) S.profiles[bName] = { keywords: [bName], sections: {} };
      var re = /\[([a-zA-Z]+)\]\s*([A-Za-z0-9+\/_=-]+)/g, match, imported = 0;
      while ((match = re.exec(bBody)) !== null) {
        var rawTag = lowerStr(match[1]);
        var tag = (rawTag === "keywords") ? "keywords" : normalizeSectionName(rawTag);
        if (tag !== "keywords" && SECTIONS.indexOf(tag) === -1) continue;
        var decoded = fromBase64(match[2]);
        if (decoded === null) { results.push("Invalid base64 for [" + tag + "]"); continue; }
        if (tag === "keywords") S.profiles[bName].keywords = parseKeywords(decoded);
        else { S.profiles[bName].sections[tag] = appendSectionText(S.profiles[bName].sections[tag], decoded); imported += 1; }
      }
      results.push("Imported " + imported + " sections (b64) for " + bName + " (" + profileSize(S.profiles[bName]) + " chars)");
      return;
    }

    if (action === "importallb64") {
      var arg = trimStr(rest), lower = lowerStr(arg);
      if (!arg) { results.push("Usage: /profile importallb64 [merge|replace] <base64>"); return; }
      if (lower === "cancel" || lower === "abort") {
        S.importBuffer.active = false; S.importBuffer.mode = "merge"; S.importBuffer.payload = "";
        results.push("Import buffer cleared."); return;
      }
      if (lower === "finish" || lower === "end" || lower === "commit") {
        if (!S.importBuffer.active || !S.importBuffer.payload) { results.push("No active import buffer. Use /profile importallb64 begin first."); return; }
        var finishMode = (S.importBuffer.mode === "replace") ? "replace" : "merge";
        var payload = S.importBuffer.payload;
        S.importBuffer.active = false; S.importBuffer.mode = "merge"; S.importBuffer.payload = "";
        importAllProfiles(S, payload, finishMode, results); return;
      }
      if (lower.indexOf("begin") === 0 || lower.indexOf("start") === 0) {
        var startParts = arg.split(/\s+/), modeStart = "merge";
        if (startParts.length > 1 && (lowerStr(startParts[1]) === "merge" || lowerStr(startParts[1]) === "replace")) modeStart = lowerStr(startParts[1]);
        S.importBuffer.active = true; S.importBuffer.mode = modeStart; S.importBuffer.payload = "";
        results.push("Import buffer started (" + modeStart + "). Send chunks with /profile importallb64 chunk <data>, then /profile importallb64 finish");
        return;
      }
      if (lower.indexOf("chunk ") === 0 || lower.indexOf("append ") === 0) {
        if (!S.importBuffer.active) { results.push("No active import buffer. Use /profile importallb64 begin first."); return; }
        var chunk = trimStr(arg.replace(/^(?:chunk|append)\s+/i, ""));
        if (!chunk) { results.push("Usage: /profile importallb64 chunk <base64-part>"); return; }
        S.importBuffer.payload += chunk;
        results.push("Buffered chunk: +" + chunk.length + " chars (total " + S.importBuffer.payload.length + ")");
        return;
      }
      var mode = "merge", payloadB64 = arg, firstSpace = payloadB64.indexOf(" ");
      if (firstSpace !== -1) {
        var maybeMode = lowerStr(payloadB64.substring(0, firstSpace));
        if (maybeMode === "merge" || maybeMode === "replace") { mode = maybeMode; payloadB64 = trimStr(payloadB64.substring(firstSpace + 1)); }
      }
      if (!payloadB64) { results.push("Usage: /profile importallb64 [merge|replace] <base64>"); return; }
      importAllProfiles(S, payloadB64, mode, results);
      return;
    }

    if (action === "export" || action === "exportb64") {
      var exportName = normalizeName(rest.split(" ")[0]);
      if (!exportName || !S.profiles[exportName]) { results.push("Not found: " + (exportName || "?")); return; }
      var profile = S.profiles[exportName];
      var out = (action === "export")
        ? ("/profile import " + exportName + " [keywords] " + (profile.keywords || []).join(","))
        : ("/profile importb64 " + exportName + " [keywords] " + toBase64((profile.keywords || []).join(",")));
      for (var e = 0; e < SECTIONS.length; e++) {
        var secName = SECTIONS[e];
        if (profile.sections && profile.sections[secName]) out += " [" + secName + "] " + ((action === "export") ? profile.sections[secName] : toBase64(profile.sections[secName]));
      }
      if (action === "export") out += "\nTip: use /profile exportb64 for guaranteed round-trip safety.";
      results.push(out);
      return;
    }

    if (action === "exportallb64") {
      var countProfiles = 0;
      for (var pn in S.profiles) if (S.profiles.hasOwnProperty(pn)) countProfiles += 1;
      results.push("Profiles exported: " + countProfiles + "\n/profile importallb64 " + toBase64(JSON.stringify({ v: 1, p: S.profiles })));
      return;
    }

    if (action === "exportallchunks") {
      var args = trimStr(rest).split(/\s+/), modeChunk = "merge", chunkSize = 1200;
      if (args[0] && (lowerStr(args[0]) === "merge" || lowerStr(args[0]) === "replace")) { modeChunk = lowerStr(args[0]); args.shift(); }
      if (args[0]) {
        var maybeSize = parseInt(args[0], 10);
        if (!isNaN(maybeSize)) chunkSize = Math.max(250, Math.min(5000, maybeSize));
      }
      var totalProfiles = 0;
      for (var pnk in S.profiles) if (S.profiles.hasOwnProperty(pnk)) totalProfiles += 1;
      var payloadChunk = toBase64(JSON.stringify({ v: 1, p: S.profiles }));
      var lines = [];
      lines.push("Profiles exported: " + totalProfiles + " | payload chars=" + payloadChunk.length + " | chunkSize=" + chunkSize);
      lines.push("/profile importallb64 begin " + modeChunk);
      for (var offset = 0; offset < payloadChunk.length; offset += chunkSize) lines.push("/profile importallb64 chunk " + payloadChunk.substring(offset, offset + chunkSize));
      lines.push("/profile importallb64 finish");
      results.push(lines.join("\n"));
      return;
    }

    if (action === "config") {
      if (!rest) {
        var overrideCount = 0;
        for (var sk in S.config.sectionKeywords) if (S.config.sectionKeywords.hasOwnProperty(sk) && S.config.sectionKeywords[sk] && S.config.sectionKeywords[sk].length) overrideCount += 1;
        results.push("Config: budget=" + S.config.budget + " | fallback=" + S.config.fallback + " | debug=" + (S.config.debug ? "on" : "off") + " | maxActive=" + S.config.maxActive + " | widgets=" + (S.config.widgets ? "on" : "off") + " | keywordOverrides=" + overrideCount);
        return;
      }
      var cfg = rest.split(" "), key = lowerStr(cfg[0]), val = trimStr(cfg.slice(1).join(" "));
      if (key === "budget") {
        var num = parseInt(val, 10);
        if (isNaN(num) || num < 100) { results.push("Budget must be >= 100"); return; }
        S.config.budget = num; results.push("Budget: " + num); return;
      }
      if (key === "fallback") {
        var fallback = normalizeSectionName(val);
        if (SECTIONS.indexOf(fallback) === -1) { results.push("Bad section: " + val); return; }
        S.config.fallback = fallback; results.push("Fallback: " + fallback); return;
      }
      if (key === "debug") {
        var debugOn = parseOnOff(val);
        if (debugOn === null) { results.push("Usage: /profile config debug <on|off>"); return; }
        if (!debugOn) S._widgetClearPending = true;
        S.config.debug = debugOn; results.push("Debug: " + (debugOn ? "on" : "off")); return;
      }
      if (key === "maxactive") {
        var ma = parseInt(val, 10);
        if (isNaN(ma) || ma < 0) { results.push("maxActive must be >= 0 (0 = no cap)"); return; }
        S.config.maxActive = ma; results.push("maxActive: " + ma + (ma === 0 ? " (no cap)" : "")); return;
      }
      if (key === "keywords") {
        var sectionAndWords = trimStr(val);
        if (!sectionAndWords) { results.push("Usage: /profile config keywords <section> <word1,word2,...> | clear"); return; }
        var spk = sectionAndWords.indexOf(" ");
        var rawSecName = (spk === -1 ? sectionAndWords : sectionAndWords.substring(0, spk));
        var secName = normalizeSectionName(rawSecName);
        var wordsRaw = trimStr(spk === -1 ? "" : sectionAndWords.substring(spk + 1));
        if (SECTIONS.indexOf(secName) === -1) { results.push("Bad section: " + rawSecName + ". Use /profile sections"); return; }
        if (!wordsRaw) {
          var current = S.config.sectionKeywords[secName] || [];
          results.push("Keyword override for " + secName + ": " + (current.length ? current.join(", ") : "(none)")); return;
        }
        var keywordCmd = lowerStr(wordsRaw);
        if (keywordCmd === "clear" || keywordCmd === "reset" || keywordCmd === "off") { delete S.config.sectionKeywords[secName]; results.push("Cleared keyword override for " + secName); return; }
        var parsed = parseKeywords(wordsRaw);
        if (!parsed.length) { results.push("No keywords provided."); return; }
        S.config.sectionKeywords[secName] = parsed; results.push("Keyword override for " + secName + ": " + parsed.join(", ")); return;
      }
      if (key === "widgets") {
        if (!val) { results.push("Widgets: " + (S.config.widgets ? "on" : "off")); return; }
        var widgetVal = lowerStr(val);
        if (widgetVal === "on" || widgetVal === "true" || widgetVal === "1") { S.config.widgets = true; results.push("Widgets: on (requires BetterDungeon; keep off for mobile/shared users)"); return; }
        if (widgetVal === "off" || widgetVal === "false" || widgetVal === "0") { S.config.widgets = false; S._widgetClearPending = true; results.push("Widgets: off"); return; }
        results.push("Usage: /profile config widgets <on|off>"); return;
      }
      results.push("Config keys: budget, fallback, debug, maxActive, keywords, widgets");
      return;
    }

    results.push("Unknown: " + action + ". Try /profile help");
  }

  globalThis.DCP = function DCP(hook) {
    var S = ensureDcpState();

    if (hook === "input") {
      var rawInput = String(globalThis.text || "");
      var raw = extractEmbeddedCommand(rawInput, "/profile") || trimStr(rawInput);
      if (!startsWithCommand(raw, "/profile")) return;
      var parts = raw.split(";;");
      var results = [];
      var hasCommand = false;
      for (var i = 0; i < parts.length; i++) {
        var cmd = extractEmbeddedCommand(parts[i], "/profile") || trimStr(parts[i]);
        if (!startsWithCommand(cmd, "/profile")) continue;
        hasCommand = true;
        handleProfileCommand(cmd, S, results);
      }
      if (hasCommand) setPendingMessage(S, "profile", results.join("\n---\n"));
      return;
    }

    if (hook === "context") {
      var text = stripBDTags(globalThis.text || "");
      globalThis.text = text;
      state.dcpRuntime = { activeCount: 0, activeNames: [], top: [], used: 0 };
      var profiles = S.profiles;
      var names = [];
      for (var n in profiles) if (profiles.hasOwnProperty(n)) names.push(n);
      if (!names.length) return;

      var hist = (typeof history !== "undefined" && history) ? history : [];
      var lookback = Math.min(6, hist.length);
      var recentText = "";
      for (var h = hist.length - lookback; h < hist.length; h++) if (h >= 0 && hist[h]) recentText += " " + safeText(hist[h].text || hist[h].rawText);
      recentText = stripBDTags(recentText).toLowerCase();
      var textLower = text.toLowerCase();
      var keywords = getSectionKeywords(S.config.sectionKeywords);
      var matched = [];
      for (var ni = 0; ni < names.length; ni++) {
        var charName = names[ni], profile = profiles[charName], hit = 0;
        if (!profile || !profile.keywords) continue;
        for (var kw = 0; kw < profile.keywords.length; kw++) {
          var keyword = lowerStr(profile.keywords[kw]);
          if (!keyword) continue;
          if (containsWord(recentText, keyword)) hit += 1;
          if (containsWord(textLower, keyword)) hit += 2;
        }
        if (hit > 0) matched.push({ name: charName, hit: hit });
      }
      matched.sort(function (a, b) { return (b.hit !== a.hit) ? (b.hit - a.hit) : (a.name < b.name ? -1 : (a.name > b.name ? 1 : 0)); });
      var active = [];
      for (var m = 0; m < matched.length; m++) {
        if (S.config.maxActive > 0 && active.length >= S.config.maxActive) break;
        active.push(matched[m].name);
      }
      state.dcpRuntime.activeCount = active.length;
      state.dcpRuntime.activeNames = active.slice(0, 5);
      if (!active.length) return;

      var ranked = [];
      for (var si = 0; si < SECTIONS.length; si++) {
        var sectionName = SECTIONS[si], score = 0, words = keywords[sectionName] || [];
        for (var wi = 0; wi < words.length; wi++) {
          if (containsWord(recentText, words[wi])) score += 1;
          if (containsWord(textLower, words[wi])) score += 2;
        }
        ranked.push({ cat: sectionName, score: score, order: si });
      }
      ranked.sort(function (a, b) { return (b.score !== a.score) ? (b.score - a.score) : (a.order - b.order); });
      state.dcpRuntime.top = ranked.slice(0, 3).map(function (x) { return x.cat + ":" + x.score; });

      var chunks = [];
      for (var ai = 0; ai < active.length; ai++) {
        var activeName = active[ai], pObj = profiles[activeName];
        if (!pObj || !pObj.sections) continue;
        var partsOut = [], used = 0, addedSections = 0, header = "[ " + activeName + " ]";
        used += header.length + 2;
        for (var ri = 0; ri < ranked.length; ri++) {
          if (used >= S.config.budget) break;
          if (addedSections >= MAX_SECTIONS_PER_PROFILE) break;
          if (ranked[ri].score < 1) continue;
          var sec = ranked[ri].cat, content = safeText(pObj.sections[sec]);
          if (!content) continue;
          var label = sec + ": ", remain = S.config.budget - used;
          if (label.length + content.length <= remain) {
            partsOut.push(label + content);
            used += label.length + content.length + 1;
            addedSections += 1;
          } else {
            var maxContent = remain - label.length;
            if (maxContent <= 20) continue;
            var truncated = content.substring(0, maxContent), lastDot = truncated.lastIndexOf(".");
            if (lastDot > maxContent * 0.4) truncated = truncated.substring(0, lastDot + 1);
            partsOut.push(label + truncated);
            used += label.length + truncated.length + 1;
            addedSections += 1;
          }
        }
        if (!partsOut.length && pObj.sections[S.config.fallback]) {
          var fallback = pObj.sections[S.config.fallback];
          var maxFallback = S.config.budget - header.length - S.config.fallback.length - 4;
          if (maxFallback > 20) partsOut.push(S.config.fallback + ": " + (fallback.length > maxFallback ? fallback.substring(0, maxFallback) : fallback));
        }
        if (partsOut.length) chunks.push(header + "\n" + partsOut.join("\n"));
      }

      if (chunks.length) {
        var maxChars = (typeof info !== "undefined" && info && info.maxChars) ? info.maxChars : 8000;
        var openTag = "\n[Character Detail]\n", closeTag = "\n[/Character Detail]\n";
        var room = maxChars - text.length - openTag.length - closeTag.length;
        if (room > 64) {
          var fitted = [], usedChars = 0;
          for (var ci = 0; ci < chunks.length; ci++) {
            var sep = fitted.length ? "\n\n" : "";
            var candidate = sep + chunks[ci];
            if (usedChars + candidate.length <= room) {
              fitted.push(chunks[ci]);
              usedChars += candidate.length;
            } else {
              var remain = room - usedChars - sep.length;
              if (remain > 64) {
                var partial = chunks[ci].substring(0, remain), cut = partial.lastIndexOf("\n");
                if (cut > 32) partial = partial.substring(0, cut);
                fitted.push(partial + " ...");
              }
              break;
            }
          }
          if (fitted.length) {
            var block = openTag + fitted.join("\n\n") + closeTag;
            var lastNl = text.lastIndexOf("\n");
            globalThis.text = (lastNl > 0) ? (text.substring(0, lastNl) + block + text.substring(lastNl)) : (text + block);
            state.dcpRuntime.used = block.length;
          }
        }
      }
      return;
    }

    if (hook === "output") {
      var outText = (typeof globalThis.text === "string") ? globalThis.text : " ";
      if (S._pending) {
        outText = S._pending;
        clearPendingMessage(S);
      }
      outText = stripBDTags(outText).replace(/([.!?]["\)\]]?)([A-Z])/g, "$1 $2");
      if (S._widgetClearPending) {
        outText += destroyDebugWidgets();
        S._widgetClearPending = false;
        S._widgetActive = false;
      }
      if (S.config.widgets && S.config.debug) {
        outText += buildDebugWidgets(S, state.dcpRuntime || {});
        S._widgetActive = true;
      } else if (S._widgetActive) {
        outText += destroyDebugWidgets();
        S._widgetActive = false;
      }
      globalThis.text = outText;
      return;
    }
  };

  globalThis.DCPTime = function DCPTime(hook) {
    var T = ensureTimeState();
    var S = ensureDcpState();

    if (hook === "input") {
      var rawInput = String(globalThis.text || "");
      var extracted = extractAnyCommand(rawInput);
      T.lastInput = extracted || trimStr(rawInput);
      var quickMsg = handleQuickTimeCommand(T.lastInput, T);
      if (quickMsg !== null) {
        setPendingMessage(S, "time", quickMsg);
        return;
      }
      if (startsWithCommand(T.lastInput, "/remind")) {
        setPendingMessage(S, "time", handleRemindCommand(T.lastInput, T));
        return;
      }
      if (!startsWithCommand(T.lastInput, "/time")) return;

      var argStr = trimStr(T.lastInput.substring("/time".length));
      var sp = argStr.indexOf(" ");
      var action = lowerStr(sp === -1 ? argStr : argStr.substring(0, sp));
      var rest = trimStr(sp === -1 ? "" : argStr.substring(sp + 1));
      var msg = "";

      if (!action || action === "help") msg = timeHelpText();
      else if (action === "show" || action === "status") msg = "Time: " + formatCurrentTimeStamp(T) + " | display=" + T.displayMode + " | format=" + T.timeFormat + " | enabled=" + (T.enabled ? "on" : "off") + " | paused=" + (T.paused ? "on" : "off") + " | context=" + (T.showContext ? "on" : "off") + " | output=" + (T.showOutput ? "on" : "off") + " | message=" + (T.showStateMessage ? "on" : "off") + " | minutesPerAction=" + T.minutesPerAction + " | reminders=" + T.reminders.length;
      else if (action === "set") {
        if (!rest) msg = quickTimeUsage("/time set");
        else {
          var parsedSet = parseClockWithNextday(rest);
          if (!parsedSet) msg = quickTimeUsage("/time set");
          else {
            var previousSetMs = getWorldTimestampMs(T);
            T.hour = parsedSet.hour;
            T.minute = parsedSet.minute;
            if (parsedSet.nextday) T.day += 1;
            normalizeTime(T);
            processReminderEvents(T, previousSetMs, getWorldTimestampMs(T));
            msg = "Time set: " + formatVisibleTimeStamp(T);
          }
        }
      } else if (action === "add") {
        var duration = parseDuration(rest);
        if (!duration.ok) msg = "Usage: /time add <Nd Nh Nm> (example: /time add 1d 4h 30m)";
        else {
          applyDurationAdvance(T, duration);
          msg = "Time advanced: " + formatVisibleTimeStamp(T);
        }
      } else if (action === "config") {
        if (!rest) msg = "Time config: enabled=" + (T.enabled ? "on" : "off") + " | paused=" + (T.paused ? "on" : "off") + " | display=" + T.displayMode + " | format=" + T.timeFormat + " | context=" + (T.showContext ? "on" : "off") + " | output=" + (T.showOutput ? "on" : "off") + " | message=" + (T.showStateMessage ? "on" : "off") + " | minutes=" + T.minutesPerAction + " | sleep=" + formatClockParts(T.defaultSleepHour, T.defaultSleepMinute, T.timeFormat) + " | nap=" + minutesToDurationText(T.defaultNapMinutes) + " | rest=" + minutesToDurationText(T.defaultRestMinutes) + " | date=" + formatCalendarStamp(T) + " | time=" + formatClockDisplay(T) + " | reminders=" + T.reminders.length;
        else {
          var sp2 = rest.indexOf(" ");
          var key = lowerStr(sp2 === -1 ? rest : rest.substring(0, sp2));
          var val = trimStr(sp2 === -1 ? "" : rest.substring(sp2 + 1));
          if (key === "date") {
            var parsedDate = parseCalendarDate(val);
            if (!parsedDate) msg = "Usage: /time config date <MM/DD/YYYY>";
            else {
              setDisplayedCalendarDate(T, parsedDate[0], parsedDate[1], parsedDate[2]);
              msg = "Time config date: " + formatCalendarStamp(T);
            }
          } else if (key === "format") {
            var parsedFormat = normalizeTimeFormat(val);
            if (!parsedFormat) msg = "Usage: /time config format <12h|24h>";
            else {
              T.timeFormat = parsedFormat;
              normalizeTime(T);
              msg = "Time format: " + T.timeFormat;
            }
          } else if (key === "display") {
            var parsedDisplay = normalizeDisplayMode(val);
            if (!parsedDisplay) msg = "Usage: /time config display <full|compact>";
            else {
              T.displayMode = parsedDisplay;
              normalizeTime(T);
              msg = "Time display: " + T.displayMode;
            }
          } else if (key === "sleep") {
            var parsedSleep = parseClockTime(val);
            if (!parsedSleep) msg = "Usage: /time config sleep <time>";
            else {
              T.defaultSleepHour = parsedSleep[0];
              T.defaultSleepMinute = parsedSleep[1];
              normalizeTime(T);
              msg = "Default sleep time: " + formatClockParts(T.defaultSleepHour, T.defaultSleepMinute, T.timeFormat);
            }
          } else if (key === "nap" || key === "rest") {
            var parsedDuration = parseDuration(val);
            var totalDuration = durationToMinutes(parsedDuration);
            if (!parsedDuration.ok || totalDuration < 1) msg = "Usage: /time config " + key + " <duration>";
            else {
              if (key === "nap") T.defaultNapMinutes = totalDuration;
              else T.defaultRestMinutes = totalDuration;
              normalizeTime(T);
              msg = "Default " + key + " duration: " + minutesToDurationText(key === "nap" ? T.defaultNapMinutes : T.defaultRestMinutes);
            }
          } else if (key === "enabled" || key === "context" || key === "output" || key === "message") {
            var boolVal = parseOnOff(val);
            if (boolVal === null) msg = "Usage: /time config " + key + " <on|off>";
            else {
              if (key === "enabled") T.enabled = boolVal;
              else if (key === "context") T.showContext = boolVal;
              else if (key === "output") T.showOutput = boolVal;
              else T.showStateMessage = boolVal;
              msg = "Time config " + key + ": " + (boolVal ? "on" : "off");
            }
          } else if (key === "minutes") {
            var minutes = parseInt(val, 10);
            if (isNaN(minutes) || minutes < 1 || minutes > 60) msg = "Minutes must be 1-60";
            else { T.minutesPerAction = minutes; msg = "Minutes per action: " + minutes; }
          } else msg = "Time config keys: date, display, format, sleep, nap, rest, enabled, context, output, message, minutes";
        }
      } else msg = "Unknown /time command: " + action + ". Try /time help";

      setPendingMessage(S, "time", msg);
      return;
    }

    if (hook === "context") {
      normalizeTime(T);
      var actionCount = getActionCount();
      if (actionCount >= 0 && actionCount !== T.lastAdvanceAction) {
        T.lastAdvanceAction = actionCount;
        if (T.enabled && !T.paused) {
          var effectiveInput = trimStr(T.lastInput || "");
          var commandTurn = startsWithCommand(effectiveInput, "/profile") || startsWithAnyCommand(effectiveInput, TIME_COMMAND_TOKENS);
          if (!commandTurn) {
            applyTimeMacros(T, effectiveInput.toLowerCase());
            advanceTurnTime(T);
          }
        }
      }
      var reminderCommandTurn = startsWithCommand(T.lastInput || "", "/profile") || startsWithAnyCommand(T.lastInput || "", TIME_COMMAND_TOKENS);
      if (T.pendingReminderCues.length && !reminderCommandTurn && globalThis.stop !== true) {
        globalThis.text = String(globalThis.text || "") + "\n\n" + T.pendingReminderCues.join("\n");
        T.pendingReminderCues = [];
      }
      if (T.enabled && T.showContext && globalThis.stop !== true) {
        globalThis.text = String(globalThis.text || "") + "\n\n[Use this timing information: Date: " + formatCalendarStamp(T) + ", Time: " + formatClockDisplay(T) + ", Phase: " + T.phase + "]";
      }
      return;
    }

    if (hook === "output") {
      normalizeTime(T);
      if (T.enabled && T.showOutput) {
        globalThis.text = String(globalThis.text || "") + "\n\n[Time: " + formatVisibleTimeStamp(T) + "]";
      }
      if (T.enabled && T.showStateMessage) {
        state.message = formatVisibleTimeStamp(T);
      }
      return;
    }
  };

  globalThis.DCPInputRouter = function DCPInputRouter(text) {
    var raw = String(text || "");
    var S = ensureDcpState();
    clearPendingMessage(S);
    globalThis.text = raw;
    globalThis.stop = false;

    var parts = raw.split(";;");
    var hasCommand = false;

    for (var i = 0; i < parts.length; i++) {
      var segment = trimStr(parts[i]);
      if (!segment) continue;
      var command = extractAnyCommand(segment);
      if (!command) continue;
      hasCommand = true;
      globalThis.text = command;
      if (startsWithCommand(command, "/profile")) {
        if (typeof DCP === "function") DCP("input");
      } else if (startsWithAnyCommand(command, TIME_COMMAND_TOKENS)) {
        if (typeof DCPTime === "function") DCPTime("input");
      }
    }

    if (!hasCommand) {
      globalThis.text = raw;
      globalThis.stop = false;
      if (typeof DCPTime === "function") DCPTime("input");
      if (globalThis.stop !== true && typeof DCP === "function") DCP("input");
      return {
        text: globalThis.text || " ",
        stop: globalThis.stop === true
      };
    }

    return {
      text: globalThis.text || " ",
      stop: globalThis.stop === true
    };
  };
})();



