/**
 * Misiones y objetivos por noche: spawn de objetos, reparaciones,
 * secuencias de interruptores, teclados numéricos y escape final.
 */
import * as THREE from 'three';
import chaptersData from '@/data/chapters.json';
import storyData from '@/data/story.json';
import type { ChapterDef, ObjectiveDef, Interactable } from '../core/types';
import { createPickupMesh } from '../world/props';
import type { WorldBuilder } from '../world/worldbuilder';
import type { useHud } from '../core/state';

type HudStore = typeof useHud;

export interface ObjectiveRT {
  def: ObjectiveDef;
  done: boolean;
  count: number;
}

interface SpawnedItem {
  id: string;
  mesh: THREE.Object3D;
  colliderId?: string;
  kind: string;
}

const TAPE_CHAPTER: Record<number, string[]> = {
  1: ['tape_w1', 'tape_w7'],
  2: ['tape_w2', 'tape_w3'],
  3: ['tape_w4', 'tape_w9'],
  4: ['tape_w6', 'tape_w5'],
  5: ['tape_w8'],
  6: ['tape_golden'],
};

/** fichas doradas del recreativo (cap 2) */
const TOKEN_SPOTS: Array<[number, number]> = [
  [-12.6, -13.5], [-6.2, -14.2], [-4.5, -10.8],
];

export class MissionSystem {
  chapter: ChapterDef;
  world: WorldBuilder;
  store: HudStore;
  objectives: ObjectiveRT[] = [];
  items: SpawnedItem[] = [];
  fusesHeld = 0;
  coversHeld = 0;
  keycards = 0;
  tokensHeld = 0;
  hasKey = false;
  hasTablet = false;
  hasFlashlight = false;
  kitchenEventDone = false;
  musicBoxWoundOnce = false;
  sequenceProgress: number[] = [];
  sequenceTarget: number[] = [];
  sequenceTargetId = '';
  game: MissionHost;
  exitReached = false;

  constructor(chapter: ChapterDef, world: WorldBuilder, store: HudStore, game: MissionHost) {
    this.chapter = chapter;
    this.world = world;
    this.store = store;
    this.game = game;
    this.objectives = chapter.objectives.map((o) => ({ def: o, done: false, count: 0 }));
    this.spawnItems();
    this.syncObjectives();
  }

  /* ============ SPAWN DE OBJETOS ============ */

  private spawnItems() {
    const n = this.chapter.chapter;
    // cintas
    (TAPE_CHAPTER[n] ?? []).forEach((tapeId) => {
      const tape = (storyData.tapes as Array<{ id: string; title: string; location: string; text: string }>).find((t) => t.id === tapeId);
      if (tape) this.spawnPickup(tape.id, 'tape', `tape_${tape.location}`);
    });
    // notas de lore
    if (n >= 1) this.spawnPickup('note_order_pick', 'note', 'note_order');
    if (n >= 6) this.spawnPickup('note_master_pick', 'note', 'note_master');
    // fichas doradas (cap2, para la bolera)
    if (n === 2) {
      TOKEN_SPOTS.forEach(([x, z], i) => {
        this.spawnPickupAt(`token_${i}`, 'token', new THREE.Vector3(x, 0.08, z));
      });
    }
    // baterías (todos los capítulos, 6 aleatorias)
    const spots = this.world.map.batterySpots.slice();
    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(Math.random() * spots.length);
      const [x, z] = spots.splice(idx, 1)[0] ?? [0, 0];
      this.spawnPickupAt(`battery_${i}`, 'battery', new THREE.Vector3(x + (Math.random() - 0.5), 0.06, z + (Math.random() - 0.5)));
    }
  }

  private anchorPos(anchorId: string): THREE.Vector3 | null {
    const a = this.world.anchors.get(anchorId);
    return a ? a.pos.clone() : null;
  }

  private spawnPickup(id: string, kind: string, anchorId: string) {
    const pos = this.anchorPos(anchorId);
    if (!pos) return;
    this.spawnPickupAt(id, kind, pos);
  }

  private spawnPickupAt(id: string, kind: string, pos: THREE.Vector3) {
    const mesh = createPickupMesh(
      (kind === 'token' ? 'part' : kind) as 'fuse' | 'tape' | 'note' | 'battery' | 'cover' | 'key' | 'keycard' | 'part'
    );
    mesh.position.copy(pos);
    if (kind === 'note') {
      mesh.rotation.x = -Math.PI / 2.4;
      mesh.position.y = 1.02;
    }
    if (kind === 'battery' || kind === 'tape' || kind === 'fuse') mesh.position.y = 0.08;
    this.world.root.add(mesh);
    this.items.push({ id, mesh, kind });
    // animación de flotación sutil para visibilidad
    const y0 = mesh.position.y;
    this.world.propAnims.push({
      update: (_dt, t) => {
        if (mesh.visible) mesh.position.y = y0 + Math.sin(t * 2 + pos.x) * 0.015 + 0.01;
      },
    });
  }

  removeItem(id: string) {
    const it = this.items.find((i) => i.id === id);
    if (it) {
      it.mesh.visible = false;
      this.items = this.items.filter((i) => i.id !== id);
    }
  }

  itemAt(pos: THREE.Vector3, radius: number): SpawnedItem | null {
    for (const it of this.items) {
      if (!it.mesh.visible) continue;
      const d = Math.hypot(it.mesh.position.x - pos.x, it.mesh.position.z - pos.z);
      if (d < radius) return it;
    }
    return null;
  }

  /* ============ OBJETIVOS ============ */

  syncObjectives() {
    this.store.getState().syncHud({
      objectives: this.objectives.map((o) => ({
        id: o.def.id,
        title: o.count > 0 && o.def.count ? `${o.def.title} (${o.count}/${o.def.count})` : o.def.title,
        done: o.done,
        optional: o.def.optional,
      })),
    });
  }

  completeObjective(id: string, silent = false) {
    const o = this.objectives.find((x) => x.def.id === id);
    if (!o || o.done) return;
    o.done = true;
    if (!silent) {
      this.game.sfx.alertBeep();
      this.game.notify('OBJECTIVE COMPLETE');
    }
    this.syncObjectives();
  }

  progressObjective(id: string, addCount = 1) {
    const o = this.objectives.find((x) => x.def.id === id);
    if (!o || o.done) return;
    o.count += addCount;
    if (o.def.count && o.count >= o.def.count) {
      this.completeObjective(id);
    }
    this.syncObjectives();
  }

  allRequiredDone(): boolean {
    return this.objectives.filter((o) => !o.def.optional && o.def.type !== 'survive').every((o) => o.done);
  }

  /* ============ SECUENCIAS DE INTERRUPTORES ============ */

  beginSequence(targetId: 'west_switches' | 'master_switches') {
    this.sequenceTargetId = targetId;
    this.sequenceTarget = targetId === 'west_switches' ? [2, 4, 1, 3] : [3, 1, 4, 2];
    this.sequenceProgress = [];
  }

  sequenceActive(): boolean {
    return this.sequenceTargetId !== '';
  }

  pressSwitch(switchNo: number): 'ok' | 'wrong' | 'done' | 'inactive' {
    if (!this.sequenceActive()) {
      // iniciar automáticamente al primer interruptor del panel correspondiente
      return 'inactive';
    }
    const expected = this.sequenceTarget[this.sequenceProgress.length];
    if (switchNo === expected) {
      this.sequenceProgress.push(switchNo);
      this.game.sfx.switchClick();
      if (this.sequenceProgress.length === this.sequenceTarget.length) {
        // ¡secuencia correcta!
        this.game.sfx.powerUp();
        if (this.sequenceTargetId === 'west_switches') {
          this.game.setPower(this.game.getPower() + 45);
          this.completeObjective('c4_master');
        } else {
          this.game.setPower(100);
          this.completeObjective('c4_master');
          this.game.notify('POWER RESTORED — THE EXIT HAS LIGHT');
        }
        this.sequenceTargetId = '';
        return 'done';
      }
      return 'ok';
    }
    // error: reinicio
    this.sequenceProgress = [];
    this.game.sfx.keypadBeep(false);
    this.game.notify('WRONG SEQUENCE — BREAKER TRIPPED');
    this.game.setPower(Math.max(3, this.game.getPower() - 8));
    return 'wrong';
  }

  reset() {
    for (const it of this.items) {
      this.world.root.remove(it.mesh);
    }
    this.items = [];
    this.fusesHeld = 0;
    this.coversHeld = 0;
    this.hasKey = false;
    this.exitReached = false;
    this.kitchenEventDone = false;
    this.musicBoxWoundOnce = false;
    this.sequenceTargetId = '';
    this.sequenceProgress = [];
  }
}

export interface MissionHost {
  sfx: {
    alertBeep(): void;
    switchClick(): void;
    keypadBeep(ok: boolean): void;
    powerUp(): void;
    pickup(): void;
    repairClick(): void;
  };
  notify(msg: string): void;
  setPower(v: number): void;
  getPower(): number;
}
