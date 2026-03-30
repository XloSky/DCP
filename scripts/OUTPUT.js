// DCP v1.6.3 - OUTPUT.js
const modifier = (text) => {
  globalThis.text = text;

  if (typeof DCP === "function") DCP("output");
  if (typeof DCPTime === "function") DCPTime("output");

  return { text: globalThis.text || " " };
};
modifier(text);


