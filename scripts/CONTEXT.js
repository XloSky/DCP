// DCP v1.6.3 - CONTEXT.js
const modifier = (text) => {
  globalThis.text = text;
  globalThis.stop = false;

  if (typeof DCPTime === "function") DCPTime("context");
  if (globalThis.stop !== true && typeof DCP === "function") DCP("context");

  return {
    text: globalThis.text || " ",
    stop: globalThis.stop === true
  };
};
modifier(text);


