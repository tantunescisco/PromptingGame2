# Prompt Quest 🚀

An interactive browser-based game for learning and practicing **prompt engineering**. Players progress through 5 levels of increasing difficulty, from playful basics to advanced AI architecture techniques.

🌐 **Live demo:** [https://tantunescisco.github.io/PromptingGame/](https://tantunescisco.github.io/PromptingGame/)

> Scores are shared in real time across all participants via Firebase Realtime Database.  
> Scoreboards reset automatically every **Monday at 00:00 UTC**.

---

## Overview

Prompt Quest is a workshop tool for teaching participants how to communicate effectively with AI systems. Each level introduces new prompt engineering concepts through hands-on exercises with immediate feedback.

| Level | Theme | Concept |
|-------|-------|---------|
| 1 🌈 | Prompt Playground | What is a prompt? Basics of clear instructions |
| 2 ⚔️ | Clarity Kingdom | Specificity, the 5 W's, format and length |
| 3 🔮 | Context Cave | Role assignment, system prompts, context injection |
| 4 ⚙️ | Format Factory | Output formatting, constraints, templating |
| 5 🤖 | AI Architect | Few-shot, chain-of-thought, prompt chaining, meta-prompting |

---

## Features

- **5 levels** with 20 questions each — 4 randomly selected per session for replayability
- **4 exercise types:** Multiple choice, free-text prompts, drag-to-order, and matching
- **3-tier free-text scoring:** Full credit, partial credit, or zero based on keyword coverage and answer quality
- **Shared live scoreboard** — all participants see the same leaderboard in real time
- **Per-level and overall leaderboards** with score + time tie-breaking
- **Top-5 weekly leaderboard on the start screen** — visible before the game begins
- **Weekly auto-reset** — scores clear every Monday at 00:00 UTC automatically
- **Duplicate name prevention** — checks the live leaderboard before starting
- **Player name validation** — 3–20 characters required
- **Admin mode** — hidden access (Ctrl+Shift+A or 5-tap leaderboard title) to reset scores with credential login
- **Quit button** — exit to the start screen at any point during the game
- **Themed music** per level + welcome screen using the Web Audio API (procedural, no audio files)
- **Themed sound effects** for correct/wrong answers and level completion fanfares
- **Separate mute controls** for music 🎵 and sound effects 🔔

---

## Running the App

Open the live URL in any browser — no setup needed:

```
https://tantunescisco.github.io/PromptingGame/
```

All participants share the same live scoreboard via Firebase. Works on any device with a browser.

---

## Scoring

| Action | Points |
|--------|--------|
| Correct answer (no hint) | 10 pts |
| Correct answer (hint used) | 5 pts |
| Partial free-text answer | 5 pts |
| Wrong answer | 0 pts |

- Maximum per level: **40 points** (4 exercises × 10 pts)
- Leaderboards rank by **score descending**, then **time ascending** on ties

---

## Weekly Auto-Reset

Scores are cleared automatically every **Monday at 00:00 UTC** via a GitHub Actions cron job (`.github/workflows/weekly-reset.yml`).

To trigger a manual reset:
- **GitHub Actions:** Run the `weekly-reset.yml` workflow from the Actions tab → click **Run workflow**
- **Admin mode:** Ctrl+Shift+A → login → Reset All Scores

---

## Firebase Database Rules

The database must allow public read/write. Set the following rules in the Firebase Console  
(**Realtime Database → Rules**):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> The default test mode rules expire after 30 days. Use the rules above to make access permanent.

---

## Tech Stack

- **Frontend:** Pure HTML5 / CSS3 / Vanilla JavaScript (ES2022) — no frameworks, no bundler
- **Audio:** Web Audio API — procedural music and SFX (6 themes: welcome + 5 levels), no audio files
- **Storage:** Firebase Realtime Database — free, real-time, works on GitHub Pages
- **Deployment:** GitHub Actions → GitHub Pages

---

## Project Structure

```
PromptingGame/
├── index.html                        # Single-page app shell
├── style.css                         # All themes and styles (5 level themes)
├── game.js                           # 100 questions, all game engines and logic
├── server.py                         # Python local server (optional, offline use)
├── server.js                         # Node.js local server (optional, offline use)
├── .github/
│   └── workflows/
│       ├── deploy.yml               # GitHub Pages deployment on push to main
│       └── weekly-reset.yml         # Monday 00:00 UTC Firebase score reset
└── .gitignore
```

---

## Architecture Notes

**`game.js`** is the single source of truth for all game logic:

- `FIREBASE_URL` — connection to the shared Realtime Database
- `GAME_DATA` — 5 levels × 20 questions each (4 randomly selected per playthrough)
- `GameState` — current session state (level, score, timer, player name)
- `Scoreboard` — async Firebase storage with localStorage fallback
- `Timer` — live per-level countdown display
- `MusicEngine` — procedural looping music (welcome theme + one per level), independent mute
- `SoundEngine` — themed correct/wrong/level-complete SFX, independent mute
- `GameEngine` — all screen transitions, exercise rendering, scoring logic, and admin mode
- `AdminMode` — hidden credential-gated panel for leaderboard management

---

## Deployment

Every push to `main` auto-deploys to GitHub Pages via GitHub Actions.

```bash
git add .
git commit -m "description"
git push origin main
# Live on GitHub Pages in ~30 seconds
```

---

## License

MIT
