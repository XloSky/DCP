// DCP v4 — Input tab (one-liner, all logic in Library)
const modifier = (text) => {
  globalThis.text = text;
  globalThis.stop = false;

  if (typeof DCP !== "function") return { text };

  var out = DCP("input", text);
  if (!out || typeof out.text !== "string") out = { text };
  if (out.stop) globalThis.stop = true;
  return out;
};
modifier(text);
