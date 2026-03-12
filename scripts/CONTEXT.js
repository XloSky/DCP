// DCP v4.4 + DCPTime v1.4.8 Context Modifier
const modifier = (text) => {
  globalThis.text = text;
  globalThis.stop = false;

  DCP("context");
  if (globalThis.stop !== true) DCPTime("context");

  return { text: globalThis.text, stop: (globalThis.stop === true) };
};
modifier(text);
