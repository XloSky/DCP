// DCP v4.1 + DCPTime v1.4.1 Input Modifier
const modifier = (text) => {
  globalThis.text = text;
  globalThis.stop = false;

  const raw = String(text || "").trim();

  // Important: /time commands must bypass DCP input parsing,
  // otherwise DCP clears pending command output as "non-/profile" input.
  if (/^\/time(?:\s|$)/i.test(raw)) {
    DCPTime("input");
    return { text: globalThis.text, stop: (globalThis.stop === true) };
  }

  DCPTime("input");
  if (globalThis.stop !== true) DCP("input");

  return { text: globalThis.text, stop: (globalThis.stop === true) };
};
modifier(text);
