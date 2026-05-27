# Prompt Quest 🚀 — The Evolution

> *From the first clay tablet to the edge of the Singularity — master the language of AI.*

An interactive browser-based game for learning **prompt engineering** through a journey across five ages of human civilization. Each era has its own aesthetic, music, and prompt engineering challenge — from primitive clarity to post-human AI architecture.

🌐 **Live demo:** [https://tantunescisco.github.io/PromptingGame2/](https://tantunescisco.github.io/PromptingGame2/)

> Scores are shared in real time across all participants via Firebase Realtime Database.  
> Scoreboards reset automatically every **Monday at 00:00 UTC**.

---

## The Journey

### 🌾 Level 1 — The Cradle of Clay *(First Civilizations)*

**Aesthetic:** Sun-baked mud bricks, expansive river valleys, papyrus reeds, and towering ziggurats. Heavy ochre, terracotta, and river blues. Cinzel serif typography carved from stone.

**Core Theme:** *Organization & Survival.* Transitioning from nomadic tribes to structured societies — and writing your first instructions in clay.

**Prompt Engineering Focus:** What is a prompt? The basics of clear, specific instructions. Just as the first scribes learned every cuneiform symbol must be precise, you'll learn that vague prompts produce vague answers.

**Music:** Ancient tribal drone — earth bass, D minor pentatonic melody, temple bells.

---

### 🏛️ Level 2 — Marble & Iron *(Classical Antiquity to Empires)*

**Aesthetic:** Colossal stone architecture, grand pillars, sprawling aqueducts, and massive military marching grounds. Brilliant whites, deep imperial purples, and polished bronze. Cinzel serif — the typography of empire.

**Core Theme:** *Expansion & Philosophy.* The rise of global empires, rhetoric, and institutionalized logic. Aristotle, Cicero, and the great orators understood that the *how* of communication matters as much as the *what*.

**Prompt Engineering Focus:** Clarity, the 5 W's (Who, What, When, Where, Why), format, and length. The classical rules of effective communication applied to AI.

**Music:** Stately D Dorian — lyre triangle waves, measured tempo, sustained harmonic bass.

---

### ⚙️ Level 3 — Smog & Steel *(The Industrial Revolution)*

**Aesthetic:** Dark, soot-stained brick factories, towering iron scaffolding, steam trains cutting through the countryside, and early electric lighting. Charcoal greys, copper, and mechanical rust. Special Elite typewriter font.

**Core Theme:** *Mechanization & Labor.* Replacing muscle power with machine power — and specialised roles that each serve a precise function.

**Prompt Engineering Focus:** Role assignment, system prompts, and context injection. Telling the AI *"You are a senior engineer reviewing code for security vulnerabilities"* is the industrial precision of prompting.

**Music:** Driving C mixolydian — sawtooth pistons, bass thumps, metallic clank accents.

---

### 🌐 Level 4 — Silicon & Neon *(The Hyper-Connected Information Age)*

**Aesthetic:** Sleek glass skyscrapers, clean server farms, glowing fiber-optic networks, and bright digital UIs. Clean whites, metallic silvers, vivid neon blues and purples. Orbitron + Share Tech Mono — the fonts of the digital frontier.

**Core Theme:** *Globalism & Data.* Moving past physical manufacturing into a borderless, digitized, and highly automated world where structure is everything.

**Prompt Engineering Focus:** Output formatting, constraints, and templating. JSON, markdown tables, bullet points, negative constraints — taming the flood of information into usable structures.

**Music:** Syncopated digital arpeggios — C pentatonic, sine + percussive click, 220ms pulse.

---

### 🌌 Level 5 — The Stellar Singularity *(Future Civilization)*

**Aesthetic:** Dyson spheres surrounding stars, celestial orbital rings, and structures made of shifting light or programmable matter. Cosmic purples, deep space blacks, and blinding starlight. Orbitron + Share Tech Mono — the language of post-human intelligence.

**Core Theme:** *Post-Humanity & Energy.* Reaching Type II or Type III status on the Kardashev Scale, where humanity has outgrown Earth and merged fully with advanced technology.

**Prompt Engineering Focus:** Few-shot prompting, chain-of-thought reasoning, prompt chaining, temperature control, and meta-prompting. You are no longer asking an AI — you are *architecting systems*.

**Music:** High-velocity cyberpunk synth — A minor sawtooth/square, 160ms glitch arpeggios.

---

## Quick Reference

| Level | Era | Theme | Prompt Engineering Skill |
|-------|-----|-------|--------------------------|
| 1 🌾 | First Civilizations | The Cradle of Clay | Basics — what a prompt is, clarity |
| 2 🏛️ | Classical Antiquity | Marble & Iron | Specificity, the 5 W's, format & length |
| 3 ⚙️ | Industrial Revolution | Smog & Steel | Role assignment, system prompts, context |
| 4 🌐 | Information Age | Silicon & Neon | Output formatting, constraints, templating |
| 5 🌌 | Post-Humanity | The Stellar Singularity | Few-shot, CoT, prompt chaining, meta-prompting |

---

## Features

- **5 levels** with 20 questions each — 4 randomly selected per session for replayability
- **Historical era themes** — distinct visual design, typography, color palette, and music per civilization age
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
- **Era-themed music** per level + welcome screen using the Web Audio API (procedural, no audio files)
- **Themed sound effects** for correct/wrong answers and level completion fanfares
- **Separate mute controls** for music 🎵 and sound effects 🔔

---

## Running the App

Open the live URL in any browser — no setup needed:

```
https://tantunescisco.github.io/PromptingGame2/
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
PromptingGame2/
├── index.html                        # Single-page app shell
├── style.css                         # All era themes and styles (5 level themes)
├── game.js                           # 100 questions, all game engines and logic
└── .gitignore
```

---

## Architecture Notes

**`game.js`** is the single source of truth for all game logic:

- `FIREBASE_URL` — connection to the shared Realtime Database
- `GAME_DATA` — 5 levels × 20 questions each (4 randomly selected per playthrough), each with era-themed metadata (title, badge, concept)
- `GameState` — current session state (level, score, timer, player name)
- `Scoreboard` — async Firebase storage with localStorage fallback
- `Timer` — live per-level countdown display
- `MusicEngine` — procedural era-themed music (welcome + 5 levels: tribal drums → Dorian lyre → industrial pistons → digital arpeggios → singularity synth), independent mute
- `SoundEngine` — themed correct/wrong/level-complete SFX, independent mute
- `GameEngine` — all screen transitions, exercise rendering, scoring logic, and admin mode
- `AdminMode` — hidden credential-gated panel for leaderboard management

**`style.css`** defines the visual identity for each era:

| Theme class | Era | Typography | Palette |
|-------------|-----|------------|---------|
| `body.level-1` | First Civilizations | Cinzel (serif) | Terra cotta & parchment |
| `body.level-2` | Classical Antiquity | Cinzel (serif) | Marble & gold |
| `body.level-3` | Industrial Revolution | Special Elite (typewriter) | Copper & smoke |
| `body.level-4` | Information Age | Orbitron + Share Tech Mono | Navy & cyan neon |
| `body.level-5` | Post-Humanity | Orbitron + Share Tech Mono | Deep space & violet |

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
