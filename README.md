# Dynamic Character Profiles (DCP)

DCP is an AI Dungeon scripting system that stores large character profiles in persistent script state and injects only the most relevant slices into model context each turn.

The current build also includes `DCPTime`, a companion time/calendar system that shares the same merged Library file.

It uses a library-centric hook pattern: all logic lives in the Library script, and the Input/Context/Output tabs stay minimal.

## Current Version

- Standalone merged library: `versions/1.5.0/dcp-library-merged-v1.5.0.js`
- Minimal wrappers:
  - `versions/1.5.0/dcp-input-modifier-v1.5.0.js`
  - `versions/1.5.0/dcp-context-modifier-v1.5.0.js`
  - `versions/1.5.0/dcp-output-modifier-v1.5.0.js`

## What DCP Solves

AI Dungeon Story Cards have practical size limits. DCP lets you keep deeper character data in script state and inject it dynamically based on scene context instead of trying to cram everything into cards.

## Current Feature Set

- Persistent profile storage in `state.dcp.profiles`
- Persistent time storage in `state.dcpTime`
- 10 profile sections:
  - `appearance`, `personality`, `history`, `abilities`, `quirks`, `relationships`, `speech`, `mannerisms`, `species`, `other`
- Keyword-based character activation with word-boundary checks
- Weighted activation scoring:
  - current input is weighted higher than recent history
- Optional active-profile cap via `maxActive`
- Category relevance scoring for section selection
- Per-character injection budget with truncation and partial-fit logic
- Fallback section injection when nothing scores
- Batch `/profile` commands with `;;`
- Safe base64 import/export for single profiles and full profile sets
- Case-insensitive slash commands
- Embedded command extraction from Story / Do / Say forms such as `You say "/Time help"`
- Output run-on repair for common punctuation-spacing issues
- Time system with:
  - configurable minutes-per-action
  - configurable displayed calendar date
  - configurable `12h` or `24h` display format
  - automatic phase-of-day labeling
  - rollover snapping such as `07:59 -> 08:00`
  - quick macro commands such as `/sleep`, `/nap`, `/rest`, and `/wait`
  - pause and resume control for automatic turn advancement
  - calendar-style output such as `[Time: 20:23 (Night), 12/31/2026 (Winter)]`

## Setup

Paste these exact files into AI Dungeon:

1. Library tab:
   - `versions/1.5.0/dcp-library-merged-v1.5.0.js`
2. Input tab:
   - `versions/1.5.0/dcp-input-modifier-v1.5.0.js`
3. Context tab:
   - `versions/1.5.0/dcp-context-modifier-v1.5.0.js`
4. Output tab:
   - `versions/1.5.0/dcp-output-modifier-v1.5.0.js`

Minimal wrappers:

**Input**

```js
const modifier = (text) => {
  globalThis.text = text;
  globalThis.stop = false;

  if (typeof DCPTime === "function") DCPTime("input");
  if (globalThis.stop !== true && typeof DCP === "function") DCP("input");

  return {
    text: globalThis.text || " ",
    stop: globalThis.stop === true
  };
}
modifier(text)
```

**Context**

```js
const modifier = (text) => {
  globalThis.text = text;
  globalThis.stop = false;

  if (typeof DCPTime === "function") DCPTime("context");
  if (globalThis.stop !== true && typeof DCP === "function") DCP("context");

  return {
    text: globalThis.text || " ",
    stop: globalThis.stop === true
  };
}
modifier(text)
```

**Output**

```js
const modifier = (text) => {
  globalThis.text = text;

  if (typeof DCP === "function") DCP("output");
  if (typeof DCPTime === "function") DCPTime("output");

  return { text: globalThis.text || " " };
}
modifier(text)
```

## Profile Name Rules

- Profile keys are normalized to lowercase internally.
- Underscores are safe and recommended for stable keys.
- Activation depends on `/profile keywords`, not the key format itself.

## Profile Commands

### Core Profile Commands

- `/profile add <name>`
- `/profile remove <name>`
- `/profile delete <name>`
- `/profile show <name>`
- `/profile list`
- `/profile sections`
- `/profile help`

### Section Editing

- `/profile set <name> <section> <text>`
- `/profile append <name> <section> <text>`
- `/profile keywords <name> <word1,word2,...>`
- `/profile keywords <name>`

### Import / Export

- `/profile import <name> [section] text...`
- `/profile importb64 <name> [section] <base64>...`
- `/profile importallb64 [merge|replace] <base64>`
- `/profile importallb64 begin [merge|replace]`
- `/profile importallb64 chunk <base64-part>`
- `/profile importallb64 finish`
- `/profile export <name>`
- `/profile exportb64 <name>`
- `/profile exportallb64`
- `/profile exportallchunks [merge|replace] [chunkSize]`

Notes:

- Plain `export/import` is human-readable but not fully safe for all characters.
- `exportb64/importb64` and `exportallb64/importallb64` are safe round-trip formats.
- `importallb64 merge` updates and creates while keeping existing profiles.
- `importallb64 replace` clears existing profiles first.

### Profile Config

- `/profile config`
- `/profile config budget <number>`
- `/profile config fallback <section>`
- `/profile config debug <on|off|true|false|1|0>`
- `/profile config maxActive <number>`
- `/profile config keywords <section> <word1,word2,...>`
- `/profile config keywords <section>`
- `/profile config keywords <section> <clear|reset|off>`

Example:

```text
/profile add nova ;; /profile keywords nova nova,the courier ;; /profile set nova personality Guarded and blunt.
```

## Time Commands

- `/now`
- `/sleep [time]`
- `/sleep until <time>`
- `/nap [duration]`
- `/rest [duration]`
- `/wait <duration>`
- `/wait until <time>`
- `/waituntil <time>`
- `/tomorrow [time]`
- `/pause`
- `/resume`
- `/time help`
- `/time show`
- `/time set <time> [nextday]`
- `/time add <Nd Nh Nm>`
- `/time config`
- `/time config date <MM/DD/YYYY>`
- `/time config format <12h|24h>`
- `/time config enabled <on|off>`
- `/time config context <on|off>`
- `/time config output <on|off>`
- `/time config message <on|off>`
- `/time config minutes <1-60>`

Example:

```text
/time config date 12/31/2026
/time config format 12h
/time set 8:23 PM
```

That produces output like:

```text
[Time: 8:23 PM (Night), 12/31/2026 (Winter)]
```

## Runtime Behavior

### DCP Profile Injection

Each context turn:

1. DCP scans recent history and current input for profile keywords.
2. Profiles get weighted hit scores and are sorted by relevance.
3. `maxActive` is applied. `0` means no cap.
4. Section categories are scored from the scene language.
5. Highest-value sections are injected per active profile up to `budget`.
6. If needed, content is truncated or partially fit to respect total context room.
7. If no category fits, the configured fallback section is used.

### DCPTime

Each turn:

1. The system records the latest input.
2. `/profile` and `/time` command turns do not advance time.
3. Quick time commands such as `/sleep`, `/nap`, `/rest`, `/wait`, `/tomorrow`, `/pause`, and `/resume` also do not consume automatic turn advancement.
4. Normal turns advance by `minutesPerAction`, unless time is paused.
5. If the turn crosses the hour boundary from `:59`, the clock snaps to the next hour.
6. `/time config date` sets the current displayed date.
7. Phase is derived from the current hour:
   - Morning: `06:00-11:59`
   - Afternoon: `12:00-16:59`
   - Evening: `17:00-19:59`
   - Night: `20:00-05:59`
8. Display format is controlled by `/time config format <12h|24h>`.

## Seasons

Seasons are derived directly from the displayed month:

- Winter:
  - December 1 through February 28/29
- Spring:
  - March 1 through May 31
- Summer:
  - June 1 through August 31
- Autumn:
  - September 1 through November 30

Season rollover dates:

- Spring starts on `03/01`
- Summer starts on `06/01`
- Autumn starts on `09/01`
- Winter starts on `12/01`

## Tuning Tips

- Crowd scenes:
  - lower `budget` and/or set `maxActive`
- Example:
  - `/profile config budget 300 ;; /profile config maxActive 3`
- Duo scenes:
  - raise `budget` and loosen the cap
- Example:
  - `/profile config budget 800 ;; /profile config maxActive 0`
- Keep keywords specific to avoid accidental activations.
- Keep section text dense and actionable.

## Limitations

- DCP improves consistency but cannot force perfect model compliance.
- Very large profile sets can still hit platform context and input limits.
- Plain export/import is less robust than base64 commands for special characters.
- The README tracks the supported workflow. Legacy widget scaffolding still exists in code but is intentionally not part of the current documented setup.

## Recommended Workflow

1. Paste the `v1.5.0` merged library and minimal wrappers.
2. Build profiles with `import` or `importb64`.
3. Verify activation with `/profile show` and `/profile keywords`.
4. Tune `budget` and `maxActive` for scene density.
5. Set the displayed calendar date with `/time config date`.
6. Choose `12h` or `24h` output with `/time config format`.
7. Set the clock with `/time set` or use the quick time commands.
8. Use `exportallb64` or `exportallchunks` for migration between scenarios.
