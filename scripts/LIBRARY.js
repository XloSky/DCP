// ============================================================
// DCP v4.1 — LIBRARY TAB
// State initialization only. All logic is inline per hook tab.
// ============================================================
if (!state.dcp) {
  state.dcp = {
    profiles: {},
    config: { budget: 800, fallback: "personality", debug: false }
  };
}
