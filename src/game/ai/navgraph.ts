/**
 * Navegación por rejilla con A* y suavizado por línea de visión.
 * Cubre todo el edificio; los conductos son celdas especiales solo
 * transitables por animatrónicos con acceso a conductos.
 */
import * as THREE from 'three';
import type { WorldBuilder, Collider } from '../world/worldbuilder';
import { mapData } from './mapdata';

const CELL = 0.4;
const MIN_X = mapData.building.minX - 0.5;
const MAX_X = mapData.building.maxX + 0.5;
const MIN_Z = mapData.building.minZ - 0.5;
const MAX_Z = mapData.building.maxZ + 0.5;
const IN_X = mapData.building.minX + 0.1;
const IN_X2 = mapData.building.maxX - 0.1;
const IN_Z = mapData.building.minZ + 0.1;
const IN_Z2 = mapData.building.maxZ - 0.1;

export const GRID_W = Math.ceil((MAX_X - MIN_X) / CELL);
export const GRID_H = Math.ceil((MAX_Z - MIN_Z) / CELL);

/** 0 bloqueado, 1 transitable, 2 conducto, 3 puerta bloqueada */
export class NavGraph {
  grid = new Uint8Array(GRID_W * GRID_H);
  private gScore = new Float32Array(GRID_W * GRID_H);
  private fScore = new Float32Array(GRID_W * GRID_H);
  private cameFrom = new Int32Array(GRID_W * GRID_H);
  private closed = new Uint8Array(GRID_W * GRID_H);
  private openFlag = new Uint8Array(GRID_W * GRID_H);
  private ventCells: number[] = [];

  build(world: WorldBuilder) {
    const radius = 0.3;
    const staticCols = world.colliders.filter((c) => c.id?.startsWith('vent_cover_') ? false : true);
    for (let j = 0; j < GRID_H; j++) {
      for (let i = 0; i < GRID_W; i++) {
        const x = MIN_X + (i + 0.5) * CELL;
        const z = MIN_Z + (j + 0.5) * CELL;
        let v: number = 1;
        // fuera del edificio
        if (x < IN_X || x > IN_X2 || z < IN_Z || z > IN_Z2) v = 0;
        if (v === 1) {
          // colisión con muros / muebles (sin puertas ni tapas)
          v = this.freeAt(x, z, radius, staticCols) ? 1 : 0;
        }
        this.grid[j * GRID_W + i] = v;
      }
    }
    // marcar celdas de conducto
    this.ventCells = [];
    for (const vent of mapData.vents) {
      const pts: Array<[number, number]> = [vent.a, vent.b];
      for (const [ax, az] of pts) {
        for (const [bx, bz] of pts) {
          const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL / 2)) + 2;
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const x = ax + (bx - ax) * t;
            const z = az + (bz - az) * t;
            const i = this.cellX(x);
            const j = this.cellZ(z);
            if (i >= 0 && j >= 0 && i < GRID_W && j < GRID_H) {
              const idx = j * GRID_W + i;
              if (this.grid[idx] !== 0) {
                this.grid[idx] = 2;
                this.ventCells.push(idx);
              }
            }
          }
        }
      }
      // celdas interiores de todos los tramos
      for (const seg of vent.segments) {
        const [x1, z1, x2, z2] = seg;
        const steps = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / (CELL / 2)) + 2;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const x = x1 + (x2 - x1) * t;
          const z = z1 + (z2 - z1) * t;
          const i = this.cellX(x);
          const j = this.cellZ(z);
          if (i >= 0 && j >= 0 && i < GRID_W && j < GRID_H) {
            const idx = j * GRID_W + i;
            if (this.grid[idx] !== 0) {
              this.grid[idx] = 2;
              if (!this.ventCells.includes(idx)) this.ventCells.push(idx);
            }
          }
        }
      }
    }
    // ensanchar celdas transitables alrededor de conductos (el acceso se arrastra)
    // Bloquear puertas con cerrojo (celdas del hueco)
    for (const d of mapData.doors) {
      if (d.locked || d.secret) {
        this.setDoorBlocked(d.id, true);
      }
    }
  }

  private freeAt(x: number, z: number, r: number, cols: Collider[]): boolean {
    for (const c of cols) {
      if (!c.active) continue;
      if (c.id && (c.id.startsWith('door_') || c.id.startsWith('vent_cover_') || c.id.startsWith('vent_side_') || c.id.startsWith('vent_fill'))) continue;
      if (c.id === 'ballpit') { if (this.inBox(x, z, r, c)) return false; continue; }
      if (this.inBox(x, z, r, c)) return false;
    }
    return true;
  }

  private inBox(x: number, z: number, r: number, c: Collider): boolean {
    return (
      x > c.box.min.x - r && x < c.box.max.x + r &&
      z > c.box.min.z - r && z < c.box.max.z + r
    );
  }

  cellX(x: number): number {
    return Math.floor((x - MIN_X) / CELL);
  }

  cellZ(z: number): number {
    return Math.floor((z - MIN_Z) / CELL);
  }

  worldX(i: number): number {
    return MIN_X + (i + 0.5) * CELL;
  }

  worldZ(j: number): number {
    return MIN_Z + (j + 0.5) * CELL;
  }

  /** bloquear/desbloquear celdas del hueco de una puerta (cerrojos) */
  setDoorBlocked(doorId: string, blocked: boolean) {
    const d = mapData.doors.find((dd) => dd.id === doorId);
    if (!d) return;
    const alongX = d.axis === 'x';
    const half = d.width / 2 + 0.15;
    for (let i = this.cellX(d.x - (alongX ? half : 0.3)); i <= this.cellX(d.x + (alongX ? half : 0.3)); i++) {
      for (let j = this.cellZ(d.z - (alongX ? 0.3 : half)); j <= this.cellZ(d.z + (alongX ? 0.3 : half)); j++) {
        if (i < 0 || j < 0 || i >= GRID_W || j >= GRID_H) continue;
        const idx = j * GRID_W + i;
        if (blocked) {
          if (this.grid[idx] !== 0) this.grid[idx] = 3;
        } else if (this.grid[idx] === 3) {
          this.grid[idx] = 1;
        }
      }
    }
  }

  setVentBlocked(ventId: string, blocked: boolean) {
    const v = mapData.vents.find((vv) => vv.id === ventId);
    if (!v) return;
    const ax = v.coverAt === 'a' ? v.a[0] : v.b[0];
    const az = v.coverAt === 'a' ? v.a[1] : v.b[1];
    for (let i = this.cellX(ax - 0.75); i <= this.cellX(ax + 0.75); i++) {
      for (let j = this.cellZ(az - 0.75); j <= this.cellZ(az + 0.75); j++) {
        if (i < 0 || j < 0 || i >= GRID_W || j >= GRID_H) continue;
        const idx = j * GRID_W + i;
        if (this.grid[idx] === 2 || this.grid[idx] === 1) {
          this.grid[idx] = blocked ? 3 : (this.ventCells.includes(idx) ? 2 : 1);
        }
      }
    }
  }

  private walkable(idx: number, ventOK: boolean): boolean {
    const v = this.grid[idx];
    if (v === 1) return true;
    if (v === 2) return ventOK;
    return false;
  }

  /** A* de mundo a mundo; devuelve puntos del mundo */
  findPath(from: THREE.Vector3, to: THREE.Vector3, ventOK: boolean): THREE.Vector3[] {
    let si = this.cellX(from.x);
    let sj = this.cellZ(from.z);
    let ti = this.cellX(to.x);
    let tj = this.cellZ(to.z);
    // normalizar a celdas válidas
    si = this.clamp(si, 0, GRID_W - 1);
    sj = this.clamp(sj, 0, GRID_H - 1);
    ti = this.clamp(ti, 0, GRID_W - 1);
    tj = this.clamp(tj, 0, GRID_H - 1);
    if (!this.walkable(sj * GRID_W + si, ventOK)) {
      const s = this.nearestWalkable(si, sj, ventOK);
      if (s) { si = s[0]; sj = s[1]; } else return [];
    }
    if (!this.walkable(tj * GRID_W + ti, ventOK)) {
      const t = this.nearestWalkable(ti, tj, ventOK, 12);
      if (t) { ti = t[0]; tj = t[1]; } else return [];
    }
    const start = sj * GRID_W + si;
    const goal = tj * GRID_W + ti;
    if (start === goal) return [to.clone()];

    // reiniciar estructuras (lazy clear via generación)
    const gen = new Int32Array(GRID_W * GRID_H);
    let curGen = 1;
    const open: number[] = [];
    const inOpen = new Uint8Array(GRID_W * GRID_H);

    const g = this.gScore;
    const f = this.fScore;
    const came = this.cameFrom;
    const closedF = this.closed;
    const genArr = gen;
    const h = (i: number, j: number) => Math.hypot(ti - i, tj - j);
    const goalI = ti;
    const goalJ = tj;

    genArr[start] = curGen;
    g[start] = 0;
    f[start] = h(si, sj);
    open.push(start);
    inOpen[start] = 1;

    let found = false;
    let guard = 0;
    const maxIter = GRID_W * GRID_H * 2;

    while (open.length > 0 && guard++ < maxIter) {
      // extraer el de menor f (búsqueda lineal sobre open — suficiente con heap ligero)
      let best = 0;
      let bestF = f[open[0]];
      for (let k = 1; k < open.length; k++) {
        if (f[open[k]] < bestF) { bestF = f[open[k]]; best = k; }
      }
      const cur = open[best];
      open[best] = open[open.length - 1];
      open.pop();
      inOpen[cur] = 0;
      if (cur === goal) { found = true; break; }
      closedF[cur] = 1;
      const ci = cur % GRID_W;
      const cj = (cur / GRID_W) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (di === 0 && dj === 0) continue;
          const ni = ci + di;
          const nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= GRID_W || nj >= GRID_H) continue;
          const nIdx = nj * GRID_W + ni;
          if (!this.walkable(nIdx, ventOK)) continue;
          // sin cortar esquinas en diagonal
          if (di !== 0 && dj !== 0) {
            if (!this.walkable(cj * GRID_W + ni, ventOK) || !this.walkable(nj * GRID_W + ci, ventOK)) continue;
          }
          if (genArr[nIdx] !== curGen) {
            genArr[nIdx] = curGen;
            g[nIdx] = Infinity;
            closedF[nIdx] = 0;
          }
          if (closedF[nIdx]) continue;
          const step = di !== 0 && dj !== 0 ? 1.4142 : 1;
          const tentative = g[cur] + step;
          if (tentative < g[nIdx]) {
            came[nIdx] = cur;
            g[nIdx] = tentative;
            f[nIdx] = tentative + h(ni, nj) * 1.05;
            if (!inOpen[nIdx]) {
              open.push(nIdx);
              inOpen[nIdx] = 1;
            }
          }
        }
      }
    }
    if (!found) return [];

    // reconstruir
    const cellsRev: number[] = [];
    let c = goal;
    let safety = 0;
    while (c !== start && safety++ < 10000) {
      cellsRev.push(c);
      c = came[c];
    }
    cellsRev.reverse();
    // puntos del mundo
    const pts: THREE.Vector3[] = [];
    for (const idx of cellsRev) {
      const i = idx % GRID_W;
      const j = (idx / GRID_W) | 0;
      pts.push(new THREE.Vector3(this.worldX(i), 0, this.worldZ(j)));
    }
    if (pts.length > 0) pts[pts.length - 1].set(to.x, 0, to.z);
    return this.smooth(pts, ventOK);
  }

  /** suavizado por línea de visión */
  private smooth(pts: THREE.Vector3[], ventOK: boolean): THREE.Vector3[] {
    if (pts.length < 3) return pts;
    const out: THREE.Vector3[] = [pts[0]];
    let anchor = 0;
    for (let k = 2; k < pts.length; k++) {
      if (!this.los(pts[anchor], pts[k], ventOK)) {
        out.push(pts[k - 1]);
        anchor = k - 1;
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  los(a: THREE.Vector3, b: THREE.Vector3, ventOK: boolean, maxDist = Infinity): boolean {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    if (d > maxDist) return false;
    const steps = Math.ceil(d / (CELL * 0.5));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      const i = this.cellX(x);
      const j = this.cellZ(z);
      if (i < 0 || j < 0 || i >= GRID_W || j >= GRID_H) return false;
      if (!this.walkable(j * GRID_W + i, ventOK)) return false;
    }
    return true;
  }

  private nearestWalkable(i: number, j: number, ventOK: boolean, maxR = 8): [number, number] | null {
    for (let r = 1; r <= maxR; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= GRID_W || nj >= GRID_H) continue;
          if (this.walkable(nj * GRID_W + ni, ventOK)) return [ni, nj];
        }
      }
    }
    return null;
  }

  private clamp(v: number, a: number, b: number): number {
    return Math.max(a, Math.min(b, v));
  }
}
