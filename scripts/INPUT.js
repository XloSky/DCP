// DCP v4.4 + DCPTime v1.4.8 Input Modifier
const modifier = (text) => {
  globalThis.text = text;
  globalThis.stop = false;

  function normalizeSlashCommand(raw) {
    let t = String(raw || "").trim();

    // Already a direct slash command
    if (/^\/(?:profile|time)(?:\s|$)/i.test(t)) return t;

    // Do mode often formats as: You /time show.
    let m = t.match(/^You\s+(\/(?:profile|time)[\s\S]*)$/i);
    if (m && m[1]) {
      return m[1].trim().replace(/[\s]+$/, "").replace(/[.!?]+$/, "");
    }

    // Say mode often formats as: You say "/time show"
    m = t.match(/^You\s+says?\s+"(\/(?:profile|time)[\s\S]*?)"\s*$/i);
    if (m && m[1]) {
      return m[1].trim();
    }

    return t;
  }

  const normalized = normalizeSlashCommand(text);

  // Route recognized slash commands directly.
  if (/^\/time(?:\s|$)/i.test(normalized)) {
    globalThis.text = normalized;
    DCPTime("input");
    return { text: globalThis.text, stop: (globalThis.stop === true) };
  }

  if (/^\/profile(?:\s|$)/i.test(normalized)) {
    globalThis.text = normalized;
    DCP("input");
    return { text: globalThis.text, stop: (globalThis.stop === true) };
  }

  // Normal path
  DCPTime("input");
  if (globalThis.stop !== true) DCP("input");

  return { text: globalThis.text, stop: (globalThis.stop === true) };
};
modifier(text);
