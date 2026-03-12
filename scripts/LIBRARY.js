// ============================================================
// DCP v4.4 — LIBRARY (all logic lives here)
//
// Fixes in v4.4:
// - Runtime-safe base64 encode/decode (works without btoa/atob globals)
// - Base64 payload normalization (handles base64url and '+' -> space issues)
// - Chunked bulk import for long /profile importallb64 payloads

// - Correct command-stop behavior (uses globalThis.stop = true)
// - Safe export/import payload encoding (base64 for section content)
// - Graceful context injection when maxChars is tight (partial fit)
// - Case-insensitive profile/action/section handling
// ============================================================

globalThis.DCP = function DCP(hook) {
  "use strict";

  // === STATE INIT ===
  if ((typeof state.dcp !== "object") || (state.dcp === null) || Array.isArray(state.dcp)) {
    state.dcp = {};
  }
  if ((typeof state.dcp.profiles !== "object") || (state.dcp.profiles === null) || Array.isArray(state.dcp.profiles)) {
    state.dcp.profiles = {};
  }
  if ((typeof state.dcp.config !== "object") || (state.dcp.config === null) || Array.isArray(state.dcp.config)) {
    state.dcp.config = {};
  }
  if (typeof state.dcp._pending !== "string") {
    state.dcp._pending = "";
  }
  var S = state.dcp;
  S.config = S.config || {};
  S.config.budget = (typeof S.config.budget === "number" ? S.config.budget : 800);
  S.config.fallback = (S.config.fallback || "personality").toLowerCase();
  S.config.debug = !!S.config.debug;
  S.config.sectionKeywords = S.config.sectionKeywords || {};
  S.config.widgets = !!S.config.widgets;
  S.config.maxActive = parseInt(S.config.maxActive, 10);
  if (isNaN(S.config.maxActive) || S.config.maxActive < 0) S.config.maxActive = 0;


  var SECTIONS = [
    "appearance", "personality", "history", "abilities", "quirks",
    "relationships", "speech", "mannerisms", "species", "other"
  ];

  // === HELPERS ===

  function isWordBound(ch) {
    return !ch || " \t\n\r.,!?;:'\"-()[]{}/<>@#$%^&*~`+=|\\".indexOf(ch) !== -1;
  }

  function containsWord(str, word) {
    var idx = 0;
    while (true) {
      idx = str.indexOf(word, idx);
      if (idx === -1) return false;
      var before = (idx === 0) || isWordBound(str.charAt(idx - 1));
      var after = (idx + word.length >= str.length) || isWordBound(str.charAt(idx + word.length));
      if (before && after) return true;
      idx++;
    }
  }

  function profileSize(prof) {
    var total = 0;
    for (var k in prof.sections) {
      if (prof.sections.hasOwnProperty(k)) total += prof.sections[k].length;
    }
    return total;
  }

  function normalizeName(name) {
    return (name || "").trim().toLowerCase();
  }

  function parseKeywords(str) {
    var arr = [];
    var parts = (str.indexOf(",") !== -1) ? str.split(",") : str.split(" ");
    for (var i = 0; i < parts.length; i++) {
      var w = parts[i].trim().toLowerCase();
      if (w) arr.push(w);
    }
    return arr;
  }


  var B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  function normalizeBase64Input(input) {
    var s = String(input || "");
    if (!s) return "";
    s = s.replace(/\r/g, "").replace(/\n/g, "").replace(/\t/g, "");
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    if ((s.indexOf(" ") !== -1) && (s.indexOf("+") === -1)) {
      s = s.replace(/ /g, "+");
    }
    s = s.replace(/\s+/g, "");
    while ((s.length % 4) !== 0) s += "=";
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
      out += B64_CHARS.charAt((triplet >> 18) & 63);
      out += B64_CHARS.charAt((triplet >> 12) & 63);
      out += isNaN(b) ? "=" : B64_CHARS.charAt((triplet >> 6) & 63);
      out += isNaN(c) ? "=" : B64_CHARS.charAt(triplet & 63);
    }
    return out;
  }

  function base64ToBytes(input) {
    var clean = String(input || "").replace(/\s+/g, "");
    if (clean.length === 0) return [];
    if ((clean.length % 4) !== 0) return null;

    var map = {};
    for (var i = 0; i < B64_CHARS.length; i++) {
      map[B64_CHARS.charAt(i)] = i;
    }

    var bytes = [];
    for (var j = 0; j < clean.length; j += 4) {
      var c1 = clean.charAt(j);
      var c2 = clean.charAt(j + 1);
      var c3 = clean.charAt(j + 2);
      var c4 = clean.charAt(j + 3);
      if ((c1 === "=") || (c2 === "=")) return null;

      var v1 = map[c1];
      var v2 = map[c2];
      if ((v1 === undefined) || (v2 === undefined)) return null;

      var pad3 = (c3 === "=");
      var pad4 = (c4 === "=");
      var v3 = 0;
      var v4 = 0;

      if (!pad3) {
        v3 = map[c3];
        if (v3 === undefined) return null;
      } else if (!pad4) {
        return null;
      }

      if (!pad4) {
        v4 = map[c4];
        if (v4 === undefined) return null;
      }

      var triplet = (v1 << 18) | (v2 << 12) | (v3 << 6) | v4;
      bytes.push((triplet >> 16) & 255);
      if (!pad3) bytes.push((triplet >> 8) & 255);
      if (!pad4) bytes.push(triplet & 255);

      if ((pad3 || pad4) && ((j + 4) < clean.length)) {
        return null;
      }
    }
    return bytes;
  }

  function utf8ToBytes(str) {
    if (typeof TextEncoder === "function") {
      try {
        var enc = new TextEncoder().encode(str);
        var arr = [];
        for (var i = 0; i < enc.length; i++) arr.push(enc[i]);
        return arr;
      } catch (e) {}
    }
    var utf8 = unescape(encodeURIComponent(str));
    var out = [];
    for (var j = 0; j < utf8.length; j++) {
      out.push(utf8.charCodeAt(j));
    }
    return out;
  }

  function bytesToUtf8(bytes) {
    if (typeof TextDecoder === "function") {
      try {
        return new TextDecoder().decode(new Uint8Array(bytes));
      } catch (e) {}
    }
    var bin = "";
    for (var i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    try {
      return decodeURIComponent(escape(bin));
    } catch (e2) {
      return null;
    }
  }

  function toBase64(s) {
    if (!s) return "";
    var str = String(s);
    var out = "";

    if (typeof btoa === "function") {
      try {
        out = btoa(unescape(encodeURIComponent(str)));
      } catch (e) {}
    }

    if (!out && (typeof Buffer !== "undefined") && Buffer && (typeof Buffer.from === "function")) {
      try {
        out = Buffer.from(str, "utf8").toString("base64");
      } catch (e2) {}
    }

    if (!out) {
      out = bytesToBase64(utf8ToBytes(str));
    }

    return out.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function fromBase64(s) {
    if (!s) return "";
    var input = normalizeBase64Input(s);
    if (!input) return "";

    if (typeof atob === "function") {
      try {
        return decodeURIComponent(escape(atob(input)));
      } catch (e) {}
    }

    if ((typeof Buffer !== "undefined") && Buffer && (typeof Buffer.from === "function")) {
      try {
        return Buffer.from(input, "base64").toString("utf8");
      } catch (e2) {}
    }

    try {
      var bytes = base64ToBytes(input);
      if (bytes === null) return null;
      return bytesToUtf8(bytes);
    } catch (e3) {
      return null;
    }
  }
  function defaultSectionKeywords() {
    return {
      appearance: ["appearance","look","looks","looked","describe","description","features","face","eyes","hair","body","height","build","clothing","clothes","outfit","wearing","uniform","armor"],
      personality: ["personality","temperament","attitude","demeanor","mood","emotion","feeling","feel","feels","calm","angry","nervous","confident","shy","kind","cruel","friendly","polite","rude","humor"],
      history: ["history","backstory","background","past","origin","grew up","childhood","before","previously","once","years ago","remember","memory","memories","former","used to"],
      abilities: ["abilities","ability","power","powers","skills","skill","talent","talents","strength","weakness","fight","combat","attack","defend","magic","spell","weapon","tactics","capable","can"],
      quirks: ["quirk","quirks","habit","habits","odd","peculiar","strange","unusual","tick","tics","obsession","fear","phobia","favorite","routine","compulsion"],
      relationships: ["relationship","relationships","friend","friends","enemy","enemies","rival","ally","partner","family","parent","sibling","mentor","student","bond","trust","loyal","romance"],
      speech: ["speech","voice","tone","accent","says","said","speak","speaks","speaking","whisper","shout","dialogue","phrase","phrasing","word choice"],
      mannerisms: ["mannerism","mannerisms","gesture","gestures","posture","movement","moves","walk","walks","stance","fidget","nod","shrug","glance","expression","body language"],
      species: ["species","race","lineage","ancestry","biology","anatomy","physiology","human","humanoid","creature","beast","monster","nonhuman","instinct","traits"],
      other: ["other","misc","miscellaneous","notes","detail","details","extra","additional","general","context"]
    };
  }

  function getSectionKeywords() {
    var base = defaultSectionKeywords();
    var overrides = S.config.sectionKeywords || {};
    for (var sec in overrides) {
      if (!overrides.hasOwnProperty(sec)) continue;
      if (SECTIONS.indexOf(sec) === -1) continue;
      var custom = overrides[sec];
      if (!custom || !custom.length) continue;
      if (!base[sec]) base[sec] = [];
      for (var i = 0; i < custom.length; i++) {
        var w = (custom[i] || "").toLowerCase().trim();
        if (w && base[sec].indexOf(w) === -1) base[sec].push(w);
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

  function bdWidget(id, config) {
    return bdMessage({ type: "widget", widgetId: id, action: "create", config: config });
  }

  var DCP_WIDGET_IDS = ["dcp_active", "dcp_budget", "dcp_focus"];

  function bdDestroy(id) {
    return bdMessage({ type: "widget", widgetId: id, action: "destroy" });
  }

  function destroyDebugWidgets() {
    var out = "";
    for (var i = 0; i < DCP_WIDGET_IDS.length; i++) {
      out += bdDestroy(DCP_WIDGET_IDS[i]);
    }
    return out;
  }

  function buildDebugWidgets() {
    if (!S.config.widgets || !S.config.debug) return "";
    var snap = state.dcpRuntime || {};
    var widgets = "";

    widgets += bdWidget("dcp_active", {
      type: "stat",
      label: "Active",
      value: snap.activeCount || 0,
      align: "left",
      order: 1,
      color: "#22c55e"
    });

    var injectCap = (snap.activeCount || 0) * (S.config.budget || 0);

    widgets += bdWidget("dcp_budget", {
      type: "stat",
      label: "Inject",
      value: String(snap.used || 0) + "/" + String(injectCap),
      align: "right",
      order: 1,
      color: "#60a5fa"
    });

    if (snap.top && snap.top.length) {
      widgets += bdWidget("dcp_focus", {
        type: "badge",
        text: "Focus: " + snap.top.join(", "),
        variant: "subtle",
        align: "center",
        order: 1,
        color: "#f59e0b"
      });
    }

    return widgets;
  }

  function importAllFromPayload(payloadB64, mode, results) {
    var decodedAll = fromBase64(payloadB64);
    if (decodedAll === null) {
      results.push("Invalid base64 payload.");
      return false;
    }

    var parsedAll = null;
    try {
      parsedAll = JSON.parse(decodedAll);
    } catch (e) {
      results.push("Invalid payload JSON.");
      return false;
    }

    var sourceProfiles = parsedAll && (parsedAll.p || parsedAll.profiles);
    if (!sourceProfiles || typeof sourceProfiles !== "object") {
      results.push("Payload missing profiles.");
      return false;
    }

    if (mode === "replace") S.profiles = {};

    var created = 0;
    var updated = 0;
    var skipped = 0;

    for (var rawName in sourceProfiles) {
      if (!sourceProfiles.hasOwnProperty(rawName)) continue;
      var normName = normalizeName(rawName);
      if (!normName) { skipped++; continue; }

      var srcProf = sourceProfiles[rawName] || {};
      var srcSections = srcProf.sections || {};

      var cleanSections = {};
      for (var si = 0; si < SECTIONS.length; si++) {
        var secName = SECTIONS[si];
        var secVal = srcSections[secName];
        if (typeof secVal === "string" && secVal.trim().length) {
          cleanSections[secName] = secVal;
        }
      }

      var cleanKeywords = [];
      if (srcProf.keywords && srcProf.keywords.length) {
        for (var ki = 0; ki < srcProf.keywords.length; ki++) {
          var kwItem = String(srcProf.keywords[ki] || "").trim().toLowerCase();
          if (kwItem && cleanKeywords.indexOf(kwItem) === -1) cleanKeywords.push(kwItem);
        }
      }
      if (cleanKeywords.length === 0) cleanKeywords.push(normName);

      if (S.profiles[normName]) updated++; else created++;
      S.profiles[normName] = { keywords: cleanKeywords, sections: cleanSections };
    }

    results.push(
      "Imported all profiles (" + mode + "): created=" + created +
      ", updated=" + updated +
      ", skipped=" + skipped +
      ", total=" + (created + updated)
    );
    return true;
  }
  // ================================================================
  //  INPUT — command parsing
  //  Supports ;; as batch separator and /profile import for bulk entry
  // ================================================================
  if (hook === "input") {
    var raw = (globalThis.text || "").trim();

    // Safety: clear stale pending fallback on normal (non-command) turns.
    // This prevents old command text from leaking into a later output.
    if (S._pending && raw.indexOf("/profile") !== 0) {
      S._pending = "";
    }
    if (raw.indexOf("/profile") === -1) return;

    var parts = raw.split(";;");
    var results = [];
    var hasCommand = false;

    for (var p = 0; p < parts.length; p++) {
      var trimmed = parts[p].trim();


      if (trimmed.indexOf("/profile") !== 0) continue;
      if (trimmed.length > 8 && trimmed.charAt(8) !== " ") continue;

      hasCommand = true;
      var argStr = trimmed.length > 9 ? trimmed.substring(9).trim() : "";
      var spIdx = argStr.indexOf(" ");
      var action = (spIdx === -1 ? argStr : argStr.substring(0, spIdx)).toLowerCase();
      var rest = spIdx === -1 ? "" : argStr.substring(spIdx + 1).trim();

      // --- HELP ---
      if (action === "" || action === "help") {
        results.push(
          "=== DCP Commands ===\n" +
          "/profile add <name>\n" +
          "/profile remove <name>\n" +
          "/profile show <name>\n" +
          "/profile list\n" +
          "/profile set <name> <section> <text>\n" +
          "/profile append <name> <section> <text>\n" +
          "/profile keywords <name> <word1,word2,...>\n" +
          "/profile import <name> [section] text...\n" +
          "/profile importb64 <name> [section] <base64>...\n" +
          "/profile importallb64 [merge|replace] <base64>\n" +
          "/profile importallb64 begin [merge|replace]\n" +
          "/profile importallb64 chunk <base64-part>\n" +
          "/profile importallb64 finish\n" +
          "/profile exportallchunks [merge|replace] [chunkSize]\n" +
          "/profile export <name>\n" +
          "/profile exportb64 <name>\n" +
          "/profile exportallb64\n" +
          "/profile config [budget|fallback|debug|maxActive|keywords|widgets] [value]\n" +
          "/profile sections\n" +
          "Batch: separate commands with ;;"
        );
      }

      // --- SECTIONS ---
      else if (action === "sections") {
        results.push("Sections: " + SECTIONS.join(", "));
      }

      // --- LIST ---
      else if (action === "list") {
        var names = [];
        for (var k in S.profiles) {
          if (S.profiles.hasOwnProperty(k)) {
            names.push(k + " (" + profileSize(S.profiles[k]) + ")");
          }
        }
        results.push(names.length === 0
          ? "No profiles stored."
          : "Profiles: " + names.join(", "));
      }

      // --- ADD ---
      else if (action === "add") {
        var nameRaw = rest.split(" ")[0];
        var name = normalizeName(nameRaw);
        if (!name) { results.push("Usage: /profile add <name>"); continue; }
        if (S.profiles[name]) { results.push(name + " already exists."); continue; }
        S.profiles[name] = { keywords: [name], sections: {} };
        results.push("Created " + name + ".");
      }

      // --- REMOVE ---
      else if (action === "remove" || action === "delete") {
        var name = normalizeName(rest.split(" ")[0]);
        if (!name || !S.profiles[name]) { results.push("Not found: " + (name || "?")); continue; }
        delete S.profiles[name];
        results.push("Removed " + name + ".");
      }

      // --- SHOW ---
      else if (action === "show") {
        var name = normalizeName(rest.split(" ")[0]);
        if (!name || !S.profiles[name]) { results.push("Not found: " + (name || "?")); continue; }
        var prof = S.profiles[name];
        var lines = ["= " + name + " =", "Keywords: " + prof.keywords.join(", ")];
        var total = 0;
        for (var s = 0; s < SECTIONS.length; s++) {
          var sec = SECTIONS[s];
          if (prof.sections[sec]) {
            lines.push("  " + sec + ": " + prof.sections[sec].length + " chars");
            total += prof.sections[sec].length;
          }
        }
        lines.push("Total: " + total + " chars");
        results.push(lines.join("\n"));
      }

      // --- SET ---
      else if (action === "set") {
        var sp1 = rest.indexOf(" ");
        if (sp1 === -1) { results.push("Usage: /profile set <name> <section> <text>"); continue; }
        var name = normalizeName(rest.substring(0, sp1));
        var after = rest.substring(sp1 + 1).trim();
        var sp2 = after.indexOf(" ");
        if (sp2 === -1) { results.push("Usage: /profile set <name> <section> <text>"); continue; }
        var section = after.substring(0, sp2).toLowerCase();
        var val = after.substring(sp2 + 1).trim();
        if (!S.profiles[name]) { results.push("Not found: " + name + ". Use /profile add first."); continue; }
        if (SECTIONS.indexOf(section) === -1) { results.push("Bad section: " + section + ". Use /profile sections"); continue; }
        S.profiles[name].sections[section] = val;
        results.push(name + "." + section + " set (" + val.length + " chars)");
      }

      // --- APPEND ---
      else if (action === "append") {
        var sp1 = rest.indexOf(" ");
        if (sp1 === -1) { results.push("Usage: /profile append <name> <section> <text>"); continue; }
        var name = normalizeName(rest.substring(0, sp1));
        var after = rest.substring(sp1 + 1).trim();
        var sp2 = after.indexOf(" ");
        if (sp2 === -1) { results.push("Usage: /profile append <name> <section> <text>"); continue; }
        var section = after.substring(0, sp2).toLowerCase();
        var val = after.substring(sp2 + 1).trim();
        if (!S.profiles[name]) { results.push("Not found: " + name); continue; }
        if (SECTIONS.indexOf(section) === -1) { results.push("Bad section: " + section); continue; }
        S.profiles[name].sections[section] = (S.profiles[name].sections[section] || "") + " " + val;
        S.profiles[name].sections[section] = S.profiles[name].sections[section].trim();
        results.push(name + "." + section + " appended (" + S.profiles[name].sections[section].length + " chars)");
      }

      // --- KEYWORDS ---
      else if (action === "keywords") {
        var sp1 = rest.indexOf(" ");
        if (sp1 === -1) {
          var nameOnly = normalizeName(rest);
          if (!nameOnly || !S.profiles[nameOnly]) { results.push("Not found: " + (nameOnly || "?")); continue; }
          results.push("Keywords for " + nameOnly + ": " + S.profiles[nameOnly].keywords.join(", "));
          continue;
        }
        var name = normalizeName(rest.substring(0, sp1));
        var kwStr = rest.substring(sp1 + 1).trim();
        if (!S.profiles[name]) { results.push("Not found: " + name); continue; }
        S.profiles[name].keywords = parseKeywords(kwStr);
        results.push("Keywords for " + name + ": " + S.profiles[name].keywords.join(", "));
      }

      // --- IMPORT (plain text tagged sections) ---
      else if (action === "import") {
        var sp1 = rest.indexOf(" ");
        if (sp1 === -1) {
          results.push("Usage: /profile import <name> [section] text [section] text...");
          continue;
        }
        var name = normalizeName(rest.substring(0, sp1));
        var body = rest.substring(sp1 + 1).trim();
        if (!S.profiles[name]) S.profiles[name] = { keywords: [name], sections: {} };

        var count = 0;
        var currentKey = null;
        var sectionStart = -1;
        var pos = 0;

        while (pos < body.length) {
          var ob = body.indexOf("[", pos);
          if (ob === -1) break;
          var cb = body.indexOf("]", ob);
          if (cb === -1) break;
          var tag = body.substring(ob + 1, cb).toLowerCase().trim();

          if (tag === "keywords" || SECTIONS.indexOf(tag) !== -1) {
            if (currentKey !== null && sectionStart >= 0) {
              var content = body.substring(sectionStart, ob).trim();
              if (content) {
                if (currentKey === "keywords") {
                  S.profiles[name].keywords = parseKeywords(content);
                } else {
                  S.profiles[name].sections[currentKey] = content;
                  count++;
                }
              }
            }
            currentKey = tag;
            sectionStart = cb + 1;
            pos = cb + 1;
          } else {
            pos = cb + 1;
          }
        }

        if (currentKey !== null && sectionStart >= 0 && sectionStart <= body.length) {
          var lastContent = body.substring(sectionStart).trim();
          if (lastContent) {
            if (currentKey === "keywords") {
              S.profiles[name].keywords = parseKeywords(lastContent);
            } else {
              S.profiles[name].sections[currentKey] = lastContent;
              count++;
            }
          }
        }

        results.push("Imported " + count + " sections for " + name + " (" + profileSize(S.profiles[name]) + " chars)");
      }

      // --- IMPORTB64 (safe round-trip for arbitrary section text) ---
      else if (action === "importb64") {
        var sp1 = rest.indexOf(" ");
        if (sp1 === -1) {
          results.push("Usage: /profile importb64 <name> [section] <base64>...");
          continue;
        }
        var name = normalizeName(rest.substring(0, sp1));
        var body = rest.substring(sp1 + 1).trim();
        if (!S.profiles[name]) S.profiles[name] = { keywords: [name], sections: {} };

        var match;
        var re = /\[([a-zA-Z]+)\]\s*([A-Za-z0-9+\/=_-]+)/g;
        var imported = 0;
        while ((match = re.exec(body)) !== null) {
          var tag = match[1].toLowerCase();
          var b64 = match[2];
          if (tag !== "keywords" && SECTIONS.indexOf(tag) === -1) continue;

          var decoded = fromBase64(b64);
          if (decoded === null) {
            results.push("Invalid base64 for [" + tag + "]");
            continue;
          }

          if (tag === "keywords") {
            S.profiles[name].keywords = parseKeywords(decoded);
          } else {
            S.profiles[name].sections[tag] = decoded;
            imported++;
          }
        }
        results.push("Imported " + imported + " sections (b64) for " + name + " (" + profileSize(S.profiles[name]) + " chars)");
      }

      // --- IMPORTALLB64 (bulk transfer) ---
      else if (action === "importallb64") {
        S.importBuffer = S.importBuffer || { active: false, mode: "merge", payload: "" };

        var arg = (rest || "").trim();
        if (!arg) {
          results.push("Usage: /profile importallb64 [merge|replace] <base64>");
          continue;
        }

        var argLower = arg.toLowerCase();

        if (argLower === "cancel" || argLower === "abort") {
          S.importBuffer.active = false;
          S.importBuffer.mode = "merge";
          S.importBuffer.payload = "";
          results.push("Import buffer cleared.");
          continue;
        }

        if (argLower === "finish" || argLower === "end" || argLower === "commit") {
          if (!S.importBuffer.active || !S.importBuffer.payload) {
            results.push("No active import buffer. Use /profile importallb64 begin first.");
            continue;
          }
          var finishMode = (S.importBuffer.mode === "replace") ? "replace" : "merge";
          var bufferedPayload = S.importBuffer.payload;
          S.importBuffer.active = false;
          S.importBuffer.mode = "merge";
          S.importBuffer.payload = "";
          importAllFromPayload(bufferedPayload, finishMode, results);
          continue;
        }

        if (argLower.indexOf("begin") === 0 || argLower.indexOf("start") === 0) {
          var startParts = arg.split(/\s+/);
          var modeStart = "merge";
          if (startParts.length > 1) {
            var maybeMode = startParts[1].toLowerCase();
            if (maybeMode === "merge" || maybeMode === "replace") modeStart = maybeMode;
          }
          S.importBuffer.active = true;
          S.importBuffer.mode = modeStart;
          S.importBuffer.payload = "";
          results.push("Import buffer started (" + modeStart + "). Send chunks with /profile importallb64 chunk <data>, then /profile importallb64 finish");
          continue;
        }

        if (argLower.indexOf("chunk ") === 0 || argLower.indexOf("append ") === 0) {
          if (!S.importBuffer.active) {
            results.push("No active import buffer. Use /profile importallb64 begin first.");
            continue;
          }
          var chunkData = arg.replace(/^(?:chunk|append)\s+/i, "").trim();
          if (!chunkData) {
            results.push("Usage: /profile importallb64 chunk <base64-part>");
            continue;
          }
          S.importBuffer.payload += chunkData;
          results.push("Buffered chunk: +" + chunkData.length + " chars (total " + S.importBuffer.payload.length + ")");
          continue;
        }

        // One-shot mode for backwards compatibility.
        var mode = "merge";
        var payloadB64 = arg;
        var firstSpace = payloadB64.indexOf(" ");
        if (firstSpace !== -1) {
          var modeMaybe = payloadB64.substring(0, firstSpace).toLowerCase();
          if (modeMaybe === "merge" || modeMaybe === "replace") {
            mode = modeMaybe;
            payloadB64 = payloadB64.substring(firstSpace + 1).trim();
          }
        }
        if (!payloadB64) {
          results.push("Usage: /profile importallb64 [merge|replace] <base64>");
          continue;
        }

        importAllFromPayload(payloadB64, mode, results);
      }
      // --- EXPORT (plain, human-readable) ---
      else if (action === "export") {
        var name = normalizeName(rest.split(" ")[0]);
        if (!name || !S.profiles[name]) { results.push("Not found: " + (name || "?")); continue; }
        var prof = S.profiles[name];
        var out = "/profile import " + name + " [keywords] " + prof.keywords.join(",");
        for (var s = 0; s < SECTIONS.length; s++) {
          var sec = SECTIONS[s];
          if (prof.sections[sec]) out += " [" + sec + "] " + prof.sections[sec];
        }
        out += "\nTip: use /profile exportb64 for guaranteed round-trip safety.";
        results.push(out);
      }

      // --- EXPORTB64 (safe, re-importable) ---
      else if (action === "exportb64") {
        var name = normalizeName(rest.split(" ")[0]);
        if (!name || !S.profiles[name]) { results.push("Not found: " + (name || "?")); continue; }
        var prof = S.profiles[name];
        var outB64 = "/profile importb64 " + name + " [keywords] " + toBase64(prof.keywords.join(","));
        for (var s = 0; s < SECTIONS.length; s++) {
          var sec = SECTIONS[s];
          if (prof.sections[sec]) outB64 += " [" + sec + "] " + toBase64(prof.sections[sec]);
        }
        results.push(outB64);
      }

      // --- EXPORTALLB64 (compact bulk export) ---
      else if (action === "exportallb64") {
        var countProfiles = 0;
        for (var pn in S.profiles) {
          if (S.profiles.hasOwnProperty(pn)) countProfiles++;
        }
        var payloadAll = { v: 1, p: S.profiles };
        var outAll = "/profile importallb64 " + toBase64(JSON.stringify(payloadAll));
        results.push("Profiles exported: " + countProfiles + "\n" + outAll);
      }

      // --- EXPORTALLCHUNKS (chunked bulk export) ---
      else if (action === "exportallchunks") {
        var chunkMode = "merge";
        var chunkSize = 1200;
        var args = (rest || "").trim().split(/\s+/).filter(function (x) { return x; });

        if (args.length) {
          var maybeMode = args[0].toLowerCase();
          if (maybeMode === "merge" || maybeMode === "replace") {
            chunkMode = maybeMode;
            args.shift();
          }
        }
        if (args.length) {
          var maybeSize = parseInt(args[0], 10);
          if (!isNaN(maybeSize)) {
            chunkSize = Math.max(250, Math.min(5000, maybeSize));
          }
        }

        var countProfilesChunk = 0;
        for (var pnk in S.profiles) {
          if (S.profiles.hasOwnProperty(pnk)) countProfilesChunk++;
        }

        var payloadChunkAll = toBase64(JSON.stringify({ v: 1, p: S.profiles }));
        var chunkLines = [];
        chunkLines.push("Profiles exported: " + countProfilesChunk + " | payload chars=" + payloadChunkAll.length + " | chunkSize=" + chunkSize);
        chunkLines.push("/profile importallb64 begin " + chunkMode);
        for (var offset = 0; offset < payloadChunkAll.length; offset += chunkSize) {
          chunkLines.push("/profile importallb64 chunk " + payloadChunkAll.substring(offset, offset + chunkSize));
        }
        chunkLines.push("/profile importallb64 finish");
        results.push(chunkLines.join("\n"));
      }
      // --- CONFIG ---
      else if (action === "config") {
        if (!rest) {
          var overrideCount = 0;
          for (var sk in S.config.sectionKeywords) {
            if (S.config.sectionKeywords.hasOwnProperty(sk) && S.config.sectionKeywords[sk] && S.config.sectionKeywords[sk].length) {
              overrideCount++;
            }
          }
          results.push("Config: budget=" + S.config.budget + " | fallback=" + S.config.fallback + " | debug=" + (S.config.debug ? "on" : "off") + " | maxActive=" + S.config.maxActive + " | widgets=" + (S.config.widgets ? "on" : "off") + " | keywordOverrides=" + overrideCount);
          continue;
        }
        var cfgParts = rest.split(" ");
        var key = (cfgParts[0] || "").toLowerCase();
        var val = cfgParts.slice(1).join(" ");

        if (key === "budget") {
          var num = parseInt(val, 10);
          if (isNaN(num) || num < 100) { results.push("Budget must be >= 100"); continue; }
          S.config.budget = num;
          results.push("Budget: " + num);
        } else if (key === "fallback") {
          var fallback = (val || "").toLowerCase();
          if (SECTIONS.indexOf(fallback) === -1) { results.push("Bad section: " + val); continue; }
          S.config.fallback = fallback;
          results.push("Fallback: " + fallback);
        } else if (key === "debug") {
          var v = (val || "").toLowerCase();
          var debugOn = (v === "true" || v === "on" || v === "1");
          if (!debugOn) S._widgetClearPending = true;
          S.config.debug = debugOn;
          results.push("Debug: " + (S.config.debug ? "on" : "off"));
        } else if (key === "maxactive") {
          var ma = parseInt(val, 10);
          if (isNaN(ma) || ma < 0) {
            results.push("maxActive must be >= 0 (0 = no cap)");
            continue;
          }
          S.config.maxActive = ma;
          results.push("maxActive: " + ma + (ma === 0 ? " (no cap)" : ""));
        } else if (key === "keywords") {
          var sectionAndWords = (val || "").trim();
          if (!sectionAndWords) {
            results.push("Usage: /profile config keywords <section> <word1,word2,...> | clear");
            continue;
          }
          var spk = sectionAndWords.indexOf(" ");
          var secName = (spk === -1 ? sectionAndWords : sectionAndWords.substring(0, spk)).toLowerCase();
          var wordsRaw = (spk === -1 ? "" : sectionAndWords.substring(spk + 1).trim());
          if (SECTIONS.indexOf(secName) === -1) {
            results.push("Bad section: " + secName + ". Use /profile sections");
            continue;
          }
          if (!wordsRaw) {
            var current = S.config.sectionKeywords[secName] || [];
            results.push("Keyword override for " + secName + ": " + (current.length ? current.join(", ") : "(none)"));
            continue;
          }
          var cmd = wordsRaw.toLowerCase();
          if (cmd === "clear" || cmd === "reset" || cmd === "off") {
            delete S.config.sectionKeywords[secName];
            results.push("Cleared keyword override for " + secName);
            continue;
          }
          var parsed = parseKeywords(wordsRaw);
          if (!parsed.length) {
            results.push("No keywords provided.");
            continue;
          }
          S.config.sectionKeywords[secName] = parsed;
          results.push("Keyword override for " + secName + ": " + parsed.join(", "));
        } else if (key === "widgets") {
          if (!val) {
            results.push("Widgets: " + (S.config.widgets ? "on" : "off"));
            continue;
          }
          var wv = val.toLowerCase();
          if (wv === "on" || wv === "true" || wv === "1") {
            S.config.widgets = true;
            results.push("Widgets: on (requires BetterDungeon; keep off for mobile/shared users)");
          } else if (wv === "off" || wv === "false" || wv === "0") {
            S.config.widgets = false;
            S._widgetClearPending = true;
            results.push("Widgets: off");
          } else {
            results.push("Usage: /profile config widgets <on|off>");
          }
        } else {
          results.push("Config keys: budget, fallback, debug, maxActive, keywords, widgets");
        }
      }

      // --- UNKNOWN ---
      else {
        results.push("Unknown: " + action + ". Try /profile help");
      }
    }

    // Deliver command results and stop model call for this turn.
    if (hasCommand) {
      var msg = results.join("\n---\n");
      state.message = msg;
      state.dcp._pending = msg;
      globalThis.text = " ";
      globalThis.stop = false;
    }
    return;
  }

  // ================================================================
  //  CONTEXT — dynamic character injection
  //  Gracefully fits as much as possible under maxChars
  // ================================================================
  if (hook === "context") {
    var text = stripBDTags(globalThis.text || "");
    globalThis.text = text;

    state.dcpRuntime = { activeCount: 0, activeNames: [], top: [], used: 0 };
    var profiles = S.profiles;
    var pkeys = [];
    for (var k in profiles) {
      if (profiles.hasOwnProperty(k)) pkeys.push(k);
    }
    if (pkeys.length === 0) {
        return;
    }

    var hist = (typeof history !== "undefined") ? history : [];
    var lookback = Math.min(6, hist.length);
    var recentText = "";
    for (var h = hist.length - lookback; h < hist.length; h++) {
      if (hist[h] && hist[h].text) recentText += " " + hist[h].text;
    }
    recentText = stripBDTags(recentText).toLowerCase();
    var textLower = text.toLowerCase();

    var KEYWORDS = getSectionKeywords();

    var matched = [];
    for (var n = 0; n < pkeys.length; n++) {
      var charName = pkeys[n];
      var prof = profiles[charName];
      if (!prof || !prof.keywords) continue;
      var hit = 0;
      for (var kw = 0; kw < prof.keywords.length; kw++) {
        var keyword = prof.keywords[kw].toLowerCase();
        if (containsWord(recentText, keyword)) hit += 1;
        if (containsWord(textLower, keyword)) hit += 2;
      }
      if (hit > 0) matched.push({ name: charName, hit: hit });
    }

    matched.sort(function(a, b) {
      if (b.hit !== a.hit) return b.hit - a.hit;
      return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
    });

    var active = [];
    var maxActive = S.config.maxActive;
    for (var m = 0; m < matched.length; m++) {
      if (maxActive > 0 && active.length >= maxActive) break;
      active.push(matched[m].name);
    }

    state.dcpRuntime.activeCount = active.length;
    state.dcpRuntime.activeNames = active.slice(0, 5);
    if (active.length === 0) {
        return;
    }

    var scores = {};
    for (var cat in KEYWORDS) {
      if (!KEYWORDS.hasOwnProperty(cat)) continue;
      var score = 0;
      var words = KEYWORDS[cat];
      for (var w = 0; w < words.length; w++) {
        if (containsWord(recentText, words[w])) score++;
        if (containsWord(textLower, words[w])) score += 2;
      }
      scores[cat] = score;
    }

    var ranked = [];
    for (var c in scores) {
      if (scores.hasOwnProperty(c)) ranked.push({ cat: c, score: scores[c] });
    }
    ranked.sort(function(a, b) { return b.score - a.score; });

    state.dcpRuntime.top = ranked.slice(0, 3).map(function(x) { return x.cat + ":" + x.score; });
    state.dcpRuntime.used = 0;

    var budget = S.config.budget;
    var fallback = S.config.fallback;
    var chunks = [];

    for (var i = 0; i < active.length; i++) {
      var name = active[i];
      var pObj = profiles[name];
      if (!pObj || !pObj.sections) continue;

      var charParts = [];
      var used = 0;
      var header = "[ " + name + " ]";
      used += header.length + 2;

      for (var r = 0; r < ranked.length; r++) {
        if (used >= budget) break;
        var sec = ranked[r].cat;
        var content = pObj.sections[sec];
        if (!content || content.length === 0) continue;

        var label = sec + ": ";
        var remaining = budget - used;

        if (label.length + content.length <= remaining) {
          charParts.push(label + content);
          used += label.length + content.length + 1;
        } else {
          var maxContent = remaining - label.length;
          if (maxContent <= 20) continue;
          var truncated = content.substring(0, maxContent);
          var lastDot = truncated.lastIndexOf(".");
          if (lastDot > maxContent * 0.4) truncated = truncated.substring(0, lastDot + 1);
          charParts.push(label + truncated);
          used += label.length + truncated.length + 1;
        }
      }

      if (charParts.length === 0 && pObj.sections[fallback]) {
        var fb = pObj.sections[fallback];
        var maxFb = budget - header.length - fallback.length - 4;
        if (maxFb > 20) {
          var tr = fb.length > maxFb ? fb.substring(0, maxFb) : fb;
          charParts.push(fallback + ": " + tr);
        }
      }

      if (charParts.length > 0) {
        chunks.push(header + "\n" + charParts.join("\n"));
      }
    }

    if (chunks.length > 0) {
      var maxChars = (typeof info !== "undefined" && info.maxChars) ? info.maxChars : 8000;
      var openTag = "\n[Character Detail]\n";
      var closeTag = "\n[/Character Detail]\n";
      var room = maxChars - text.length - openTag.length - closeTag.length;

      if (room > 64) {
        var fitted = [];
        var usedChars = 0;
        for (var ci = 0; ci < chunks.length; ci++) {
          var sep = fitted.length ? "\n\n" : "";
          var candidate = sep + chunks[ci];
          if (usedChars + candidate.length <= room) {
            fitted.push(chunks[ci]);
            usedChars += candidate.length;
          } else {
            // Try partial fit for this chunk.
            var remain = room - usedChars - sep.length;
            if (remain > 64) {
              var partial = chunks[ci].substring(0, remain);
              var cut = partial.lastIndexOf("\n");
              if (cut > 32) partial = partial.substring(0, cut);
              fitted.push(partial + " ...");
              usedChars = room;
            }
            break;
          }
        }

        if (fitted.length > 0) {
          var block = openTag + fitted.join("\n\n") + closeTag;
          var lastNl = text.lastIndexOf("\n");
          if (lastNl > 0) {
            globalThis.text = text.substring(0, lastNl) + block + text.substring(lastNl);
          } else {
            globalThis.text = text + block;
          }

          state.dcpRuntime.used = block.length;

          if (S.config.debug) {
            var topCats = [];
            for (var t = 0; t < Math.min(3, ranked.length); t++) {
              topCats.push(ranked[t].cat + ":" + ranked[t].score);
            }
            state.dcpDebugContext = "Injected " + block.length + " chars for " + active.join(", ") + " | Top: " + topCats.join(", ");
          }
        }
      }
    }
    return;
  }

  // ================================================================
  //  OUTPUT — fallback delivery
  // ================================================================
  if (hook === "output") {
    if (state.dcp._pending) {
      globalThis.text = state.dcp._pending;
      state.dcp._pending = "";
    }

    var outText = (typeof globalThis.text === "string") ? globalThis.text : " ";
    outText = stripBDTags(outText);
    // Repair common model run-on like "floor.Hakari" -> "floor. Hakari"
    outText = outText.replace(/([.!?]["\)\]]?)([A-Z])/g, "$1 $2");

    if (S._widgetClearPending) {
      outText += destroyDebugWidgets();
      S._widgetClearPending = false;
      S._widgetActive = false;
    }

    if (S.config.widgets && S.config.debug) {
      outText += buildDebugWidgets();
      S._widgetActive = true;
    } else if (S._widgetActive) {
      outText += destroyDebugWidgets();
      S._widgetActive = false;
    }



    globalThis.text = outText;
    return;
  }
};





// ============================================================
// DCPTime v1.3.0 (composed with DCP; does not wrap DCP)
// ============================================================
globalThis.DCPTime = function DCPTime(hook) {
  "use strict";

  state.dcpTime = state.dcpTime || {
    enabled: true,
    showContext: true,
    showOutput: true,
    showStateMessage: false,
    minutesPerAction: 10,
    day: 1,
    hour: 8,
    minute: 0,
    phase: "Morning",
    lastInput: "",
    lastAdvanceAction: -1
  };

  var T = state.dcpTime;

  function trimStr(s) {
    return String(s || "").replace(/^\s+|\s+$/g, "");
  }

  function pad2(n) {
    n = parseInt(n, 10);
    if (isNaN(n)) n = 0;
    return (n < 10 ? "0" : "") + String(n);
  }

  function isCmd(raw, cmd) {
    var t = trimStr(raw).toLowerCase();
    var c = String(cmd || "").toLowerCase();
    if (t.indexOf(c) !== 0) return false;
    return (t.length === c.length || t.charAt(c.length) === " ");
  }

  function parseOnOff(v) {
    v = trimStr(v).toLowerCase();
    if (v === "on" || v === "true" || v === "1" || v === "yes") return true;
    if (v === "off" || v === "false" || v === "0" || v === "no") return false;
    return null;
  }

  function parseHHMM(raw) {
    var m = trimStr(raw).match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    var hh = parseInt(m[1], 10);
    var mm = parseInt(m[2], 10);
    if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return [hh, mm];
  }

  function parseDuration(raw) {
    var out = { d: 0, h: 0, m: 0, ok: false };
    var s = trimStr(raw).toLowerCase();
    if (!s) return out;
    var toks = s.split(/\s+/);
    for (var i = 0; i < toks.length; i++) {
      var x = null;
      if ((x = toks[i].match(/^(\d+)d$/))) { out.d += parseInt(x[1], 10); out.ok = true; continue; }
      if ((x = toks[i].match(/^(\d+)h$/))) { out.h += parseInt(x[1], 10); out.ok = true; continue; }
      if ((x = toks[i].match(/^(\d+)m$/))) { out.m += parseInt(x[1], 10); out.ok = true; continue; }
      if ((x = toks[i].match(/^(\d+)$/))) { out.m += parseInt(x[1], 10); out.ok = true; continue; }
    }
    return out;
  }

  function normalizeTime() {
    T.minutesPerAction = parseInt(T.minutesPerAction, 10);
    if (isNaN(T.minutesPerAction) || T.minutesPerAction < 1 || T.minutesPerAction > 60) T.minutesPerAction = 10;

    T.day = parseInt(T.day, 10);
    if (isNaN(T.day) || T.day < 1) T.day = 1;

    T.hour = parseInt(T.hour, 10);
    if (isNaN(T.hour) || T.hour < 0 || T.hour > 23) T.hour = 8;

    T.minute = parseInt(T.minute, 10);
    if (isNaN(T.minute) || T.minute < 0 || T.minute > 59) T.minute = 0;

    while (T.minute >= 60) { T.minute -= 60; T.hour += 1; }
    while (T.minute < 0) { T.minute += 60; T.hour -= 1; }
    while (T.hour >= 24) { T.hour -= 24; T.day += 1; }
    while (T.hour < 0) { T.hour += 24; T.day -= 1; }
    if (T.day < 1) T.day = 1;

    if (T.hour >= 6 && T.hour < 12) T.phase = "Morning";
    else if (T.hour >= 12 && T.hour < 17) T.phase = "Afternoon";
    else if (T.hour >= 17 && T.hour < 20) T.phase = "Evening";
    else T.phase = "Night";

    T.enabled = (T.enabled !== false);
    T.showContext = (T.showContext !== false);
    T.showOutput = (T.showOutput !== false);
    T.showStateMessage = !!T.showStateMessage;
    T.lastInput = String(T.lastInput || "");

    T.lastAdvanceAction = parseInt(T.lastAdvanceAction, 10);
    if (isNaN(T.lastAdvanceAction)) T.lastAdvanceAction = -1;
  }

  function applyMacros(lowerInput) {
    if (lowerInput.indexOf("go to sleep") !== -1) {
      T.hour = 8;
      T.minute = 0;
      T.day += 1;
      return;
    }
    if (lowerInput.indexOf("rest a bit") !== -1) {
      T.hour += 4;
      return;
    }
    if (lowerInput.indexOf("fly to the moon") !== -1) {
      T.hour += 16;
      T.minute += 30;
      return;
    }
  }

  normalizeTime();

  if (hook === "input") {
    var raw = trimStr(globalThis.text || "");
    T.lastInput = raw;

    if (!isCmd(raw, "/time")) return;

    var argStr = trimStr(raw.substring(5));
    var sp = argStr.indexOf(" ");
    var action = (sp === -1 ? argStr : argStr.substring(0, sp)).toLowerCase();
    var rest = trimStr(sp === -1 ? "" : argStr.substring(sp + 1));
    var msg = "";

    if (action === "" || action === "help") {
      msg = [
        "=== DCP Time Commands ===",
        "/time show",
        "/time set <HH:MM> [nextday]",
        "/time add <Nd Nh Nm>",
        "/time config",
        "/time config enabled <on|off>",
        "/time config context <on|off>",
        "/time config output <on|off>",
        "/time config message <on|off>",
        "/time config minutes <1-60>"
      ].join("\n");
    } else if (action === "show" || action === "status") {
      msg = "Time: " + pad2(T.hour) + ":" + pad2(T.minute) + " (" + T.phase + "), Day " + T.day +
        " | enabled=" + (T.enabled ? "on" : "off") +
        " | context=" + (T.showContext ? "on" : "off") +
        " | output=" + (T.showOutput ? "on" : "off") +
        " | message=" + (T.showStateMessage ? "on" : "off") +
        " | minutesPerAction=" + T.minutesPerAction;
    } else if (action === "set") {
      var p = rest ? rest.split(/\s+/) : [];
      if (!p.length) {
        msg = "Usage: /time set <HH:MM> [nextday]";
      } else {
        var tt = parseHHMM(p[0]);
        if (!tt) {
          msg = "Bad time. Use HH:MM (24h), example: 08:00";
        } else {
          T.hour = tt[0];
          T.minute = tt[1];
          if (p.length > 1 && String(p[1]).toLowerCase() === "nextday") T.day += 1;
          normalizeTime();
          msg = "Time set: Day " + T.day + ", " + pad2(T.hour) + ":" + pad2(T.minute) + " (" + T.phase + ")";
        }
      }
    } else if (action === "add") {
      var d = parseDuration(rest);
      if (!d.ok) {
        msg = "Usage: /time add <Nd Nh Nm> (example: /time add 1d 4h 30m)";
      } else {
        T.day += d.d;
        T.hour += d.h;
        T.minute += d.m;
        normalizeTime();
        msg = "Time advanced: Day " + T.day + ", " + pad2(T.hour) + ":" + pad2(T.minute) + " (" + T.phase + ")";
      }
    } else if (action === "config") {
      if (!rest) {
        msg = "Time config: enabled=" + (T.enabled ? "on" : "off") +
          " | context=" + (T.showContext ? "on" : "off") +
          " | output=" + (T.showOutput ? "on" : "off") +
          " | message=" + (T.showStateMessage ? "on" : "off") +
          " | minutes=" + T.minutesPerAction +
          " | day=" + T.day +
          " | time=" + pad2(T.hour) + ":" + pad2(T.minute);
      } else {
        var sp2 = rest.indexOf(" ");
        var key = (sp2 === -1 ? rest : rest.substring(0, sp2)).toLowerCase();
        var val = trimStr(sp2 === -1 ? "" : rest.substring(sp2 + 1));

        if (key === "enabled" || key === "context" || key === "output" || key === "message") {
          var b = parseOnOff(val);
          if (b === null) {
            msg = "Usage: /time config " + key + " <on|off>";
          } else {
            if (key === "enabled") T.enabled = b;
            else if (key === "context") T.showContext = b;
            else if (key === "output") T.showOutput = b;
            else T.showStateMessage = b;
            msg = "Time config " + key + ": " + (b ? "on" : "off");
          }
        } else if (key === "minutes") {
          var mins = parseInt(val, 10);
          if (isNaN(mins) || mins < 1 || mins > 60) msg = "Minutes must be 1-60";
          else {
            T.minutesPerAction = mins;
            msg = "Minutes per action: " + mins;
          }
        } else {
          msg = "Time config keys: enabled, context, output, message, minutes";
        }
      }
    } else {
      msg = "Unknown /time command: " + action + ". Try /time help";
    }

    state.message = msg;
    state.dcp = state.dcp || {};
    state.dcp._pending = msg;
    globalThis.text = " ";
    globalThis.stop = false;
    return;
  }

  if (hook === "context") {
    var actionCount = -1;
    if (typeof info !== "undefined" && info && typeof info.actionCount === "number") {
      actionCount = Math.abs(parseInt(info.actionCount, 10));
    }

    if (actionCount >= 0 && actionCount !== T.lastAdvanceAction) {
      T.lastAdvanceAction = actionCount;
      if (T.enabled) {
        var lower = trimStr(T.lastInput).toLowerCase();
        var commandTurn = isCmd(lower, "/profile") || isCmd(lower, "/time");
        if (!commandTurn) {
          applyMacros(lower);
          T.minute += T.minutesPerAction;
          normalizeTime();
        }
      }
    }

    if (T.enabled && T.showContext && globalThis.stop !== true) {
      var timeData = "Day: " + T.day + ", Time: " + pad2(T.hour) + ":" + pad2(T.minute) + ", Phase: " + T.phase;
      globalThis.text = String(globalThis.text || "") + "\n\n[Use this timing information: " + timeData + "]";
    }
    return;
  }

  if (hook === "output") {
    normalizeTime();

    var lowerOut = trimStr(T.lastInput).toLowerCase();
    var commandOut = isCmd(lowerOut, "/profile") || isCmd(lowerOut, "/time");

    if (!commandOut && T.enabled && T.showOutput) {
      globalThis.text = String(globalThis.text || "") + "\n\n[Time: " + pad2(T.hour) + ":" + pad2(T.minute) + " (" + T.phase + "), Day #: " + T.day + "]";
    }

    if (!commandOut && T.enabled && T.showStateMessage) {
      state.message = "Day " + T.day + ", " + pad2(T.hour) + ":" + pad2(T.minute);
    }
  }
};

// DCP build: 1.4.0 (no-stop command mode)

