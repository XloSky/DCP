// DCP v4 — Context tab (one-liner, all logic in Library)
const modifier = (text) => {
  globalThis.text = text;
  if (typeof DCP !== "function") return { text: text || " " };

  DCP("context");
  return { text: globalThis.text || text || " " };
};
modifier(text);
