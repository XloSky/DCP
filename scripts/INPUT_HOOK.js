// DCP v4 — Input tab (one-liner, all logic in Library)
const modifier = (text) => {
  globalThis.text = text;
  globalThis.stop = false;

  if (typeof DCP !== "function") return { text: text || " " };

  DCP("input");

  var r = { text: globalThis.text || " " };
  if (globalThis.stop) r.stop = true;
  return r;
};
modifier(text);
