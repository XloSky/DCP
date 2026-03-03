// ============================================================
// DCP v4.0 — LIBRARY (all logic lives here)
//
// Library-Centric Hook Pattern: this single function handles
// input commands, context injection, and output delivery.
// The Input/Context/Output tabs are one-liners that call DCP().
//
// SETUP:
//   Library tab  → this file
//   Input tab    → INPUT_HOOK.js
//   Output tab   → OUTPUT_HOOK.js
//   Context tab  → CONTEXT_HOOK.js
// ============================================================

globalThis.DCP = function DCP(hook) {
  "use strict";

  // === STATE INIT ===
  if (!state.dcp) {
    state.dcp = {
      profiles: {},
      config: { budget: 800, fallback: "personality", debug: false }
    };
  }
  var S = state.dcp;

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

  // Splits keyword string by commas if present, otherwise by spaces
  function parseKeywords(str) {
    var arr = [];
    var parts = (str.indexOf(",") !== -1) ? str.split(",") : str.split(" ");
    for (var i = 0; i < parts.length; i++) {
      var w = parts[i].trim().toLowerCase();
      if (w) arr.push(w);
    }
    return arr;
  }

  // ================================================================
  //  INPUT — command parsing
  //  Supports ;; as batch separator and /profile import for bulk entry
  //  Handles commands without using stop:true (avoids runtime stop errors)
  // ================================================================
  if (hook === "input") {
    var raw = (globalThis.text || "").trim();

    // Fast path: if no /profile anywhere, skip entirely
    if (raw.indexOf("/profile") === -1) return;

    // Split on ;; for batch commands
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
          "/profile export <name>\n" +
          "/profile config [budget|fallback|debug] [value]\n" +
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
        var name = rest.split(" ")[0];
        if (!name) { results.push("Usage: /profile add <name>"); continue; }
        if (S.profiles[name]) { results.push(name + " already exists."); continue; }
        S.profiles[name] = { keywords: [name.toLowerCase()], sections: {} };
        results.push("Created " + name + ".");
      }

      // --- REMOVE ---
      else if (action === "remove" || action === "delete") {
        var name = rest.split(" ")[0];
        if (!name || !S.profiles[name]) { results.push("Not found: " + (name || "?")); continue; }
        delete S.profiles[name];
        results.push("Removed " + name + ".");
      }

      // --- SHOW ---
      else if (action === "show") {
        var name = rest.split(" ")[0];
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
        var name = rest.substring(0, sp1);
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
        var name = rest.substring(0, sp1);
        var after = rest.substring(sp1 + 1).trim();
        var sp2 = after.indexOf(" ");
        if (sp2 === -1) { results.push("Usage: /profile append <name> <section> <text>"); continue; }
        var section = after.substring(0, sp2).toLowerCase();
        var val = after.substring(sp2 + 1).trim();
        if (!S.profiles[name]) { results.push("Not found: " + name); continue; }
        if (SECTIONS.indexOf(section) === -1) { results.push("Bad section: " + section); continue; }
        S.profiles[name].sections[section] = (S.profiles[name].sections[section] || "") + " " + val;
        results.push(name + "." + section + " appended (" + S.profiles[name].sections[section].length + " chars)");
      }

      // --- KEYWORDS ---
      else if (action === "keywords") {
        var sp1 = rest.indexOf(" ");
        if (sp1 === -1) {
          var name = rest;
          if (!name || !S.profiles[name]) { results.push("Not found: " + (name || "?")); continue; }
          results.push("Keywords for " + name + ": " + S.profiles[name].keywords.join(", "));
          continue;
        }
        var name = rest.substring(0, sp1);
        var kwStr = rest.substring(sp1 + 1).trim();
        if (!S.profiles[name]) { results.push("Not found: " + name); continue; }
        S.profiles[name].keywords = parseKeywords(kwStr);
        results.push("Keywords for " + name + ": " + S.profiles[name].keywords.join(", "));
      }

      // --- IMPORT (bulk set all sections in one command) ---
      else if (action === "import") {
        var sp1 = rest.indexOf(" ");
        if (sp1 === -1) {
          results.push("Usage: /profile import <name> [section] text [section] text...");
          continue;
        }
        var name = rest.substring(0, sp1);
        var body = rest.substring(sp1 + 1).trim();

        // Auto-create profile if it doesn't exist
        if (!S.profiles[name]) {
          S.profiles[name] = { keywords: [name.toLowerCase()], sections: {} };
        }

        // Parse [tag] markers: [keywords], [appearance], [personality], etc.
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
            // Save previous section
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
        // Save last section
        if (currentKey !== null && sectionStart >= 0 && sectionStart <= body.length) {
          var content = body.substring(sectionStart).trim();
          if (content) {
            if (currentKey === "keywords") {
              S.profiles[name].keywords = parseKeywords(content);
            } else {
              S.profiles[name].sections[currentKey] = content;
              count++;
            }
          }
        }

        results.push("Imported " + count + " sections for " + name + " (" + profileSize(S.profiles[name]) + " chars)");
      }

      // --- EXPORT (outputs re-importable command) ---
      else if (action === "export") {
        var name = rest.split(" ")[0];
        if (!name || !S.profiles[name]) { results.push("Not found: " + (name || "?")); continue; }
        var prof = S.profiles[name];
        var out = "/profile import " + name + " [keywords] " + prof.keywords.join(",");
        for (var s = 0; s < SECTIONS.length; s++) {
          var sec = SECTIONS[s];
          if (prof.sections[sec]) {
            out += " [" + sec + "] " + prof.sections[sec];
          }
        }
        results.push(out);
      }

      // --- CONFIG ---
      else if (action === "config") {
        if (!rest) {
          results.push("Config: budget=" + S.config.budget + " | fallback=" + S.config.fallback + " | debug=" + (S.config.debug ? "on" : "off"));
          continue;
        }
        var cfgParts = rest.split(" ");
        var key = cfgParts[0];
        var val = cfgParts.slice(1).join(" ");

        if (key === "budget") {
          var num = parseInt(val, 10);
          if (isNaN(num) || num < 100) { results.push("Budget must be >= 100"); continue; }
          S.config.budget = num;
          results.push("Budget: " + num);
        } else if (key === "fallback") {
          if (SECTIONS.indexOf(val) === -1) { results.push("Bad section: " + val); continue; }
          S.config.fallback = val;
          results.push("Fallback: " + val);
        } else if (key === "debug") {
          S.config.debug = (val === "true" || val === "on" || val === "1");
          results.push("Debug: " + (S.config.debug ? "on" : "off"));
        } else {
          results.push("Config keys: budget, fallback, debug");
        }
      }

      // --- UNKNOWN ---
      else {
        results.push("Unknown: " + action + ". Try /profile help");
      }
    }

    // Deliver results and stop the game loop (no AI generation)
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
  //  Scans recent history for active characters, scores categories,
  //  and injects the most relevant sections into AI context
  // ================================================================
  if (hook === "context") {
    var text = globalThis.text || "";
    var profiles = S.profiles;
    var pkeys = [];
    for (var k in profiles) {
      if (profiles.hasOwnProperty(k)) pkeys.push(k);
    }
    if (pkeys.length === 0) return;

    // Gather recent history
    var hist = (typeof history !== "undefined") ? history : [];
    var lookback = Math.min(6, hist.length);
    var recentText = "";
    for (var h = hist.length - lookback; h < hist.length; h++) {
      if (hist[h] && hist[h].text) recentText += " " + hist[h].text;
    }
    recentText = recentText.toLowerCase();
    var textLower = text.toLowerCase();

    // Category keywords for scene analysis
    var KEYWORDS = {
      appearance: ["look","looks","beautiful","pretty","handsome","eyes","hair","face","skin","body","tall","short","wearing","outfit","clothes","dress","armor","appearance","describe"],
      personality: ["feel","feels","feeling","emotion","mood","happy","sad","angry","nervous","excited","calm","shy","confident","afraid","love","hate","trust","kind","cruel","gentle","friendly","laugh","cry","smile","frown","blush"],
      history: ["remember","past","before","ago","childhood","origin","born","parents","family","backstory","history","memories","forgot","experience","trauma","once","years"],
      abilities: ["fight","attack","defend","dodge","sword","weapon","magic","spell","power","ability","skill","punch","kick","slash","shoot","strength","speed","combat","battle","web","swing","climb","venom","poison","shield","heal"],
      quirks: ["habit","always","never","obsess","phobia","fear","weird","strange","unusual","favorite","tendency","hobby","interest"],
      relationships: ["friend","enemy","rival","ally","partner","lover","brother","sister","mother","father","master","mentor","together","relationship","bond","loyal","devoted"],
      speech: ["say","says","said","tell","told","ask","reply","shout","whisper","murmur","voice","tone","accent","speak","spoke","yell","scream"],
      mannerisms: ["walk","move","sit","stand","lean","gesture","nod","shake","wave","bow","fidget","pace","approach","enter","leave","turn","step"],
      species: ["species","monster","creature","beast","tail","wings","claws","fangs","scales","fur","horns","legs","limbs","human","inhuman","lamia","arachne","centaur","harpy","vampire","dragon","demon","anatomy","nature","instinct","spider","silk","web","thread","threads","spinnerets"]
    };

    // Find active characters (mentioned in recent context)
    var active = [];
    for (var n = 0; n < pkeys.length; n++) {
      var charName = pkeys[n];
      var prof = profiles[charName];
      if (!prof || !prof.keywords) continue;
      var found = false;
      for (var kw = 0; kw < prof.keywords.length; kw++) {
        var keyword = prof.keywords[kw].toLowerCase();
        if (containsWord(recentText, keyword) || containsWord(textLower, keyword)) {
          found = true;
          break;
        }
      }
      if (found) active.push(charName);
    }
    if (active.length === 0) return;

    // Score categories by keyword frequency
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

    // Rank categories descending
    var ranked = [];
    for (var cat in scores) {
      if (scores.hasOwnProperty(cat)) ranked.push({ cat: cat, score: scores[cat] });
    }
    ranked.sort(function(a, b) { return b.score - a.score; });

    // Build injection per active character
    var budget = S.config.budget;
    var fallback = S.config.fallback;
    var injections = [];

    for (var i = 0; i < active.length; i++) {
      var charName = active[i];
      var prof = profiles[charName];
      if (!prof || !prof.sections) continue;

      var charParts = [];
      var used = 0;
      var header = "[ " + charName + " ]";
      used += header.length + 2;

      for (var r = 0; r < ranked.length; r++) {
        if (used >= budget) break;
        var sec = ranked[r].cat;
        var content = prof.sections[sec];
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

      // Fallback: always inject at least one section
      if (charParts.length === 0 && prof.sections[fallback]) {
        var fb = prof.sections[fallback];
        var maxFb = budget - header.length - fallback.length - 4;
        if (maxFb > 20) {
          var tr = fb.length > maxFb ? fb.substring(0, maxFb) : fb;
          charParts.push(fallback + ": " + tr);
        }
      }

      if (charParts.length > 0) {
        injections.push(header + "\n" + charParts.join("\n"));
      }
    }

    // Insert injection block into context
    if (injections.length > 0) {
      var block = "\n[Character Detail]\n" + injections.join("\n\n") + "\n[/Character Detail]\n";
      var maxChars = (typeof info !== "undefined" && info.maxChars) ? info.maxChars : 8000;

      if (text.length + block.length < maxChars) {
        var lastNl = text.lastIndexOf("\n");
        if (lastNl > 0) {
          globalThis.text = text.substring(0, lastNl) + block + text.substring(lastNl);
        } else {
          globalThis.text = text + block;
        }

        if (S.config.debug) {
          var topCats = [];
          for (var t = 0; t < Math.min(3, ranked.length); t++) {
            topCats.push(ranked[t].cat + ":" + ranked[t].score);
          }
          state.dcpDebugContext = "Injected " + block.length + " chars for " + active.join(", ") + " | Top: " + topCats.join(", ");
        }
      }
    }
    return;
  }

  // ================================================================
  //  OUTPUT — fallback delivery
  //  If stop:true didn't prevent AI generation, deliver results here
  // ================================================================
  if (hook === "output") {
    if (state.dcp._pending) {
      globalThis.text = state.dcp._pending;
      state.dcp._pending = "";
    }
    return;
  }
};
