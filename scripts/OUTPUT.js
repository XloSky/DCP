// DCP v4.4 + DCPTime v1.4.8 Output Modifier
const modifier = (text) => {
  globalThis.text = text;

  DCP("output");
  DCPTime("output");

  return { text: globalThis.text };
};
modifier(text);
