// ============================================================
// DCP MINIMAL TEST — paste into OUTPUT tab
// Used with TEST_INPUT.js in the Input tab
// ============================================================
const modifier = (text) => {
  if (state.dcpCommandResult && state.dcpCommandResult.length > 0) {
    text = state.dcpCommandResult;
    state.dcpCommandResult = "";
  }
  return { text };
};
modifier(text);
