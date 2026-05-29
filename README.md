# Prompt Quest 2 - The Evolution of Civilization

> From the first clay tablet to the edge of the Singularity - master the language of AI.

Prompt Quest 2 is a browser-based prompt engineering game built with plain HTML, CSS, and JavaScript. Players move through five civilization eras, complete themed prompt exercises, compete on shared scoreboards, and can resume unfinished runs locally by re-entering the same name.

Live demo: [https://tantunescisco.github.io/PromptingGame2/](https://tantunescisco.github.io/PromptingGame2/)

## Overview

- 5 levels themed around major eras of civilization
- 20 exercises per level, with 4 randomly selected each run for replayability
- Era-specific visual design, typography, dialogue, music, and character art
- Prompt engineering concepts that progress from basic clarity to structured prompting and advanced orchestration

## Levels

| Level | Era | Prompt Engineering Focus |
|-------|-----|--------------------------|
| 1 | The Cradle of Clay | Prompt basics, clarity, specificity |
| 2 | Marble & Iron | The 5 W's, formatting, scope, and length |
| 3 | Smog & Steel | Role prompting, system prompts, and context injection |
| 4 | Silicon & Neon | Output formatting, constraints, and templating |
| 5 | The Stellar Singularity | Few-shot prompting, prompt chaining, and meta-prompting |

## Current Functionality

### Core gameplay

- Single-page browser game with welcome, level intro, exercise, level-complete, and final completion screens
- 4 exercise types: multiple choice, free-text, ordering, and matching
- 4 randomly selected exercises per level from a 20-question pool
- Per-question hints with reduced scoring when used
- Immediate feedback after each answer with explanation and prompt-engineering tip
- Level timer shown during play and used for leaderboard tie-breaking
- Per-level score tracking plus total run score across all 5 levels

### Scoring

| Action | Points |
|--------|--------|
| Correct answer without hint | 10 |
| Correct answer after using a hint | 5 |
| Partial free-text answer | 5 |
| Wrong answer | 0 |

- Maximum score per level: 40 points
- Maximum score per full run: 200 points
- Leaderboards rank by score descending, then time ascending
- Free-text scoring uses keyword coverage thresholds for full or partial credit

### Scoreboards and persistence

- Welcome screen shows the current top 5 overall leaderboard before the game starts
- Level-complete screens show per-level leaderboards
- Final completion screen shows the overall leaderboard
- Shared scoreboard storage uses a 3-tier fallback model:
  1. Firebase Realtime Database when `FIREBASE_URL` is configured
  2. REST API endpoints via `server.py` if available
  3. `localStorage` fallback for local-only play
- Duplicate player-name prevention checks the overall leaderboard before starting a new run
- Player name validation requires 3 to 20 characters

### Resume flow

- Unfinished progress is saved locally in `localStorage` under `pq_progress_v1`
- If a player returns to the welcome screen after finishing a level, the next unfinished level chip becomes clickable
- If the player reloads or closes the browser, entering the same name prompts them to resume the previous run
- Mid-level progress can resume from the saved exercise state, including score, timer, answers, and the selected exercise set
- Finished runs clear saved resume progress automatically

### Welcome screen and admin tools

- Responsive welcome panorama with multiple artwork variants for different viewport shapes
- Hidden admin login trigger by `Ctrl+Shift+A`
- Hidden alternate admin trigger by clicking the welcome leaderboard title 5 times within 3 seconds
- Admin mode allows jumping directly to any level from the welcome chips
- Admin mode includes leaderboard reset and completion-screen preview actions
- Welcome screen visually highlights resumable level chips when a matching saved run exists
- About button in the top-right control cluster opens the current game version and a learner guide in the active theme

### Audio and presentation

- Procedural music for the welcome screen plus all 5 levels using the Web Audio API
- Procedural sound effects for correct answers, wrong answers, and level completion
- Separate always-visible controls for home, music mute, SFX mute, and About
- Era-specific character art for each civilization and human-evolution timeline art on the final screen
- Completion screen includes animated stats, leaderboard, timeline, fireworks, and a clipboard-ready share summary

### Completion flow

- Final score is converted into a rank title
- Completion screen includes score, accuracy, total time, efficiency text, and earned rank
- Players can copy a prebuilt share message to the clipboard
- Players can replay the full timeline from the completion screen

## Running the App

### Option 1: Play the deployed version

Open the live site in any browser:

```text
https://tantunescisco.github.io/PromptingGame2/
```

### Option 2: Run locally

Any static web server will work. For example:

```powershell
python -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/
```

## Storage Configuration

The app supports three scoreboard storage modes:

1. Firebase Realtime Database
2. REST API backend served from the same origin
3. Browser `localStorage`

If Firebase is configured, all players share the same live scoreboard even on GitHub Pages.

### Firebase rules

If you use Firebase Realtime Database for the shared scoreboard, the database must allow public read and write:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

## Tech Stack

- Frontend: HTML5, CSS3, Vanilla JavaScript
- Audio: Web Audio API
- Shared scoreboard storage: Firebase Realtime Database
- Local persistence: `localStorage`
- Deployment: GitHub Pages

## Project Structure

```text
PromptingGame2/
|-- index.html
|-- style.css
|-- game.js
|-- ABOUT.md
|-- README.md
|-- completionscreen.md
|-- completion.png
|-- panorama_1-1.png
|-- panorama_4-3.png
|-- panorama_21-9.png
|-- civil1.png
|-- civil1_human.png
|-- civil2.png
|-- civil2_human.png
|-- civil3.png
|-- civil3_human.png
|-- civil4.png
|-- civil4_human.png
|-- civil5.png
|-- civil5_human.png
```

## Architecture Notes

### `game.js`

Primary game systems include:

- `GAME_DATA`: all level metadata, exercise pools, narrative content, and answer rules
- `GameState`: in-memory state for the active run
- `ProgressStore`: local resume-state persistence
- `Scoreboard`: shared and fallback leaderboard storage
- `Timer`: elapsed-time tracking and formatting
- `MusicEngine`: procedural per-era music
- `SoundEngine`: procedural SFX
- `CharacterEngine`: era character rendering and final timeline visuals
- `GameEngine`: screen flow, exercise rendering, scoring, saving, restoring, and leaderboard rendering
- `AdminMode`: hidden admin tools for login, level jumping, reset, and preview flows
- `AboutModal`: loads and renders `ABOUT.md` inside a themed modal

### `style.css`

Contains:

- Global layout and responsive rules
- Welcome, gameplay, feedback, leaderboard, and completion-screen styling
- Distinct era themes for all 5 levels
- Admin modal and admin-banner styling
- About modal styling and markdown-viewer presentation

### `index.html`

Defines the single-page shell for:

- Welcome screen
- Level intro screen
- Exercise screen
- Level-complete screen
- Final completion screen
- Admin login and admin panel modals
- About modal

## Deployment Notes

- The site is designed to run as a static app on GitHub Pages
- Cache-busting query strings are used on core static assets to force refreshed client loads after UI changes

## License

MIT
