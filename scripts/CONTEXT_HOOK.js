// DCP v4 — Output tab (one-liner, all logic in Library)
const modifier = (text) => {
  globalThis.text = text;
  if (typeof DCP !== "function") return { text: text || " " };

  DCP("output");
  return { text: globalThis.text || " " };
};
modifier(text);
