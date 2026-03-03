// DCP v4 — Context tab (one-liner, all logic in Library)
const modifier = (text) => {
  globalThis.text = text;
  if (typeof DCP !== "function") return { text: text || " " };

  DCP("context");
  var out = globalThis.text || text || " ";
  out = out.replace(/\[\[BD:[\s\S]*?:BD\]\]/g, "");
  return { text: out || " " };
};
modifier(text);
