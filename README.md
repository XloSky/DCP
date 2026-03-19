# Dynamic Character Profiles (DCP)

DCP is an AI Dungeon library for two things:

- storing large character profiles without filling Story Cards
- tracking in-world time, date, seasons, and reminders

This build is meant to be pasted into AI Dungeon, not programmed against.

## What You Get

- profile storage that stays in script state
- smart profile injection based on the current scene
- quick time commands like `/sleep`, `/nap`, `/rest`, and `/wait`
- calendar date, season, and AM/PM or 24h time
- optional compact time footer
- one-shot reminders using `phone` or `alarm`

## Current Version

- Stable setup files:
  - `scripts/LIBRARY.js`
  - `scripts/INPUT.js`
  - `scripts/CONTEXT.js`
  - `scripts/OUTPUT.js`
- Version archive:
  - `versions/1.5.1/`

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

If you only want the basics, these are the commands most people need:

```text
/profile add hakari
/profile keywords hakari hakari
/profile set hakari personality Confident, reckless, and sharp.

/time config date 03/19/2026
/time config format 12h
/time set 8:23 PM

/sleep
/nap
/rest
/wait 30m

/remind add phone 6:00 PM Meet Hakari
```

## Most-Used Commands

### Profiles

```text
/profile help
/profile add <name>
/profile show <name>
/profile list
/profile set <name> <section> <text>
/profile append <name> <section> <text>
/profile keywords <name> <word1,word2,...>
/profile remove <name>
/profile sections
```

### Time

```text
/time help
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

```text
/remind help
/remind add phone 6:00 PM Meet Hakari
/remind add phone tomorrow 6:00 PM 30m Meet Hakari
/remind add alarm 03/20/2026 8:00 AM Wake up
/remind list
/remind remove <id>
```

## Useful Time Settings

```text
/time config date <MM/DD/YYYY>
/time config format <12h|24h>
/time config display <full|compact>
/time config sleep <time>
/time config nap <duration>
/time config rest <duration>
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

## Notes

- Commands are case-insensitive.
- Commands also work from Story / Do / Say forms like `You say "/Time help"`.
- If you omit the date in a reminder, DCP resolves it to the next valid in-world time.
- Reminders are one-shot. They do not repeat automatically.
- `/sleep`, `/nap`, and `/rest` can use your configured defaults.

## Profile Sections

```text
appearance
personality
history
abilities
quirks
relationships
speech
mannerisms
species
other
```

## Import / Export

Use these when moving profiles between scenarios:

```text
/profile export <name>
/profile exportb64 <name>
/profile exportallb64
/profile exportallchunks [merge|replace] [chunkSize]

/profile import <name> [section] text...
/profile importb64 <name> [section] <base64>...
/profile importallb64 [merge|replace] <base64>
```

## Limits

- DCP improves consistency, but it cannot force the model to obey perfectly.
- Very large profile sets can still hit AI Dungeon limits.
- Plain import/export is less safe than base64 import/export.
