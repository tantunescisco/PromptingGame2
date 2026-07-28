/* Shared leaderboard storage for Prompt Quest 2. */

"use strict";

// ============================================================
// FIREBASE CONFIG  (Tier-1 shared storage — works on GitHub Pages)
// ─────────────────────────────────────────────────────────────
// The configured Firebase Realtime Database exposes shared score reads while
// Firebase Authentication and database rules govern score writes.
//
// When set, ALL participants — even on GitHub Pages — share the same
// live scoreboard in real time. Leave empty to use server.py or localStorage.
// ─────────────────────────────────────────────────────────────
const FIREBASE_URL = 'https://promptinggamedb-default-rtdb.europe-west1.firebasedatabase.app'; // Firebase Realtime Database

// ============================================================
// SCOREBOARD STORAGE
// — Tier 1: authenticated Firebase Realtime Database score storage
// — Tier 2: localStorage fallback when Firebase is unavailable
// ============================================================
const Scoreboard = {
  _lsKey:      'pq_scores',
  _apiOnline:  null,              // null = not yet checked
  _fbEnabled:  !!FIREBASE_URL,   // true when Firebase URL is configured

  _validLevelIds() {
    return new Set(GAME_DATA.levels.map(level => String(level.id)));
  },

  _maxLevelScore(levelId) {
    const level = GAME_DATA.levels.find(entry => String(entry.id) === String(levelId));
    const exerciseCount = level ? Math.min(level.exercises.length, 4) : 0;
    const streakBonus = (exerciseCount >= 3 ? 2 : 0) + (exerciseCount >= 4 ? 3 : 0);
    return exerciseCount * 10 + streakBonus;
  },

  _maxOverallScore() {
    return GAME_DATA.levels.reduce((sum, level) => sum + this._maxLevelScore(level.id), 0);
  },

  _sanitizeEntry(levelId, entry) {
    if (!entry || !entry.name) return null;
    const name = String(entry.name).trim();
    if (!name) return null;
    const maxScore = this._maxLevelScore(levelId);
    const rawScore = Number(entry.score);
    const rawTimeMs = Number(entry.timeMs);
    return {
      name,
      score: Math.max(0, Math.min(Number.isFinite(rawScore) ? rawScore : 0, maxScore)),
      timeMs: Math.max(0, Number.isFinite(rawTimeMs) ? rawTimeMs : 0)
    };
  },

  _normalizeLevelEntries(levelId, entries) {
    if (!Array.isArray(entries)) return [];
    return entries
      .map(entry => this._sanitizeEntry(levelId, entry))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.timeMs - b.timeMs);
  },

  _aggregateOverall(levelEntriesById) {
    const validLevelIds = this._validLevelIds();
    const best = {};

    Object.entries(levelEntriesById).forEach(([lid, entries]) => {
      if (!validLevelIds.has(String(lid)) || !Array.isArray(entries)) return;

      const seen = {};
      entries.forEach(entry => {
        const candidate = this._sanitizeEntry(lid, entry);
        if (!candidate) return;
        const existing = seen[candidate.name];
        if (!existing || candidate.score > existing.score ||
            (candidate.score === existing.score && candidate.timeMs < existing.timeMs)) {
          seen[candidate.name] = candidate;
        }
      });

      Object.values(seen).forEach(entry => {
        if (!best[entry.name]) best[entry.name] = { name: entry.name, totalScore: 0, totalTimeMs: 0 };
        best[entry.name].totalScore += entry.score;
        best[entry.name].totalTimeMs += entry.timeMs;
      });
    });

    const maxOverallScore = this._maxOverallScore();
    return Object.values(best)
      .map(entry => ({
        ...entry,
        totalScore: Math.min(entry.totalScore, maxOverallScore)
      }))
      .sort((a, b) => b.totalScore - a.totalScore || a.totalTimeMs - b.totalTimeMs);
  },

  // ── Firebase helpers ─────────────────────────────────────
  async _fbGet(levelId) {
    const r    = await fetch(`${FIREBASE_URL}/scores/${levelId}.json`);
    const data = await r.json();
    if (!data || typeof data !== 'object') return [];
    return this._normalizeLevelEntries(levelId, Object.values(data));
  },

  async _fbOverall() {
    const r    = await fetch(`${FIREBASE_URL}/scores.json`);
    const data = await r.json();
    if (!data || typeof data !== 'object') return [];
    const normalized = Object.fromEntries(
      Object.entries(data).map(([lid, levelObj]) => [
        lid,
        levelObj && typeof levelObj === 'object' ? Object.values(levelObj) : []
      ])
    );
    return this._aggregateOverall(normalized);
  },

  // ── REST API (server.py) availability check ───────────────
  async _isApiOnline() {
    if (this._apiOnline !== null) return this._apiOnline;
    if (window.location.protocol === 'file:') { this._apiOnline = false; return false; }
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 2500);
      const r    = await fetch('/api/scores/1', { signal: ctrl.signal });
      clearTimeout(tid);
      this._apiOnline = r.ok || r.status === 200;
    } catch { this._apiOnline = false; }
    return this._apiOnline;
  },

  // Returns true when ANY shared backend is available (for LIVE badge)
  async _isOnline() {
    return this._fbEnabled || (await this._isApiOnline());
  },

  async _firebaseService() {
    const service = window.PromptQuestScoreService;
    if (!service) return null;
    await service.ready;
    return service.configured ? service : null;
  },

  // ── Public API (3-tier, async) ────────────────────────────
  async saveLevel(levelId, name, score, timeMs) {
    const sanitized = this._sanitizeEntry(levelId, { name, score, timeMs });
    if (!sanitized) return this.getLevel(levelId);

    const service = await this._firebaseService();
    if (service) {
      try {
        await service.saveScore(levelId, sanitized);
        return await this.getLevel(levelId);
      } catch {}
    }

    return this._lsSave(levelId, sanitized.name, sanitized.score, sanitized.timeMs);
  },

  async getLevel(levelId) {
    if (this._fbEnabled) {
      try { return await this._fbGet(levelId); } catch {}
    }
    if (await this._isApiOnline()) {
      try {
        const r = await fetch(`/api/scores/${levelId}`);
        if (r.ok) return this._normalizeLevelEntries(levelId, await r.json());
      } catch {}
    }
    return this._lsGet(levelId);
  },

  async getOverall() {
    if (this._fbEnabled) {
      try { return await this._fbOverall(); } catch {}
    }
    if (await this._isApiOnline()) {
      try {
        const r = await fetch('/api/scores/overall');
        if (r.ok) return await r.json();
      } catch {}
    }
    return this._lsOverall();
  },

  async resetLeaderboard() {
    const service = await this._firebaseService();
    if (service) return service.resetLeaderboard();
    if (this._fbEnabled || await this._isApiOnline()) {
      throw new Error('The shared leaderboard is unavailable. Please try again.');
    }
    try { localStorage.removeItem(this._lsKey); } catch {}
    return true;
  },

  // ── localStorage fallback ─────────────────────────────────
  _lsLoad() {
    try { return JSON.parse(localStorage.getItem(this._lsKey)) || {}; }
    catch { return {}; }
  },
  _lsSave(levelId, name, score, timeMs) {
    const all = this._lsLoad();
    if (!all[levelId]) all[levelId] = [];
    all[levelId].push({ name, score, timeMs, date: Date.now() });
    all[levelId] = this._normalizeLevelEntries(levelId, all[levelId]);
    try { localStorage.setItem(this._lsKey, JSON.stringify(all)); } catch {}
    return all[levelId];
  },
  _lsGet(levelId) {
    const all = this._lsLoad();
    return this._normalizeLevelEntries(levelId, all[levelId] || []);
  },
  _lsOverall() {
    return this._aggregateOverall(this._lsLoad());
  },
};

