/**
 * Estado compartido motor ↔ React (zustand).
 * El motor escribe; los componentes de UI leen.
 */
import { create } from 'zustand';
import type { GameMode, GameSettings, HudObjective } from './types';

export interface NoteView {
  id: string;
  title: string;
  text: string;
}

export interface HudState {
  mode: GameMode;
  loadingProgress: number;
  loadingLabel: string;
  chapter: number;
  chapterTitle: string;
  hour: number; // 0..6 (solo estético en cinemáticas)
  battery: number;
  stamina: number;
  power: number;
  musicBox: number;
  maskOn: boolean;
  flashlightOn: boolean;
  inVent: boolean;
  crouching: boolean;
  danger: number;
  objectives: HudObjective[];
  prompt: string | null;
  holdProgress: number | null;
  subtitle: string | null;
  callActive: boolean;
  tabletOpen: boolean;
  tabletCam: number;
  tabletGlitch: boolean;
  musicBoxCam: boolean;
  alert: string | null;
  keypadDoor: string | null;
  note: NoteView | null;
  deadBy: string | null;
  chapterComplete: boolean;
  ending: 'normal' | 'secret' | null;
  jumpscare: string | null;
  cinematic: boolean;
  cinematicText: string | null;
  cinematicSkip: boolean;
  settings: GameSettings;
  unlockedChapter: number;
  tapes: string[];
  pointerLockHint: boolean;
  introLines: string[];
  endingLines: string[];

  setMode: (m: GameMode) => void;
  setLoading: (p: number, label: string) => void;
  syncHud: (data: Partial<HudState>) => void;
  setPrompt: (p: string | null, hold?: number | null) => void;
  setSubtitle: (s: string | null) => void;
  setTablet: (open: boolean, cam?: number) => void;
  setKeypad: (door: string | null) => void;
  setNote: (n: NoteView | null) => void;
  setAlert: (a: string | null) => void;
  setDead: (by: string | null) => void;
  setJumpscare: (k: string | null) => void;
  setSettings: (s: GameSettings) => void;
  setProgress: (unlocked: number, tapes: string[]) => void;
  setPointerHint: (v: boolean) => void;
  setIntro: (lines: string[]) => void;
  setEnding: (e: 'normal' | 'secret' | null, lines: string[]) => void;
}

export const useHud = create<HudState>()((set) => ({
  mode: 'boot',
  loadingProgress: 0,
  loadingLabel: 'Iniciando...',
  chapter: 1,
  chapterTitle: '',
  hour: 0,
  battery: 100,
  stamina: 100,
  power: 100,
  musicBox: 100,
  maskOn: false,
  flashlightOn: false,
  inVent: false,
  crouching: false,
  danger: 0,
  objectives: [],
  prompt: null,
  holdProgress: null,
  subtitle: null,
  callActive: false,
  tabletOpen: false,
  tabletCam: 1,
  tabletGlitch: false,
  musicBoxCam: false,
  alert: null,
  keypadDoor: null,
  note: null,
  deadBy: null,
  chapterComplete: false,
  ending: null,
  jumpscare: null,
  cinematic: false,
  cinematicText: null,
  cinematicSkip: false,
  settings: {
    master: 0.9,
    music: 0.7,
    sfx: 0.95,
    sensitivity: 1,
    invertY: false,
    quality: 'high',
    subtitleSize: 'medium',
  },
  unlockedChapter: 1,
  tapes: [],
  pointerLockHint: false,
  introLines: [],
  endingLines: [],

  setMode: (m) => set({ mode: m }),
  setLoading: (p, label) => set({ loadingProgress: p, loadingLabel: label }),
  syncHud: (data) => set(data),
  setPrompt: (p, hold) => set({ prompt: p, holdProgress: hold ?? null }),
  setSubtitle: (s) => set({ subtitle: s }),
  setTablet: (open, cam) => set((st) => ({ tabletOpen: open, tabletCam: cam ?? st.tabletCam })),
  setKeypad: (door) => set({ keypadDoor: door }),
  setNote: (n) => set({ note: n }),
  setAlert: (a) => set({ alert: a }),
  setDead: (by) => set({ deadBy: by }),
  setJumpscare: (k) => set({ jumpscare: k }),
  setSettings: (s) => set({ settings: s }),
  setProgress: (unlocked, tapes) => set({ unlockedChapter: unlocked, tapes }),
  setPointerHint: (v) => set({ pointerLockHint: v }),
  setIntro: (lines) => set({ introLines: lines }),
  setEnding: (e, lines) => set({ ending: e, endingLines: lines }),
}));
