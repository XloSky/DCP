# Dynamic Character Profiles (DCP)

**A scripting system for AI Dungeon that bypasses the 1,000-character Story Card limit.**

Characters get unlimited profile data stored in persistent state. Each turn, the script analyzes the scene and dynamically injects the most contextually relevant slice of character data into the AI's context.

---

## The Problem

AI Dungeon's story cards are limited to 1,000 characters — barely enough for a name and a few traits. Characters lose depth, forget their history, and blend together. Players are forced to choose between shallow profiles or constantly reminding the AI who someone is. DCP aims to:

- Store unlimited character profile data beyond the 1,000-character story card limit.
- Dynamically inject only the most relevant character details each turn based on scene analysis.
- Automatically detect which characters are active in the scene via keyword matching.
- Score 10 detail categories against recent context so the AI gets the right information at the right time.
- Reduce context pollution by using a smart character budget instead of dumping everything.
- Keep characters consistent across long adventures without manual intervention.

## Features

- **Unlimited profile storage** across 10 sections: `appearance`, `personality`, `history`, `abilities`, `quirks`, `relationships`, `speech`, `mannerisms`, `species`, `other`
- **Contextual scene analysis** — scores categories like abilities, speech, and appearance against recent history
- **Smart budget system** — injects the highest-scoring sections up to a configurable character limit (default 800)
- **Multi-character support** — tracks and injects multiple characters simultaneously
- **Custom keyword triggers** — control when each character's data activates
- **Word-boundary matching** — prevents false activations from partial word matches
- **Fallback injection** — always sends at least one section (default: personality) when no category scores
- **In-adventure profile management** via `/profile` commands
- **Configurable** budget, fallback section, and debug mode
- **Works alongside existing story cards** — complements rather than replaces

---

## Setup

1. Open your AI Dungeon scenario and go to the script editor.
2. Paste [`scripts/LIBRARY.js`](scripts/LIBRARY.js) into the **Library** tab.
3. Paste [`scripts/INPUT_HOOK.js`](scripts/INPUT_HOOK.js) into the **Input** tab.
4. Paste [`scripts/OUTPUT_HOOK.js`](scripts/OUTPUT_HOOK.js) into the **Output** tab.
5. Paste [`scripts/CONTEXT_HOOK.js`](scripts/CONTEXT_HOOK.js) into the **Context** tab.
6. Save and start playing.

### Verifying Installation

Before deploying the full script, you can test that the hook mechanism works in your scenario:

1. Paste [`scripts/TEST_INPUT.js`](scripts/TEST_INPUT.js) into the **Input** tab.
2. Paste [`scripts/TEST_OUTPUT.js`](scripts/TEST_OUTPUT.js) into the **Output** tab.
3. Leave Library and Context tabs **empty**.
4. Type `/profile list` in your adventure.
5. If you see `DCP WORKS — Turn #...` in the output, the delivery mechanism is working. Deploy the full script.

---

## Usage

### Creating a Profile

```
/profile add Nova
/profile set Nova appearance Tall and lean with silver hair and mismatched eyes — one gold, one black. A long scar runs from her left temple to her jawline. Wears a patched military coat over a dark bodysuit.
/profile set Nova personality Guarded and blunt. Speaks only when necessary. Fiercely loyal once trust is earned but assumes betrayal by default. Dry humor surfaces in moments of stress.
/profile set Nova history Former military scout who deserted after her unit was sacrificed in a cover-up. Spent three years in hiding before resurfacing as a freelance courier. Still wanted by the state.
```

### Adding to Existing Sections

Use `append` to add more detail without overwriting:

```
/profile append Nova abilities Expert marksman and close-quarters fighter. Can navigate by stars alone. Trained in field medicine — enough to stabilize, not enough to save.
```

### Setting Keywords

By default, a character activates when their name appears in the story. Add extra trigger words for nicknames, titles, or species:

```
/profile keywords Nova nova,the courier,silver
```

Now the script will inject her profile whenever "nova", "the courier", or "silver" appears in recent history.

### All Commands

| Command | Description |
|---|---|
| `/profile add <name>` | Create a new profile |
| `/profile remove <name>` | Delete a profile |
| `/profile set <name> <section> <text>` | Set a section's content |
| `/profile append <name> <section> <text>` | Append to a section |
| `/profile show <name>` | Display profile summary with character counts |
| `/profile list` | List all stored profiles |
| `/profile sections` | List all available sections |
| `/profile keywords <name> <word1,word2>` | Set custom trigger keywords |
| `/profile config` | Show current configuration |
| `/profile config budget <number>` | Set injection budget (default: 800 chars) |
| `/profile config fallback <section>` | Set fallback section (default: personality) |
| `/profile config debug true/false` | Toggle debug mode |
| `/profile help` | Show command list |

---

## How It Works

DCP runs automatically in the background. Each turn:

1. The script scans the last 6 history entries for character keywords.
2. Active characters are identified by keyword match (with word-boundary checking).
3. The scene is analyzed — words like "fight", "attack", "sword" score the **abilities** category higher, while "eyes", "hair", "wearing" score **appearance** higher.
4. The highest-scoring sections are injected into the AI's context up to the budget limit.
5. If nothing scores, the fallback section (default: personality) is injected instead.

You don't need to do anything during play. Just write your story and DCP handles the rest.

### Category Keywords

Each category has 15-25 trigger words used for scene analysis:

| Category | Example Keywords |
|---|---|
| `appearance` | look, eyes, hair, face, wearing, outfit, beautiful |
| `personality` | feel, emotion, happy, sad, angry, confident, shy |
| `history` | remember, past, childhood, origin, family, trauma |
| `abilities` | fight, attack, magic, power, combat, weapon, heal |
| `quirks` | habit, obsess, phobia, weird, favorite, hobby |
| `relationships` | friend, enemy, rival, partner, loyal, devoted |
| `speech` | say, tell, shout, whisper, voice, tone, accent |
| `mannerisms` | walk, move, gesture, lean, fidget, pace, bow |
| `species` | monster, creature, tail, wings, claws, fangs, scales |

---

## Configuration Tips

- **Raise the budget** (`/profile config budget 1200`) if you have fewer characters and want more detail per turn.
- **Lower the budget** if you have many active characters at once to avoid exceeding context limits.
- **Set keywords** for nicknames and titles — if other characters call someone "Boss", add "boss" as a keyword.
- **Use your story card for essentials**, use DCP for deep details. They complement each other.
- **Shorter, denser sections** perform better than long paragraphs. Focus on traits the AI can act on.

---

## Architecture

DCP uses AI Dungeon's four-tab scripting system:

| Tab | File | Role |
|---|---|---|
| Library | `LIBRARY.js` | Initializes `state.dcp` on first run |
| Input | `INPUT_HOOK.js` | Intercepts `/profile` commands, stores results in state |
| Output | `OUTPUT_HOOK.js` | Delivers command results to the player |
| Context | `CONTEXT_HOOK.js` | Analyzes scene and injects character data |

All logic is inline per tab — no cross-tab function calls. State is used only for data storage (profiles, config, command results). This architecture was chosen for maximum compatibility with AI Dungeon's isolated-vm runtime.

---

## Disclaimer

DCP injects character data into AI context but cannot guarantee the AI will use every detail perfectly every turn. Results improve with well-written profile sections. Pair with a strong story card for best results.
