// ============================================================
// DCP v3.0 — OUTPUT TAB
// Delivers command results via BOTH state.message and text replacement.
// At least one of these should work in your scenario.
// ============================================================
const modifier = (text) => {
  if (state.dcpCommandResult && state.dcpCommandResult.length > 0) {
    // Method 1: Toast notification (how TAS delivers messages)
    state.message = state.dcpCommandResult;
    // Method 2: Replace AI output text (confirmed working in your tests)
    text = state.dcpCommandResult;
    // Clear so it doesn't repeat next turn
    state.dcpCommandResult = "";
  }
  return { text };
};
modifier(text);
