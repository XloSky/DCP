# Dynamic Character Profiles (DCP)

DCP is an AI Dungeon script set for two things:

- storing large character profiles in script state instead of Story Cards
- tracking in-world time, date, seasons, and one-shot reminders

This build is meant to be pasted into AI Dungeon, not programmed against.

## What You Get

- profile storage that stays in script state
- name and keyword-based profile activation
- smart profile injection based on the current scene
- a 4-section profile model: `behavior`, `speech`, `capabilities`, `reactions`
- legacy profile compatibility through automatic section remapping
- quick time commands like `/sleep`, `/nap`, `/rest`, and `/wait`
- calendar date, season, and `12h` or `24h` time
- optional full or compact time footer
- one-shot reminders using `phone` or `alarm`
- optional debug widgets for BetterDungeon users

## Current Version

Latest release in this workspace:

- `releases/1.6.3/`

Previous stable archive:

- `releases/1.5.2/`

`1.6.3` keeps the normal four AI Dungeon script tabs, but the main logic is centralized in the merged library file:

- `releases/1.6.3/LIBRARY.js`
- `releases/1.6.3/INPUT.js`
- `releases/1.6.3/CONTEXT.js`
- `releases/1.6.3/OUTPUT.js`

## Setup

Paste these into AI Dungeon:

1. Library tab:
   - [LIBRARY.js](scripts/LIBRARY.js)
2. Input tab:
   - [INPUT.js](scripts/INPUT.js)
3. Context tab:
   - [CONTEXT.js](scripts/CONTEXT.js)
4. Output tab:
   - [OUTPUT.js](scripts/OUTPUT.js)

## Quick Start

If you want DCP working fast, do these in order.

Rule of thumb:

- Story Card = short, always-on basics
- DCP Profile = deeper details, behaviors, reactions, and situational nuance

### 1. Make a profile

```text
/profile add hakari
/profile keywords hakari hakari
/profile set hakari behavior Confident, reckless, and sharp.
```

### 2. Turn time on

```text
/time config enabled on
/time config output on
/time config format 12h
/time config display compact
/time config date 03/19/2026
/time set 8:23 PM
```

### 3. Use the quick time commands if you want them

```text
/sleep
/nap
/rest
/wait 30m
/remind add phone 6:00 PM Meet Hakari
```

## Most-Used Commands

### Profiles

Use these to create, edit, and check profiles:

```text
/profile help
/profile add <name>
/profile remove <name>
/profile show <name>
/profile list
/profile set <name> <section> <text>
/profile append <name> <section> <text>
/profile keywords <name> <word1,word2,...>
/profile sections
/profile config
/profile config budget <chars>
/profile config fallback <section>
/profile config maxActive <number>
/profile config debug <on|off>
/profile config widgets <on|off>
/profile config keywords <section> <word1,word2,...>
```

### Time

Use these to check, move, and configure in-world time:

```text
/time help
/time show
/time set <time> [nextday]
/time add <Nd Nh Nm>
/now
/sleep [time]
/sleep until <time>
/nap [duration]
/rest [duration]
/wait <duration>
/wait until <time>
/waituntil <time>
/tomorrow [time]
/pause
/resume
```

### Reminders

Use these for one-shot reminders and alarms:

```text
/remind help
/remind add phone 6:00 PM Meet Hakari
/remind add phone tomorrow 6:00 PM 30m Meet Hakari
/remind add alarm 03/20/2026 8:00 AM Wake up
/remind list
/remind remove <id>
```

## Useful Settings

### Profile settings

Use these when you want to control how much profile detail DCP injects:

```text
/profile config budget <chars>
/profile config fallback <behavior|speech|capabilities|reactions>
/profile config maxActive <number>
/profile config debug <on|off>
/profile config widgets <on|off>
/profile config keywords <section> <word1,word2,...>
```

- `budget` defaults to `800`
- `fallback` defaults to `behavior`
- `maxActive 0` means no cap
- debug widgets only matter if you are using BetterDungeon

### Time settings

Use these when you want to control how time appears and progresses:

```text
/time config date <MM/DD/YYYY>
/time config display <full|compact>
/time config format <12h|24h>
/time config sleep <time>
/time config nap <duration>
/time config rest <duration>
/time config enabled <on|off>
/time config context <on|off>
/time config output <on|off>
/time config message <on|off>
/time config minutes <1-60>
```

## What The Time Footer Looks Like

Full:

```text
[Time: 8:23 PM (Night), 12/31/2026 (Winter)]
```

Compact:

```text
[Time: 8:23 PM (Night)]
```

## Profile Sections

These are the four live DCP sections:

- `behavior`: how the character acts, approaches situations, moves, and generally carries themselves
- `speech`: tone, phrasing, cadence, favorite wording, and how they usually talk
- `capabilities`: skills, powers, talents, knowledge, or physical advantages
- `reactions`: emotional tells, jealousy, protectiveness, embarrassment, fear, softness, and other response patterns

You do not need to fill every section for every profile. Even one or two solid sections can be enough.

Legacy sections are still accepted and auto-mapped when profiles are loaded or imported:

- `appearance` -> `behavior`
- `personality` -> `behavior`
- `history` -> `behavior`
- `abilities` -> `capabilities`
- `quirks` -> `behavior`
- `relationships` -> `reactions`
- `mannerisms` -> `behavior`
- `species` -> `behavior`
- `other` -> `behavior`
- `speech` -> `speech`

## Import / Export

Use these when moving profiles between scenarios or backing them up:

```text
/profile export <name>
/profile exportb64 <name>
/profile exportallb64
/profile exportallchunks [merge|replace] [chunkSize]

/profile import <name> [section] text...
/profile importb64 <name> [section] <base64>...
/profile importallb64 [merge|replace] <base64>
/profile importallb64 begin [merge|replace]
/profile importallb64 chunk <base64-part>
/profile importallb64 finish
```

## Notes

- Commands are case-insensitive.
- Commands also work from Story / Do / Say forms like `You say "/time help"`.
- DCP works best alongside Story Cards, not as a full replacement for them.
- If you omit the date in a reminder, DCP resolves it to the next valid in-world time.
- Reminders are one-shot and do not repeat automatically.
- `/sleep`, `/nap`, and `/rest` can use your configured defaults.
- `1.6.3` injects at most two sections per active profile, chosen by scene relevance, with fallback to your configured section if nothing scores.
- Old profiles still work, but older multi-section profiles are compressed into the new 4-section model.

## Limits

- DCP improves consistency, but it cannot force the model to obey perfectly.
- Very large profile sets can still hit AI Dungeon context limits.
- Plain import/export is less safe than base64 import/export.
- Legacy profiles are supported, but custom old section names outside the built-in mapping will not migrate automatically.



