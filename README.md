# Dynamic Character Profiles (DCP)

DCP is an AI Dungeon scripting system that stores large character profiles in persistent script state and injects only the most relevant slices into model context each turn.

It is built with the Library-Centric Hook Pattern: all logic is in the Library script, and Input/Context/Output tabs are thin wrappers.

## What DCP Solves

AI Dungeon Story Cards have practical size limits. DCP lets you keep deeper character data in script state and inject it dynamically based on scene context.

## Current Feature Set

- Persistent profile storage in `state.dcp.profiles`
- 10 sections per profile:
- `appearance`, `personality`, `history`, `abilities`, `quirks`, `relationships`, `speech`, `mannerisms`, `species`, `other`
- Keyword-based character activation with word-boundary checks
- Weighted activation scoring (current input weighted higher than recent history)
- Optional active-profile cap via `maxActive`
- Category relevance scoring for section selection
- Per-character injection budget with truncation/partial-fit logic
- Fallback section injection when nothing scores (`fallback` config)
- Batch commands with `;;`
- Safe base64 import/export (single profile and all profiles)
- Optional BetterDungeon debug widgets (off by default)
- Auto cleanup of widget IDs when debug/widgets are turned off
- Output run-on repair for common punctuation-spacing issues (example: `floor.Hakari` -> `floor. Hakari`)

## Setup

1. Library tab: paste `DCP_v4_1_LIBRARY.js`
2. Input tab: call `DCP("input")`
3. Context tab: call `DCP("context")`
4. Output tab: call `DCP("output")`

### Hooks

```js
// DCP v4 — Input tab (one-liner, all logic in Library)
const modifier = (text) => {
  globalThis.text = text;
  globalThis.stop = false;

  if (typeof DCP !== "function") return { text: text || " " };

  DCP("input");

  return { text: globalThis.text || " " };
};
modifier(text);
```

```js
// DCP v4 — Context tab (one-liner, all logic in Library)
const modifier = (text) => {
  globalThis.text = text;
  if (typeof DCP !== "function") return { text: text || " " };

  DCP("context");
  var out = globalThis.text || text || " ";
  return { text: out || " " };
};
modifier(text);
```

```js
// DCP v4 — Output tab (one-liner, all logic in Library)
const modifier = (text) => {
  globalThis.text = text;
  if (typeof DCP !== "function") return { text: text || " " };

  DCP("output");
  return { text: globalThis.text || " " };
};
modifier(text);
```

## Profile Name Rules

- Profile keys are normalized to lowercase internally.
- Underscores are safe and recommended for stable keys (example: `hahari_hanazono`).
- Activation depends on `/profile keywords`, not the key format itself.

## Commands

### Core profile commands

- `/profile add <name>`
- `/profile remove <name>` (or `/profile delete <name>`)
- `/profile show <name>`
- `/profile list`
- `/profile sections`

### Section editing

- `/profile set <name> <section> <text>`
- `/profile append <name> <section> <text>`
- `/profile keywords <name> <word1,word2,...>`
- `/profile keywords <name>` (view current keywords)

### Import/export

- `/profile import <name> [section] text...`
- `/profile importb64 <name> [section] <base64>...`
- `/profile importallb64 [merge|replace] <base64>`
- `/profile export <name>`
- `/profile exportb64 <name>`
- `/profile exportallb64`

Notes:
- `export/import` (plain) is human-readable but not fully safe for all characters.
- `exportb64/importb64` and `exportallb64/importallb64` are safe round-trip formats.
- `importallb64 merge` updates/creates while keeping existing profiles.
- `importallb64 replace` clears existing profiles first.

### Config

- `/profile config`
- `/profile config budget <number>`
- `/profile config fallback <section>`
- `/profile config debug <on|off|true|false|1|0>`
- `/profile config maxActive <number>`
- `/profile config keywords <section> <word1,word2,...>`
- `/profile config keywords <section>` (view override)
- `/profile config keywords <section> <clear|reset|off>`
- `/profile config widgets <on|off|true|false|1|0>`

### Help and batching

- `/profile help`
- Use `;;` to chain commands in one turn

Example:

```text
/profile add nova ;; /profile keywords nova nova,the courier ;; /profile set nova personality Guarded and blunt.
```

## Runtime Behavior

Each context turn:

1. DCP scans recent history (last 6 actions) and current context text for profile keywords.
2. Profiles get weighted hit scores and are sorted by relevance.
3. `maxActive` cap is applied (`0` means no cap).
4. Section categories are scored from scene language.
5. Highest-value sections are injected per active profile up to `budget`.
6. If needed, content is truncated/partially fit to respect total context room.
7. If no category fits, `fallback` section is used.

## Widgets (BetterDungeon)

Widgets are optional and disabled by default.

- Require BetterDungeon extension to render as HUD.
- Script emits debug widgets only when both are true:
- `debug = on`
- `widgets = on`

Widget IDs used:
- `dcp_active`
- `dcp_budget`
- `dcp_focus`

When toggling widgets/debug off, DCP sends destroy messages for these IDs.

Notes:
- If command turns are stopped before output renders, cleanup may apply on the next normal output turn.
- Both Context and Output hooks strip `[[BD:...:BD]]` tags to prevent model/visible text pollution.

## Tuning Tips

- Crowd scenes: lower budget and/or set `maxActive`
- Example: `/profile config budget 300 ;; /profile config maxActive 3`
- Duo scenes: raise budget and loosen cap
- Example: `/profile config budget 800 ;; /profile config maxActive 0`
- Keep keywords specific to avoid accidental activations.
- Keep section text dense and actionable.

## Limitations

- DCP improves consistency but cannot force perfect model compliance.
- Very large profile sets can still hit platform context/input limits.
- Plain export/import is less robust than base64 commands for special characters.

## Recommended Workflow

1. Build profiles with `import` or `importb64`
2. Verify activation with `/profile show` and `/profile keywords`
3. Tune `budget` and `maxActive` for scene density
4. Use `exportallb64` for scenario-to-scenario migration
