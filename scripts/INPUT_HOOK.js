// ============================================================
// DCP v4.1 — INPUT TAB
// All command parsing inline. Supports ;; batch, /profile import,
// /profile export. Uses stop:true to skip AI generation on commands.
// ============================================================
const modifier = (text) => {
  if (!state.dcp) {
    state.dcp = {
      profiles: {},
      config: { budget: 800, fallback: "personality", debug: false }
    };
  }

  // Clear any leftover pending result from previous command turn
  if (state.dcp._pending) {
    state.dcp._pending = "";
  }

  var SECTIONS = [
    "appearance", "personality", "history", "abilities", "quirks",
    "relationships", "speech", "mannerisms", "species", "other"
  ];

  var raw = text.trim();

  // Fast exit: if no /profile anywhere, pass through
  if (raw.indexOf("/profile") === -1) {
    return { text };
  }

  // --- Helpers ---
  var profileSize = function(prof) {
    var total = 0;
    for (var k in prof.sections) {
      if (prof.sections.hasOwnProperty(k)) total += prof.sections[k].length;
    }
    return total;
  };

  var parseKeywords = function(str) {
    var arr = [];
    var parts = (str.indexOf(",") !== -1) ? str.split(",") : str.split(" ");
    for (var i = 0; i < parts.length; i++) {
      var w = parts[i].trim().toLowerCase();
      if (w) arr.push(w);
    }
    return arr;
  };

  // --- Batch command support: split on ;; ---
  var cmdParts = raw.split(";;");
  var results = [];
  var hasCommand = false;
  var profiles = state.dcp.profiles;

  for (var p = 0; p < cmdParts.length; p++) {
    var trimmed = cmdParts[p].trim();
    if (trimmed.indexOf("/profile") !== 0) continue;
    if (trimmed.length > 8 && trimmed.charAt(8) !== " ") continue;

    hasCommand = true;
    var argStr = trimmed.length > 9 ? trimmed.substring(9).trim() : "";
    var spIdx = argStr.indexOf(" ");
    var action = (spIdx === -1 ? argStr : argStr.substring(0, spIdx)).toLowerCase();
    var rest = spIdx === -1 ? "" : argStr.substring(spIdx + 1).trim();

    // === HELP ===
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

    // === SECTIONS ===
    else if (action === "sections") {
      results.push("Sections: " + SECTIONS.join(", "));
    }

    // === LIST ===
    else if (action === "list") {
      var names = [];
      for (var k in profiles) {
        if (profiles.hasOwnProperty(k)) {
          names.push(k + " (" + profileSize(profiles[k]) + ")");
        }
      }
      results.push(names.length === 0
        ? "No profiles stored."
        : "Profiles: " + names.join(", "));
    }

    // === ADD ===
    else if (action === "add") {
      var name = rest.split(" ")[0];
      if (!name) { results.push("Usage: /profile add <name>"); continue; }
      if (profiles[name]) { results.push(name + " already exists."); continue; }
      profiles[name] = { keywords: [name.toLowerCase()], sections: {} };
      results.push("Created " + name + ".");
    }

    // === REMOVE ===
    else if (action === "remove" || action === "delete") {
      var name = rest.split(" ")[0];
      if (!name || !profiles[name]) { results.push("Not found: " + (name || "?")); continue; }
      delete profiles[name];
      results.push("Removed " + name + ".");
    }

    // === SHOW ===
    else if (action === "show") {
      var name = rest.split(" ")[0];
      if (!name || !profiles[name]) { results.push("Not found: " + (name || "?")); continue; }
      var prof = profiles[name];
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

    // === SET ===
    else if (action === "set") {
      var sp1 = rest.indexOf(" ");
      if (sp1 === -1) { results.push("Usage: /profile set <name> <section> <text>"); continue; }
      var name = rest.substring(0, sp1);
      var after = rest.substring(sp1 + 1).trim();
      var sp2 = after.indexOf(" ");
      if (sp2 === -1) { results.push("Usage: /profile set <name> <section> <text>"); continue; }
      var section = after.substring(0, sp2).toLowerCase();
      var val = after.substring(sp2 + 1).trim();
      if (!profiles[name]) { results.push("Not found: " + name + ". Use /profile add first."); continue; }
      if (SECTIONS.indexOf(section) === -1) { results.push("Bad section: " + section + ". Use /profile sections"); continue; }
      profiles[name].sections[section] = val;
      results.push(name + "." + section + " set (" + val.length + " chars)");
    }

    // === APPEND ===
    else if (action === "append") {
      var sp1 = rest.indexOf(" ");
      if (sp1 === -1) { results.push("Usage: /profile append <name> <section> <text>"); continue; }
      var name = rest.substring(0, sp1);
      var after = rest.substring(sp1 + 1).trim();
      var sp2 = after.indexOf(" ");
      if (sp2 === -1) { results.push("Usage: /profile append <name> <section> <text>"); continue; }
      var section = after.substring(0, sp2).toLowerCase();
      var val = after.substring(sp2 + 1).trim();
      if (!profiles[name]) { results.push("Not found: " + name); continue; }
      if (SECTIONS.indexOf(section) === -1) { results.push("Bad section: " + section); continue; }
      profiles[name].sections[section] = (profiles[name].sections[section] || "") + " " + val;
      results.push(name + "." + section + " appended (" + profiles[name].sections[section].length + " chars)");
    }

    // === KEYWORDS ===
    else if (action === "keywords") {
      var sp1 = rest.indexOf(" ");
      if (sp1 === -1) {
        var name = rest;
        if (!name || !profiles[name]) { results.push("Not found: " + (name || "?")); continue; }
        results.push("Keywords for " + name + ": " + profiles[name].keywords.join(", "));
        continue;
      }
      var name = rest.substring(0, sp1);
      var kwStr = rest.substring(sp1 + 1).trim();
      if (!profiles[name]) { results.push("Not found: " + name); continue; }
      profiles[name].keywords = parseKeywords(kwStr);
      results.push("Keywords for " + name + ": " + profiles[name].keywords.join(", "));
    }

    // === IMPORT (bulk set all sections in one command) ===
    else if (action === "import") {
      var sp1 = rest.indexOf(" ");
      if (sp1 === -1) {
        results.push("Usage: /profile import <name> [section] text [section] text...");
        continue;
      }
      var name = rest.substring(0, sp1);
      var body = rest.substring(sp1 + 1).trim();

      // Auto-create profile if needed
      if (!profiles[name]) {
        profiles[name] = { keywords: [name.toLowerCase()], sections: {} };
      }

      // Parse [tag] markers
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
                profiles[name].keywords = parseKeywords(content);
              } else {
                profiles[name].sections[currentKey] = content;
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
            profiles[name].keywords = parseKeywords(content);
          } else {
            profiles[name].sections[currentKey] = content;
            count++;
          }
        }
      }

      results.push("Imported " + count + " sections for " + name + " (" + profileSize(profiles[name]) + " chars)");
    }

    // === EXPORT (re-importable command) ===
    else if (action === "export") {
      var name = rest.split(" ")[0];
      if (!name || !profiles[name]) { results.push("Not found: " + (name || "?")); continue; }
      var prof = profiles[name];
      var out = "/profile import " + name + " [keywords] " + prof.keywords.join(",");
      for (var s = 0; s < SECTIONS.length; s++) {
        var sec = SECTIONS[s];
        if (prof.sections[sec]) {
          out += " [" + sec + "] " + prof.sections[sec];
        }
      }
      results.push(out);
    }

    // === CONFIG ===
    else if (action === "config") {
      var cfg = state.dcp.config;
      if (!rest) {
        results.push("Config: budget=" + cfg.budget + " | fallback=" + cfg.fallback + " | debug=" + (cfg.debug ? "on" : "off"));
        continue;
      }
      var cfgParts = rest.split(" ");
      var key = cfgParts[0];
      var val = cfgParts.slice(1).join(" ");

      if (key === "budget") {
        var num = parseInt(val, 10);
        if (isNaN(num) || num < 100) { results.push("Budget must be >= 100"); continue; }
        cfg.budget = num;
        results.push("Budget: " + num);
      } else if (key === "fallback") {
        if (SECTIONS.indexOf(val) === -1) { results.push("Bad section: " + val); continue; }
        cfg.fallback = val;
        results.push("Fallback: " + val);
      } else if (key === "debug") {
        cfg.debug = (val === "true" || val === "on" || val === "1");
        results.push("Debug: " + (cfg.debug ? "on" : "off"));
      } else {
        results.push("Config keys: budget, fallback, debug");
      }
    }

    // === UNKNOWN ===
    else {
      results.push("Unknown: " + action + ". Try /profile help");
    }
  }

  // --- Deliver results ---
  if (hasCommand) {
    var msg = results.join("\n---\n");
    state.message = msg;
    state.dcp._pending = msg;
    // Official docs: return null text + stop to skip AI generation
    return { text: null, stop: true };
  }

  return { text };
};
modifier(text);
