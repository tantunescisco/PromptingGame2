/* ============================================
   GAME.JS — Prompt Quest: All Levels & Engine
   ============================================ */

"use strict";

const APP_VERSION = "2026.07.28.22";

// GAME DATA is loaded from game-data.js before this runtime.

// ============================================================
// GAME STATE
// ============================================================
const GameState = {
  currentLevel: 0,
  currentExercise: 0,
  score: 0,
  totalScore: 0,
  badges: [],
  selectedChoice: null,
  matchingState: { selected: null, pairs: {} },
  hintUsed: false,
  answers: {},
  playerName: 'Player',
  levelStartTime: 0,
  levelElapsed: 0,
  timerInterval: null,
  levelTimes: [],
  pollInterval: null,
  fireworksInterval: null,
  completionUiTimeouts: [],
  _parallaxCleanup: null,
  levelExercises: [],  // randomly selected exercises for the current level
  streak: 0,
  mastery: {},
  replayMode: false,
  currentStage: 'welcome'
};

const ProgressStore = {
  _lsKey: 'pq_progress_v1',
  _historyKey: 'pq_completed_levels_v1',

  _normalizeName(name) {
    return String(name || '').trim().toLowerCase();
  },

  _loadAll() {
    try { return JSON.parse(localStorage.getItem(this._lsKey)) || {}; }
    catch { return {}; }
  },

  _saveAll(all) {
    try { localStorage.setItem(this._lsKey, JSON.stringify(all)); } catch {}
  },

  load(name) {
    const key = this._normalizeName(name);
    if (!key) return null;
    return this._loadAll()[key] || null;
  },

  save(progress) {
    const key = this._normalizeName(progress?.playerName);
    if (!key) return;
    const all = this._loadAll();
    all[key] = { ...progress, savedAt: Date.now() };
    this._saveAll(all);
  },

  clear(name) {
    const key = this._normalizeName(name);
    if (!key) return;
    const all = this._loadAll();
    delete all[key];
    this._saveAll(all);
  },

  _loadCompletionHistory() {
    try { return JSON.parse(localStorage.getItem(this._historyKey)) || {}; }
    catch { return {}; }
  },

  completedLevels(name) {
    const key = this._normalizeName(name);
    const levels = key ? this._loadCompletionHistory()[key] : [];
    return Array.isArray(levels) ? levels.filter(Number.isInteger) : [];
  },

  markCompleted(name, levelIndex) {
    const key = this._normalizeName(name);
    if (!key || !Number.isInteger(levelIndex)) return;
    const history = this._loadCompletionHistory();
    const levels = Array.isArray(history[key]) ? history[key] : [];
    if (!levels.includes(levelIndex)) levels.push(levelIndex);
    history[key] = levels.sort((left, right) => left - right);
    try { localStorage.setItem(this._historyKey, JSON.stringify(history)); } catch {}
  }
};

// Scoreboard is loaded from scoreboard.js before this runtime.

// ============================================================
// ADMIN MODE
// ============================================================
const AdminMode = {
  showLogin() {
    const modal = document.getElementById('admin-login-modal');
    if (!modal) return;
    document.getElementById('admin-login-error').classList.add('hidden');
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('admin-email').focus(), 60);
  },

  closeLogin() {
    document.getElementById('admin-login-modal')?.classList.add('hidden');
  },

  async handleLogin() {
    const email = document.getElementById('admin-email')?.value.trim();
    const password = document.getElementById('admin-password')?.value;
    const service = await Scoreboard._firebaseService();
    let isAdmin = false;
    try { isAdmin = !!service && await service.signInAdmin(email, password); } catch {}
    if (isAdmin) {
      this._activateAdminLevelButtons();
      this.closeLogin();
    } else {
      document.getElementById('admin-login-error')?.classList.remove('hidden');
    }
  },

  _activateAdminLevelButtons() {
    [0, 1, 2, 3, 4].forEach(i => {
      const el = document.getElementById('lp-btn-' + i);
      if (!el) return;
      if (el.classList.contains('admin-clickable')) return;
      el.classList.add('admin-clickable');
      el.title = 'Admin: click to jump to this level';
      el.addEventListener('click', () => AdminMode.jumpToLevel(i));
    });
    const banner = document.getElementById('admin-mode-banner');
    if (banner) banner.classList.remove('hidden');
    const previewArea = document.getElementById('admin-preview-area');
    if (previewArea) previewArea.classList.remove('hidden');
  },

  exitAdminMode() {
    [0, 1, 2, 3, 4].forEach(i => {
      const el = document.getElementById('lp-btn-' + i);
      if (!el) return;
      const clone = el.cloneNode(true);
      clone.classList.remove('admin-clickable');
      clone.title = '';
      el.replaceWith(clone);
    });
    const banner = document.getElementById('admin-mode-banner');
    if (banner) banner.classList.add('hidden');
    const previewArea = document.getElementById('admin-preview-area');
    if (previewArea) previewArea.classList.add('hidden');
    Scoreboard._firebaseService().then(service => service?.signOutAdmin());
  },

  showResetLeaderboardConfirmation() {
    const modal = document.getElementById('admin-reset-modal');
    if (!modal) return;
    document.getElementById('admin-reset-error')?.classList.add('hidden');
    modal.classList.remove('hidden');
  },

  closeResetLeaderboardConfirmation() {
    document.getElementById('admin-reset-modal')?.classList.add('hidden');
  },

  async resetLeaderboard() {
    const confirmButton = document.getElementById('admin-reset-confirm-btn');
    const error = document.getElementById('admin-reset-error');
    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.textContent = 'Deleting...';
    }
    error?.classList.add('hidden');
    try {
      await Scoreboard.resetLeaderboard();
      this.closeResetLeaderboardConfirmation();
      await GameEngine._renderWelcomeLeaderboard();
    } catch (resetError) {
      if (error) {
        error.textContent = resetError?.message || 'Unable to reset the leaderboard.';
        error.classList.remove('hidden');
      }
    } finally {
      if (confirmButton) {
        confirmButton.disabled = false;
        confirmButton.textContent = 'Delete Scores';
      }
    }
  },

  jumpToLevel(levelIndex) {
    const nameInput = document.getElementById('player-name-input');
    const name = nameInput ? nameInput.value.trim() : '';
    GameState.playerName = (name.length >= 3 && name.length <= 20) ? name : 'Admin';
    GameState.currentLevel = levelIndex;
    GameState.score = 0;
    GameState.totalScore = 0;
    GameState.badges = [];
    GameState.answers = {};
    GameState.levelTimes = [];
    setTheme(`level-${levelIndex + 1}`);
    GameEngine.showLevelIntro();
  },

  previewVictory() {
    GameState.playerName = GameState.playerName || 'Admin';
    GameState.totalScore = Scoreboard._maxOverallScore();
    GameState.levelTimes = [30000, 45000, 60000, 40000, 50000];
    GameState.badges = ['🌟', '💡', '🏆', '⚙️', '🤖'];
    GameEngine.showGameComplete();
  },

  async previewLevelComplete(levelIndex) {
    const level = GAME_DATA.levels[levelIndex];
    GameState.playerName = GameState.playerName || 'Admin';
    GameState.currentLevel = levelIndex;
    GameState.score = Scoreboard._maxLevelScore(level.id);
    GameState.totalScore = GameState.score;
    GameState.answers = { 0: true, 1: true, 2: true, 3: true };
    GameState.levelExercises = level.exercises.slice(0, 4);
    GameState.levelTimes = Array.from({ length: levelIndex + 1 }, (_, idx) => 42000 + idx * 6000);
    GameState.badges = GAME_DATA.levels
      .slice(0, levelIndex)
      .map(level => level.completeBadge);
    setTheme(`level-${levelIndex + 1}`);
    MusicEngine.playLevelComplete(levelIndex);
    await GameEngine.showLevelCompletePreview(levelIndex);
  }
};

const AboutModal = {
  _cachedHtml: null,

  open() {
    const modal = document.getElementById('about-modal');
    const versionEl = document.getElementById('about-version');
    if (!modal || !versionEl) return;
    versionEl.textContent = `Version ${APP_VERSION}`;
    modal.classList.remove('hidden');
    this._loadReadme();
  },

  close() {
    document.getElementById('about-modal')?.classList.add('hidden');
  },

  async _loadReadme() {
    const container = document.getElementById('about-readme-content');
    if (!container) return;
    if (this._cachedHtml) {
      container.innerHTML = this._cachedHtml;
      container.scrollTop = 0;
      return;
    }

    container.innerHTML = '<p class="about-loading">Loading guide...</p>';
    try {
      const response = await fetch(`ABOUT.md?v=${encodeURIComponent(APP_VERSION)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`ABOUT request failed with ${response.status}`);
      const markdown = await response.text();
      this._cachedHtml = this._markdownToHtml(markdown);
      container.innerHTML = this._cachedHtml;
      container.scrollTop = 0;
    } catch {
      container.innerHTML = '<p class="about-error">Could not load the in-game guide for this build.</p>';
    }
  },

  _markdownToHtml(markdown) {
    const lines = String(markdown || '').replace(/\r/g, '').split('\n');
    const html = [];
    let paragraph = [];
    let listType = null;
    let listItems = [];
    let codeFence = null;
    let codeLines = [];

    const flushParagraph = () => {
      if (!paragraph.length) return;
      html.push(`<p>${this._inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    };

    const flushList = () => {
      if (!listType || !listItems.length) return;
      html.push(`<${listType}>${listItems.map(item => `<li>${this._inline(item)}</li>`).join('')}</${listType}>`);
      listType = null;
      listItems = [];
    };

    const flushCode = () => {
      if (!codeFence) return;
      html.push(`<pre><code>${escHtml(codeLines.join('\n'))}</code></pre>`);
      codeFence = null;
      codeLines = [];
    };

    const parseTable = startIndex => {
      const tableLines = [];
      let index = startIndex;
      while (index < lines.length && /^\|.*\|\s*$/.test(lines[index].trim())) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      if (tableLines.length < 2 || !/^\|?[\s:-]+\|[\s|:-]*$/.test(tableLines[1])) {
        return null;
      }

      const splitRow = row => row.split('|').slice(1, -1).map(cell => cell.trim());
      const headers = splitRow(tableLines[0]);
      const bodyRows = tableLines.slice(2).map(splitRow);
      const thead = `<thead><tr>${headers.map(cell => `<th>${this._inline(cell)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${bodyRows.map(row => `<tr>${row.map(cell => `<td>${this._inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      return {
        html: `<table>${thead}${tbody}</table>`,
        nextIndex: index
      };
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();

      if (trimmed.startsWith('```')) {
        flushParagraph();
        flushList();
        if (codeFence) {
          flushCode();
        } else {
          codeFence = trimmed.slice(3).trim() || 'plain';
        }
        continue;
      }

      if (codeFence) {
        codeLines.push(line);
        continue;
      }

      const table = /^\|.*\|\s*$/.test(trimmed) ? parseTable(index) : null;
      if (table) {
        flushParagraph();
        flushList();
        html.push(table.html);
        index = table.nextIndex - 1;
        continue;
      }

      if (!trimmed) {
        flushParagraph();
        flushList();
        continue;
      }

      if (/^---+$/.test(trimmed)) {
        flushParagraph();
        flushList();
        html.push('<hr>');
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
      if (headingMatch) {
        flushParagraph();
        flushList();
        const level = headingMatch[1].length;
        html.push(`<h${level}>${this._inline(headingMatch[2])}</h${level}>`);
        continue;
      }

      const quoteMatch = trimmed.match(/^>\s?(.*)$/);
      if (quoteMatch) {
        flushParagraph();
        flushList();
        html.push(`<blockquote>${this._inline(quoteMatch[1])}</blockquote>`);
        continue;
      }

      const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
      if (unorderedMatch) {
        flushParagraph();
        if (listType && listType !== 'ul') flushList();
        listType = 'ul';
        listItems.push(unorderedMatch[1]);
        continue;
      }

      const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
      if (orderedMatch) {
        flushParagraph();
        if (listType && listType !== 'ol') flushList();
        listType = 'ol';
        listItems.push(orderedMatch[1]);
        continue;
      }

      if (listType) flushList();
      paragraph.push(trimmed);
    }

    flushParagraph();
    flushList();
    flushCode();
    return html.join('');
  },

  _inline(text) {
    return escHtml(text)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  }
};

// ============================================================
// TIMER
// ============================================================
const Timer = {
  start(initialElapsed = 0) {
    GameState.levelStartTime = Date.now() - initialElapsed;
    GameState.levelElapsed = initialElapsed;
    clearInterval(GameState.timerInterval);
    const renderElapsed = totalMs => {
      const secs = Math.floor(totalMs / 1000);
      const mins = Math.floor(secs / 60);
      const ss = String(secs % 60).padStart(2, '0');
      const el = document.getElementById('timer-display');
      if (el) el.textContent = `⏱ ${mins}:${ss}`;
      GameState.levelElapsed = totalMs;
    };
    renderElapsed(initialElapsed);
    GameState.timerInterval = setInterval(() => {
      const elapsed = Date.now() - GameState.levelStartTime;
      renderElapsed(elapsed);
    }, 500);
  },

  stop() {
    clearInterval(GameState.timerInterval);
    GameState.timerInterval = null;
    GameState.levelElapsed = Date.now() - GameState.levelStartTime;
    return GameState.levelElapsed;
  },

  format(ms) {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const ss = String(secs % 60).padStart(2, '0');
    return `${mins}:${ss}`;
  }
};

// ============================================================
// MUSIC ENGINE  (Web Audio API — procedural, no files needed)
// Each level has a distinct generative music style
// ============================================================
const MusicEngine = {
  ctx: null,
  masterGain: null,
  enabled: true,
  currentLevel: null,
  schedulers: [],     // handles returned by setInterval/setTimeout
  oscillators: [],    // active oscillators to stop

  sfxGain: null,

  _ctx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.21;
      this.masterGain.connect(this.ctx.destination);
      // Separate gain bus for SFX — louder than music
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.55;
      this.sfxGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  toggle() {
    this.enabled = !this.enabled;
    const btn = document.getElementById('music-toggle');
    btn?.classList.toggle('muted', !this.enabled);
    if (this.masterGain) this.masterGain.gain.value = this.enabled ? 0.21 : 0;
    if (this.enabled) {
      this._resumeCurrentTrack();
    } else if (!this.enabled) {
      this._stopAll();
    }
  },

  _resumeCurrentTrack() {
    const stage = GameState.currentStage;
    if (stage === 'welcome') {
      this.playWelcome();
      return;
    }
    if (stage === 'game-complete') {
      this.playVictory();
      return;
    }
    if ((stage === 'level-complete' || stage === 'level-evolution') && Number.isInteger(GameState.currentLevel)) {
      this.playLevelComplete(GameState.currentLevel);
      return;
    }
    if (Number.isInteger(GameState.currentLevel)) {
      this.play(GameState.currentLevel);
      return;
    }
    this.playWelcome();
  },

  play(levelIndex) {
    this._stopAll();
    this.currentLevel = levelIndex;
    if (!this.enabled) return;
    const ctx = this._ctx();
    // Level theme 0→4
    [
      this._playLevel1.bind(this),
      this._playLevel2.bind(this),
      this._playLevel3.bind(this),
      this._playLevel4.bind(this),
      this._playLevel5.bind(this)
    ][levelIndex]?.(ctx);
  },

  playLevelComplete(levelIndex) {
    this._stopAll();
    this.currentLevel = null;
    if (!this.enabled) return;
    const ctx = this._ctx();
    [
      this._playLevel1Complete.bind(this),
      this._playLevel2Complete.bind(this),
      this._playLevel3Complete.bind(this),
      this._playLevel4Complete.bind(this),
      this._playLevel5Complete.bind(this)
    ][levelIndex]?.(ctx);
  },

  _stopAll() {
    this.schedulers.forEach(h => clearInterval(h));
    this.schedulers = [];
    this.oscillators.forEach(o => { try { o.stop(); } catch {} });
    this.oscillators = [];
  },

  _note(ctx, freq, start, dur, type = 'sine', gainVal = 0.22) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gainVal, start + 0.02);
    g.gain.linearRampToValueAtTime(0, start + dur);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(start);
    osc.stop(start + dur + 0.05);
    this.oscillators.push(osc);
  },

  // ── Welcome screen: upbeat lo-fi launch — 104 BPM, D minor, warm pads + crisp percussion
  playWelcome() {
    this._stopAll();
    this.currentLevel = null;
    if (!this.enabled) return;
    const ctx = this._ctx();

    // 104 BPM: quarter = 577 ms, 8th = 288 ms
    const q = 577;   // quarter note ms
    const e = 288;   // 8th note ms

    // D minor pentatonic: D3 F3 G3 A3 C4 D4
    const pent = [146.83, 174.61, 196, 220, 261.63, 293.66];

    // ── 8 distinct 8-step lead phrases ──────────────────────────────────
    // ── Sparse lo-fi melody (12 phrases × 8 steps × 353ms ≈ 34s cycle) ──
    const ph0 = [0, null, 2, null, 3, null, null, null];    // D  .  G  .  A  .  .  .
    const ph1 = [null, 2, null, 3, null, 4, null, null];    // .  G  .  A  .  C  .  .
    const ph2 = [3, null, null, 2, null, 0, null, null];    // A  .  .  G  .  D  .  .
    const ph3 = [null, null, 4, null, 3, null, 2, null];    // .  .  C  .  A  .  G  .
    const ph4 = [5, null, null, null, 3, null, null, 0];    // D'.  .  .  A  .  .  D
    const ph5 = [null, null, null, 2, null, null, 3, null]; // very sparse
    const ph6 = [0, 2, null, null, 3, 2, null, null];       // double note start
    const ph7 = [3, null, 2, null, 0, null, null, null];    // descend home
    const sequence = [ph0, ph1, ph2, ph0, ph3, ph5, ph6, ph4, ph0, ph7, ph2, ph5];
    let gs = 0;

    const melodTick = () => {
      const now    = ctx.currentTime;
      const phrase = sequence[Math.floor(gs / 8) % sequence.length];
      const m      = phrase[gs % 8];
      if (m !== null) {
        this._note(ctx, pent[m], now, 0.48, 'sine', 0.105);
        if (Math.random() < 0.35) this._note(ctx, pent[m] * 2, now, 0.24, 'sine', 0.03);
      }
      gs++;
    };
    melodTick();
    this.schedulers.push(setInterval(melodTick, e));

    // ── Warm pad chords — Dm Bb F C (each lasts 4 quarter notes ≈ 2.82s) ──
    const padChords = [
      [73.42,  174.61, 220],    // Dm: D2 F3 A3
      [58.27,  146.83, 174.61], // Bb: Bb1 D3 F3
      [87.31,  220,    261.63], // F:  F2 A3 C4
      [65.41,  164.81, 196],    // C:  C2 E3 G3
    ];
    let ci = 0;
    const padTick = () => {
      const now   = ctx.currentTime;
      const chord = padChords[ci % padChords.length];
      chord.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const lpf = ctx.createBiquadFilter();
        const g   = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq * (1 + (i === 1 ? 0.003 : i === 2 ? -0.002 : 0));
        lpf.type = 'lowpass'; lpf.frequency.value = 480 + i * 80; lpf.Q.value = 0.5;
        const dur = (q * 4) / 1000;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.037, now + 0.4);
        g.gain.setValueAtTime(0.037, now + dur - 0.4);
        g.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(lpf); lpf.connect(g); g.connect(this.masterGain);
        osc.start(now); osc.stop(now + dur + 0.1);
        this.oscillators.push(osc);
      });
      ci++;
    };
    padTick();
    this.schedulers.push(setInterval(padTick, q * 4));

    // ── Walking bass — root notes, following chord, every quarter note ──
    const bassRoots = [73.42, 58.27, 87.31, 65.41]; // Dm Bb F C
    let bi = 0;
    const bassTick = () => {
      const now  = ctx.currentTime;
      const root = bassRoots[Math.floor(bi / 4) % bassRoots.length];
      const movement = [1, 1, 1.5, 1]; // slight movement on beat 3
      this._note(ctx, root * movement[bi % 4], now, 0.52, 'sine', 0.13);
      bi++;
    };
    bassTick();
    this.schedulers.push(setInterval(bassTick, q));

    // ── Rhythm: kick + snare + hi-hat in a single 8th-note tick ──
    // Kick beats 1&3: ri%8===0, ri%8===4
    // Snare beats 2&4: ri%8===2, ri%8===6
    let ri = 0;
    const rhythmTick = () => {
      const now = ctx.currentTime;
      if (ri % 8 === 0 || ri % 8 === 4) {              // kick
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(75, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);
        g.gain.setValueAtTime(0.11, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(g); g.connect(this.masterGain);
        osc.start(now); osc.stop(now + 0.2);
        this.oscillators.push(osc);
      }
      if (ri % 8 === 2 || ri % 8 === 6) {              // snare (soft, lo-fi)
        const len  = Math.floor(ctx.sampleRate * 0.1);
        const buf  = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
        const src  = ctx.createBufferSource(); src.buffer = buf;
        const bpf  = ctx.createBiquadFilter(); bpf.type = 'bandpass';
        bpf.frequency.value = 2200; bpf.Q.value = 0.9;
        const g = ctx.createGain(); g.gain.value = 0.034;
        src.connect(bpf); bpf.connect(g); g.connect(this.masterGain);
        src.start(now);
      }
      {                                                  // hi-hat (every 8th)
        const vol     = ri % 2 === 0 ? 0.024 : 0.013;
        const hatLen  = Math.floor(ctx.sampleRate * 0.014);
        const hatBuf  = ctx.createBuffer(1, hatLen, ctx.sampleRate);
        const hatData = hatBuf.getChannelData(0);
        for (let i = 0; i < hatLen; i++) hatData[i] = (Math.random() * 2 - 1) * (1 - i / hatLen);
        const hatSrc  = ctx.createBufferSource(); hatSrc.buffer = hatBuf;
        const hatFilt = ctx.createBiquadFilter(); hatFilt.type = 'highpass';
        hatFilt.frequency.value = 9000;
        const hatG = ctx.createGain(); hatG.gain.value = vol;
        hatSrc.connect(hatFilt); hatFilt.connect(hatG); hatG.connect(this.masterGain);
        hatSrc.start(now);
      }
      ri++;
    };
    rhythmTick();
    this.schedulers.push(setInterval(rhythmTick, e));

    // ── Vinyl crackle — sparse pops at very low volume ──
    const crackTick = () => {
      const now  = ctx.currentTime;
      const len  = Math.floor(ctx.sampleRate * 2);
      const buf  = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() < 0.0015 ? (Math.random() * 2 - 1) * 0.6 : 0;
      }
      const src = ctx.createBufferSource(); src.buffer = buf;
      const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 3500;
      const g   = ctx.createGain(); g.gain.value = 0.02;
      src.connect(lpf); lpf.connect(g); g.connect(this.masterGain);
      src.start(now); src.stop(now + 2);
    };
    crackTick();
    this.schedulers.push(setInterval(crackTick, 2000));
  },

  // ── Level 1: Ancient tribal — D minor pentatonic drone, temple bells, 136 BPM pulse
  _playLevel1(ctx) {
    const scale = [146.83, 174.61, 196, 220, 261.63, 293.66];
    const beatMs = 440;

    [73.42, 110].forEach(freq => {
      const osc = ctx.createOscillator();
      const lpf = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      lpf.type = 'lowpass'; lpf.frequency.value = 320; lpf.Q.value = 0.8;
      g.gain.value = 0.028;
      osc.connect(lpf); lpf.connect(g); g.connect(this.masterGain);
      osc.start();
      this.oscillators.push(osc);
    });

    const sequence = [
      [0, null, 2, null, 3, null, 2, null],
      [null, 2, null, 3, null, 5, null, null],
      [3, null, 2, null, 0, null, 2, null],
      [5, null, 3, null, 2, null, 0, null],
      [0, null, null, 2, null, 3, null, null],
      [2, null, 3, null, 5, null, 3, null]
    ];
    let step = 0;
    const melodyTick = () => {
      const now = ctx.currentTime;
      const phrase = sequence[Math.floor(step / 8) % sequence.length];
      const note = phrase[step % 8];
      if (note !== null) {
        this._note(ctx, scale[note], now, 0.48, 'triangle', 0.11);
        this._note(ctx, scale[note] * 2, now + 0.03, 0.22, 'sine', 0.025);
      }
      step++;
    };
    melodyTick();
    this.schedulers.push(setInterval(melodyTick, beatMs));

    let drum = 0;
    const drumTick = () => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(drum % 4 === 0 ? 78 : 60, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.18);
      g.gain.setValueAtTime(drum % 4 === 0 ? 0.13 : 0.09, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(g); g.connect(this.masterGain);
      osc.start(now); osc.stop(now + 0.28);
      this.oscillators.push(osc);
      drum++;
    };
    drumTick();
    this.schedulers.push(setInterval(drumTick, beatMs));

    const bellTick = () => {
      const now = ctx.currentTime;
      this._note(ctx, 587.33, now, 1.2, 'sine', 0.04);
      this._note(ctx, 880, now + 0.08, 1.0, 'sine', 0.025);
    };
    bellTick();
    this.schedulers.push(setInterval(bellTick, beatMs * 8));
  },

  // ── Level 2: Classical antiquity — D Dorian, lyre triangle, driving 194 BPM pulse
  _playLevel2(ctx) {
    const scale = [146.83, 164.81, 174.61, 196, 220, 246.94, 261.63, 293.66];
    const beatMs = 310;

    const sequence = [
      [0, 2, 4, null, 5, 4, 2, null],
      [4, 5, 7, null, 5, 4, 2, null],
      [0, null, 2, 4, null, 5, null, 4],
      [5, 4, 2, null, 4, 2, 0, null],
      [3, 4, 5, null, 4, 3, 2, null],
      [7, 5, 4, null, 2, null, 0, null]
    ];
    let step = 0;
    const melodyTick = () => {
      const now = ctx.currentTime;
      const phrase = sequence[Math.floor(step / 8) % sequence.length];
      const note = phrase[step % 8];
      if (note !== null) {
        this._note(ctx, scale[note] * 2, now, 0.26, 'triangle', 0.15);
        if (step % 4 === 0) this._note(ctx, scale[note] * 4, now, 0.16, 'sine', 0.035);
      }
      step++;
    };
    melodyTick();
    this.schedulers.push(setInterval(melodyTick, beatMs));

    const counter = [null, 0, null, null, 2, null, null, null, null, 4, null, null, 5, null, null, null];
    let counterStep = 0;
    const counterTick = () => {
      const note = counter[counterStep % counter.length];
      if (note !== null) this._note(ctx, scale[note] * 3, ctx.currentTime, 0.34, 'triangle', 0.04);
      counterStep++;
    };
    counterTick();
    this.schedulers.push(setInterval(counterTick, beatMs));

    const bassRoots = [73.42, 98, 110, 82.41];
    let bassIndex = 0;
    const bassTick = () => {
      const now = ctx.currentTime;
      const freq = bassRoots[bassIndex++ % bassRoots.length];
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const dur = (beatMs * 4) / 1000;
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.08, now + 0.22);
      g.gain.setValueAtTime(0.08, now + dur - 0.26);
      g.gain.linearRampToValueAtTime(0, now + dur);
      osc.connect(g); g.connect(this.masterGain);
      osc.start(now); osc.stop(now + dur + 0.1);
      this.oscillators.push(osc);
    };
    bassTick();
    this.schedulers.push(setInterval(bassTick, beatMs * 4));

    let pulse = 0;
    const pulseTick = () => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pulse % 4 === 0 ? 92 : 58, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);
      g.gain.setValueAtTime(pulse % 4 === 0 ? 0.085 : 0.042, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(g); g.connect(this.masterGain);
      osc.start(now); osc.stop(now + 0.18);
      this.oscillators.push(osc);
      pulse++;
    };
    pulseTick();
    this.schedulers.push(setInterval(pulseTick, beatMs));
  },

  // ── Level 3: Industrial revolution — C mixolydian, sawtooth pistons, 273 BPM drive
  _playLevel3(ctx) {
    const scale = [130.81, 146.83, 164.81, 174.61, 196, 220, 233.08, 261.63];
    const beatMs = 220;

    [65.41, 98].forEach(freq => {
      const osc = ctx.createOscillator();
      const lpf = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      lpf.type = 'lowpass'; lpf.frequency.value = 300; lpf.Q.value = 0.6;
      g.gain.value = 0.022;
      osc.connect(lpf); lpf.connect(g); g.connect(this.masterGain);
      osc.start();
      this.oscillators.push(osc);
    });

    const sequence = [
      [0, 2, 4, null, 4, 2, 4, null],
      [4, 5, 4, null, 2, null, 4, null],
      [0, null, 4, null, 6, null, 4, null],
      [6, 4, 2, null, 4, 2, 0, null],
      [0, 2, null, 4, null, 6, null, 4],
      [4, 2, 0, null, 2, 4, null, null]
    ];
    let step = 0;
    const melodyTick = () => {
      const now = ctx.currentTime;
      const phrase = sequence[Math.floor(step / 8) % sequence.length];
      const note = phrase[step % 8];
      if (note !== null) {
        this._note(ctx, scale[note], now, 0.14, 'sawtooth', 0.11);
        this._note(ctx, scale[note] * 2, now, 0.08, 'square', 0.03);
      }
      step++;
    };
    melodyTick();
    this.schedulers.push(setInterval(melodyTick, beatMs));

    let piston = 0;
    const pistonTick = () => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(piston % 4 === 0 ? 62 : 46.25, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.08);
      g.gain.setValueAtTime(piston % 4 === 0 ? 0.1 : 0.07, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(g); g.connect(this.masterGain);
      osc.start(now); osc.stop(now + 0.15);
      this.oscillators.push(osc);
      piston++;
    };
    pistonTick();
    this.schedulers.push(setInterval(pistonTick, beatMs));

    const clankTick = () => {
      const now = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * 0.05);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 0.7);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bpf = ctx.createBiquadFilter(); bpf.type = 'bandpass';
      bpf.frequency.value = 3200; bpf.Q.value = 1.6;
      const g = ctx.createGain(); g.gain.value = 0.04;
      src.connect(bpf); bpf.connect(g); g.connect(this.masterGain);
      src.start(now);
    };
    clankTick();
    this.schedulers.push(setInterval(clankTick, beatMs * 4));
  },

  // ── Level 4: Information age — C pentatonic 2 octaves, sine+click, rapid 364 BPM sequencer
  _playLevel4(ctx) {
    const scale = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.26];
    const beatMs = 165;

    const sequence = [
      [0, null, 2, null, 4, null, 2, null],
      [1, null, 3, null, 4, null, 3, null],
      [0, 1, null, 2, null, 4, null, 5],
      [5, null, 4, null, 3, null, 2, null],
      [0, null, null, 2, null, 3, null, 4],
      [4, 3, null, 2, null, 1, null, 0]
    ];
    let step = 0;
    const melodyTick = () => {
      const now = ctx.currentTime;
      const phrase = sequence[Math.floor(step / 8) % sequence.length];
      const note = phrase[step % 8];
      if (note !== null) {
        this._note(ctx, scale[note], now, 0.1, 'sine', 0.16);
        this._note(ctx, scale[note] * 2, now + 0.04, 0.08, 'triangle', 0.03);
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.015), ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain(); g.gain.value = 0.045;
        src.connect(g); g.connect(this.masterGain);
        src.start(now);
      }
      step++;
    };
    melodyTick();
    this.schedulers.push(setInterval(melodyTick, beatMs));

    const padChords = [
      [130.81, 164.81, 220],
      [146.83, 196, 246.94],
      [110, 164.81, 220],
      [130.81, 196, 261.63]
    ];
    let chordIndex = 0;
    const chordTick = () => {
      const now = ctx.currentTime;
      padChords[chordIndex++ % padChords.length].forEach(freq => {
        this._note(ctx, freq, now, 0.72, 'sine', 0.035);
      });
    };
    chordTick();
    this.schedulers.push(setInterval(chordTick, beatMs * 8));

    this.schedulers.push(setInterval(() => {
      this._note(ctx, 65.41, ctx.currentTime, 0.14, 'sawtooth', 0.1);
    }, beatMs * 2));
  },

  // ── Level 5: Stellar singularity — A minor, sawtooth/square, high-energy 444 BPM sequencer
  _playLevel5(ctx) {
    const scale = [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 329.63];
    const beatMs = 135;

    const sequence = [
      [0, 2, 4, 6, 4, 2, 0, 2],
      [5, 7, 6, 5, 7, 5, 4, 2],
      [6, 5, 4, 2, 4, 5, 6, 5],
      [0, null, 4, null, 6, null, 4, null],
      [7, 7, 6, 4, 6, 7, 7, null],
      [0, 2, null, 4, null, 2, 0, null],
      [4, 5, 6, 7, 6, 5, 4, null],
      [6, 5, 4, 2, 0, 2, 4, 5]
    ];
    let step = 0;
    const melodyTick = () => {
      const now = ctx.currentTime;
      const phrase = sequence[Math.floor(step / 8) % sequence.length];
      const note = phrase[step % 8];
      if (note !== null) {
        const jump = step % 8 === 0 && Math.random() < 0.35;
        this._note(ctx, scale[note] * (jump ? 2 : 1), now, 0.12, 'sawtooth', 0.14);
        this._note(ctx, scale[note] * (jump ? 4 : 2), now + 0.03, 0.09, 'square', 0.05);
        if (step % 4 === 0) this._note(ctx, scale[note] * 0.5, now, 0.14, 'triangle', 0.03);
      }
      if (step % 8 === 0) {
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 2200;
        const g = ctx.createGain(); g.gain.value = 0.03;
        src.connect(filt); filt.connect(g); g.connect(this.masterGain);
        src.start(now);
      }
      step++;
    };
    melodyTick();
    this.schedulers.push(setInterval(melodyTick, beatMs));

    const harmony = [null, null, 0, null, null, 4, null, null, null, 2, null, null, null, 5, null, null];
    let harmonyStep = 0;
    const harmonyTick = () => {
      const note = harmony[harmonyStep % harmony.length];
      if (note !== null) this._note(ctx, scale[note] * 2, ctx.currentTime, 0.1, 'square', 0.04);
      harmonyStep++;
    };
    harmonyTick();
    this.schedulers.push(setInterval(harmonyTick, beatMs));

    this.schedulers.push(setInterval(() => {
      this._note(ctx, 55, ctx.currentTime, 0.12, 'square', 0.15);
    }, beatMs * 4));
  },

  _playLevel1Complete(ctx) {
    const scale = [146.83, 174.61, 196, 220, 261.63, 293.66];
    const beatMs = 320;
    const sequence = [
      [0, 2, 3, 5, 3, 2, 0, null],
      [2, 3, 5, 3, 2, 0, 2, null],
      [5, 3, 2, 0, 2, 3, 5, null],
      [3, 2, 0, null, 2, 3, 5, null]
    ];
    let step = 0;
    const tick = () => {
      const phrase = sequence[Math.floor(step / 8) % sequence.length];
      const note = phrase[step % 8];
      if (note !== null) {
        this._note(ctx, scale[note], ctx.currentTime, 0.36, 'triangle', 0.14);
        this._note(ctx, scale[note] * 2, ctx.currentTime + 0.04, 0.22, 'sine', 0.03);
      }
      step++;
    };
    tick();
    this.schedulers.push(setInterval(tick, beatMs));
    this.schedulers.push(setInterval(() => {
      this._note(ctx, 587.33, ctx.currentTime, 0.9, 'sine', 0.045);
    }, beatMs * 8));
  },

  _playLevel2Complete(ctx) {
    const scale = [146.83, 164.81, 174.61, 196, 220, 246.94, 261.63, 293.66];
    const beatMs = 270;
    const sequence = [
      [0, 2, 4, 5, 7, 5, 4, null],
      [4, 5, 7, 5, 4, 2, 0, null],
      [2, 4, 5, 7, 5, 4, 2, null],
      [0, 2, 4, null, 5, 4, 2, null]
    ];
    let step = 0;
    const tick = () => {
      const phrase = sequence[Math.floor(step / 8) % sequence.length];
      const note = phrase[step % 8];
      if (note !== null) {
        this._note(ctx, scale[note] * 2, ctx.currentTime, 0.24, 'triangle', 0.16);
        if (step % 4 === 0) this._note(ctx, scale[note] * 4, ctx.currentTime, 0.14, 'sine', 0.04);
      }
      step++;
    };
    tick();
    this.schedulers.push(setInterval(tick, beatMs));
  },

  _playLevel3Complete(ctx) {
    const scale = [130.81, 146.83, 164.81, 174.61, 196, 220, 233.08, 261.63];
    const beatMs = 200;
    const sequence = [
      [0, 2, 4, 6, 4, 2, 0, null],
      [4, 6, 4, 2, 4, 6, 7, null],
      [7, 6, 4, 2, 0, 2, 4, null],
      [4, 2, 0, null, 2, 4, 6, null]
    ];
    let step = 0;
    const tick = () => {
      const phrase = sequence[Math.floor(step / 8) % sequence.length];
      const note = phrase[step % 8];
      if (note !== null) {
        this._note(ctx, scale[note], ctx.currentTime, 0.16, 'sawtooth', 0.11);
        this._note(ctx, scale[note] * 2, ctx.currentTime, 0.08, 'square', 0.035);
      }
      step++;
    };
    tick();
    this.schedulers.push(setInterval(tick, beatMs));
  },

  _playLevel4Complete(ctx) {
    const scale = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.26];
    const beatMs = 155;
    const sequence = [
      [0, 2, 4, 5, 4, 2, 0, null],
      [1, 3, 4, 6, 4, 3, 1, null],
      [5, 4, 3, 2, 1, 0, 2, null],
      [0, null, 2, null, 4, null, 5, null]
    ];
    let step = 0;
    const tick = () => {
      const phrase = sequence[Math.floor(step / 8) % sequence.length];
      const note = phrase[step % 8];
      if (note !== null) {
        this._note(ctx, scale[note], ctx.currentTime, 0.1, 'sine', 0.16);
        this._note(ctx, scale[note] * 2, ctx.currentTime + 0.03, 0.08, 'triangle', 0.025);
      }
      step++;
    };
    tick();
    this.schedulers.push(setInterval(tick, beatMs));
  },

  _playLevel5Complete(ctx) {
    const scale = [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 329.63];
    const beatMs = 125;
    const sequence = [
      [0, 2, 4, 6, 7, 6, 4, 2],
      [5, 7, 6, 5, 7, 6, 4, 2],
      [7, 6, 5, 4, 2, 0, 2, 4],
      [0, null, 4, 6, 7, null, 6, 4]
    ];
    let step = 0;
    const tick = () => {
      const phrase = sequence[Math.floor(step / 8) % sequence.length];
      const note = phrase[step % 8];
      if (note !== null) {
        this._note(ctx, scale[note], ctx.currentTime, 0.11, 'sawtooth', 0.13);
        this._note(ctx, scale[note] * 2, ctx.currentTime + 0.03, 0.08, 'square', 0.05);
      }
      step++;
    };
    tick();
    this.schedulers.push(setInterval(tick, beatMs));
  },

  // ── Victory / Game Complete: cinematic orchestral-synth victory loop
  playVictory() {
    this._stopAll();
    this.currentLevel = null;
    if (!this.enabled) return;
    const ctx = this._ctx();

    const bpm = 112;
    const quarterMs = Math.round((60000 / bpm));
    const eighthMs = Math.round(quarterMs / 2);
    const introMs = quarterMs * 8;
    const themeGain = ctx.createGain();
    themeGain.gain.setValueAtTime(0, ctx.currentTime);
    themeGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.2);
    themeGain.connect(this.masterGain);

    const scale = [293.66, 329.63, 369.99, 392, 440, 493.88, 554.37, 587.33];
    const progressions = [
      [146.83, 293.66, 369.99, 440],
      [123.47, 246.94, 369.99, 493.88],
      [98, 196, 293.66, 392],
      [110, 220, 329.63, 440]
    ];

    const playVoice = (freq, start, dur, {
      wave = 'triangle',
      gain = 0.08,
      attack = 0.02,
      release = 0.18,
      filterType = null,
      filterFreq = 1200,
      q = 0.7,
      detune = 0,
      vibrato = 0
    } = {}) => {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, start);
      if (detune) osc.detune.setValueAtTime(detune, start);
      if (vibrato > 0) {
        osc.frequency.linearRampToValueAtTime(freq * (1 + vibrato), start + dur * 0.5);
        osc.frequency.linearRampToValueAtTime(freq, start + dur);
      }
      amp.gain.setValueAtTime(0, start);
      amp.gain.linearRampToValueAtTime(gain, start + attack);
      amp.gain.setValueAtTime(gain, Math.max(start + attack, start + dur - release));
      amp.gain.linearRampToValueAtTime(0, start + dur);

      let lastNode = osc;
      if (filterType) {
        const filter = ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.setValueAtTime(filterFreq, start);
        filter.Q.value = q;
        osc.connect(filter);
        lastNode = filter;
      }

      lastNode.connect(amp);
      amp.connect(themeGain);
      osc.start(start);
      osc.stop(start + dur + 0.05);
      this.oscillators.push(osc);
    };

    const playStack = (freq, start, dur, profile) => {
      profile.forEach(layer => {
        playVoice(freq * (layer.ratio ?? 1), start + (layer.offset ?? 0), dur, layer);
      });
    };

    const playChord = (freqs, start, dur, gain = 0.04) => {
      freqs.forEach((freq, index) => {
        playStack(freq, start, dur, [
          { wave: 'sawtooth', gain: gain * 0.9, attack: 0.32, release: 0.55, filterType: 'lowpass', filterFreq: 840 + index * 110, detune: -4 },
          { wave: 'sawtooth', gain: gain * 0.9, attack: 0.38, release: 0.6, filterType: 'lowpass', filterFreq: 1040 + index * 120, detune: 4 },
          { wave: 'triangle', gain: gain * 0.45, attack: 0.24, release: 0.4, filterType: 'lowpass', filterFreq: 620 + index * 60 }
        ]);
      });
    };

    const playBrass = (freq, start, dur, gain = 0.11) => {
      playStack(freq, start, dur, [
        { wave: 'sawtooth', gain, attack: 0.05, release: 0.22, filterType: 'lowpass', filterFreq: 1600, q: 1.1, detune: -5, vibrato: 0.01 },
        { wave: 'square', gain: gain * 0.58, attack: 0.04, release: 0.18, filterType: 'lowpass', filterFreq: 1250, q: 0.8, detune: 5 }
      ]);
    };

    const playSub = (freq, start, dur, gain = 0.12) => {
      playStack(freq, start, dur, [
        { wave: 'sine', gain, attack: 0.01, release: 0.18 },
        { wave: 'triangle', gain: gain * 0.3, attack: 0.01, release: 0.12, filterType: 'lowpass', filterFreq: 180 }
      ]);
    };

    const playGlock = (freq, start, gain = 0.045) => {
      playStack(freq, start, 0.46, [
        { wave: 'sine', gain, attack: 0.005, release: 0.42 },
        { wave: 'triangle', ratio: 2, gain: gain * 0.45, attack: 0.003, release: 0.26 },
        { wave: 'sine', ratio: 3, gain: gain * 0.18, attack: 0.002, release: 0.18 }
      ]);
    };

    const playNoisePulse = (start, dur = 0.08, gain = 0.02, band = 3800, highpass = 1800) => {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const decay = Math.pow(1 - i / len, 1.6);
        data[i] = (Math.random() * 2 - 1) * decay;
      }
      const src = ctx.createBufferSource();
      const hp = ctx.createBiquadFilter();
      const bp = ctx.createBiquadFilter();
      const amp = ctx.createGain();
      hp.type = 'highpass';
      hp.frequency.value = highpass;
      bp.type = 'bandpass';
      bp.frequency.value = band;
      bp.Q.value = 1.2;
      amp.gain.setValueAtTime(gain, start);
      amp.gain.exponentialRampToValueAtTime(0.001, start + dur);
      src.buffer = buf;
      src.connect(hp);
      hp.connect(bp);
      bp.connect(amp);
      amp.connect(themeGain);
      src.start(start);
      src.stop(start + dur + 0.02);
    };

    const introChords = [progressions[0], progressions[1], progressions[2], progressions[3]];
    introChords.forEach((chord, bar) => {
      const start = ctx.currentTime + bar * quarterMs * 2;
      playChord(chord, start, 1.9, 0.032 + bar * 0.004);
      playSub(chord[0] * 0.5, start, 1.2, 0.09);
    });

    [
      [4, 0.2, 0.65], [5, 0.85, 0.7], [6, 1.55, 0.72], [7, 2.2, 0.9],
      [6, 2.95, 0.65], [7, 3.45, 1.15], [5, 4.2, 0.85], [7, 4.9, 1.25]
    ].forEach(([note, offset, dur]) => {
      playBrass(scale[note], ctx.currentTime + offset, dur, note >= 6 ? 0.13 : 0.1);
      playBrass(scale[note] * 0.5, ctx.currentTime + offset, dur + 0.1, 0.05);
    });

    [
      [7, 1.25], [6, 2.45], [7, 3.75], [5, 4.65]
    ].forEach(([note, offset]) => {
      playGlock(scale[note] * 2, ctx.currentTime + offset, 0.04);
      playGlock(scale[note], ctx.currentTime + offset + 0.18, 0.026);
    });

    const loopMelody = [
      [4, null, 5, null, 7, null, 6, null],
      [7, null, 6, 5, null, 4, null, 2],
      [4, 5, null, 7, null, 6, 5, null],
      [7, null, 5, null, 4, null, 2, null],
      [5, null, 6, null, 7, null, 6, null],
      [4, null, 5, 7, null, 5, 4, null],
      [2, null, 4, null, 5, null, 7, null],
      [6, 5, null, 4, null, 2, null, null]
    ];
    const loopPlucks = [
      [7, null, null, 6, null, null, 5, null],
      [null, 6, null, null, 5, null, null, 4],
      [7, null, 6, null, null, 5, null, null],
      [null, 5, null, 4, null, null, 2, null]
    ];

    const startLoop = () => {
      let melodyStep = 0;
      let pluckStep = 0;
      let bassStep = 0;
      let chordStep = 0;
      let percStep = 0;

      const melodyTick = () => {
        const now = ctx.currentTime;
        const phrase = loopMelody[Math.floor(melodyStep / 8) % loopMelody.length];
        const note = phrase[melodyStep % 8];
        if (note !== null) {
          playBrass(scale[note], now, 0.46, 0.075 + (melodyStep % 8 === 0 ? 0.018 : 0));
          if (melodyStep % 4 === 0) playBrass(scale[note] * 0.5, now, 0.6, 0.035);
        }
        melodyStep++;
      };
      melodyTick();
      this.schedulers.push(setInterval(melodyTick, quarterMs));

      const pluckTick = () => {
        const now = ctx.currentTime;
        const phrase = loopPlucks[Math.floor(pluckStep / 8) % loopPlucks.length];
        const note = phrase[pluckStep % 8];
        if (note !== null) {
          playGlock(scale[note] * 2, now, 0.03);
          playVoice(scale[note] * 2, now, 0.32, {
            wave: 'triangle',
            gain: 0.022,
            attack: 0.01,
            release: 0.22,
            filterType: 'lowpass',
            filterFreq: 2200
          });
        }
        pluckStep++;
      };
      pluckTick();
      this.schedulers.push(setInterval(pluckTick, eighthMs));

      const chordTick = () => {
        const chord = progressions[chordStep++ % progressions.length];
        playChord(chord, ctx.currentTime, 2.4, 0.034);
      };
      chordTick();
      this.schedulers.push(setInterval(chordTick, quarterMs * 4));

      const bassRoots = [73.42, 61.74, 49, 55];
      const bassPattern = [1, 1, 1.5, 1];
      const bassTick = () => {
        const root = bassRoots[Math.floor(bassStep / 4) % bassRoots.length];
        const multiplier = bassPattern[bassStep % bassPattern.length];
        playSub(root * multiplier, ctx.currentTime, 0.5, bassStep % 4 === 0 ? 0.125 : 0.095);
        bassStep++;
      };
      bassTick();
      this.schedulers.push(setInterval(bassTick, quarterMs));

      const percTick = () => {
        const now = ctx.currentTime;
        if (percStep % 8 === 0 || percStep % 8 === 4) {
          playSub(41.2, now, 0.22, 0.08);
        }
        if (percStep % 8 === 2 || percStep % 8 === 6) {
          playNoisePulse(now, 0.11, 0.018, 2100, 900);
        }
        playNoisePulse(now, 0.045, percStep % 2 === 0 ? 0.012 : 0.008, 5200, 3200);
        if (percStep % 8 === 7) {
          playNoisePulse(now, 0.06, 0.01, 6400, 4100);
        }
        percStep++;
      };
      percTick();
      this.schedulers.push(setInterval(percTick, eighthMs));
    };

    this.schedulers.push(setTimeout(startLoop, introMs));
  }
};


// ============================================================
// SOUND ENGINE — Themed correct / wrong SFX via Web Audio API
// ============================================================
Object.assign(MusicEngine, {
  _voice(ctx, freq, start, duration, options = {}) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    oscillator.type = options.wave || 'sine';
    oscillator.frequency.setValueAtTime(freq, start);
    if (options.detune) oscillator.detune.setValueAtTime(options.detune, start);
    filter.type = options.filter || 'lowpass';
    filter.frequency.setValueAtTime(options.cutoff || 1800, start);
    filter.Q.value = options.resonance || 0.4;
    const attack = options.attack ?? 0.025;
    const release = options.release ?? Math.min(0.25, duration * 0.35);
    const level = options.gain ?? 0.06;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(level, start + attack);
    gain.gain.setValueAtTime(level, Math.max(start + attack, start + duration - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
    this.oscillators.push(oscillator);
  },

  _wash(ctx, chord, start, duration, options = {}) {
    chord.forEach((freq, index) => {
      this._voice(ctx, freq, start, duration, {
        wave: options.wave || 'sawtooth', gain: (options.gain || 0.025) * (index === 0 ? 1.1 : 0.8),
        cutoff: options.cutoff || 700, attack: options.attack ?? 0.45,
        release: options.release ?? 0.7, detune: index % 2 ? 5 : -5
      });
    });
  },

  _noise(ctx, start, duration, gain = 0.025, cutoff = 2800) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index++) data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, 1.8);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass'; filter.frequency.value = cutoff; filter.Q.value = 0.8;
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter); filter.connect(amp); amp.connect(this.masterGain);
    source.start(start); source.stop(start + duration + 0.02);
  },

  _drum(ctx, start, accent = false) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(accent ? 94 : 68, start);
    oscillator.frequency.exponentialRampToValueAtTime(32, start + 0.16);
    gain.gain.setValueAtTime(accent ? 0.105 : 0.065, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    oscillator.connect(gain); gain.connect(this.masterGain);
    oscillator.start(start); oscillator.stop(start + 0.22);
    this.oscillators.push(oscillator);
  },

  _startLoop(callback, interval) {
    callback();
    this.schedulers.push(setInterval(callback, interval));
  },

  playWelcome() {
    this._stopAll(); this.currentLevel = null;
    if (!this.enabled) return;
    const ctx = this._ctx();
    const chordMs = 6000;
    const chords = [[65.41, 130.81, 196, 293.66], [55, 110, 164.81, 246.94], [73.42, 146.83, 220, 329.63], [49, 98, 146.83, 220]];
    let chordStep = 0;
    this._startLoop(() => {
      const now = ctx.currentTime;
      this._wash(ctx, chords[chordStep++ % chords.length], now, 5.7, { gain: 0.018, cutoff: 540, attack: 1.15, release: 1.2 });
      this._voice(ctx, chords[(chordStep - 1) % chords.length][0] * 0.5, now, 5.4, { wave: 'sine', gain: 0.03, cutoff: 260, attack: 1.3, release: 1.1 });
    }, chordMs);
    const stars = [392, null, 493.88, 587.33, null, 659.26, 587.33, null, 493.88, null, 440, null];
    let starStep = 0;
    this._startLoop(() => {
      const note = stars[starStep++ % stars.length];
      if (note) {
        const now = ctx.currentTime;
        this._voice(ctx, note, now, 1.8, { wave: 'sine', gain: 0.028, cutoff: 3600, attack: 0.05, release: 1.1 });
        this._voice(ctx, note * 2, now + 0.12, 0.9, { wave: 'triangle', gain: 0.008, cutoff: 4800, attack: 0.02, release: 0.55 });
      }
    }, 750);
  },

  _playLevel1(ctx) {
    [55, 82.41].forEach(freq => this._voice(ctx, freq, ctx.currentTime, 12, { wave: 'triangle', gain: 0.025, cutoff: 330, attack: 0.8, release: 1.4 }));
    const scale = [146.83, 164.81, 196, 220, 261.63, 293.66];
    const phrase = [0, null, 2, null, 3, 2, null, 0, null, 2, 4, null, 3, null, 2, null];
    let step = 0;
    this._startLoop(() => {
      const now = ctx.currentTime; const note = phrase[step % phrase.length];
      if (note !== null) this._voice(ctx, scale[note], now, 0.48, { wave: 'triangle', gain: 0.09, cutoff: 1150, attack: 0.012, release: 0.35 });
      if (step % 4 === 0) this._drum(ctx, now, step % 8 === 0);
      if (step % 8 === 5) this._noise(ctx, now, 0.09, 0.015, 900);
      step++;
    }, 375);
  },

  _playLevel2(ctx) {
    const scale = [146.83, 164.81, 174.61, 196, 220, 246.94, 293.66];
    const phrase = [0, 2, 4, null, 5, 4, 2, null, 4, 5, 6, 5, 4, null, 2, null];
    let step = 0;
    this._startLoop(() => {
      const now = ctx.currentTime; const note = phrase[step % phrase.length];
      if (note !== null) {
        this._voice(ctx, scale[note] * 2, now, 0.31, { wave: 'triangle', gain: 0.1, cutoff: 1750, attack: 0.008, release: 0.22 });
        if (step % 4 === 0) this._voice(ctx, scale[note], now, 0.46, { wave: 'sine', gain: 0.035, cutoff: 850, attack: 0.02, release: 0.3 });
      }
      if (step % 4 === 0) this._drum(ctx, now, true);
      if (step % 4 === 2) this._noise(ctx, now, 0.07, 0.018, 1800);
      step++;
    }, 278);
  },

  _playLevel3(ctx) {
    const roots = [65.41, 73.42, 87.31, 98]; let step = 0;
    this._startLoop(() => {
      const now = ctx.currentTime; const root = roots[Math.floor(step / 4) % roots.length];
      this._voice(ctx, root, now, 0.18, { wave: 'square', gain: 0.08, cutoff: 430, attack: 0.008, release: 0.1 });
      if (step % 2 === 0) this._voice(ctx, root * 4, now, 0.12, { wave: 'sawtooth', gain: 0.05, cutoff: 1050, attack: 0.005, release: 0.08 });
      if (step % 4 === 0) this._drum(ctx, now, true);
      if (step % 4 === 2) this._noise(ctx, now, 0.06, 0.036, 2600);
      if (step % 8 === 6) this._voice(ctx, root * 2, now, 0.44, { wave: 'sawtooth', gain: 0.055, cutoff: 940, attack: 0.02, release: 0.2 });
      step++;
    }, 255);
  },

  _playLevel4(ctx) {
    const scale = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];
    const arp = [0, 2, 4, 5, 4, 2, 1, 3, 5, 6, 5, 3, 2, 4, 5, 2]; let step = 0;
    this._startLoop(() => {
      const now = ctx.currentTime; const note = scale[arp[step % arp.length]];
      this._voice(ctx, note, now, 0.16, { wave: 'sine', gain: 0.085, cutoff: 4200, attack: 0.006, release: 0.11 });
      this._voice(ctx, note * 2, now + 0.045, 0.1, { wave: 'triangle', gain: 0.018, cutoff: 5300, attack: 0.004, release: 0.07 });
      if (step % 4 === 0) this._voice(ctx, [65.41, 73.42, 55, 65.41][Math.floor(step / 4) % 4], now, 0.26, { wave: 'sawtooth', gain: 0.07, cutoff: 480, attack: 0.01, release: 0.16 });
      if (step % 2 === 1) this._noise(ctx, now, 0.018, 0.009, 6900);
      step++;
    }, 145);
  },

  _playLevel5(ctx) {
    const chords = [[55, 110, 164.81, 220], [49, 98, 146.83, 220], [65.41, 130.81, 196, 261.63], [73.42, 146.83, 220, 293.66]];
    let chord = 0;
    this._startLoop(() => this._wash(ctx, chords[chord++ % chords.length], ctx.currentTime, 2.7, { gain: 0.022, cutoff: 1100, attack: 0.28, release: 0.5 }), 2800);
    const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25]; const sequence = [0, 2, 4, 6, 4, 5, 3, 1, 2, 4, 6, 5, 4, 2, 1, 3]; let step = 0;
    this._startLoop(() => {
      const now = ctx.currentTime; const note = scale[sequence[step % sequence.length]];
      this._voice(ctx, note, now, 0.13, { wave: 'sawtooth', gain: 0.075, cutoff: 2100, attack: 0.006, release: 0.09 });
      this._voice(ctx, note * 2, now + 0.025, 0.1, { wave: 'sine', gain: 0.024, cutoff: 5200, attack: 0.006, release: 0.07 });
      if (step % 4 === 0) this._drum(ctx, now, true);
      if (step % 4 === 2) this._noise(ctx, now, 0.04, 0.022, 4300);
      step++;
    }, 128);
  },

  _completion(ctx, scale, wave, tempo, flourish) {
    const pattern = [0, 2, 4, 5, 7, 5, 4, 2, 4, 5, 7, 9, 7, 5, 4, 7]; let step = 0;
    this._startLoop(() => {
      const now = ctx.currentTime; const note = scale[pattern[step % pattern.length] % scale.length];
      this._voice(ctx, note, now, tempo / 1000 * 0.86, { wave, gain: 0.12, cutoff: 2200, attack: 0.008, release: 0.16 });
      if (step % 4 === 0) this._voice(ctx, note * 0.5, now, 0.22, { wave: 'sine', gain: 0.055, cutoff: 520, attack: 0.01, release: 0.12 });
      if (step % 8 === 7) flourish(now, note);
      step++;
    }, tempo);
  },

  _playLevel1Complete(ctx) { this._completion(ctx, [146.83, 164.81, 196, 220, 261.63, 293.66], 'triangle', 285, (now, note) => this._voice(ctx, note * 2, now, 1.05, { wave: 'sine', gain: 0.045, cutoff: 2800, attack: 0.02, release: 0.7 })); },
  _playLevel2Complete(ctx) { this._completion(ctx, [146.83, 164.81, 174.61, 196, 220, 246.94, 293.66], 'triangle', 235, (now, note) => this._voice(ctx, note * 2, now, 0.75, { wave: 'sine', gain: 0.04, cutoff: 3300, attack: 0.01, release: 0.5 })); },
  _playLevel3Complete(ctx) { this._completion(ctx, [130.81, 146.83, 164.81, 196, 220, 261.63, 293.66], 'sawtooth', 190, now => this._noise(ctx, now, 0.08, 0.026, 3100)); },
  _playLevel4Complete(ctx) { this._completion(ctx, [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33], 'sine', 165, (now, note) => this._voice(ctx, note * 2, now, 0.4, { wave: 'triangle', gain: 0.035, cutoff: 5100, attack: 0.005, release: 0.24 })); },
  _playLevel5Complete(ctx) { this._completion(ctx, [220, 261.63, 293.66, 329.63, 392, 440, 523.25], 'sawtooth', 135, (now, note) => this._voice(ctx, note * 2, now, 0.56, { wave: 'sine', gain: 0.04, cutoff: 4800, attack: 0.01, release: 0.35 })); },

  playVictory() {
    this._stopAll(); this.currentLevel = null;
    if (!this.enabled) return;
    const ctx = this._ctx();
    const chords = [[130.81, 261.63, 329.63, 392], [110, 220, 329.63, 440], [98, 196, 293.66, 392], [146.83, 293.66, 369.99, 440]];
    let chord = 0;
    this._startLoop(() => {
      const now = ctx.currentTime; const notes = chords[chord++ % chords.length];
      this._wash(ctx, notes, now, 3.55, { gain: 0.035, cutoff: 1500, attack: 0.22, release: 0.6 });
      this._voice(ctx, notes[0] * 0.5, now, 0.45, { wave: 'sine', gain: 0.11, cutoff: 360, attack: 0.01, release: 0.22 });
      this._drum(ctx, now, true); this._drum(ctx, now + 1.0, false);
    }, 2000);
    const fanfare = [392, 440, 493.88, 587.33, 659.26, 587.33, 493.88, 659.26, 783.99, 659.26, 587.33, 783.99]; let step = 0;
    this._startLoop(() => {
      const now = ctx.currentTime; const note = fanfare[step % fanfare.length];
      this._voice(ctx, note, now, 0.36, { wave: 'sawtooth', gain: 0.115, cutoff: 2450, attack: 0.018, release: 0.19 });
      this._voice(ctx, note * 2, now + 0.04, 0.25, { wave: 'sine', gain: 0.025, cutoff: 4400, attack: 0.01, release: 0.16 });
      if (step % 4 === 3) this._noise(ctx, now, 0.05, 0.018, 4600);
      step++;
    }, 250);
  }
});

const SoundEngine = {
  enabled: true,

  toggle() {
    this.enabled = !this.enabled;
    const btn = document.getElementById('sfx-toggle');
    btn.classList.toggle('muted', !this.enabled);
    if (MusicEngine.sfxGain) MusicEngine.sfxGain.gain.value = this.enabled ? 0.55 : 0;
  },

  _g() { return MusicEngine.sfxGain || MusicEngine._ctx() && MusicEngine.sfxGain; },
  _ctx() { return MusicEngine._ctx(); },

  _note(freq, start, dur, type = 'sine', gain = 0.35) {
    const ctx = this._ctx(); if (!ctx) return;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(g); g.connect(this._g());
    osc.start(start); osc.stop(start + dur + 0.05);
  },

  _noise(start, dur, gainVal, hipass = 0) {
    const ctx = this._ctx(); if (!ctx) return;
    const buf  = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src  = ctx.createBufferSource(); src.buffer = buf;
    const gl   = ctx.createGain(); gl.gain.value = gainVal;
    if (hipass > 0) {
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hipass;
      src.connect(f); f.connect(gl);
    } else { src.connect(gl); }
    gl.connect(this._g()); src.start(start);
  },

  playCorrect(levelIndex) {
    if (!this.enabled) return;
    const ctx = this._ctx(); if (!ctx) return;
    const now = ctx.currentTime;
    switch (levelIndex) {
      case 0: // 🌈 Childish — bouncy ascending xylophone arpeggio
        [261.63, 329.63, 392, 523.25, 659.26].forEach((f, i) =>
          this._note(f, now + i * 0.08, 0.28, 'triangle', 0.45));
        break;

      case 1: // ⚔️ Adventure — triumphant 4-note fanfare
        [392, 523.25, 659.26, 783.99].forEach((f, i) =>
          this._note(f, now + i * 0.1, 0.22, 'square', 0.28));
        this._note(783.99, now + 0.4, 0.4, 'square', 0.25);
        break;

      case 2: // 🔮 Fantasy — magical shimmer bells
        [1046.5, 1318.5, 1567.98, 2093].forEach((f, i) => {
          this._note(f,       now + i * 0.06, 0.5, 'sine', 0.3);
          this._note(f * 0.5, now + i * 0.06, 0.5, 'sine', 0.12);
        });
        break;

      case 3: // ⚙️ Corporate — clean double notification ping
        this._note(1046.5, now,        0.12, 'sine', 0.4);
        this._note(1318.5, now + 0.14, 0.35, 'sine', 0.32);
        break;

      case 4: // 🤖 Cyberpunk — synth sweep + digital stutter
        { const osc = ctx.createOscillator(), g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.28);
          g.gain.setValueAtTime(0.32, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
          osc.connect(g); g.connect(this._g()); osc.start(now); osc.stop(now + 0.35);
        }
        [0, 0.14, 0.22, 0.28].forEach(t => this._note(880, now + t, 0.04, 'square', 0.12));
        this._noise(now, 0.06, 0.08, 6000);
        break;
    }
  },

  playLevelComplete(levelIndex) {
    if (!this.enabled) return;
    const ctx = this._ctx(); if (!ctx) return;
    const now = ctx.currentTime;
    switch (levelIndex) {
      case 0: // 🌈 Playground — jubilant ascending scale + sparkle burst
        [261.63, 329.63, 392, 523.25, 659.26, 783.99, 1046.5].forEach((f, i) =>
          this._note(f, now + i * 0.1, 0.45, 'triangle', 0.5));
        [1046.5, 1318.5, 1567.98, 2093].forEach((f, i) =>
          this._note(f, now + 0.72 + i * 0.07, 0.55, 'sine', 0.35));
        this._noise(now + 1.1, 0.18, 0.12, 4000);
        break;

      case 1: // ⚔️ Kingdom — heroic trumpet fanfare
        [[392, 0], [392, 0.12], [523.25, 0.24], [392, 0.42], [523.25, 0.54], [659.26, 0.7]].forEach(([f, t]) =>
          this._note(f, now + t, 0.2, 'square', 0.3));
        this._note(783.99, now + 0.95, 0.65, 'square', 0.32);
        this._note(659.26, now + 0.95, 0.65, 'triangle', 0.18);
        break;

      case 2: // 🔮 Cave — magical chime cascade + reverb swell
        [523.25, 659.26, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => {
          this._note(f,       now + i * 0.09, 0.9, 'sine', 0.35);
          this._note(f * 2,   now + i * 0.09 + 0.04, 0.5, 'sine', 0.12);
        });
        this._note(2093, now + 0.58, 1.2, 'sine', 0.28);
        break;

      case 3: // ⚙️ Factory — sharp corporate success sting
        [[1046.5, 0], [1318.5, 0.14], [1046.5, 0.28], [1567.98, 0.42]].forEach(([f, t]) =>
          this._note(f, now + t, 0.16, 'sine', 0.38));
        this._note(2093, now + 0.62, 0.55, 'sine', 0.4);
        this._note(1567.98, now + 0.62, 0.55, 'sine', 0.2);
        break;

      case 4: // 🤖 Architect — cyberpunk power chord + rising synth
        { const osc = ctx.createOscillator(), g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(110, now);
          osc.frequency.exponentialRampToValueAtTime(1760, now + 0.7);
          g.gain.setValueAtTime(0.38, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
          osc.connect(g); g.connect(this._g()); osc.start(now); osc.stop(now + 0.8);
        }
        [440, 554.37, 659.26, 880, 1108.73, 1318.51].forEach((f, i) =>
          this._note(f, now + 0.55 + i * 0.07, 0.4, 'square', 0.18));
        this._noise(now + 0.6, 0.25, 0.1, 5000);
        break;
    }
  },

  playWrong(levelIndex) {
    if (!this.enabled) return;
    const ctx = this._ctx(); if (!ctx) return;
    const now = ctx.currentTime;
    switch (levelIndex) {
      case 0: // 🌈 Childish — sad descending wah-wah
        [392, 349.23, 311.13, 261.63].forEach((f, i) =>
          this._note(f, now + i * 0.16, 0.22, 'sine', 0.38));
        break;

      case 1: // ⚔️ Adventure — trombone slide down
        { const osc = ctx.createOscillator(), g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(233, now);
          osc.frequency.linearRampToValueAtTime(110, now + 0.65);
          g.gain.setValueAtTime(0.32, now);
          g.gain.linearRampToValueAtTime(0.001, now + 0.7);
          osc.connect(g); g.connect(this._g()); osc.start(now); osc.stop(now + 0.72);
        }
        break;

      case 2: // 🔮 Fantasy — dark impact + low rumble
        this._note(55,    now,        0.55, 'sine',     0.45);
        this._note(73.42, now + 0.05, 0.4,  'sawtooth', 0.15);
        this._noise(now, 0.25, 0.25);
        break;

      case 3: // ⚙️ Corporate — two error buzzes
        [now, now + 0.22].forEach(t => this._note(110, t, 0.14, 'square', 0.32));
        break;

      case 4: // 🤖 Cyberpunk — glitch noise + descending saw
        this._noise(now, 0.35, 0.18, 800);
        { const osc = ctx.createOscillator(), g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(40, now + 0.45);
          g.gain.setValueAtTime(0.28, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
          osc.connect(g); g.connect(this._g()); osc.start(now); osc.stop(now + 0.5);
        }
        break;
    }
  }
};

// ============================================================
// UTILITY HELPERS
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const el = document.getElementById(id);
  el.style.display = 'flex';
  void el.offsetWidth;
  el.classList.add('active');

  const quitBtn = document.getElementById('quit-btn');
  if (quitBtn) quitBtn.style.display = id === 'screen-welcome' ? 'none' : 'flex';
  const audioControls = document.getElementById('audio-controls');
  if (audioControls) audioControls.style.display = 'flex';

  document.body.setAttribute('data-screen', id);
  document.body.classList.toggle('welcome', id === 'screen-welcome');
  if (id === 'screen-welcome') {
    GameState.currentStage = 'welcome';
    const nameInput = document.getElementById('player-name-input');
    if (nameInput && GameState.playerName && GameState.playerName !== 'Player') {
      nameInput.value = GameState.playerName;
    }
    GameEngine._renderWelcomeLeaderboard();
    GameEngine._updateWelcomeResumeCta();
  }
}

function setTheme(levelClass) {
  document.body.className = document.body.className
    .replace(/level-\d/g, '')
    .replace(/game-complete/g, '')
    .trim();
  if (levelClass) document.body.classList.add(levelClass);
}

const LEVEL_BACKGROUND_IMAGES = [
  'civil1.png',
  'civil2.png',
  'civil3.png',
  'civil4.png',
  'civil5.png'
];

const FINAL_SYNCHRONIZER_BG = 'civil6.png';
const COMPLETION_BG_IMAGE = `completion.png?v=${encodeURIComponent(APP_VERSION)}`;

const LEVEL_EVOLUTION_MS = 5400;
const FINAL_SYNCHRONIZER_INDEX = 5;

function starRating(correct, total) {
  const pct = correct / total;
  if (pct >= 0.9) return '⭐⭐⭐';
  if (pct >= 0.6) return '⭐⭐';
  return '⭐';
}

// Escape HTML to prevent XSS when rendering user-supplied names in scoreboard
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function analyzeFreeText(answer, exercise) {
  const trimmed = String(answer || '').trim();
  const lower = trimmed.toLowerCase();
  const minLength = exercise.minLength || 30;
  const matched = (exercise.keywords || []).filter(keyword => lower.includes(keyword.toLowerCase()));
  const missing = (exercise.keywords || []).filter(keyword => !matched.includes(keyword));
  const keywordHits = matched.length;
  const fullThreshold = exercise.keywordsForFull || 4;
  const halfThreshold = exercise.keywordsForHalf || 2;
  const minMet = trimmed.length >= minLength;
  const grade = !minMet ? 'none'
    : keywordHits >= fullThreshold ? 'full'
    : keywordHits >= halfThreshold ? 'partial'
    : 'none';
  return { grade, matched, missing, keywordHits, fullThreshold, minLength, minMet, length: trimmed.length };
}

// Freetext scoring — returns 'full', 'partial', or 'none'
// full:    minLength met + keywordHits >= exercise.keywordsForFull  (default 4)
// partial: minLength met + keywordHits >= exercise.keywordsForHalf  (default 2)
// none:    below partial thresholds
function checkFreeText(answer, exercise) {
  return analyzeFreeText(answer, exercise).grade;
}

// ============================================================
// DRAG & DROP for ordering exercises
// ============================================================
let dragSrc = null;

function initDragDrop(list) {
  const items = list.querySelectorAll('.order-item');
  items.forEach(item => {
    item.addEventListener('dragstart', e => {
      dragSrc = item;
      e.dataTransfer.effectAllowed = 'move';
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      dragSrc = null;
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    item.addEventListener('drop', e => {
      e.stopPropagation();
      if (dragSrc !== item) {
        const allItems = [...list.querySelectorAll('.order-item')];
        const srcIdx = allItems.indexOf(dragSrc);
        const dstIdx = allItems.indexOf(item);
        if (srcIdx < dstIdx) {
          list.insertBefore(dragSrc, item.nextSibling);
        } else {
          list.insertBefore(dragSrc, item);
        }
      }
    });
  });
}

// ============================================================
// CHARACTER ENGINE
// Animated 2D character avatars displayed during exercises
// ============================================================
const CharacterEngine = {

  _humanImages: [
    'civil1_human.png',
    'civil2_human.png',
    'civil3_human.png?v=20260529',
    'civil4_human.png',
    'civil5_human.png',
    'civil6_human.png'
  ],

  _svgs: [

    // ── Level 1: Mesopotamian Scribe ─────────────────────────────────────────
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 165">
      <path d="M38 66 Q49 53 62 61 L70 158 Q60 163 50 163 Q40 163 30 158 Z" fill="#f1e1bf" stroke="#c3a075" stroke-width="1.2"/>
      <path d="M43 63 L50 74 L57 63" fill="#e5d0a8" stroke="#c3a075" stroke-width="1"/>
      <path d="M39 67 Q49 73 58 67" fill="none" stroke="#f5ecd6" stroke-width="1.4" opacity="0.7"/>
      <ellipse cx="37" cy="70" rx="4.6" ry="5.2" fill="#c79267"/>
      <ellipse cx="63" cy="70" rx="4.6" ry="5.2" fill="#c79267"/>
      <path d="M34 104 Q50 110 66 104" fill="none" stroke="#caa77e" stroke-width="1.5" opacity="0.75"/>
      <path d="M44 160 Q46 147 47 133" fill="none" stroke="#8e6a45" stroke-width="2.3" stroke-linecap="round"/>
      <path d="M56 160 Q54 147 53 133" fill="none" stroke="#8e6a45" stroke-width="2.3" stroke-linecap="round"/>
      <path d="M35 71 Q24 81 19 95 Q14 109 15 123" fill="none" stroke="#c79267" stroke-width="7" stroke-linecap="round"/>
      <path d="M15 123 Q15 132 18 140" fill="none" stroke="#c79267" stroke-width="6" stroke-linecap="round"/>
      <rect x="5" y="133" width="24" height="18" rx="2.5" fill="#8f643f" stroke="#654525" stroke-width="1.2"/>
      <line x1="9" y1="138" x2="25" y2="138" stroke="#654525" stroke-width="0.9"/>
      <line x1="9" y1="142.5" x2="25" y2="142.5" stroke="#654525" stroke-width="0.9"/>
      <line x1="9" y1="147" x2="21" y2="147" stroke="#654525" stroke-width="0.9"/>
      <g transform="translate(62,70)">
        <g class="char-write-arm">
          <path d="M0 0 Q11 12 16 24" fill="none" stroke="#c79267" stroke-width="7" stroke-linecap="round"/>
          <path d="M16 24 Q19 35 15 49" fill="none" stroke="#c79267" stroke-width="6" stroke-linecap="round"/>
          <path d="M14 47 L1 66" fill="none" stroke="#6f4e2c" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="0" cy="67" r="1.6" fill="#3f2a16"/>
        </g>
      </g>
      <path d="M42 67 Q47 72 50 81 Q53 72 58 67" fill="none" stroke="#d6bf95" stroke-width="2" stroke-linecap="round"/>
      <path d="M40 74 Q50 81 60 74" fill="none" stroke="#c8af83" stroke-width="1.2" opacity="0.55" stroke-linecap="round"/>
      <rect x="45" y="56" width="10" height="8" rx="3" fill="#c79267"/>
      <path d="M35 28 Q36 18 44 15 Q50 13 56 15 Q64 18 65 28 L64 43 Q61 52 56 55 Q50 57 44 55 Q39 52 36 43 Z" fill="#c79267"/>
      <path d="M39 45 Q44 55 50 56 Q56 55 61 45" fill="#b57f5f" opacity="0.2"/>
      <path d="M42 18 Q50 16 58 18" fill="none" stroke="#f0cfb4" stroke-width="1.3" opacity="0.35" stroke-linecap="round"/>
      <path d="M35 28 Q36 17 44 14 Q50 12 56 14 Q64 17 65 28 Q61 20 50 18 Q39 20 35 28Z" fill="#2d1d12"/>
      <path d="M36 28 Q33 39 37 49" fill="none" stroke="#2d1d12" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M64 28 Q67 39 63 49" fill="none" stroke="#2d1d12" stroke-width="3.2" stroke-linecap="round"/>
      <ellipse cx="36" cy="37" rx="2.2" ry="4.5" fill="#b8835d"/>
      <ellipse cx="64" cy="37" rx="2.2" ry="4.5" fill="#b8835d"/>
      <g class="char-eyes">
        <ellipse cx="43.1" cy="36.8" rx="3.5" ry="2.7" fill="#fff7f2"/>
        <circle cx="44" cy="36.9" r="1.65" fill="#1f160f"/>
        <circle cx="44.5" cy="36.3" r="0.55" fill="#fff" opacity="0.82"/>
        <ellipse cx="56.9" cy="36.8" rx="3.5" ry="2.7" fill="#fff7f2"/>
        <circle cx="57.8" cy="36.9" r="1.65" fill="#1f160f"/>
        <circle cx="58.3" cy="36.3" r="0.55" fill="#fff" opacity="0.82"/>
      </g>
      <path d="M38.5 29.5 Q43 27.3 47.6 30" fill="none" stroke="#2d1d12" stroke-width="1.9" stroke-linecap="round"/>
      <path d="M52.4 30 Q57 27.3 61.5 29.5" fill="none" stroke="#2d1d12" stroke-width="1.9" stroke-linecap="round"/>
      <path d="M39.3 33.2 Q43 31.8 46.7 33" fill="none" stroke="#7e543d" stroke-width="0.8" opacity="0.45" stroke-linecap="round"/>
      <path d="M53.3 33 Q57 31.8 60.7 33.2" fill="none" stroke="#7e543d" stroke-width="0.8" opacity="0.45" stroke-linecap="round"/>
      <path d="M50 39.8 Q47.8 45.8 49.5 51" fill="none" stroke="#a87352" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M47 49 Q50 50.3 53 49" fill="none" stroke="#9d6a4f" stroke-width="0.8" opacity="0.45" stroke-linecap="round"/>
      <path d="M44.5 55.2 Q50 57.3 55.5 55.2" fill="none" stroke="#996548" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M45.5 57 Q50 58.6 54.5 57" fill="none" stroke="#7a4f38" stroke-width="0.9" opacity="0.45" stroke-linecap="round"/>
    </svg>`,

    // ── Level 2: Roman/Greek Philosopher-Senator ──────────────────────────────
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 165">
      <g class="char-debate-arm">
        <path d="M0 0 Q11 -9 20 -23" transform="translate(66 72)" fill="none" stroke="#d2a176" stroke-width="7.5" stroke-linecap="round"/>
        <path d="M20 -23 Q25 -37 24 -50" transform="translate(66 72)" fill="none" stroke="#d2a176" stroke-width="6.5" stroke-linecap="round"/>
        <ellipse cx="90" cy="18" rx="5.5" ry="4.3" fill="#d2a176" transform="rotate(-16 90 18)"/>
      </g>
      <path d="M32 66 Q21 90 24 158 L76 158 Q79 92 68 66 Z" fill="#f5f0eb" stroke="#d9cec0" stroke-width="1"/>
      <path d="M25 64 Q15 88 17 150 L24 149 Q24 94 34 68 Z" fill="#e8e1d8" stroke="#d3c6b6" stroke-width="0.8"/>
      <path d="M17 69 Q17 110 19 150 L22 149 Q21 110 21 71 Z" fill="#6b2fa0" opacity="0.92"/>
      <path d="M35 68 Q50 73 66 68" fill="none" stroke="#fffaf2" stroke-width="1.4" opacity="0.65"/>
      <path d="M31 71 Q34 66 39 66" fill="none" stroke="#e7ddd1" stroke-width="6" stroke-linecap="round"/>
      <path d="M61 67 Q65 66 68 70" fill="none" stroke="#f0ece7" stroke-width="7" stroke-linecap="round"/>
      <path d="M43 67 Q47 74 50 82 Q53 74 57 67" fill="none" stroke="#ddd1c4" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M37 70 Q35 105 38 156" fill="none" stroke="#ddd0c4" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M50 68 Q50 108 50 156" fill="none" stroke="#ddd0c4" stroke-width="1" stroke-linecap="round"/>
      <path d="M63 70 Q65 105 62 156" fill="none" stroke="#ddd0c4" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M23 148 Q50 152 77 148 L77 158 Q50 162 23 158 Z" fill="#6b2fa0"/>
      <path d="M32 82 Q26 97 21 117 Q19 123 18 128" fill="none" stroke="#d2a176" stroke-width="6" stroke-linecap="round"/>
      <circle cx="18" cy="129" r="3.8" fill="#d2a176"/>
      <circle cx="66" cy="67" r="3.4" fill="#c7a12a" stroke="#7a5800" stroke-width="0.9"/>
      <circle cx="66" cy="67" r="1.4" fill="#7a5800"/>
      <rect x="45" y="56" width="10" height="8" rx="3" fill="#d2a176"/>
      <path d="M35 27 Q36 17 44 14 Q50 12 56 14 Q64 17 65 27 L64 43 Q61 53 56 56 Q50 58 44 56 Q39 53 36 43 Z" fill="#d2a176"/>
      <path d="M39 45 Q43 56 50 58 Q57 56 61 45" fill="#a8704f" opacity="0.18"/>
      <path d="M42 17 Q50 13 58 17" fill="none" stroke="#f7dec1" stroke-width="1.2" opacity="0.38" stroke-linecap="round"/>
      <path d="M35 27 Q36 18 44 14 Q50 12 56 14 Q64 17 65 27 Q61 20 50 18 Q39 20 35 27Z" fill="#3c2a1b"/>
      <path d="M35 28 Q33 39 36 48" fill="none" stroke="#3c2a1b" stroke-width="3" stroke-linecap="round"/>
      <path d="M65 28 Q67 39 64 48" fill="none" stroke="#3c2a1b" stroke-width="3" stroke-linecap="round"/>
      <path d="M38 50 Q44 59 50 61 Q57 59 62 50" fill="none" stroke="#6f5a4b" stroke-width="4.4" stroke-linecap="round" opacity="0.82"/>
      <path d="M39 25 Q41 22 44 24" fill="none" stroke="#3c2a1b" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M46 24 Q48 21.5 51 24" fill="none" stroke="#3c2a1b" stroke-width="1.4" stroke-linecap="round"/>
      <ellipse cx="32" cy="37" rx="2.2" ry="4.3" fill="#bf8d63"/>
      <ellipse cx="68" cy="37" rx="2.2" ry="4.3" fill="#bf8d63"/>
      <g class="char-eyes">
        <ellipse cx="43.2" cy="36.1" rx="3.35" ry="2.5" fill="#fff8f1"/>
        <circle cx="44" cy="36.3" r="1.55" fill="#23170f"/>
        <circle cx="44.5" cy="35.7" r="0.5" fill="#fff" opacity="0.8"/>
        <ellipse cx="56.8" cy="36.1" rx="3.35" ry="2.5" fill="#fff8f1"/>
        <circle cx="57.6" cy="36.3" r="1.55" fill="#23170f"/>
        <circle cx="58.1" cy="35.7" r="0.5" fill="#fff" opacity="0.8"/>
      </g>
      <path d="M38.5 29 Q43 26.6 47.5 28.7" fill="none" stroke="#3c2a1b" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M52.5 28.7 Q57 26.6 61.5 29" fill="none" stroke="#3c2a1b" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M39.3 32.3 Q42.8 31.2 46.2 32.4" fill="none" stroke="#8c6549" stroke-width="0.75" opacity="0.4" stroke-linecap="round"/>
      <path d="M53.8 32.4 Q57.2 31.2 60.7 32.3" fill="none" stroke="#8c6549" stroke-width="0.75" opacity="0.4" stroke-linecap="round"/>
      <path d="M50 39 Q48.5 45.5 49.4 50.4" fill="none" stroke="#b17d58" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M47.2 48.5 Q50 49.6 52.8 48.5" fill="none" stroke="#9b7150" stroke-width="0.8" opacity="0.45" stroke-linecap="round"/>
      <path d="M44.5 55.5 Q50 56.8 55.5 55.5" fill="none" stroke="#8f6347" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M44.8 57 Q50 58 55.2 57" fill="none" stroke="#6d4a36" stroke-width="0.9" opacity="0.45" stroke-linecap="round"/>
      <path d="M44.5 14 Q50 10 55.5 14" fill="none" stroke="#b18f2d" stroke-width="2" stroke-linecap="round"/>
      <circle cx="41" cy="16" r="1.6" fill="#b18f2d"/>
      <circle cx="59" cy="16" r="1.6" fill="#b18f2d"/>
    </svg>`,

    // ── Level 3: Victorian Engineer ──────────────────────────────────────────
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 165">
      <path d="M37 61 L63 61 L69 72 L72 112 L68 156 Q59 162 50 162 Q41 162 32 156 L28 112 L31 72 Z" fill="#ece7df" stroke="#d1cac1" stroke-width="1"/>
      <path d="M28 72 Q40 65 50 66 Q60 65 72 72 L78 108 Q72 117 70 128 L76 157 Q62 162 50 162 Q38 162 24 157 L30 128 Q28 117 22 108 Z" fill="#4a4a49" stroke="#252525" stroke-width="1.2"/>
      <path d="M37 75 Q50 70 63 75 L67 154 Q59 157 50 157 Q41 157 33 154 Z" fill="#645245" opacity="0.55"/>
      <path d="M39 77 Q50 72 61 77" fill="none" stroke="#8c7a6e" stroke-width="1.2" opacity="0.55"/>
      <path d="M31 75 Q35 71 40 72 Q39 78 36 82 Q32 80 31 75 Z" fill="#e8e1d8" stroke="#d1cac1" stroke-width="1"/>
      <path d="M69 75 Q65 71 60 72 Q61 78 64 82 Q68 80 69 75 Z" fill="#e8e1d8" stroke="#d1cac1" stroke-width="1"/>
      <path d="M34 81 Q29 92 28 105 Q27 118 30 128" fill="none" stroke="#d2c0af" stroke-width="6" stroke-linecap="round"/>
      <path d="M66 81 Q71 92 72 105 Q73 118 70 128" fill="none" stroke="#d2c0af" stroke-width="6" stroke-linecap="round"/>
      <rect x="24" y="104" width="52" height="10.5" rx="3" fill="#5f3d24" stroke="#382113" stroke-width="1"/>
      <g class="char-wrench-pulse">
        <path d="M29 103 L33 96" fill="none" stroke="#c9a017" stroke-width="2.8" stroke-linecap="round"/>
        <circle cx="30.5" cy="104.2" r="2.4" fill="#c9a017"/>
        <ellipse cx="34" cy="95.7" rx="1.8" ry="3" fill="#c9a017"/>
      </g>
      <g class="char-wrench-pulse" style="animation-delay: 0.15s;">
        <path d="M41 104 L45 96" fill="none" stroke="#c9a017" stroke-width="2.8" stroke-linecap="round"/>
        <circle cx="42.5" cy="104.5" r="2.4" fill="#c9a017"/>
        <ellipse cx="46" cy="96" rx="1.8" ry="3" fill="#c9a017"/>
      </g>
      <g class="char-wrench-pulse" style="animation-delay: 0.3s;">
        <path d="M54 104 L58 96" fill="none" stroke="#c9a017" stroke-width="2.8" stroke-linecap="round"/>
        <circle cx="55.5" cy="104.4" r="2.4" fill="#c9a017"/>
        <ellipse cx="59" cy="96" rx="1.8" ry="3" fill="#c9a017"/>
      </g>
      <g class="char-wrench-pulse" style="animation-delay: 0.45s;">
        <path d="M67 103 L71 96" fill="none" stroke="#c9a017" stroke-width="2.8" stroke-linecap="round"/>
        <circle cx="68.5" cy="104.2" r="2.4" fill="#c9a017"/>
        <ellipse cx="72" cy="95.8" rx="1.8" ry="3" fill="#c9a017"/>
      </g>
      <path d="M30 128 Q29 133 31 137" fill="none" stroke="#d2c0af" stroke-width="5" stroke-linecap="round"/>
      <path d="M70 128 Q71 133 69 137" fill="none" stroke="#d2c0af" stroke-width="5" stroke-linecap="round"/>
      <path d="M39 160 Q43 147 44 130" fill="none" stroke="#2a2220" stroke-width="3" stroke-linecap="round"/>
      <path d="M61 160 Q57 147 56 130" fill="none" stroke="#2a2220" stroke-width="3" stroke-linecap="round"/>
      <path d="M44 68 Q47 74 50 80 Q53 74 56 68" fill="none" stroke="#ddd8cf" stroke-width="1.7" stroke-linecap="round"/>
      <rect x="45" y="54" width="10" height="8" rx="3" fill="#d2c0af"/>
      <path d="M36 27 Q37 17 44 13 Q50 11 56 13 Q63 17 64 27 L63 42 Q60 52 55 55 Q50 57 45 55 Q40 52 37 42 Z" fill="#d2c0af"/>
      <path d="M39 42 Q43 53 50 55 Q57 53 61 42" fill="#ad896f" opacity="0.18"/>
      <path d="M41 15 Q50 12 59 15" fill="none" stroke="#f4e0ce" stroke-width="1.2" opacity="0.38" stroke-linecap="round"/>
      <path d="M36 26 Q37 16 44 13 Q50 11 56 13 Q63 16 64 26 Q60 18 50 16 Q40 18 36 26Z" fill="#2f2319"/>
      <path d="M36 27 Q34 38 37 47" fill="none" stroke="#2f2319" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M64 27 Q66 38 63 47" fill="none" stroke="#2f2319" stroke-width="3.2" stroke-linecap="round"/>
      <g class="char-goggle-glow">
        <circle cx="40" cy="20" r="6.4" fill="#545454" stroke="#1f1f1f" stroke-width="1.2"/>
        <circle cx="40" cy="20" r="4.8" fill="#31525c" opacity="0.82"/>
        <circle cx="60" cy="20" r="6.4" fill="#545454" stroke="#1f1f1f" stroke-width="1.2"/>
        <circle cx="60" cy="20" r="4.8" fill="#31525c" opacity="0.82"/>
        <rect x="46" y="18" width="8" height="4" rx="2" fill="#3c3c3c"/>
        <path d="M33 20 Q30 22 29 25" fill="none" stroke="#3a3a3a" stroke-width="2" stroke-linecap="round"/>
        <path d="M67 20 Q70 22 71 25" fill="none" stroke="#3a3a3a" stroke-width="2" stroke-linecap="round"/>
      </g>
      <g class="char-eyes">
        <ellipse cx="42.8" cy="33.3" rx="3.5" ry="2.5" fill="#fff8f2" opacity="0.9"/>
        <circle cx="43.7" cy="33.5" r="1.55" fill="#1e140e"/>
        <ellipse cx="57.2" cy="33.3" rx="3.5" ry="2.5" fill="#fff8f2" opacity="0.9"/>
        <circle cx="58.1" cy="33.5" r="1.55" fill="#1e140e"/>
      </g>
      <path d="M37 28.5 Q41.5 25.5 46 28.2" fill="none" stroke="#2f2319" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M54 28.2 Q58.5 25.5 63 28.5" fill="none" stroke="#2f2319" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M39.5 30.8 Q43.3 29.5 46.5 30.7" fill="none" stroke="#8a644d" stroke-width="0.75" opacity="0.42" stroke-linecap="round"/>
      <path d="M53.5 30.7 Q56.7 29.5 60.5 30.8" fill="none" stroke="#8a644d" stroke-width="0.75" opacity="0.42" stroke-linecap="round"/>
      <path d="M50 38.5 Q48.4 44.6 49.5 49" fill="none" stroke="#a47f66" stroke-width="1.15" stroke-linecap="round"/>
      <path d="M47.3 47.8 Q50 48.9 52.7 47.8" fill="none" stroke="#90705b" stroke-width="0.8" opacity="0.45" stroke-linecap="round"/>
      <path d="M44.5 52 Q50 53.8 55.5 52" fill="none" stroke="#876751" stroke-width="1.35" stroke-linecap="round"/>
      <path d="M45.5 54.2 Q50 55 54.5 54.2" fill="none" stroke="#6c5140" stroke-width="0.85" opacity="0.45" stroke-linecap="round"/>
    </svg>`,

    // ── Level 4: Cyberpunk Hacker ────────────────────────────────────────────
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 165">
      <path d="M24 76 Q34 57 50 55 Q66 57 76 76 L78 157 Q65 162 50 162 Q35 162 22 157 Z" fill="#0a0d15" stroke="#171e2d" stroke-width="1.2"/>
      <path d="M37 76 Q50 67 63 76" fill="none" stroke="#00c8f0" stroke-width="1.1" opacity="0.6"/>
      <path d="M31 78 Q35 72 41 72" fill="none" stroke="#101723" stroke-width="7" stroke-linecap="round"/>
      <path d="M59 72 Q65 72 69 78" fill="none" stroke="#101723" stroke-width="7" stroke-linecap="round"/>
      <path d="M32 78 Q36 73 40 73" fill="none" stroke="#00c8f0" stroke-width="1.3" opacity="0.35" stroke-linecap="round"/>
      <path d="M60 73 Q64 73 68 78" fill="none" stroke="#00c8f0" stroke-width="1.3" opacity="0.35" stroke-linecap="round"/>
      <path d="M34 82 Q50 89 66 82" fill="none" stroke="#1b3652" stroke-width="1.1" opacity="0.45"/>
      <path d="M35 78 Q25 91 16 121" fill="none" stroke="#0b0f18" stroke-width="7" stroke-linecap="round"/>
      <path d="M65 78 Q75 91 84 121" fill="none" stroke="#0b0f18" stroke-width="7" stroke-linecap="round"/>
      <path d="M36 79 Q27 93 18 122" fill="none" stroke="#00c8f0" stroke-width="1.6" opacity="0.45" stroke-linecap="round"/>
      <path d="M64 79 Q73 93 82 122" fill="none" stroke="#00c8f0" stroke-width="1.6" opacity="0.45" stroke-linecap="round"/>
      <path d="M37 160 Q41 147 43 128" fill="none" stroke="#0a0d15" stroke-width="3" stroke-linecap="round"/>
      <path d="M63 160 Q59 147 57 128" fill="none" stroke="#0a0d15" stroke-width="3" stroke-linecap="round"/>
      <path d="M28 38 Q30 17 50 13 Q70 17 72 38 L65 71 Q58 61 50 61 Q42 61 35 71 Z" fill="#090d15" stroke="#151b29" stroke-width="1"/>
      <path d="M37 61 Q44 66 50 76 Q56 66 63 61" fill="none" stroke="#00a7c7" stroke-width="1.4" opacity="0.7"/>
      <path d="M36 30 Q37 21 44 18 Q50 16 56 18 Q63 21 64 30 L63 45 Q60 54 55 57 Q50 59 45 57 Q40 54 37 45 Z" fill="#c18a6f"/>
      <path d="M40 48 Q44 57 50 58 Q56 57 60 48" fill="#915d48" opacity="0.17"/>
      <path d="M35 37 Q36 24 50 21 Q64 24 65 37 Q61 29 50 26 Q39 29 35 37Z" fill="#0a0a0c"/>
      <path d="M35 38 Q33 46 35 54" fill="none" stroke="#0a0a0c" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M65 38 Q67 46 65 54" fill="none" stroke="#0a0a0c" stroke-width="2.8" stroke-linecap="round"/>
      <ellipse class="char-visor" cx="50" cy="36" rx="20" ry="8.8" fill="#092336" stroke="#00c8f0" stroke-width="1.5" opacity="0.92"/>
      <ellipse cx="50" cy="34.5" rx="18" ry="6.5" fill="#26f0ff" opacity="0.12"/>
      <g class="char-visor-code" opacity="0.8">
        <text x="34" y="34" font-family="'Share Tech Mono', monospace" font-size="5.4" fill="#00ffae">01</text>
        <text x="42" y="38" font-family="'Share Tech Mono', monospace" font-size="4.6" fill="#8ef3ff">101</text>
        <text x="55" y="33.5" font-family="'Share Tech Mono', monospace" font-size="5.1" fill="#7d7dff">11</text>
        <text x="62" y="38.5" font-family="'Share Tech Mono', monospace" font-size="4.4" fill="#00ffae">010</text>
      </g>
      <path d="M42 47.5 Q50 49.4 58 47.5" fill="none" stroke="#955f4a" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M42.5 52.2 Q50 54 57.5 52.2" fill="none" stroke="#7c4f3d" stroke-width="1.15" stroke-linecap="round"/>
      <path d="M44 55.4 Q50 56.4 56 55.4" fill="none" stroke="#5d3a2f" stroke-width="0.8" opacity="0.45" stroke-linecap="round"/>
      <path d="M39 64 Q50 69 61 64" fill="none" stroke="#00c8f0" stroke-width="1.2" opacity="0.7"/>
      <rect x="39" y="97" width="22" height="34" rx="4" fill="#07131d" stroke="#00c8f0" stroke-width="1.1" opacity="0.55"/>
      <line x1="28" y1="121" x2="72" y2="121" stroke="#00c8f0" stroke-width="1" opacity="0.35"/>
    </svg>`,

    // ── Level 5: Star Archon ─────────────────────────────────────────────────
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 165">
      <path d="M37 28 Q39 18 45 15 Q50 13 55 15 Q61 18 63 28 L62 42 Q59 52 55 56 Q50 58 45 56 Q41 52 38 42 Z" fill="#d7c7f3" opacity="0.9"/>
      <path d="M39 46 Q44 56 50 57 Q56 56 61 46" fill="#9b7cc8" opacity="0.16"/>
      <path d="M33 36 Q34 19 50 17 Q66 19 67 36" fill="none" stroke="#f4ebff" stroke-width="0.9" opacity="0.5"/>
      <path d="M23 76 Q34 58 50 55 Q66 58 77 76 L76 157 Q63 162 50 162 Q37 162 24 157 Z" fill="#26104d" opacity="0.78"/>
      <path d="M33 73 Q50 64 67 73 L68 156 Q60 159 50 159 Q40 159 32 156 Z" fill="#57248f" opacity="0.46"/>
      <path d="M31 76 Q36 69 42 69" fill="none" stroke="#5b2ca0" stroke-width="7" opacity="0.6" stroke-linecap="round"/>
      <path d="M58 69 Q64 69 69 76" fill="none" stroke="#5b2ca0" stroke-width="7" opacity="0.6" stroke-linecap="round"/>
      <path d="M26 84 Q31 72 36 70" fill="none" stroke="#7f49d0" stroke-width="5.5" opacity="0.35" stroke-linecap="round"/>
      <path d="M74 84 Q69 72 64 70" fill="none" stroke="#7f49d0" stroke-width="5.5" opacity="0.35" stroke-linecap="round"/>
      <path d="M38 80 Q50 87 62 80" fill="none" stroke="#b993ff" stroke-width="1.1" opacity="0.28"/>
      <path d="M41 67 Q46 75 50 85 Q54 75 59 67" fill="none" stroke="#e2d4ff" stroke-width="1.5" opacity="0.6"/>
      <path d="M35 78 Q23 96 16 121" fill="none" stroke="#33125f" stroke-width="7" stroke-linecap="round" opacity="0.85"/>
      <path d="M65 78 Q77 96 84 121" fill="none" stroke="#33125f" stroke-width="7" stroke-linecap="round" opacity="0.85"/>
      <path d="M36 160 Q41 147 43 126" fill="none" stroke="#38156b" stroke-width="3" stroke-linecap="round"/>
      <path d="M64 160 Q59 147 57 126" fill="none" stroke="#38156b" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="50" cy="35" rx="10" ry="6.5" fill="#fff" opacity="0.08"/>
      <circle cx="41" cy="28" r="1.1" fill="#ffffff" opacity="0.95"/>
      <circle cx="47" cy="25" r="0.8" fill="#ffffff" opacity="0.8"/>
      <circle cx="53" cy="30" r="0.9" fill="#ffffff" opacity="0.86"/>
      <circle cx="59" cy="27" r="1" fill="#ffffff" opacity="0.9"/>
      <ellipse cx="44" cy="36" rx="2.2" ry="1.35" fill="#fbf7ff" opacity="0.75"/>
      <ellipse cx="56" cy="36" rx="2.2" ry="1.35" fill="#fbf7ff" opacity="0.75"/>
      <circle cx="44" cy="52" r="0.85" fill="#ffffff" opacity="0.75"/>
      <circle cx="56" cy="48" r="0.7" fill="#ffffff" opacity="0.7"/>
      <circle cx="50" cy="62" r="0.9" fill="#ffffff" opacity="0.78"/>
      <line x1="41" y1="28" x2="47" y2="25" stroke="#ffffff" stroke-width="0.35" opacity="0.35"/>
      <line x1="47" y1="25" x2="53" y2="30" stroke="#ffffff" stroke-width="0.35" opacity="0.32"/>
      <line x1="53" y1="30" x2="59" y2="27" stroke="#ffffff" stroke-width="0.35" opacity="0.32"/>
      <path d="M44 50 Q50 52.4 56 50" fill="none" stroke="#eadcff" stroke-width="1.2" opacity="0.55" stroke-linecap="round"/>
      <path d="M46 53 Q50 54 54 53" fill="none" stroke="#f8f2ff" stroke-width="0.8" opacity="0.35" stroke-linecap="round"/>
      <g class="char-crown-float">
        <g class="char-crown-rotate">
          <ellipse cx="50" cy="16" rx="19" ry="10" fill="none" stroke="#ffffff" stroke-width="1.1" opacity="0.9"/>
        </g>
        <g class="char-crown-rotate-reverse">
          <ellipse cx="50" cy="16" rx="14" ry="7" fill="none" stroke="#f4ebff" stroke-width="0.95" opacity="0.75"/>
        </g>
        <ellipse cx="50" cy="16" rx="8.5" ry="4.2" fill="none" stroke="#ffffff" stroke-width="0.8" opacity="0.6"/>
        <g class="char-crown-pulse">
          <polygon points="50,5 52.8,10.5 50,16 47.2,10.5" fill="#ffffff" opacity="0.9"/>
          <polygon points="35,17 37,20 35,23 33,20" fill="#ffffff" opacity="0.55"/>
          <polygon points="65,17 67,20 65,23 63,20" fill="#ffffff" opacity="0.55"/>
        </g>
      </g>
    </svg>`,
  ],

  _dialogues: [
    // Level 1 — Mesopotamian Scribe
    {
      default:  ['The clay remembers all…',       'Inscribe your thought with care.',      'Precision shaped the ancient world.'],
      choice:   ['Four paths. One truth is carved.',  'Study carefully — choose with intent.'],
      freetext: ['The reed stylus awaits your wisdom.', 'Let your words flow like the Euphrates.'],
      ordering: ['Order is the first gift of civilization.', 'Arrange these as the stars arrange themselves.'],
      matching: ['Link what belongs together.',      'Connect purpose with form, as scribe to tablet.'],
    },
    // Level 2 — Philosopher-Senator
    {
      default:  ['Logic must govern your discourse.',    'Reason is the architect of truth.',        'Consider all arguments carefully.'],
      choice:   ['Four propositions — which withstands scrutiny?', 'As Plato taught: seek the most truthful.'],
      freetext: ['Frame your argument with precision.',  'The Senate demands clarity of thought.'],
      ordering: ['Order reveals the deeper truth.',      'Arrange your reasoning as a Roman aqueduct.'],
      matching: ['Connect each concept to its domain.',  'Logic demands perfect correspondence.'],
    },
    // Level 3 — Victorian Engineer
    {
      default:  ['Precision drives progress.',        'Every bolt must be true.',          'Engineering demands exactitude.'],
      choice:   ['Four solutions — which is most efficient?', 'Logic and mechanics must align.'],
      freetext: ['Describe your process with clarity.',  'The blueprint requires precision.'],
      ordering: ['Systems work best in proper sequence.', 'Order the steps as a machine orders its gears.'],
      matching: ['Match each component to its function.', 'Every part serves a specific purpose.'],
    },
    // Level 4 — Cyberpunk Hacker
    {
      default:  ['Optimize your prompt structure.',    'Data demands precision.',           'Code runs truest when clean.'],
      choice:   ['Four algorithms — which is most efficient?', 'Logic and bandwidth must align.'],
      freetext: ['Execute your command with clarity.',  'The network requires exact syntax.'],
      ordering: ['Systems flow best in proper sequence.', 'Stack the operations as code flows through memory.'],
      matching: ['Connect each variable to its value.', 'Every input streams to a specific output.'],
    },
    // Level 5 — Transcendent Celestial
    {
      default:  ['The Singularity whispers…',         'Language transcends dimension.',    'All prompts converge here.'],
      choice:   ['Four realities — which resonates deepest?', 'Consciousness seeks clarity.'],
      freetext: ['Articulate the infinite.',            'The cosmos awaits your transmission.'],
      ordering: ['The universe flows in perfect order.', 'Arrange these as the galaxy spirals.'],
      matching: ['Connect each soul to its purpose.',   'Every consciousness finds its frequency.'],
    },
  ],

  _promptDialogues: [
    {
      choice: ['Choose one tablet before we continue.', 'Point to the clearest inscription first.'],
      freetext: ['Write your prompt on the tablet first.', 'The stylus waits for your wording.'],
      matching: ['Pair every symbol before you proceed.', 'Complete each link on the tablet first.']
    },
    {
      choice: ['Select the strongest argument before proceeding.', 'Choose the statement that best survives scrutiny.'],
      freetext: ['State your argument before you advance.', 'Write your reasoning clearly first.'],
      matching: ['Match every concept before moving on.', 'Complete the full set of correspondences first.']
    },
    {
      choice: ['Pick the best design before I start the engine.', 'Select one solution so the gears can engage.'],
      freetext: ['Draft the blueprint before we proceed.', 'Write the prompt with proper engineering detail first.'],
      matching: ['Match every component before we power this machine.', 'Complete each pairing before the mechanism moves.']
    },
    {
      choice: ['Lock in one option before I run the sequence.', 'Select a path so the system can execute.'],
      freetext: ['Type the command before we push it live.', 'Write the prompt syntax before you submit.'],
      matching: ['Map every signal before the network routes.', 'Complete all connections before we continue.']
    },
    {
      choice: ['Choose the resonance you want to follow first.', 'Select one reality before we continue.'],
      freetext: ['Transmit your prompt before we cross the threshold.', 'Write the message before the cosmos can answer.'],
      matching: ['Complete every alignment before we ascend.', 'Match all frequencies before the portal opens.']
    }
  ],

  setDialogue(levelIndex, exerciseType) {
    const el = document.getElementById('char-dialogue-text');
    if (!el) return;
    document.querySelector('.ex-dialogue')?.classList.remove('is-warning');
    const bank = this._dialogues[levelIndex];
    if (!bank) { el.textContent = ''; return; }
    const lines = bank[exerciseType] || bank.default;
    el.textContent = lines[Math.floor(Math.random() * lines.length)];
  },

  clearPrompt(levelIndex, exerciseType) {
    this.setDialogue(levelIndex, exerciseType);
  },

  prompt(levelIndex, promptType) {
    const bubble = document.querySelector('.ex-dialogue');
    const textEl = document.getElementById('char-dialogue-text');
    if (!bubble || !textEl) return;
    const bank = this._promptDialogues[levelIndex];
    const lines = bank?.[promptType] || ['Complete the step before moving on.'];
    textEl.textContent = lines[Math.floor(Math.random() * lines.length)];
    bubble.classList.add('is-warning');
  },

  _currentState: 'idle',

  _stateDialogues: [
    // Level 1 — Scribe
    {
      thinking: ['The scribe considers…',          'Let me read the tablet again…', 'Hmm…'],
      success:  ['Excellent! The clay rings true!', 'Perfectly inscribed!',           'The river god smiles upon you!'],
      partial:  ['A fair attempt, worth keeping.',  'Almost worthy of the archives.', 'The scribe nods with reservation.'],
      failure:  ['Even I once made such errors.',   'Revise your inscription.',        'Study the ancient texts once more.'],
    },
    // Level 2 — Philosopher-Senator
    {
      thinking: ['The senator deliberates…',         'Let reason illuminate the path…',  'Hmm, let me consider…'],
      success:  ['By Jupiter, well argued!',           'The Senate would applaud!',         'Reason has prevailed!'],
      partial:  ['Acceptable — but sharpen your argument.', 'The Academy acknowledges your effort.', 'A partial truth is still progress.'],
      failure:  ['A flawed premise leads to ruin.',    'Logic requires more rigour here.',  'Even Socrates questioned himself.'],
    },
    // Level 3 — Victorian Engineer
    {
      thinking: ['The engineer calculates…',         'Let me recalibrate…',                 'Hmm, checking the pressure gauge…'],
      success:  ['Excellent calibration!',           'The engine purrs perfectly!',        'A flawless mechanism!'],
      partial:  ['Serviceable, but not optimal.',      'The machine works, yet could be refined.', 'Adequate for the moment.'],
      failure:  ['A misalignment in logic, my friend.', 'The gears resist this arrangement.',  'Back to the drawing board, I fear.'],
    },
    // Level 4 — Cyberpunk Hacker
    {
      thinking: ['Running diagnostics…',             'Scanning for optimal pathway…',    'Hmm, parsing the data stream…'],
      success:  ['Signal locked. Perfect execution!',  'The network flows flawlessly!',     'Code compiled successfully!'],
      partial:  ['Functional, but suboptimal latency.', 'System works — bandwidth could be refined.', 'Acceptable throughput achieved.'],
      failure:  ['Signal degraded. Logic corrupted.',   'The firewall rejected that pattern.',  'Stack overflow in reasoning, friend.'],
    },
    // Level 5 — Transcendent Celestial
    {
      thinking: ['The cosmos deliberates…',          'Consulting the infinite archive…',  'Hmm, spanning all dimensions…'],
      success:  ['Transcendence achieved!',          'The universe approves!',            'Perfect cosmic resonance!'],
      partial:  ['Acceptable convergence.',           'A partial glimpse of eternity.',    'Nearly infinite, yet bounded still.'],
      failure:  ['The pattern fractured.',            'Entropy whispers here.',            'Reality rejects this alignment.'],
    },
  ],

  setState(state, levelIndex) {
    this._currentState = state;
    const el = document.getElementById('level-character');
    if (el) {
      el.classList.remove('char-thinking', 'char-success', 'char-partial', 'char-failure');
      if (state !== 'idle') el.classList.add(`char-${state}`);
    }
    const textEl = document.getElementById('char-dialogue-text');
    if (!textEl) return;
    const bank = this._stateDialogues[levelIndex];
    if (!bank) return;
    const lines = bank[state] || bank.thinking;
    textEl.textContent = lines[Math.floor(Math.random() * lines.length)];
  },

  show(levelIndex) {
    const el = document.getElementById('level-character');
    if (!el) return;
    // Reset state classes on each new question
    el.classList.remove('char-thinking', 'char-success', 'char-partial', 'char-failure');
    document.querySelector('.ex-dialogue')?.classList.remove('is-warning');
    this._currentState = 'idle';
    const imgSrc = this._humanImages[levelIndex] ?? null;
    if (!imgSrc) { el.innerHTML = ''; return; }
    const levelNumber = levelIndex + 1;
    el.innerHTML = `<img src="${imgSrc}" alt="Level ${levelNumber} guide" draggable="false" />`;
  },

  hide() {
    const el = document.getElementById('level-character');
    if (el) el.innerHTML = '';
  }
};

// ============================================================
// MAIN GAME ENGINE
// ============================================================
const GameEngine = {
  _levelEvolutionTimer: null,


  _getResumeLookupName(preferredName = '') {
    const candidate = String(preferredName || '').trim()
      || String(document.getElementById('player-name-input')?.value || '').trim()
      || String(GameState.playerName || '').trim();
    return candidate && candidate !== 'Player' ? candidate : '';
  },

  _prepareNewGame(name) {
    GameState.playerName = name;
    GameState.currentLevel = 0;
    GameState.currentExercise = 0;
    GameState.score = 0;
    GameState.totalScore = 0;
    GameState.badges = [];
    GameState.selectedChoice = null;
    GameState.matchingState = { selected: null, pairs: {} };
    GameState.hintUsed = false;
    GameState.answers = {};
    GameState.streak = 0;
    GameState.mastery = {};
    GameState.replayMode = false;
    GameState.levelStartTime = 0;
    GameState.levelElapsed = 0;
    GameState.levelTimes = [];
    GameState.levelExercises = [];
    GameState.currentStage = 'intro';
  },

  _findExerciseById(levelIndex, exerciseId) {
    return GAME_DATA.levels[levelIndex]?.exercises.find(ex => ex.id === exerciseId) || null;
  },

  _getResumeTarget(progress) {
    if (!progress || !progress.playerName) return null;
    const currentLevel = Number(progress.currentLevel) || 0;
    if (progress.stage === 'game-complete' || progress.stage === 'welcome') return null;
    if (progress.stage === 'level-complete') {
      const nextLevel = currentLevel + 1;
      if (nextLevel >= GAME_DATA.levels.length) return null;
      return { levelIndex: nextLevel, stage: 'intro' };
    }
    if (currentLevel >= GAME_DATA.levels.length) return null;
    return {
      levelIndex: currentLevel,
      stage: progress.stage === 'exercise' ? 'exercise' : 'intro'
    };
  },

  _buildProgress(stage = GameState.currentStage) {
    const elapsed = stage === 'exercise' && GameState.levelStartTime
      ? Date.now() - GameState.levelStartTime
      : (GameState.levelElapsed || 0);
    return {
      playerName: GameState.playerName,
      stage,
      currentLevel: GameState.currentLevel,
      currentExercise: GameState.currentExercise,
      score: GameState.score,
      totalScore: GameState.totalScore,
      badges: [...GameState.badges],
      answers: { ...GameState.answers },
      streak: GameState.streak,
      mastery: { ...GameState.mastery },
      levelTimes: [...GameState.levelTimes],
      levelExerciseIds: GameState.levelExercises.map(ex => ex.id),
      levelElapsed: Math.max(0, elapsed)
    };
  },

  _persistProgress(stage = GameState.currentStage) {
    if (GameState.replayMode) return null;
    const playerName = this._getResumeLookupName(GameState.playerName);
    if (!playerName) return null;
    const snapshot = this._buildProgress(stage);
    snapshot.playerName = playerName;
    ProgressStore.save(snapshot);
    this._updateWelcomeResumeCta(snapshot);
    return snapshot;
  },

  _clearProgress(name = GameState.playerName) {
    const playerName = this._getResumeLookupName(name);
    if (playerName) ProgressStore.clear(playerName);
    this._updateWelcomeResumeCta();
  },

  _updateWelcomeResumeCta(progress = null) {
    const snapshot = progress || ProgressStore.load(this._getResumeLookupName());
    const target = this._getResumeTarget(snapshot);
    const completedLevels = ProgressStore.completedLevels(this._getResumeLookupName());
    [0, 1, 2, 3, 4].forEach(i => {
      const el = document.getElementById('lp-btn-' + i);
      if (!el) return;
      el.classList.remove('resume-clickable');
      el.classList.remove('replay-clickable');
      el.removeAttribute('data-resume-level');
      el.removeAttribute('data-replay-level');
      if (!el.classList.contains('admin-clickable')) el.title = '';
    });
    completedLevels.forEach(levelIndex => {
      if (target?.levelIndex === levelIndex) return;
      const el = document.getElementById('lp-btn-' + levelIndex);
      if (!el) return;
      el.classList.add('replay-clickable');
      el.setAttribute('data-replay-level', 'true');
      if (!el.classList.contains('admin-clickable')) el.title = `Practice replay: Level ${levelIndex + 1}`;
    });
    if (target) {
      const el = document.getElementById('lp-btn-' + target.levelIndex);
      if (!el) return;
      el.classList.add('resume-clickable');
      el.setAttribute('data-resume-level', 'true');
      if (!el.classList.contains('admin-clickable')) {
        const verb = snapshot?.stage === 'level-complete' ? 'Continue' : 'Resume';
        el.title = `${verb} at Level ${target.levelIndex + 1}`;
      }
    }
  },

  _restoreProgress(progress) {
    const target = this._getResumeTarget(progress);
    if (!target) return false;
    const level = GAME_DATA.levels[target.levelIndex];
    if (!level) return false;

    const nameInput = document.getElementById('player-name-input');
    const nameError = document.getElementById('name-error');
    if (nameInput) {
      nameInput.value = progress.playerName;
      nameInput.classList.remove('input-error');
    }
    if (nameError) nameError.classList.add('hidden');

    GameState.playerName = progress.playerName;
    GameState.currentLevel = target.levelIndex;
    GameState.totalScore = Number(progress.totalScore) || 0;
    GameState.badges = Array.isArray(progress.badges) ? [...progress.badges] : [];
    GameState.levelTimes = Array.isArray(progress.levelTimes) ? [...progress.levelTimes] : [];
    GameState.selectedChoice = null;
    GameState.matchingState = { selected: null, pairs: {} };
    GameState.hintUsed = false;
    GameState.streak = Number(progress.streak) || 0;
    GameState.mastery = progress.mastery && typeof progress.mastery === 'object' ? { ...progress.mastery } : {};
    GameState.replayMode = false;

    if (
      target.stage === 'exercise' &&
      target.levelIndex === Number(progress.currentLevel) &&
      Array.isArray(progress.levelExerciseIds) &&
      progress.levelExerciseIds.length
    ) {
      const restoredExercises = progress.levelExerciseIds
        .map(id => this._findExerciseById(target.levelIndex, id))
        .filter(Boolean);
      if (restoredExercises.length === progress.levelExerciseIds.length) {
        GameState.score = Number(progress.score) || 0;
        GameState.answers = progress.answers && typeof progress.answers === 'object' ? { ...progress.answers } : {};
        GameState.levelExercises = restoredExercises;
        GameState.currentExercise = Math.min(
          Number(progress.currentExercise) || 0,
          Math.max(restoredExercises.length - 1, 0)
        );
        GameState.currentStage = 'exercise';
        setTheme(level.theme);
        Timer.start(Number(progress.levelElapsed) || 0);
        this.renderExercise();
        return true;
      }
    }

    GameState.score = 0;
    GameState.answers = {};
    GameState.streak = 0;
    GameState.currentExercise = 0;
    GameState.levelExercises = [];
    GameState.currentStage = 'intro';
    setTheme(level.theme);
    this.showLevelIntro();
    return true;
  },

  _resumeFromWelcome(levelIndex) {
    const progress = ProgressStore.load(this._getResumeLookupName());
    const target = this._getResumeTarget(progress);
    if (!target || target.levelIndex !== levelIndex) return;
    this._restoreProgress(progress);
  },

  _replayCompletedLevel(levelIndex) {
    const name = this._getResumeLookupName();
    if (!name || !ProgressStore.completedLevels(name).includes(levelIndex)) return;
    const level = GAME_DATA.levels[levelIndex];
    if (!level) return;

    GameState.playerName = name;
    GameState.currentLevel = levelIndex;
    GameState.currentExercise = 0;
    GameState.score = 0;
    GameState.totalScore = 0;
    GameState.badges = [];
    GameState.answers = {};
    GameState.streak = 0;
    GameState.mastery = {};
    GameState.levelTimes = [];
    GameState.levelExercises = [];
    GameState.replayMode = true;
    setTheme(level.theme);
    this.showLevelIntro();
  },

  async startGame() {
    // Read and validate player name (3–20 chars required)
    const nameInput = document.getElementById('player-name-input');
    const nameError = document.getElementById('name-error');
    const startBtn  = document.querySelector('.btn-start');
    const raw = nameInput ? nameInput.value.trim() : '';

    const showNameError = (msg) => {
      if (nameError) { nameError.textContent = msg; nameError.classList.remove('hidden'); }
      if (nameInput) {
        nameInput.classList.remove('input-error');
        void nameInput.offsetWidth;
        nameInput.classList.add('input-error');
        nameInput.addEventListener('animationend', () => nameInput.classList.remove('input-error'), { once: true });
        nameInput.focus();
      }
    };

    if (raw.length < 3 || raw.length > 20) {
      showNameError('Please enter a name between 3 and 20 characters.');
      return;
    }

    const savedProgress = ProgressStore.load(raw);
    const resumeTarget = this._getResumeTarget(savedProgress);
    if (resumeTarget) {
      const resumeLevel = GAME_DATA.levels[resumeTarget.levelIndex];
      const shouldResume = window.confirm(
        `Resume your previous game as "${raw}"?\n\n` +
        `You will continue from ${resumeLevel ? `Level ${resumeLevel.id}: ${resumeLevel.title}` : `Level ${resumeTarget.levelIndex + 1}`}.`
      );
      if (shouldResume) {
        return this._restoreProgress(savedProgress);
      }
    }

    // Check for duplicate name against existing leaderboard entries
    if (startBtn) { startBtn.disabled = true; startBtn.textContent = 'Checking…'; }
    try {
      const existing = await Scoreboard.getOverall();
      const takenNames = (existing || []).map(e => e.name.toLowerCase());
      if (takenNames.includes(raw.toLowerCase())) {
        showNameError(`"${raw}" is already taken — please choose a different name.`);
        return;
      }
    } catch {
      // If the check fails (offline / error), allow the game to proceed
    } finally {
      if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'Start Quest'; }
    }

    if (nameError) nameError.classList.add('hidden');
    if (nameInput) nameInput.classList.remove('input-error');
    this._clearProgress(raw);
    this._prepareNewGame(raw);
    setTheme('level-1');
    this.showLevelIntro();
  },

  restartGame() {
    this._stopPolling();
    clearInterval(GameState.fireworksInterval);
    GameState.fireworksInterval = null;
    this._clearGameCompleteUiTimeouts();
    if (GameState._parallaxCleanup) { GameState._parallaxCleanup(); GameState._parallaxCleanup = null; }
    MusicEngine._stopAll();
    this._clearProgress();
    setTheme('');
    document.body.className = '';
    showScreen('screen-welcome');
    MusicEngine.playWelcome();
  },

  quitGame() {
    this._stopPolling();
    clearInterval(GameState.fireworksInterval);
    GameState.fireworksInterval = null;
    this._clearGameCompleteUiTimeouts();
    if (GameState._parallaxCleanup) { GameState._parallaxCleanup(); GameState._parallaxCleanup = null; }
    if (GameState.currentStage && GameState.currentStage !== 'welcome' && GameState.currentStage !== 'game-complete') {
      this._persistProgress(GameState.currentStage);
    }
    Timer.stop();
    MusicEngine._stopAll();
    setTheme('');
    document.body.className = '';
    showScreen('screen-welcome');
    MusicEngine.playWelcome();
  },

  showLevelIntro() {
    const level = GAME_DATA.levels[GameState.currentLevel];
    GameState.currentStage = 'intro';
    document.getElementById('intro-badge').textContent = level.badge;
    document.getElementById('intro-title').textContent = `Level ${level.id}: ${level.title}`;
    document.getElementById('intro-subtitle').textContent = level.subtitle;
    document.getElementById('intro-concept').innerHTML = level.concept;
    setTheme(level.theme);
    MusicEngine.play(GameState.currentLevel);
    showScreen('screen-level-intro');
    this._persistProgress('intro');
  },

  startLevel() {
    GameState.currentExercise = 0;
    GameState.score = 0;
    GameState.answers = {};
    GameState.levelExercises = [];
    GameState.streak = 0;
    GameState.hintUsed = false;

    const pool = [...GAME_DATA.levels[GameState.currentLevel].exercises];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    GameState.levelExercises = pool.slice(0, 4);

    Timer.start();
    this.renderExercise();
  },

  renderExercise() {
    this.hideFeedback();
    document.querySelector('.exercise-card')?.classList.remove('is-submitting');
    const level = GAME_DATA.levels[GameState.currentLevel];
    const exercise = GameState.levelExercises[GameState.currentExercise];
    GameState.selectedChoice = null;
    GameState.hintUsed = false;
    GameState.matchingState = { selected: null, pairs: {} };

    // Header
    document.getElementById('level-label').textContent = `Level ${level.id} / 5`;
    document.getElementById('exercise-counter').textContent =
      `Q ${GameState.currentExercise + 1} / 4`;
    document.getElementById('score-display').textContent = `⭐ ${GameState.totalScore}`;

    // Fill 4-segment progress bar
    document.querySelectorAll('#ex-segments .ex-seg').forEach((seg, i) => {
      seg.classList.toggle('done',   i < GameState.currentExercise);
      seg.classList.toggle('active', i === GameState.currentExercise);
    });

    // Exercise card
    document.getElementById('exercise-type-badge').textContent = exercise.type;
    document.getElementById('exercise-question').textContent = exercise.question;

    const ctxEl = document.getElementById('exercise-context');
    if (exercise.context) {
      ctxEl.textContent = exercise.context;
      ctxEl.classList.remove('hidden');
    } else {
      ctxEl.classList.add('hidden');
    }

    // Hint
    document.getElementById('exercise-hint').classList.add('hidden');
    document.getElementById('exercise-hint').textContent = '';

    // Input area
    const inputArea = document.getElementById('exercise-input-area');
    inputArea.innerHTML = '';

    if (exercise.inputType === 'choice') {
      const grid = document.createElement('div');
      grid.className = 'choice-grid';
      // Shuffle choices so correct answer isn't always in the same position
      const shuffledChoices = [...exercise.choices].sort(() => Math.random() - 0.5);
      shuffledChoices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = choice.text;
        btn.dataset.id = choice.id;
        btn.addEventListener('click', () => {
          CharacterEngine.clearPrompt(GameState.currentLevel, exercise.inputType);
          grid.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          GameState.selectedChoice = choice.id;
        });
        grid.appendChild(btn);
      });
      inputArea.appendChild(grid);

    } else if (exercise.inputType === 'freetext') {
      const label = document.createElement('div');
      label.className = 'rewrite-label';
      label.textContent = 'Your Prompt:';
      const ta = document.createElement('textarea');
      ta.className = 'prompt-input';
      ta.placeholder = exercise.placeholder || 'Type your prompt here...';
      ta.id = 'freetext-input';
      ta.addEventListener('input', () => CharacterEngine.clearPrompt(GameState.currentLevel, exercise.inputType));
      inputArea.appendChild(label);
      inputArea.appendChild(ta);

    } else if (exercise.inputType === 'ordering') {
      const ul = document.createElement('ul');
      ul.className = 'order-list';
      ul.id = 'order-list';
      // Shuffle items for display
      const shuffled = [...exercise.items].sort(() => Math.random() - 0.5);
      shuffled.forEach(item => {
        const li = document.createElement('li');
        li.className = 'order-item';
        li.draggable = true;
        li.dataset.id = item.id;
        li.innerHTML = `<span class="drag-handle">⠿</span><span>${item.text}</span>`;
        ul.appendChild(li);
      });
      inputArea.appendChild(ul);
      initDragDrop(ul);
      const hint2 = document.createElement('p');
      hint2.style.cssText = 'font-size:0.8rem;color:var(--text-light);margin-bottom:12px;';
      hint2.textContent = '↕ Drag items to reorder them';
      inputArea.insertBefore(hint2, ul);

    } else if (exercise.inputType === 'matching') {
      this.renderMatching(exercise, inputArea);
    }

    CharacterEngine.show(GameState.currentLevel);
    CharacterEngine.setDialogue(GameState.currentLevel, exercise.inputType);
    GameState.currentStage = 'exercise';
    showScreen('screen-exercise');
    this._persistProgress('exercise');
  },

  renderMatching(exercise, container) {
    const grid = document.createElement('div');
    grid.className = 'match-grid';

    // Left column
    const leftCol = document.createElement('div');
    const leftLabel = document.createElement('div');
    leftLabel.className = 'match-col-label';
    leftLabel.textContent = 'Goals';
    leftCol.appendChild(leftLabel);
    exercise.leftItems.forEach(item => {
      const div = document.createElement('div');
      div.className = 'match-item';
      div.dataset.id = item.id;
      div.dataset.side = 'left';
      div.textContent = item.text;
      div.addEventListener('click', () => this.handleMatchClick(div, 'left'));
      leftCol.appendChild(div);
    });

    // Right column
    const rightCol = document.createElement('div');
    const rightLabel = document.createElement('div');
    rightLabel.className = 'match-col-label';
    rightLabel.textContent = 'AI Roles';
    rightCol.appendChild(rightLabel);
    exercise.rightItems.forEach(item => {
      const div = document.createElement('div');
      div.className = 'match-item';
      div.dataset.id = item.id;
      div.dataset.side = 'right';
      div.textContent = item.text;
      div.addEventListener('click', () => this.handleMatchClick(div, 'right'));
      rightCol.appendChild(div);
    });

    grid.appendChild(leftCol);
    grid.appendChild(rightCol);
    container.appendChild(grid);
  },

  handleMatchClick(div, side) {
    const ms = GameState.matchingState;
    if (div.classList.contains('matched')) return;
    CharacterEngine.clearPrompt(GameState.currentLevel, 'matching');

    if (side === 'left') {
      // Deselect previous left
      document.querySelectorAll('.match-item[data-side="left"]').forEach(el => el.classList.remove('selected'));
      div.classList.add('selected');
      ms.selected = div.dataset.id;
    } else {
      // Right side — try to pair
      if (!ms.selected) return;
      const leftId = ms.selected;
      const rightId = div.dataset.id;
      ms.pairs[leftId] = rightId;

      // Mark visually
      const leftEl = document.querySelector(`.match-item[data-id="${leftId}"]`);
      leftEl.classList.remove('selected');
      leftEl.classList.add('matched');
      div.classList.add('matched');
      ms.selected = null;
    }
  },

  showHint() {
    const exercise = GameState.levelExercises[GameState.currentExercise];
    const hintEl = document.getElementById('exercise-hint');
    hintEl.textContent = `💡 ${exercise.hint}`;
    hintEl.classList.remove('hidden');
    GameState.hintUsed = true;
  },

  submitAnswer() {
    const level = GAME_DATA.levels[GameState.currentLevel];
    const exercise = GameState.levelExercises[GameState.currentExercise];
    let isCorrect = false;
    let freetextGrade = null;  // 'full', 'partial', or 'none' for freetext
    let freeTextAnalysis = null;
    let userAnswer = '';

    if (exercise.inputType === 'choice') {
      if (!GameState.selectedChoice) {
        CharacterEngine.prompt(GameState.currentLevel, 'choice');
        return;
      }
      isCorrect = GameState.selectedChoice === exercise.correct;
      userAnswer = GameState.selectedChoice;

    } else if (exercise.inputType === 'freetext') {
      const ta = document.getElementById('freetext-input');
      userAnswer = ta ? ta.value.trim() : '';
      if (userAnswer.length < 10) {
        CharacterEngine.prompt(GameState.currentLevel, 'freetext');
        return;
      }
      freeTextAnalysis = analyzeFreeText(userAnswer, exercise);
      const grade = freeTextAnalysis.grade;
      if (grade === 'full') { isCorrect = true; freetextGrade = 'full'; }
      else if (grade === 'partial') { isCorrect = true; freetextGrade = 'partial'; }
      else { isCorrect = false; freetextGrade = 'none'; }

    } else if (exercise.inputType === 'ordering') {
      const list = document.getElementById('order-list');
      if (!list) return;
      const order = [...list.querySelectorAll('.order-item')].map(li => li.dataset.id);
      isCorrect = JSON.stringify(order) === JSON.stringify(exercise.correctOrder);
      userAnswer = order;

    } else if (exercise.inputType === 'matching') {
      const ms = GameState.matchingState;
      const correct = exercise.correctPairs;
      const allMatched = Object.keys(correct).every(k => ms.pairs[k] === correct[k]);
      const allPaired = Object.keys(ms.pairs).length === Object.keys(correct).length;
      if (!allPaired) {
        CharacterEngine.prompt(GameState.currentLevel, 'matching');
        return;
      }
      isCorrect = allMatched;
      userAnswer = { ...ms.pairs };
    }

    // Score — freetext uses 3-tier: full=10, partial=5, none=0.
    // A clean third/fourth answer in a level earns a small mastery streak bonus.
    let points;
    if (freetextGrade === 'partial') {
      points = 5;
    } else if (isCorrect) {
      points = GameState.hintUsed ? 5 : 10;
    } else {
      points = 0;
    }
    const cleanCorrect = isCorrect && !GameState.hintUsed && freetextGrade !== 'partial';
    const nextStreak = cleanCorrect ? GameState.streak + 1 : 0;
    const streakBonus = nextStreak === 3 ? 2 : nextStreak >= 4 ? 3 : 0;
    points += streakBonus;

    // Determine character result state
    const resultState = (isCorrect && !GameState.hintUsed && freetextGrade !== 'partial')
      ? 'success'
      : (isCorrect || freetextGrade === 'partial')
      ? 'partial'
      : 'failure';

    // Disable submit and show thinking state for 1 second before revealing result
    const submitBtn = document.getElementById('btn-submit');
    document.querySelector('.exercise-card')?.classList.add('is-submitting');
    if (submitBtn) submitBtn.disabled = true;
    CharacterEngine.setState('thinking', GameState.currentLevel);

    setTimeout(() => {
      // Reveal character reaction
      CharacterEngine.setState(resultState, GameState.currentLevel);

      GameState.score      += points;
      GameState.totalScore += points;
      GameState.answers[GameState.currentExercise] = isCorrect || freetextGrade === 'partial';
      GameState.streak = nextStreak;
      this._recordMastery(isCorrect || freetextGrade === 'partial', points);

      // Play themed sound effect
      if (isCorrect && freetextGrade !== 'partial') SoundEngine.playCorrect(GameState.currentLevel);
      else if (freetextGrade === 'partial')          SoundEngine.playCorrect(GameState.currentLevel);
      else                                           SoundEngine.playWrong(GameState.currentLevel);

      if (submitBtn) submitBtn.disabled = false;
      this.showFeedback(isCorrect, exercise, points, freetextGrade, freeTextAnalysis, streakBonus, nextStreak);
    }, 1000);
  },

  showFeedback(isCorrect, exercise, points, freetextGrade, freeTextAnalysis = null, streakBonus = 0, streak = 0) {
    const isPartial = freetextGrade === 'partial';
    const isFull    = isCorrect && !isPartial;

    const icons = isFull
      ? ['🎉', '⭐', '🚀', '✨', '🏆'][Math.floor(Math.random() * 5)]
      : isPartial
      ? ['👏', '💡', '📝'][Math.floor(Math.random() * 3)]
      : ['😕', '🤔', '📚', '🔄'][Math.floor(Math.random() * 4)];

    document.getElementById('feedback-icon').textContent = icons;
    document.getElementById('feedback-title').textContent = isFull
      ? ['Excellent!', 'Perfect!', 'Brilliant!', 'Nailed it!', 'Outstanding!'][Math.floor(Math.random() * 5)]
      : isPartial
      ? ['Good effort!', 'Almost there!', 'Solid attempt!'][Math.floor(Math.random() * 3)]
      : ['Not quite...', 'Good try!', 'Almost there!', 'Keep going!'][Math.floor(Math.random() * 4)];

    document.getElementById('feedback-message').textContent = isFull
      ? `You earned ${points} point${points !== 1 ? 's' : ''}! ${streakBonus ? `+${streakBonus} mastery streak bonus!` : GameState.hintUsed ? '(Hint used — 5pts)' : streak >= 2 ? `${streak}-answer streak!` : ''}`
      : isPartial
      ? `Partial credit: ${points} points! Your answer covered some key aspects but missed a few important details. See the explanation below.`
      : "Don't worry — the explanation below will help you master this concept.";

    const coachingHtml = freeTextAnalysis ? this._renderFreeTextCoaching(freeTextAnalysis) : '';
    const expEl = document.getElementById('feedback-explanation');
    expEl.innerHTML = `${coachingHtml}<strong>📖 Explanation:</strong><br>${exercise.explanation}`;
    expEl.classList.remove('hidden');

    document.getElementById('feedback-tip').textContent = exercise.tip || '';

    // Show feedback panel on the right side
    const panel = document.getElementById('feedback-panel');
    document.querySelector('.ex-left')?.classList.add('feedback-open');
    document.querySelector('.exercise-card')?.classList.remove('is-submitting');
    panel.classList.add('show');
  },

  _recordMastery(isSuccessful, points) {
    const level = GAME_DATA.levels[GameState.currentLevel];
    if (!level) return;
    const current = GameState.mastery[level.id] || { successful: 0, attempted: 0, points: 0 };
    current.attempted += 1;
    current.successful += isSuccessful ? 1 : 0;
    current.points += points;
    GameState.mastery[level.id] = current;
  },

  _getMasteryRecap() {
    const results = GAME_DATA.levels.map(level => {
      const result = GameState.mastery[level.id] || { successful: 0, attempted: 0, points: 0 };
      return { level, ...result, ratio: result.attempted ? result.successful / result.attempted : 0 };
    }).filter(result => result.attempted);
    if (!results.length) return { strongest: 'Complete a level to see your strengths.', next: 'Keep exploring the timeline.' };
    const strongest = [...results].sort((a, b) => b.ratio - a.ratio || b.points - a.points)[0];
    const next = [...results].sort((a, b) => a.ratio - b.ratio || a.points - b.points)[0];
    return {
      strongest: `${strongest.level.badge} ${strongest.level.title} (${strongest.successful}/${strongest.attempted} solid answers)`,
      next: `${next.level.badge} ${next.level.title} (${next.successful}/${next.attempted} solid answers)`
    };
  },

  _renderFreeTextCoaching(analysis) {
    const formatItems = items => items.map(item => `<span>${escHtml(item)}</span>`).join('');
    const included = analysis.matched.length
      ? `<div><strong>Included:</strong><div class="feedback-ingredient-list is-included">${formatItems(analysis.matched.slice(0, 5))}</div></div>`
      : '<div><strong>Included:</strong> No target prompt ingredients detected yet.</div>';
    const missing = analysis.grade === 'full' || !analysis.missing.length
      ? ''
      : `<div><strong>Add next:</strong><div class="feedback-ingredient-list is-missing">${formatItems(analysis.missing.slice(0, 3))}</div></div>`;
    const lengthNote = analysis.minMet
      ? ''
      : `<div><strong>Length:</strong> Add at least ${analysis.minLength - analysis.length} more characters to develop the prompt.</div>`;
    return `<div class="feedback-coaching"><strong>Prompt check</strong>${included}${missing}${lengthNote}</div>`;
  },

  hideFeedback() {
    const panel = document.getElementById('feedback-panel');
    document.querySelector('.ex-left')?.classList.remove('feedback-open');
    panel.classList.remove('show');
  },

  nextExercise() {
    this.hideFeedback();
    const level = GAME_DATA.levels[GameState.currentLevel];
    GameState.currentExercise++;

    if (GameState.currentExercise >= GameState.levelExercises.length) {
      this.showLevelComplete();
    } else {
      this.renderExercise();
    }
  },

  _buildLevelCompleteBg(imagePath, isFinalEvolution = false) {
    const overlay = isFinalEvolution
      ? "linear-gradient(180deg, rgba(5, 7, 20, 0.48), rgba(5, 7, 20, 0.72)), radial-gradient(circle at 50% 35%, rgba(192,132,252,0.22), transparent 54%), radial-gradient(circle at 78% 18%, rgba(45,212,191,0.14), transparent 42%)"
      : "linear-gradient(180deg, rgba(10, 12, 18, 0.42), rgba(10, 12, 18, 0.28) 34%, rgba(10, 12, 18, 0.52)), radial-gradient(circle at 70% 24%, rgba(var(--primary-rgb, 255,111,0), 0.16), transparent 38%)";
    return `${overlay}, url('${imagePath}')`;
  },

  _getLevelCompleteBackgroundImage(levelIndex) {
    return levelIndex === GAME_DATA.levels.length - 1
      ? FINAL_SYNCHRONIZER_BG
      : (LEVEL_BACKGROUND_IMAGES[levelIndex] ?? null);
  },

  _setLevelCompleteBackground(levelIndex) {
    const bgEl = document.querySelector('#screen-level-complete .level-screen-bg');
    if (!bgEl) return;

    const bgImage = this._getLevelCompleteBackgroundImage(levelIndex);
    bgEl.style.backgroundImage = bgImage
      ? this._buildLevelCompleteBg(bgImage, false)
      : '';
  },

  _preloadEvolutionImage(imagePath) {
    if (!imagePath) return Promise.resolve();
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => {
        const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
        decoded.catch(() => {}).finally(resolve);
      };
      image.onerror = resolve;
      image.src = imagePath;
    });
  },

  _preloadLevelEvolutionAssets(levelIndex) {
    const hasNextLevel = levelIndex < GAME_DATA.levels.length - 1;
    const nextIndex = hasNextLevel ? levelIndex + 1 : FINAL_SYNCHRONIZER_INDEX;
    const nextBackground = hasNextLevel
      ? LEVEL_BACKGROUND_IMAGES[nextIndex]
      : FINAL_SYNCHRONIZER_BG;
    return Promise.all([
      LEVEL_BACKGROUND_IMAGES[levelIndex],
      nextBackground,
      CharacterEngine._humanImages[levelIndex],
      CharacterEngine._humanImages[nextIndex]
    ].map(imagePath => this._preloadEvolutionImage(imagePath)));
  },

  _setLevelCompleteEvolution(levelIndex) {
    const screen = document.getElementById('screen-level-evolution');
    const currentCharEl = document.getElementById('evolution-character-current');
    const nextCharEl = document.getElementById('evolution-character-next');
    const currentBgEl = document.getElementById('evolution-bg-current');
    const nextBgEl = document.getElementById('evolution-bg-next');
    const fromLabelEl = document.getElementById('evolution-from-label');
    const toLabelEl = document.getElementById('evolution-to-label');
    const titleEl = document.getElementById('evolution-title');
    const captionEl = document.getElementById('evolution-caption');
    if (!screen || !currentCharEl || !nextCharEl || !currentBgEl || !nextBgEl || !fromLabelEl || !toLabelEl) return;

    const hasNextLevel = levelIndex < GAME_DATA.levels.length - 1;
    const nextIndex = hasNextLevel ? levelIndex + 1 : FINAL_SYNCHRONIZER_INDEX;
    const currentLevel = GAME_DATA.levels[levelIndex];
    const nextLevel = hasNextLevel ? GAME_DATA.levels[nextIndex] : null;
    const currentChar = CharacterEngine._humanImages[levelIndex] ?? null;
    const nextChar = CharacterEngine._humanImages[nextIndex] ?? null;
    const currentBg = LEVEL_BACKGROUND_IMAGES[levelIndex] ?? null;
    const nextBg = hasNextLevel
      ? (LEVEL_BACKGROUND_IMAGES[nextIndex] ?? currentBg)
      : FINAL_SYNCHRONIZER_BG;

    currentCharEl.innerHTML = currentChar
      ? `<img src="${currentChar}" alt="${currentLevel.title} guide" draggable="false" />`
      : '';
    nextCharEl.innerHTML = nextChar
      ? `<img src="${nextChar}" alt="${hasNextLevel ? nextLevel.title : 'Civilization Synchronizer'} guide" draggable="false" />`
      : '';
    nextCharEl.classList.toggle('complete-character-ascended', !hasNextLevel);

    fromLabelEl.textContent = `From ${currentLevel.title}`;
    toLabelEl.textContent = hasNextLevel
      ? `Into ${nextLevel.title}`
      : 'Into Civilization Synchronizer';
    if (titleEl) {
      titleEl.textContent = hasNextLevel
        ? `Level ${currentLevel.id} Evolves Into Level ${nextLevel.id}`
        : 'Star Archon Evolves Into Civilization Synchronizer';
    }
    if (captionEl) {
      captionEl.textContent = hasNextLevel
        ? `Guide and world transform together. After the evolution completes, continue into ${nextLevel.title}.`
        : 'The final architect awakens. When the evolution completes, check your score to enter the synchronized finale.';
    }

    this._setLevelEvolutionButtonState(false, hasNextLevel);

    if (currentBg) currentBgEl.style.backgroundImage = this._buildLevelCompleteBg(currentBg, false);
    if (nextBg) nextBgEl.style.backgroundImage = this._buildLevelCompleteBg(nextBg, !hasNextLevel);

    screen.classList.remove('evolution-active');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        screen.classList.add('evolution-active');
      });
    });
  },

  _populateLevelCompleteContent(levelIndex, correct, timeMs, score, rows, online) {
    const level = GAME_DATA.levels[levelIndex];
    document.getElementById('complete-badge').textContent = level.badge;
    document.getElementById('complete-title').textContent = `Level ${level.id} Complete!`;
    document.getElementById('complete-summary').textContent =
      `You've mastered "${level.title}"! Score: ${score} pts · Time: ${Timer.format(timeMs)}`;
    document.getElementById('complete-stars').textContent = starRating(correct, 4);
    document.getElementById('complete-badge-earned').innerHTML =
      `🏅 Badge Earned: <strong>${level.completeBadge}</strong>`;
    document.getElementById('sb-level-title').innerHTML =
      `🏆 Level ${level.id} Scoreboard${online ? ' <span class="sb-live-dot">● LIVE</span>' : ''}`;
    this._renderScoreboardTable('level-scoreboard-body', rows, GameState.playerName, false, 10);
    const nextButton = document.getElementById('level-complete-next-btn');
    if (nextButton) nextButton.textContent = GameState.replayMode ? 'Back to Quest →' : 'Next Level →';
  },

  async showLevelCompletePreview(levelIndex) {
    const level = GAME_DATA.levels[levelIndex];
    const timeMs = 42000 + levelIndex * 6000;
    const score = Scoreboard._maxLevelScore(level.id);
    const rows = await Scoreboard.getLevel(level.id);
    const online = await Scoreboard._isOnline();

    this._stopPolling();
    this._populateLevelCompleteContent(levelIndex, 4, timeMs, score, rows, online);
    this._setLevelCompleteBackground(levelIndex);
    this._preloadLevelEvolutionAssets(levelIndex);

    GameState.currentStage = 'level-complete';
    MusicEngine.playLevelComplete(levelIndex);
    showScreen('screen-level-complete');
  },

  async showLevelComplete() {
    const level = GAME_DATA.levels[GameState.currentLevel];
    const correct = GameState.levelExercises.filter((_, i) => GameState.answers && GameState.answers[i]).length;
    const timeMs = Timer.stop();
    GameState.levelTimes.push(timeMs);

    MusicEngine.playLevelComplete(GameState.currentLevel);
    SoundEngine.playLevelComplete(GameState.currentLevel);

    GameState.badges.push(level.completeBadge);

    if (!GameState.replayMode) ProgressStore.markCompleted(GameState.playerName, GameState.currentLevel);

    // Practice replays show the board but do not alter shared scores or quest progress.
    const updated = GameState.replayMode
      ? await Scoreboard.getLevel(level.id)
      : await Scoreboard.saveLevel(level.id, GameState.playerName, GameState.score, timeMs);
    const online  = await Scoreboard._isOnline();
    this._populateLevelCompleteContent(
      GameState.currentLevel,
      correct,
      timeMs,
      GameState.score,
      updated,
      online
    );
    this._setLevelCompleteBackground(GameState.currentLevel);
    this._preloadLevelEvolutionAssets(GameState.currentLevel);

    GameState.currentStage = 'level-complete';
    showScreen('screen-level-complete');
    this._persistProgress('level-complete');

    // Live polling — refresh every 5s while on this screen
    clearInterval(GameState.pollInterval);
    GameState.pollInterval = setInterval(async () => {
      const live = await Scoreboard.getLevel(level.id);
      this._renderScoreboardTable('level-scoreboard-body', live, GameState.playerName, false, 10);
    }, 5000);
  },

  _stopPolling() {
    clearInterval(GameState.pollInterval);
    GameState.pollInterval = null;
  },

  _clearLevelEvolutionTimer() {
    if (this._levelEvolutionTimer) {
      clearTimeout(this._levelEvolutionTimer);
      this._levelEvolutionTimer = null;
    }
  },

  _queueGameCompleteUiTimeout(callback, delayMs) {
    const timeoutId = setTimeout(() => {
      GameState.completionUiTimeouts = GameState.completionUiTimeouts.filter(id => id !== timeoutId);
      callback();
    }, delayMs);
    GameState.completionUiTimeouts.push(timeoutId);
    return timeoutId;
  },

  _clearGameCompleteUiTimeouts() {
    GameState.completionUiTimeouts.forEach(clearTimeout);
    GameState.completionUiTimeouts = [];
  },

  _buildGameCompleteTimeline(levelMeta) {
    const timeline = document.getElementById('gc-timeline');
    if (!timeline) return [];

    timeline.innerHTML = '';
    const setSlotHoverState = (slot, isHovered) => {
      slot.classList.toggle('is-hovered', isHovered);
    };

    levelMeta.forEach((meta, i) => {
      const imgSrc = CharacterEngine._humanImages[i] ?? null;
      if (!imgSrc) return;

      if (i > 0) {
        const conn = document.createElement('div');
        conn.className = 'gc-timeline-connector';
        timeline.appendChild(conn);
      }

      const slot = document.createElement('div');
      slot.className = 'gc-char-slot';
      slot.tabIndex = 0;
      slot.innerHTML = `
        <div class="gc-char-avatar"><img src="${imgSrc}" alt="${meta.era}" /></div>
        <div class="gc-char-era">${meta.era}</div>
        <div class="gc-char-tooltip">${meta.topic}</div>
      `;
      slot.addEventListener('pointerenter', () => setSlotHoverState(slot, true));
      slot.addEventListener('pointerleave', () => setSlotHoverState(slot, false));
      slot.addEventListener('focus', () => setSlotHoverState(slot, true));
      slot.addEventListener('blur', () => setSlotHoverState(slot, false));
      timeline.appendChild(slot);
    });

    return [...timeline.querySelectorAll('.gc-char-slot')];
  },

  _setLevelEvolutionButtonState(isReady, hasNextLevel) {
    const button = document.getElementById('evolution-next-btn');
    if (!button) return;
    button.disabled = !isReady;
    button.classList.toggle('is-disabled', !isReady);
    button.textContent = hasNextLevel ? 'Next Level →' : 'Check Score →';
  },

  _finishLevelTransition() {
    this._clearLevelEvolutionTimer();
    GameState.currentLevel++;
    if (GameState.currentLevel >= GAME_DATA.levels.length) {
      this.showGameComplete();
    } else {
      setTheme(GAME_DATA.levels[GameState.currentLevel].theme);
      MusicEngine.play(GameState.currentLevel);
      this.showLevelIntro();
    }
  },

  _launchFireworks() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    const colors = ['#ffd700', '#ffb300', '#c084fc', '#7c3aed', '#2dd4bf', '#e040fb', '#fff7cc'];
    const burstX = Math.random() * window.innerWidth;
    const burstY = Math.random() * window.innerHeight * 0.5; // Upper half
    const particleCount = 35;
    const duration = 1.8; // seconds

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const velocity = 3 + Math.random() * 5; // pixels per ms
      const tx = Math.cos(angle) * velocity * duration * 100;
      const ty = Math.sin(angle) * velocity * duration * 80 + 200; // gravity pull
      
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 5 + Math.random() * 9;
      
      piece.style.left = burstX + 'px';
      piece.style.top = burstY + 'px';
      piece.style.width = size + 'px';
      piece.style.height = size + 'px';
      piece.style.background = color;
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      piece.style.setProperty('--tx', tx + 'px');
      piece.style.setProperty('--ty', ty + 'px');
      piece.style.animationDuration = duration + 's';
      piece.style.boxShadow = `0 0 ${3 + Math.random() * 4}px ${color}`;
      
      container.appendChild(piece);
    }

    // Clean up
    setTimeout(() => container.remove(), duration * 1000 + 100);
  },

  async nextLevel() {
    if (GameState.replayMode) {
      this._leaveReplay();
      return;
    }
    this._stopPolling();
    this._clearLevelEvolutionTimer();
    GameState.currentStage = 'level-evolution';
    await this._preloadLevelEvolutionAssets(GameState.currentLevel);
    showScreen('screen-level-evolution');
    this._setLevelCompleteEvolution(GameState.currentLevel);
    this._levelEvolutionTimer = setTimeout(() => {
      const hasNextLevel = GameState.currentLevel < GAME_DATA.levels.length - 1;
      this._setLevelEvolutionButtonState(true, hasNextLevel);
      this._levelEvolutionTimer = null;
    }, LEVEL_EVOLUTION_MS);
  },

  completeLevelEvolution() {
    const button = document.getElementById('evolution-next-btn');
    if (button?.disabled) return;
    this._finishLevelTransition();
  },

  _leaveReplay() {
    this._stopPolling();
    Timer.stop();
    GameState.replayMode = false;
    GameState.currentStage = 'welcome';
    setTheme('');
    document.body.className = '';
    showScreen('screen-welcome');
    MusicEngine.playWelcome();
    this._updateWelcomeResumeCta();
  },

  _getAchievementRank(totalScore, maxScore = Scoreboard._maxOverallScore()) {
    const safeMax = Math.max(1, Number(maxScore) || Scoreboard._maxOverallScore());
    const pct = Math.round((Math.max(0, Number(totalScore) || 0) / safeMax) * 100);
    if (pct >= 100) {
      return {
        pct,
        name: 'Civilization Synchronizer',
        tier: '✦ Perfect Synchronization — Unified Prompt Mastery ✦'
      };
    }
    if (pct >= 90) {
      return {
        pct,
        name: 'Star Archon',
        tier: 'Cosmic Command of Chaining and Meta-Prompting'
      };
    }
    if (pct >= 80) {
      return {
        pct,
        name: 'Cyberpunk Hacker',
        tier: 'Elite Output Control and Format Engineering'
      };
    }
    if (pct >= 60) {
      return {
        pct,
        name: 'Victorian Engineer',
        tier: 'Strong System Prompting and Role Precision'
      };
    }
    if (pct >= 40) {
      return {
        pct,
        name: 'Roman Orator',
        tier: 'Confident Tone, Context, and Constraint Control'
      };
    }
    return {
      pct,
      name: 'Clay Scribe',
      tier: 'Foundations of Specificity, Audience, and Roles'
    };
  },

  async showGameComplete() {
    GameState.currentStage = 'game-complete';
    this._clearProgress();
    this._clearGameCompleteUiTimeouts();
    setTheme('');
    document.body.classList.add('game-complete');
    document.body.style.setProperty('--completion-bg-image', `url('${COMPLETION_BG_IMAGE}')`);
    MusicEngine.playVictory();

    // Cosmic fireworks
    this._launchFireworks();

    const MAX_SCORE = Scoreboard._maxOverallScore();
    const totalTime = GameState.levelTimes.reduce((s, t) => s + t, 0);
    const achievementRank = this._getAchievementRank(GameState.totalScore, MAX_SCORE);

    // Stat cards
    document.getElementById('gc-rank-name').textContent = achievementRank.name;
    document.getElementById('gc-rank-tier').textContent = achievementRank.tier;
    document.getElementById('gc-accuracy-rate').textContent = `Accuracy: ${achievementRank.pct}% of ${MAX_SCORE} pts`;
    document.getElementById('gc-score-max').textContent = MAX_SCORE;
    document.getElementById('gc-time-display').textContent = Timer.format(totalTime);
    const mins = totalTime / 60000;
    const ppm = mins > 0 ? (GameState.totalScore / mins).toFixed(1) : '—';
    document.getElementById('gc-efficiency').textContent = `${ppm} pts / min`;
    const masteryRecap = this._getMasteryRecap();
    document.getElementById('gc-strongest-skill').textContent = masteryRecap.strongest;
    document.getElementById('gc-practice-next').textContent = masteryRecap.next;
    document.getElementById('gc-subtitle').textContent =
      `${GameState.playerName} guided humanity from clay tablets to the stars.`;

    // Build character evolution timeline
    const levelMeta = [
      { era: 'L1 · Clay Scribe',       topic: 'Achievement:<br>Clear Prompt Foundations<br>Specificity, audience, and roles' },
      { era: 'L2 · Roman Orator',      topic: 'Achievement:<br>Persuasive Context Control<br>Tone, rhetoric, and constraints' },
      { era: 'L3 · Victorian Engineer', topic: 'Achievement:<br>Precision Prompt Architecture<br>Role prompting and system prompts' },
      { era: 'L4 · Cyberpunk Hacker',  topic: 'Achievement:<br>Output Override Mastery<br>Format engineering and response control' },
      { era: 'L5 · Star Archon',       topic: 'Achievement:<br>Cosmic Chain Command<br>Prompt chaining and meta-prompting' },
      { era: 'Civilization Synchronizer', topic: 'Achievement:<br>Civilization Synchronized<br>Unified prompt mastery' }
    ];

    const slots = this._buildGameCompleteTimeline(levelMeta);

    // Sequential fade-in stagger (400ms between each)
    slots.forEach((slot, i) => {
      this._queueGameCompleteUiTimeout(() => slot.classList.add('gc-char-visible'), i * 260);
    });

    // Score counter — counts 0 → final over 1.5s (starts after last char fades in)
    const counterEl = document.getElementById('gc-score-counter');
    const target = GameState.totalScore;
    counterEl.textContent = '0';
    this._queueGameCompleteUiTimeout(() => {
      const start = performance.now();
      const duration = 1500;
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        counterEl.textContent = Math.round(ease * target);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, slots.length * 260 + 260);

    // Mouse parallax on the cosmic background
    const screenEl = document.getElementById('screen-game-complete');
    const parallaxHandler = (e) => {
      const cx = screenEl.clientWidth  / 2;
      const cy = screenEl.clientHeight / 2;
      screenEl.style.setProperty('--px', ((e.clientX - cx) / cx).toFixed(3));
      screenEl.style.setProperty('--py', ((e.clientY - cy) / cy).toFixed(3));
    };
    screenEl.addEventListener('mousemove', parallaxHandler);
    GameState._parallaxCleanup = () => screenEl.removeEventListener('mousemove', parallaxHandler);

    // Leaderboard
    const online  = await Scoreboard._isOnline();
    const overall = await Scoreboard.getOverall();
    document.getElementById('overall-sb-title').innerHTML =
      `🌍 Overall Leaderboard${online ? ' <span class="sb-live-dot">● LIVE</span>' : ''}`;
    this._renderScoreboardTable('overall-scoreboard-body', overall, GameState.playerName, true);

    showScreen('screen-game-complete');

    // Live polling — refresh every 5s
    clearInterval(GameState.pollInterval);
    GameState.pollInterval = setInterval(async () => {
      const live = await Scoreboard.getOverall();
      this._renderScoreboardTable('overall-scoreboard-body', live, GameState.playerName, true);
    }, 5000);

    // Fireworks burst every 5s
    clearInterval(GameState.fireworksInterval);
    GameState.fireworksInterval = setInterval(() => {
      this._launchFireworks();
    }, 5000);
  },

  copyCompletionSummary() {
    const maxScore = Scoreboard._maxOverallScore();
    const rank = this._getAchievementRank(GameState.totalScore, maxScore).name;

    const text = `I just evolved human civilization from Clay to Stars by mastering Prompt Engineering! 🌌 Score: ${GameState.totalScore}/${maxScore} | Rank: ${rank}. Can you beat me? 🚀 Play at https://tantunescisco.github.io/PromptingGame2/`;

    navigator.clipboard.writeText(text).then(() => {
      const btn = document.querySelector('.gc-btn-primary');
      if (btn) {
        btn.classList.add('copied');
        btn.textContent = '✓ Copied to Clipboard!';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.textContent = '📋 Copy Summary to Clipboard';
        }, 2500);
      }
    }).catch(() => {
      alert('Copy failed — please copy manually:\n\n' + text);
    });
  },

  /** Renders rows into a scoreboard tbody.
   *  entries: array of { name, score, timeMs } (level) OR { name, totalScore, totalTimeMs } (overall)
   *  isOverall: boolean — uses totalScore/totalTimeMs keys when true
   */
  async _renderWelcomeLeaderboard() {
    const tbody = document.getElementById('welcome-leaderboard-body');
    if (!tbody) return;
    try {
      const entries = await Scoreboard.getOverall();
      const MEDALS = ['🥇', '🥈', '🥉'];
      if (!entries || entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="lb-loading">No scores yet — be the first!</td></tr>';
        return;
      }
      tbody.innerHTML = entries.slice(0, 5).map((e, i) => {
        const rank = MEDALS[i] || `${i + 1}`;
        const achievementRank = this._getAchievementRank(e.totalScore);
        return `<tr>
          <td class="rank">${rank}</td>
          <td class="player-name">${escHtml(e.name)}</td>
          <td class="rank-achieved">${escHtml(achievementRank.name)}</td>
          <td class="score-val">${e.totalScore} pts</td>
          <td class="time-val">${Timer.format(e.totalTimeMs)}</td>
        </tr>`;
      }).join('');
    } catch {
      tbody.innerHTML = '<tr><td colspan="5" class="lb-loading">Could not load scores.</td></tr>';
    }
  },

  _renderScoreboardTable(tbodyId, entries, currentPlayer, isOverall, maxRows = 20) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const MEDALS = ['🥇', '🥈', '🥉'];
    const scoreKey = isOverall ? 'totalScore' : 'score';
    const timeKey  = isOverall ? 'totalTimeMs' : 'timeMs';

    tbody.innerHTML = entries.slice(0, maxRows).map((e, i) => {
      const rank = MEDALS[i] || `${i + 1}`;
      const isCurrent = e.name === currentPlayer;
      const rowClass = isCurrent ? 'current-player new-entry' : '';
      const rankCell = isOverall
        ? `<td class="rank-achieved">${escHtml(this._getAchievementRank(e[scoreKey]).name)}</td>`
        : '';
      return `<tr class="${rowClass}">
        <td class="rank">${rank}</td>
        <td class="player-name">${escHtml(e.name)}</td>
        ${rankCell}
        <td class="score-val">${e[scoreKey]} pts</td>
        <td class="time-val">${Timer.format(e[timeKey])}</td>
      </tr>`;
    }).join('');
  }
};

// ============================================================
// INIT — Start on welcome screen
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  showScreen('screen-welcome');

  // Start welcome music on first user interaction (browsers require gesture)
  const startWelcomeMusic = () => {
    MusicEngine.playWelcome();
    document.removeEventListener('click', startWelcomeMusic);
    document.removeEventListener('keydown', startWelcomeMusic);
  };
  document.addEventListener('click', startWelcomeMusic, { once: false });
  document.addEventListener('keydown', startWelcomeMusic, { once: false });

  // Quit button
  const quitBtn = document.getElementById('quit-btn');
  if (quitBtn) quitBtn.addEventListener('click', () => GameEngine.quitGame());

  const aboutBtn = document.getElementById('about-btn');
  if (aboutBtn) aboutBtn.addEventListener('click', () => AboutModal.open());

  // Allow Enter key to start game from name field
  const nameInput = document.getElementById('player-name-input');
  if (nameInput) {
    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') GameEngine.startGame();
    });
    nameInput.addEventListener('input', () => {
      nameInput.classList.remove('input-error');
      const nameError = document.getElementById('name-error');
      if (nameError) nameError.classList.add('hidden');
      GameEngine._updateWelcomeResumeCta();
    });
  }

  const levelPreviews = document.querySelector('.level-previews');
  if (levelPreviews) {
    levelPreviews.addEventListener('click', e => {
      const target = e.target.closest('.lp');
      if (!target) return;
      if (target.classList.contains('admin-clickable')) return;
      const levelIndex = Number(String(target.id || '').replace('lp-btn-', ''));
      if (Number.isNaN(levelIndex)) return;
      if (target.classList.contains('resume-clickable')) {
        GameEngine._resumeFromWelcome(levelIndex);
      } else if (target.classList.contains('replay-clickable')) {
        GameEngine._replayCompletedLevel(levelIndex);
      }
    });
  }

  GameEngine._updateWelcomeResumeCta();

  // Hidden trigger: Ctrl+Shift+A keyboard shortcut opens Firebase admin login.
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      AdminMode.showLogin();
    }
  });

  // Hidden trigger: tap/click leaderboard title 5 times within 3 seconds
  const lbTitle = document.querySelector('.scoreboard-title');
  if (lbTitle) {
    let tapCount = 0;
    let tapTimer = null;
    lbTitle.addEventListener('click', () => {
      tapCount++;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { tapCount = 0; }, 3000);
      if (tapCount >= 5) {
        tapCount = 0;
        clearTimeout(tapTimer);
        AdminMode.showLogin();
      }
    });
  }

  const adminPassInput = document.getElementById('admin-password');
  if (adminPassInput) {
    adminPassInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') AdminMode.handleLogin();
    });
  }

  document.getElementById('admin-login-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) AdminMode.closeLogin();
  });
  document.getElementById('about-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) AboutModal.close();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') AboutModal.close();
  });
});
