// ============================================================
// DCP v3.0 — INPUT TAB
// All command parsing is inline. No Library function calls.
// ============================================================
const modifier = (text) => {
  // Defensive init (Library should handle this, but just in case)
  if (!state.dcp) {
    state.dcp = {
      profiles: {},
      config: { budget: 800, fallback: "personality", debug: false }
    };
  }
  if (state.dcpCommandResult === undefined) {
    state.dcpCommandResult = "";
  }

  var SECTIONS = [
    "appearance", "personality", "history", "abilities",
    "quirks", "relationships", "speech", "mannerisms", "species", "other"
  ];

  var trimmed = text.trim();

  // --- Check if this is a /profile command ---
  // Must start with /profile, followed by space or end-of-string
  if (trimmed.indexOf("/profile") !== 0) {
    return { text };
  }
  if (trimmed.length > 8 && trimmed.charAt(8) !== ' ') {
    return { text };
  }

  var args = trimmed.substring(8).trim();
  var profiles = state.dcp.profiles;
  var response = "";

  // --- Parse commands ---

  if (args === "" || args === "help") {
    response = "DCP Commands:\n"
      + "  /profile add <name>\n"
      + "  /profile remove <name>\n"
      + "  /profile set <name> <section> <text>\n"
      + "  /profile append <name> <section> <text>\n"
      + "  /profile show <name>\n"
      + "  /profile list\n"
      + "  /profile sections\n"
      + "  /profile keywords <name> <word1,word2>\n"
      + "  /profile config [budget|fallback|debug] [value]";
  }

  else if (args === "sections") {
    response = "Available sections: " + SECTIONS.join(", ");
  }

  else if (args === "list") {
    var names = Object.keys(profiles);
    if (names.length === 0) {
      response = "No profiles stored yet.";
    } else {
      response = "Stored profiles: " + names.join(", ");
    }
  }

  else if (args.indexOf("add ") === 0) {
    var name = args.substring(4).trim();
    if (name.length === 0) {
      response = "Usage: /profile add <name>";
    } else if (profiles[name]) {
      response = "Profile '" + name + "' already exists.";
    } else {
      profiles[name] = { keywords: [name.toLowerCase()], sections: {} };
      for (var i = 0; i < SECTIONS.length; i++) {
        profiles[name].sections[SECTIONS[i]] = "";
      }
      response = "Created profile for " + name + ".";
    }
  }

  else if (args.indexOf("remove ") === 0) {
    var name = args.substring(7).trim();
    if (name.length === 0) {
      response = "Usage: /profile remove <name>";
    } else if (!profiles[name]) {
      response = "No profile found for '" + name + "'.";
    } else {
      delete profiles[name];
      response = "Removed profile for " + name + ".";
    }
  }

  else if (args.indexOf("show ") === 0) {
    var name = args.substring(5).trim();
    if (name.length === 0) {
      response = "Usage: /profile show <name>";
    } else if (!profiles[name]) {
      response = "No profile found for '" + name + "'.";
    } else {
      var p = profiles[name];
      response = "=== " + name + " ===\nKeywords: " + p.keywords.join(", ");
      var total = 0;
      for (var i = 0; i < SECTIONS.length; i++) {
        var s = SECTIONS[i];
        var c = p.sections[s];
        if (c && c.length > 0) {
          response = response + "\n  [" + s + "] " + c.length + " chars";
          total = total + c.length;
        }
      }
      response = response + "\nTotal: " + total + " chars";
    }
  }

  else if (args.indexOf("keywords ") === 0) {
    var rest = args.substring(9).trim();
    var sp = rest.indexOf(" ");
    if (sp === -1) {
      response = "Usage: /profile keywords <name> <word1,word2,...>";
    } else {
      var name = rest.substring(0, sp).trim();
      var kwStr = rest.substring(sp + 1).trim();
      if (!profiles[name]) {
        response = "No profile for '" + name + "'.";
      } else {
        var kwArr = kwStr.split(",");
        for (var i = 0; i < kwArr.length; i++) {
          kwArr[i] = kwArr[i].trim().toLowerCase();
        }
        profiles[name].keywords = kwArr;
        response = "Keywords for " + name + ": " + profiles[name].keywords.join(", ");
      }
    }
  }

  else if (args.indexOf("set ") === 0) {
    var rest = args.substring(4).trim();
    var parts = rest.split(" ");
    if (parts.length < 3) {
      response = "Usage: /profile set <name> <section> <text>";
    } else {
      var name = parts[0];
      var section = parts[1].toLowerCase();
      var content = parts.slice(2).join(" ");
      if (!profiles[name]) {
        response = "No profile for '" + name + "'. Use /profile add " + name + " first.";
      } else {
        var valid = false;
        for (var i = 0; i < SECTIONS.length; i++) {
          if (SECTIONS[i] === section) { valid = true; break; }
        }
        if (!valid) {
          response = "Invalid section '" + section + "'. Available: " + SECTIONS.join(", ");
        } else {
          profiles[name].sections[section] = content;
          response = "Set " + name + "." + section + " (" + content.length + " chars).";
        }
      }
    }
  }

  else if (args.indexOf("append ") === 0) {
    var rest = args.substring(7).trim();
    var parts = rest.split(" ");
    if (parts.length < 3) {
      response = "Usage: /profile append <name> <section> <text>";
    } else {
      var name = parts[0];
      var section = parts[1].toLowerCase();
      var content = parts.slice(2).join(" ");
      if (!profiles[name]) {
        response = "No profile for '" + name + "'.";
      } else {
        var valid = false;
        for (var i = 0; i < SECTIONS.length; i++) {
          if (SECTIONS[i] === section) { valid = true; break; }
        }
        if (!valid) {
          response = "Invalid section '" + section + "'. Available: " + SECTIONS.join(", ");
        } else {
          if (profiles[name].sections[section] && profiles[name].sections[section].length > 0) {
            profiles[name].sections[section] = profiles[name].sections[section] + " " + content;
          } else {
            profiles[name].sections[section] = content;
          }
          response = "Appended to " + name + "." + section + " (now " + profiles[name].sections[section].length + " chars).";
        }
      }
    }
  }

  else if (args.indexOf("config") === 0) {
    var rest = args.substring(6).trim();
    var cfg = state.dcp.config;
    if (rest.length === 0) {
      response = "Config — budget: " + cfg.budget + ", fallback: " + cfg.fallback + ", debug: " + cfg.debug;
    } else if (rest.indexOf("budget ") === 0) {
      var val = parseInt(rest.substring(7).trim());
      if (isNaN(val) || val < 100) {
        response = "Budget must be a number >= 100.";
      } else {
        cfg.budget = val;
        response = "Budget set to " + val + ".";
      }
    } else if (rest.indexOf("fallback ") === 0) {
      var fb = rest.substring(9).trim().toLowerCase();
      var valid = false;
      for (var i = 0; i < SECTIONS.length; i++) {
        if (SECTIONS[i] === fb) { valid = true; break; }
      }
      if (!valid) {
        response = "Invalid fallback. Available: " + SECTIONS.join(", ");
      } else {
        cfg.fallback = fb;
        response = "Fallback set to " + cfg.fallback + ".";
      }
    } else if (rest.indexOf("debug ") === 0) {
      cfg.debug = (rest.substring(6).trim() === "true");
      response = "Debug: " + cfg.debug;
    } else {
      response = "Config options: budget, fallback, debug";
    }
  }

  else {
    response = "Unknown command: /profile " + args + "\nType /profile help for commands.";
  }

  // --- Store result for Output hook to deliver ---
  state.dcpCommandResult = response;

  // --- Debug: also store raw debug info ---
  if (state.dcp.config.debug) {
    state.dcpDebug = "INPUT: trimmed=[" + trimmed + "] args=[" + args + "] response_len=" + response.length;
  }

  // Blank the player input so AI doesn't narrate the command
  text = " ";
  return { text };
};
modifier(text);
