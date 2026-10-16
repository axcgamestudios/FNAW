/**
 * Tipos compartidos del juego — Complejo Bruno MEGAPLEX
 */

export type GameMode =
  | 'boot'
  | 'menu'
  | 'loading'
  | 'intro'
  | 'cinematic'
  | 'playing'
  | 'paused'
  | 'dead'
  | 'complete'
  | 'ending';

export interface ChapterDef {
  chapter: number;
  id: string;
  title: string;
  enemies: string[];
  aggression: number;
  eventRate: number;
  startPower: number;
  introCinematic?: string;
  outroCinematic?: string;
  lines: string[];
  radio?: { atMinute: number; lines: string[] };
  objectives: ObjectiveDef[];
}

export interface RoomDef {
  id: string;
  name: string;
  /** Rectángulo [x1, z1, x2, z2] */
  rect: [number, number, number, number];
  floor: 'tile' | 'wood' | 'concrete' | 'carpet' | 'metal' | 'checker' | 'polished';
  wall: 'wallpaper' | 'concrete' | 'tile' | 'metal';
  /** Altura de techo de la sala (por defecto 3.6) */
  height?: number;
  ambientLight?: { intensity: number; color?: number; flicker?: number };
  camPos?: [number, number, number];
  camLook?: [number, number, number];
}

/** Muro explícito del plano (x1,z1)-(x2,z2) con huecos */
export interface WallDef {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  wallType: RoomDef['wall'];
  /** altura del muro (por defecto la del edificio) */
  h?: number;
  openings?: WallOpening[];
}

export interface WallOpening {
  at: number;
  width: number;
  height?: number;
}

export interface DoorDef {
  id: string;
  /** Centro del hueco */
  x: number;
  z: number;
  /** 'x' = hueco en pared que corre a lo largo del eje X (abre en Z) */
  axis: 'x' | 'z';
  width: number;
  roomA: string;
  roomB: string;
  locked?: boolean;
  lockedMsg?: string;
  code?: string;
  secret?: boolean;
}

export interface VentDef {
  id: string;
  from: string;
  to: string;
  /** Punto de acceso en cada extremo */
  a: [number, number];
  b: [number, number];
  /** Tramos del túnel [x1,z1,x2,z2] en orden */
  segments: Array<[number, number, number, number]>;
  coverAt?: 'a' | 'b';
}

export interface CamDef {
  index: number;
  name: string;
  room: string;
  pos: [number, number, number];
  look: [number, number, number];
  audioOnly?: boolean;
  /** La caja musical se da cuerda desde esta cámara */
  musicBox?: boolean;
}

export interface AnimatronicDef {
  id: string;
  name: string;
  kind: string;
  startRoom: string;
  startOffset?: [number, number];
  /** Capítulos en los que está activo */
  activeChapters: number[];
  /** Retardo (segundos desde el inicio del capítulo) para despertar */
  wakeDelay: number[];
  /** Se despierta por guion (no por temporizador) */
  scriptAwake?: boolean;
  speedWalk: number;
  speedRun: number;
  visionDist: number;
  visionFov: number;
  hearing: number;
  attackRange: number;
  attackWindup: number;
  maskFoolable: boolean;
  maskFoolTime: number;
  /** none | repel | freeze */
  flashlight: 'none' | 'repel' | 'freeze';
  ventAccess: boolean;
  patrolRooms: string[];
  voice: 'deep' | 'screech' | 'clank' | 'rusty' | 'chime';
  eyeColor: number;
  persistent?: boolean;
}

export interface ObjectiveDef {
  id: string;
  title: string;
  hint: string;
  type: 'goto' | 'collect' | 'interact' | 'hold' | 'sequence' | 'keypad' | 'survive' | 'system' | 'trial';
  room?: string;
  target?: string;
  count?: number;
  minutes?: number;
  optional?: boolean;
}

/* ============ PRUEBAS (trials) ============ */

export interface TrialTaskDef {
  id: string;
  label: string;
  at: [number, number];
  hold: number;
  /** requerir mirar el objeto */
}

export type TrialScare =
  | { at: 'start' | 'task1' | 'task2' | 'task3' | 'task4' | 'end'; type: 'stingerClose'; msg?: string }
  | { at: 'start' | 'task1' | 'task2' | 'task3' | 'task4' | 'end'; type: 'hunterAppear'; pos: [number, number]; msg?: string }
  | { at: 'start' | 'task1' | 'task2' | 'task3' | 'task4' | 'end'; type: 'lightsOut'; dur: number; msg?: string }
  | { at: 'start' | 'task1' | 'task2' | 'task3' | 'task4' | 'end'; type: 'fakeSteps'; msg?: string }
  | { at: 'start' | 'task1' | 'task2' | 'task3' | 'task4' | 'end'; type: 'childLaugh'; msg?: string }
  | { at: 'start' | 'task1' | 'task2' | 'task3' | 'task4' | 'end'; type: 'hunterChase'; msg?: string }
  | { at: 'start' | 'task1' | 'task2' | 'task3' | 'task4' | 'end'; type: 'ventBang'; msg?: string };

export interface TrialDef {
  id: string;
  name: string;
  chapter: number;
  /** sala donde ocurre la prueba */
  room: string;
  /** enemigo que caza durante la prueba */
  hunter: string;
  /** sala de respawn del jugador al fallar */
  respawnRoom: string;
  respawnPos: [number, number];
  respawnYaw: number;
  /** sala donde se recoloca el cazador al respawn */
  hunterResetRoom: string;
  /** mult. de agresión del cazador durante la prueba */
  aggression: number;
  introMsg: string;
  tasks: TrialTaskDef[];
  scares: TrialScare[];
  successMsg: string;
}

export interface NightDef {
  night: number;
  title: string;
  minutes: number;
  intro: string[];
  call: { atMinute: number; lines: string[] };
  objectives: ObjectiveDef[];
  animatronicAggression: number;
  eventRate: number;
  startPower: number;
  endAction?: 'escape';
}

export interface WeightedEvent {
  id: string;
  weight: number;
  minNight?: number;
}

export interface GameSave {
  unlockedChapter: number;
  tapes: string[];
  endings: string[];
  settings: GameSettings;
  lastNight?: number;
}

export interface GameSettings {
  master: number;
  music: number;
  sfx: number;
  sensitivity: number;
  invertY: boolean;
  quality: 'low' | 'medium' | 'high';
  subtitleSize: 'small' | 'medium' | 'large';
}

export interface HudObjective {
  id: string;
  title: string;
  done: boolean;
  optional?: boolean;
}

export interface Interactable {
  id: string;
  label: string;
  pos: { x: number; y: number; z: number };
  radius: number;
  /** requerir mirar hacia el objeto */
  requireLook?: boolean;
  enabled: () => boolean;
  action: () => void;
  holdTime?: number;
  holdLabel?: string;
  once?: boolean;
}

export interface NoiseEvent {
  x: number;
  z: number;
  radius: number;
  worldTime: number;
}
