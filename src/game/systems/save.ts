/**
 * Guardado y ajustes en localStorage con recuperación de datos inválidos.
 */
import type { GameSave, GameSettings } from '../core/types';

const KEY = 'fnaw_save_v2';
const OLD_KEY = 'bruno_nights_save_v1';

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
  unlockedChapter: 1,
  tapes: [],
  endings: [],
  settings: DEFAULT_SETTINGS,
};

export function loadSave(): GameSave {
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) raw = localStorage.getItem(OLD_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const data = JSON.parse(raw) as Partial<GameSave> & { unlockedNight?: number };
    const unlocked = typeof data.unlockedChapter === 'number'
      ? data.unlockedChapter
      : typeof data.unlockedNight === 'number' ? data.unlockedNight : 1;
    return {
      unlockedChapter: unlocked >= 1 && unlocked <= 5 ? Math.floor(unlocked) : 1,
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

export function unlockChapter(n: number): GameSave {
  const s = loadSave();
  if (n > s.unlockedChapter) s.unlockedChapter = Math.min(7, n);
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
