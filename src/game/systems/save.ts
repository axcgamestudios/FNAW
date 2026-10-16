/**
 * Guardado y ajustes en localStorage con recuperación de datos inválidos.
 */
import type { GameSave, GameSettings } from '../core/types';

const KEY = 'bruno_nights_save_v1';

const DEFAULT_SETTINGS: GameSettings = {
  master: 0.9,
  music: 0.7,
  sfx: 0.95,
  sensitivity: 1,
  invertY: false,
  quality: 'high',
  subtitleSize: 'medium',
};

const DEFAULT_SAVE: GameSave = {
  unlockedNight: 1,
  tapes: [],
  endings: [],
  settings: DEFAULT_SETTINGS,
};

export function loadSave(): GameSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const data = JSON.parse(raw) as Partial<GameSave>;
    return {
      unlockedNight: typeof data.unlockedNight === 'number' && data.unlockedNight >= 1 && data.unlockedNight <= 6 ? Math.floor(data.unlockedNight) : 1,
      tapes: Array.isArray(data.tapes) ? data.tapes.filter((t) => typeof t === 'string').slice(0, 50) : [],
      endings: Array.isArray(data.endings) ? data.endings.filter((t) => typeof t === 'string').slice(0, 10) : [],
      settings: { ...DEFAULT_SETTINGS, ...(typeof data.settings === 'object' && data.settings ? data.settings : {}) },
      lastNight: typeof data.lastNight === 'number' ? data.lastNight : undefined,
    };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function writeSave(save: GameSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* almacenamiento no disponible: el juego sigue funcionando */
  }
}

export function unlockNight(n: number): GameSave {
  const s = loadSave();
  if (n > s.unlockedNight) s.unlockedNight = Math.min(6, n);
  s.lastNight = n;
  writeSave(s);
  return s;
}

export function addTape(id: string): GameSave {
  const s = loadSave();
  if (!s.tapes.includes(id)) s.tapes.push(id);
  writeSave(s);
  return s;
}

export function addEnding(e: string): GameSave {
  const s = loadSave();
  if (!s.endings.includes(e)) s.endings.push(e);
  writeSave(s);
  return s;
}

export function saveSettings(settings: GameSettings): GameSave {
  const s = loadSave();
  s.settings = settings;
  writeSave(s);
  return s;
}

export function resetSave(): GameSave {
  const s = { ...DEFAULT_SAVE, tapes: [], endings: [] };
  writeSave(s);
  return s;
}
