/**
 * Datos del mapa reexportados con tipado (evita importar JSON en varios módulos).
 */
import rawMap from '@/data/map.json';
import type { RoomDef, DoorDef, VentDef, CamDef, WallDef } from '../core/types';

export const mapData = rawMap as unknown as {
  building: { minX: number; maxX: number; minZ: number; maxZ: number; wallHeight: number; wallThickness: number };
  playerSpawn: { x: number; z: number; yaw: number };
  rooms: RoomDef[];
  walls: WallDef[];
  doors: DoorDef[];
  openings: Array<{ comment: string; x0: number; x1: number; z: number; axis: string }>;
  vents: VentDef[];
  cams: CamDef[];
  hidingSpots: Array<{ id: string; room: string; pos: [number, number]; type: string; look: [number, number] }>;
  batterySpots: Array<[number, number]>;
};
