const modifier = (text) => {
  globalThis.text = text;
  globalThis.stop = false;

  if (typeof DCPInputRouter === "function") {
    return DCPInputRouter(text);
  }

  if (typeof DCPTime === "function") DCPTime("input");
  if (globalThis.stop !== true && typeof DCP === "function") DCP("input");

  return {
    text: globalThis.text || " ",
    stop: globalThis.stop === true
  };
};
modifier(text);
