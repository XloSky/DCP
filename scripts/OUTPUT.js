// DCP v4.1 + DCPTime v1.3.0 Output Modifier
const modifier = (text) => {
  globalThis.text = text;

  DCP("output");
  DCPTime("output");

  return { text: globalThis.text };
};
modifier(text);
