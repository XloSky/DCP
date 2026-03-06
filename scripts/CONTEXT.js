// DCP v4.1 + DCPTime v1.3.0 Context Modifier
const modifier = (text) => {
  globalThis.text = text;
  globalThis.stop = false;

  DCP("context");
  if (globalThis.stop !== true) DCPTime("context");

  return { text: globalThis.text, stop: (globalThis.stop === true) };
};
modifier(text);
