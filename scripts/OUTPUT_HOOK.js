// DCP v4 — Output tab (one-liner, all logic in Library)
const modifier = (text) => {
  globalThis.text = text;
  if (typeof DCP !== "function") return { text };

  var out = DCP("output", text);
  if (!out || typeof out.text !== "string") out = { text };
  return out;
};
modifier(text);
