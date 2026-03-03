// ============================================================
// DCP v4.1 — CONTEXT TAB
// All scoring and injection logic inline.
// ============================================================
const modifier = (text) => {
  if (!state.dcp || !state.dcp.profiles) {
    return { text };
  }
  if (!text) {
    return { text };
  }

  var profiles = state.dcp.profiles;
  var config = state.dcp.config;
  var pkeys = [];
  for (var k in profiles) {
    if (profiles.hasOwnProperty(k)) pkeys.push(k);
  }

  if (pkeys.length === 0) {
    return { text };
  }

  // --- Category keywords for scene analysis ---
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

  // --- Word boundary helper ---
  var isWordChar = function(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch === '_';
  };

  var containsWord = function(haystack, word) {
    var idx = 0;
    while (idx <= haystack.length - word.length) {
      idx = haystack.indexOf(word, idx);
      if (idx === -1) return false;
      var before = (idx > 0) ? haystack.charAt(idx - 1) : ' ';
      var after = (idx + word.length < haystack.length) ? haystack.charAt(idx + word.length) : ' ';
      if (!isWordChar(before) && !isWordChar(after)) return true;
      idx = idx + 1;
    }
    return false;
  };

  // --- Gather recent history text ---
  var recentHistory = history.slice(-6);
  var historyText = "";
  for (var i = 0; i < recentHistory.length; i++) {
    if (recentHistory[i] && recentHistory[i].text) {
      historyText = historyText + " " + recentHistory[i].text;
    }
  }
  historyText = historyText.toLowerCase();
  var textLower = text.toLowerCase();

  // --- Find active characters ---
  var activeCharacters = [];
  for (var i = 0; i < pkeys.length; i++) {
    var charName = pkeys[i];
    var profile = profiles[charName];
    if (!profile || !profile.keywords) continue;
    for (var j = 0; j < profile.keywords.length; j++) {
      if (containsWord(historyText, profile.keywords[j].toLowerCase()) ||
          containsWord(textLower, profile.keywords[j].toLowerCase())) {
        activeCharacters.push(charName);
        break;
      }
    }
  }

  if (activeCharacters.length === 0) {
    return { text };
  }

  // --- Score categories ---
  var scores = {};
  for (var cat in KEYWORDS) {
    var score = 0;
    var kws = KEYWORDS[cat];
    for (var k = 0; k < kws.length; k++) {
      if (containsWord(historyText, kws[k])) score = score + 1;
      if (containsWord(textLower, kws[k])) score = score + 2;
    }
    scores[cat] = score;
  }

  // --- Rank categories ---
  var entries = [];
  for (var cat in scores) {
    entries.push([cat, scores[cat]]);
  }
  entries.sort(function(a, b) { return b[1] - a[1]; });
  var ranked = [];
  for (var i = 0; i < entries.length; i++) {
    ranked.push(entries[i][0]);
  }

  // --- Build injection per active character ---
  var budget = (config && config.budget) ? config.budget : 800;
  var fallback = (config && config.fallback) ? config.fallback : "personality";
  var injections = [];

  for (var i = 0; i < activeCharacters.length; i++) {
    var name = activeCharacters[i];
    var prof = profiles[name];
    if (!prof || !prof.sections) continue;

    var injectedText = "";
    var charsUsed = 0;

    for (var r = 0; r < ranked.length; r++) {
      if (charsUsed >= budget) break;
      var category = ranked[r];
      var sectionContent = prof.sections[category];
      if (!sectionContent || sectionContent.length === 0) continue;

      var label = "[" + name + " - " + category + "]: ";
      var remaining = budget - charsUsed;

      if (sectionContent.length + label.length <= remaining) {
        injectedText = injectedText + label + sectionContent + " ";
        charsUsed = charsUsed + label.length + sectionContent.length + 1;
      } else {
        var maxContent = remaining - label.length;
        if (maxContent <= 20) continue;
        var truncated = sectionContent.substring(0, maxContent);
        var lastPeriod = truncated.lastIndexOf(".");
        if (lastPeriod > maxContent * 0.4) {
          truncated = truncated.substring(0, lastPeriod + 1);
        }
        injectedText = injectedText + label + truncated + " ";
        charsUsed = charsUsed + label.length + truncated.length + 1;
      }
    }

    // Fallback
    if (injectedText.length === 0) {
      var fbContent = prof.sections[fallback];
      if (fbContent && fbContent.length > 0) {
        var lbl = "[" + name + " - " + fallback + "]: ";
        var mx = budget - lbl.length;
        if (mx > 20) {
          var tr = fbContent;
          if (tr.length > mx) {
            tr = tr.substring(0, mx);
            var lp = tr.lastIndexOf(".");
            if (lp > mx * 0.4) tr = tr.substring(0, lp + 1);
          }
          injectedText = lbl + tr + " ";
        }
      }
    }

    if (injectedText.length > 0) {
      injections.push(injectedText);
    }
  }

  // --- Insert injection block ---
  if (injections.length > 0) {
    var maxChars = (info && info.maxChars) ? info.maxChars : 8000;
    var block = "\n[Character Detail]\n" + injections.join("\n") + "\n[/Character Detail]\n";

    if (text.length + block.length < maxChars) {
      var lastNewline = text.lastIndexOf("\n");
      if (lastNewline > 0) {
        text = text.substring(0, lastNewline) + block + text.substring(lastNewline);
      } else {
        text = text + block;
      }

      if (config && config.debug) {
        state.dcpDebugContext = "Injected " + block.length + " chars for: " + activeCharacters.join(", ")
          + " | Top categories: " + ranked.slice(0, 3).join(", ");
      }
    }
  }

  return { text };
};
modifier(text);
