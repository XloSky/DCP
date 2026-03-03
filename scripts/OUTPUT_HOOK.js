// ============================================================
// DCP v4.1 — OUTPUT TAB
// Fallback delivery: if stop:true didn't prevent AI generation,
// this replaces the AI output with the command result.
// ============================================================
const modifier = (text) => {
  if (state.dcp && state.dcp._pending && state.dcp._pending.length > 0) {
    text = state.dcp._pending;
    state.dcp._pending = "";
  }
  return { text };
};
modifier(text);
