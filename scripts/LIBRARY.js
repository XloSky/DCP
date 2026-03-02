// ============================================================
// DCP v3.0 — LIBRARY TAB
// Paste this into the Library tab.
// This ONLY initializes state. All logic lives in the hook tabs.
//
// SETUP:
//   Library tab  → this file (LIBRARY.js)
//   Input tab    → INPUT_HOOK.js
//   Output tab   → OUTPUT_HOOK.js
//   Context tab  → CONTEXT_HOOK.js
// ============================================================

if (!state.dcp) {
  state.dcp = {
    profiles: {},
    config: {
      budget: 800,
      fallback: "personality",
      debug: false
    }
  };
}
if (state.dcpCommandResult === undefined) {
  state.dcpCommandResult = "";
}
