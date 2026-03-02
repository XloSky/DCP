// ============================================================
// DCP MINIMAL TEST — paste into INPUT tab
// Leave Library and Context tabs EMPTY
// Paste TEST_OUTPUT.js into the Output tab
// Then type:  /profile list
// ============================================================
const modifier = (text) => {
  if (!state.dcp) {
    state.dcp = { profiles: {}, turnCount: 0 };
  }
  state.dcp.turnCount = (state.dcp.turnCount || 0) + 1;

  var trimmed = text.trim();

  // Only match /profile at start, not /profiles or /profiling
  if (trimmed.indexOf("/profile") === 0 && (trimmed.length === 8 || trimmed.charAt(8) === ' ')) {
    var msg = "DCP WORKS — Turn #" + state.dcp.turnCount + " — Input: [" + trimmed + "]";
    state.dcpCommandResult = msg;
    state.message = msg;
    text = " ";
  }

  return { text };
};
modifier(text);
