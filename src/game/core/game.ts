/**
 * Game: orquestador principal. Motor Three.js, bucle de juego,
 * entrada, interacciones, sistemas y flujos de noche/muerte/victoria.
 */
import * as THREE from 'three';
import nightsData from '@/data/nights.json';
import storyData from '@/data/story.json';
import animData from '@/data/animatronics.json';
import type { NightDef, AnimatronicDef, Interactable, NoiseEvent } from './types';
import { WorldBuilder } from '../world/worldbuilder';
import { NavGraph } from '../ai/navgraph';
import { Animatronic, type AIHost, type PlayerLike } from '../ai/animatronic';
import { Player } from '../player/player';
import { SecurityCameras } from '../systems/cameras';
import { MissionSystem } from '../systems/missions';
import { EventDirector } from '../systems/events';
import { AudioEngine } from '../audio/audio';
import { useHud } from './state';
import { loadSave, unlockNight, addTape, addEnding } from '../systems/save';
import { mapData } from '../ai/mapdata';
import { disposeTextures } from '../world/textures';
import { disposeMaterials } from '../world/materials';

type StoryTape = { id: string; title: string; location: string; text: string };
type StoryNote = { id: string; title: string; location: string; text: string };

export class Game {
  renderer!: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera!: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  world!: WorldBuilder;
  nav = new NavGraph();
  player!: Player;
  animatronics: Animatronic[] = [];
  cams!: SecurityCameras;
  missions!: MissionSystem;
  events!: EventDirector;
  audio = new AudioEngine();
  night = 1;
  nightDef!: NightDef;
  mode = 'boot';
  time = 0; // segundos de juego de la noche
  power = 100;
  musicBox = 100;
  holdInteract: { inter: Interactable; progress: number } | null = null;
  interactables: Interactable[] = [];
  noises: NoiseEvent[] = [];
  private hudTimer = 0;
  private raf = 0;
  private lastFrame = 0;
  private danger = 0;
  private dust: THREE.Points | null = null;
  private callLineIdx = 0;
  private callLineTimer = 0;
  private callQueue: string[] = [];
  private deathTimer = 0;
  private dyingAnimatronic: Animatronic | null = null;
  private jumpscareTimer = 0;
  private quality: 'low' | 'medium' | 'high' = 'high';
  private autoQuality = true;
  private fpsAcc = 0;
  private fpsCount = 0;
  private fpsLowTime = 0;
  private disposed = false;
  private windowListeners: Array<[string, EventListenerOrEventListenerObject]> = [];
  private winding = false;
  private maskBlockTimer = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /* ============ INICIALIZACIÓN ============ */

  async init(onProgress: (frac: number, label: string) => void) {
    onProgress(0.05, 'Encendiendo motores 3D...');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const save = loadSave();
    this.quality = save.settings.quality;
    this.applyQuality();
    useHud.getState().setSettings(save.settings);
    useHud.getState().setProgress(save.unlockedNight, save.tapes);
    this.audio.setVolumes(save.settings.master, save.settings.music, save.settings.sfx);

    this.scene.background = new THREE.Color(0x030304);
    this.scene.fog = new THREE.FogExp2(0x05060a, 0.042);
    const hemi = new THREE.HemisphereLight(0x2a3040, 0x060608, 0.8);
    this.scene.add(hemi);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.08, 70);
    this.scene.add(this.camera);

    onProgress(0.15, 'Construyendo la pizzería...');
    await nextFrame();
    this.world = new WorldBuilder(this.scene);
    this.world.buildAll((f, label) => onProgress(0.15 + f * 0.5, label));
    await nextFrame();

    onProgress(0.72, 'Trazando rutas de los animatrónicos...');
    this.nav.build(this.world);

    onProgress(0.8, 'Reclutando al guardia...');
    this.player = new Player(this.camera, {
      world: this.world,
      addNoise: (x, z, r) => this.addNoise(x, z, r),
      sfx: {
        footstep: (pos, surface, running, heavy) => this.audio.footstep(pos, surface, running, heavy),
        locker: (pos) => this.audio.locker(pos),
      },
      power: this.power,
    });

    onProgress(0.88, 'Despertando a los animatrónicos...');
    const host = this.makeAIHost();
    for (const def of (animData as { animatronics: AnimatronicDef[] }).animatronics) {
      this.animatronics.push(new Animatronic(def, host));
    }

    this.cams = new SecurityCameras(window.innerWidth / window.innerHeight, {
      camSwitch: () => this.audio.camSwitch(),
      setStatic: (l) => this.audio.setStatic(l),
    });

    this.buildDust();

    this.setupInput();
    onProgress(0.96, 'Listo para la noche...');
    this.render();
    onProgress(1, 'Completado');
  }

  private makeAIHost(): AIHost {
    return {
      time: 0,
      hour: 0,
      night: 1,
      aggression: 1,
      nav: this.nav,
      world: this.world,
      noises: this.noises,
      musicBoxLevel: 1,
      onDeath: (ai) => this.onDeath(ai),
      sfx: {
        footstep: (pos, kind, running, heavy) => this.audio.footstep(pos, kind, running, heavy),
        servo: (pos, voice) => this.audio.servo(pos, voice),
        roar: (pos, voice) => this.audio.roar(pos, voice),
        doorCreak: (pos) => this.audio.doorCreak(pos),
        ventBang: (pos) => this.audio.ventBang(pos),
        stinger: () => this.audio.stinger(),
        vocal: (pos, voice) => this.audio.vocal(pos, voice),
      },
    };
  }

  private buildDust() {
    const count = this.quality === 'low' ? 0 : this.quality === 'medium' ? 260 : 420;
    if (count === 0) return;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = Math.random() * 3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xbfae8a,
      size: 0.018,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.dust = new THREE.Points(geo, mat);
    this.scene.add(this.dust);
  }

  private updateDust(dt: number) {
    if (!this.dust) return;
    this.dust.position.set(
      Math.round(this.player.pos.x / 8) * 8,
      0,
      Math.round(this.player.pos.z / 8) * 8
    );
    const p = this.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = p.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] += Math.sin(this.time * 0.6 + i) * 0.0008 + 0.0012;
      arr[i] += Math.cos(this.time * 0.4 + i * 0.7) * 0.0006;
      if (arr[i + 1] > 3.1) arr[i + 1] = 0.05;
    }
    p.needsUpdate = true;
  }

  /* ============ NOCHE ============ */

  startNight(n: number) {
    this.night = n;
    this.nightDef = (nightsData as { nights: NightDef[] }).nights.find((x) => x.night === n) ?? (nightsData as { nights: NightDef[] }).nights[0];
    this.time = 0;
    this.power = this.nightDef.startPower;
    this.musicBox = 100;
    this.noises = [];
    this.danger = 0;
    this.world.reset();
    this.player.reset();
    for (const a of this.animatronics) a.reset();
    this.cams.reset(n);
    this.missions = new MissionSystem(this.nightDef, this.world, useHud, this.makeMissionHost());
    this.events = new EventDirector(this.makeEventHost());
    this.buildInteractables();
    this.mode = 'playing';
    useHud.getState().syncHud({
      night: n,
      nightTitle: this.nightDef.title,
      hour: 0,
      power: this.power,
      musicBox: 100,
      objectives: [],
      prompt: null,
      subtitle: null,
      deadBy: null,
      nightComplete: false,
      ending: null,
      jumpscare: null,
    });
    this.missions.syncObjectives();
    this.audio.startAmbient();
    this.audio.setChase(false);
    this.audio.resume();
    // llamada de teléfono programada
    this.callQueue = [];
    this.callLineIdx = 0;
    this.callLineTimer = 0;
  }

  private makeMissionHost() {
    return {
      sfx: {
        alertBeep: () => this.audio.alertBeep(),
        switchClick: () => this.audio.switchClick(),
        keypadBeep: (ok: boolean) => this.audio.keypadBeep(ok),
        powerUp: () => this.audio.powerUp(),
        pickup: () => this.audio.pickup(),
        repairClick: () => this.audio.repairClick(),
      },
      notify: (msg: string) => this.notify(msg),
      setPower: (v: number) => {
        this.power = Math.max(0, Math.min(100, v));
      },
      getPower: () => this.power,
    };
  }

  private makeEventHost() {
    return {
      world: this.world,
      player: this.player,
      animatronics: this.animatronics,
      time: 0,
      night: this.night,
      eventRate: this.nightDef?.eventRate ?? 1,
      audio: {
        knock: (pos: { x: number; y: number; z: number }, count?: number) => this.audio.knock(pos, count),
        whisper: (pos: { x: number; y: number; z: number }) => this.audio.whisper(pos),
        childLaugh: (pos: { x: number; y: number; z: number }) => this.audio.childLaugh(pos),
        radioBurst: (pos: { x: number; y: number; z: number }) => this.audio.radioBurst(pos),
        ventBang: (pos: { x: number; y: number; z: number }) => this.audio.ventBang(pos),
        doorCreak: (pos: { x: number; y: number; z: number }) => this.audio.doorCreak(pos),
        footstep: (pos: { x: number; y: number; z: number }, surface: string, running: boolean, heavy: boolean) =>
          this.audio.footstep(pos, surface, running, heavy),
        setStatic: (l: number) => this.audio.setStatic(l),
        powerDown: () => this.audio.powerDown(),
      },
      addPowerDrain: (v: number) => {
        this.power = Math.max(0, this.power - v);
      },
      onCallStart: (lines: string[]) => this.startCall(lines),
      onKitchenNoise: () => {
        this.notify('RUIDO EN LA COCINA — COMPRUÉBALO');
        const o = this.missions?.objectives.find((x) => x.def.id === 'n2_kitchen');
        if (o && !o.done) o.done = false;
        const gotoObj = this.missions?.objectives.find((x) => x.def.id === 'n2_kitchen');
        if (gotoObj) {
          // activarlo: se completa al llegar
          this.notify('Investiga la cocina');
        }
      },
    };
  }

  /* ============ ENTRADA ============ */

  private setupInput() {
    const kd = (e: KeyboardEvent) => this.onKeyDown(e);
    const ku = (e: KeyboardEvent) => this.onKeyUp(e);
    const mm = (e: MouseEvent) => this.onMouseMove(e);
    const rs = () => this.onResize();
    window.addEventListener('keydown', kd as EventListener);
    window.addEventListener('keyup', ku as EventListener);
    window.addEventListener('mousemove', mm as EventListener);
    window.addEventListener('resize', rs);
    this.windowListeners = [
      ['keydown', kd as EventListener], ['keyup', ku as EventListener], ['mousemove', mm as EventListener], ['resize', rs],
    ];
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.code === 'Tab') e.preventDefault();
    this.player.keys[e.code] = true;
    const st = useHud.getState();
    if (this.mode !== 'playing') {
      if (e.code === 'Escape' && this.mode === 'paused') this.resume();
      return;
    }
    switch (e.code) {
      case 'KeyF':
        if (!this.missions.hasFlashlight) {
          this.notify('La linterna está sobre el escritorio');
          break;
        }
        this.player.toggleFlashlight();
        this.audio.camSwitch();
        break;
      case 'KeyQ':
        this.toggleMask();
        break;
      case 'KeyC':
        this.toggleTablet();
        break;
      case 'ControlLeft':
      case 'ControlRight':
        this.player.crouching = !this.player.crouching;
        break;
      case 'KeyE':
        this.tryInteract();
        break;
      case 'Escape':
        this.pause();
        break;
      case 'Space':
        if (st.tabletOpen && st.tabletCam === 4) {
          this.winding = true;
          e.preventDefault();
        }
        break;
      case 'ArrowLeft':
      case 'KeyA':
        if (st.tabletOpen) this.cams.switchCam(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        if (st.tabletOpen) this.cams.switchCam(1);
        break;
      default:
        if (e.code.startsWith('Digit')) {
          const n = parseInt(e.code.slice(5), 10);
          const stt = useHud.getState();
          if (stt.tabletOpen && n >= 1 && n <= 9) {
            const cam = this.cams.cams.find((c) => c.index === n);
            if (cam) this.cams.setCam(n);
          }
        }
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    this.player.keys[e.code] = false;
    if (e.code === 'Space') this.winding = false;
    if (e.code === 'KeyE') this.holdInteract = null;
  }

  private onMouseMove(e: MouseEvent) {
    if (this.mode !== 'playing') return;
    const locked = document.pointerLockElement === this.canvas;
    if (!locked) {
      // alternativa: arrastrar con el botón izquierdo pulsado
      if (e.buttons & 1) {
        const settings = useHud.getState().settings;
        this.player.onMouseMove(e.movementX, e.movementY, settings.sensitivity, settings.invertY);
      }
      return;
    }
    const settings = useHud.getState().settings;
    this.player.onMouseMove(e.movementX, e.movementY, settings.sensitivity, settings.invertY);
  }

  onCanvasClick() {
    if (this.mode === 'playing' && document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock?.();
    }
  }

  setMouseWinding(v: boolean) {
    this.winding = v;
  }

  private onResize() {
    if (!this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.cams.camera.aspect = w / h;
    this.cams.camera.updateProjectionMatrix();
  }

  private toggleMask() {
    if (this.player.inVent) {
      this.notify('No puedes ponerte la máscara aquí');
      return;
    }
    if (this.maskBlockTimer > 0) return;
    this.maskBlockTimer = 0.6;
    this.player.masked = !this.player.masked;
    this.audio.setBreathing(this.player.masked);
    this.audio.servo(this.player.pos, 'deep');
  }

  private toggleTablet() {
    const st = useHud.getState();
    if (!this.missions.hasTablet) {
      this.notify('La tableta de vigilancia está en la oficina');
      return;
    }
    if (st.note || st.keypadDoor) return;
    const open = !st.tabletOpen;
    st.setTablet(open);
    this.audio.camSwitch();
  }

  /* ============ INTERACCIONES ============ */

  private buildInteractables() {
    this.interactables = [];
    const world = this.world;
    const P = () => this.player;

    // puertas
    for (const door of world.doors.values()) {
      const isStorageB = door.def.id === 'door_storageB';
      const isExit = door.def.id === 'door_exit';
      const isSecret = door.def.id === 'door_secret';
      this.interactables.push({
        id: `door_${door.def.id}`,
        label: isSecret ? 'Empujar la estantería' : door.locked ? 'Puerta bloqueada' : door.open ? 'Cerrar puerta' : 'Abrir puerta',
        pos: { x: door.def.x, y: 1.1, z: door.def.z },
        radius: 1.9,
        enabled: () => this.mode === 'playing' && !P().hidden,
        action: () => {
          if (isSecret && door.locked) {
            door.locked = false;
            this.nav.setDoorBlocked('door_secret', false);
            this.notify('La estantería se desliza hacia dentro... una sala oculta');
            this.audio.doorCreak(new THREE.Vector3(door.def.x, 1, door.def.z));
            door.open = true;
            door.targetAngle = door.group.rotation.y - 1.8;
            return;
          }
          if (door.locked && door.code) {
            useHud.getState().setKeypad(door.def.id);
            this.audio.alertBeep();
            return;
          }
          if (door.locked) {
            if (isExit && this.missions.hasKey) {
              this.finishNight('escape');
              return;
            }
            this.notify(door.def.lockedMsg ?? 'Bloqueada');
            this.audio.keypadBeep(false);
            return;
          }
          door.open = !door.open;
          door.targetAngle = door.group.rotation.y + (door.open ? (Math.random() > 0.5 ? 1.9 : -1.9) : door.open ? 1.9 : -1.6);
          if (!door.open) door.targetAngle = Math.round(door.group.rotation.y / (Math.PI / 2)) * (Math.PI / 2);
          this.audio.doorCreak(new THREE.Vector3(door.def.x, 1, door.def.z));
          this.addNoise(door.def.x, door.def.z, 6);
        },
      });
      if (isStorageB) door.locked = this.night >= 3;
    }

    // escondites
    for (const spot of mapData.hidingSpots) {
      const [x, z] = spot.pos;
      this.interactables.push({
        id: `hide_${spot.id}`,
        label: 'Esconderse',
        pos: { x, y: 0.9, z },
        radius: 1.6,
        enabled: () => this.mode === 'playing' && !P().hidden && !P().inVent,
        action: () => {
          this.player.hide(spot.id, new THREE.Vector3(x, 0, z), 0);
          this.notify('Escondido — mantén silencio [E para salir]');
        },
      });
      this.interactables.push({
        id: `unhide_${spot.id}`,
        label: 'Salir del escondite',
        pos: { x, y: 0.9, z },
        radius: 2.4,
        requireLook: false,
        enabled: () => this.mode === 'playing' && P().hidden === true && P().hiddenSpotId === spot.id,
        action: () => {
          this.player.unhide(new THREE.Vector3(x, 0, z));
        },
      });
    }

    // recogida de linterna y tableta
    const torch = world.anchors.get('desk_torch');
    if (torch) {
      this.interactables.push({
        id: 'pickup_torch',
        label: 'Coger la linterna',
        pos: { x: torch.pos.x, y: torch.pos.y, z: torch.pos.z },
        radius: 1.7,
        enabled: () => !this.missions.hasFlashlight,
        action: () => {
          this.missions.hasFlashlight = true;
          torch.mesh!.visible = false;
          this.audio.pickup();
          this.missions.completeObjective('n1_flashlight');
          this.notify('Linterna equipada [F]');
        },
      });
    }
    const tabletA = world.anchors.get('desk_tablet');
    if (tabletA) {
      this.interactables.push({
        id: 'pickup_tablet',
        label: 'Coger la tableta de vigilancia',
        pos: { x: tabletA.pos.x, y: tabletA.pos.y, z: tabletA.pos.z },
        radius: 1.7,
        enabled: () => !this.missions.hasTablet,
        action: () => {
          this.missions.hasTablet = true;
          tabletA.mesh!.visible = false;
          this.audio.pickup();
          this.missions.completeObjective('n1_flashlight');
          this.notify('Tableta equipada [C]');
        },
      });
    }

    // panel de la oficina (misión 1)
    const officePanel = world.anchors.get('office_panel');
    if (officePanel) {
      this.interactables.push({
        id: 'office_panel',
        label: 'Reparar el panel de la oficina',
        pos: { x: officePanel.pos.x, y: officePanel.pos.y, z: officePanel.pos.z },
        radius: 1.7,
        holdTime: 5,
        holdLabel: 'REPARANDO',
        enabled: () => this.mode === 'playing' && this.night === 1 && !this.missions.objectives.find((o) => o.def.id === 'n1_repair')?.done && this.missions.fusesHeld >= 2,
        action: () => {
          this.missions.fusesHeld -= 2;
          this.audio.repairClick();
          this.missions.completeObjective('n1_repair');
        },
      });
    }

    // panel eléctrico (misión 2)
    const elecPanel = world.anchors.get('electrical_panel');
    if (elecPanel) {
      this.interactables.push({
        id: 'electrical_panel',
        label: 'Insertar fusibles en el panel',
        pos: { x: elecPanel.pos.x, y: elecPanel.pos.y, z: elecPanel.pos.z },
        radius: 1.8,
        holdTime: 6,
        holdLabel: 'INSERTANDO FUSIBLES',
        enabled: () => this.mode === 'playing' && this.night === 2 && this.missions.fusesHeld >= 3,
        action: () => {
          this.missions.fusesHeld -= 3;
          this.power = Math.min(100, this.power + 30);
          this.audio.powerUp();
          this.missions.completeObjective('n2_fuses');
        },
      });
    }

    // soportes de cámara (misión 2)
    for (const [anchorId, objId, camIdx] of [['cam09_mount', 'n2_cam9', 9], ['cam05_mount', 'n2_cam5', 5]] as Array<[string, string, number]>) {
      const a = world.anchors.get(anchorId);
      if (!a) continue;
      this.interactables.push({
        id: anchorId,
        label: 'Reparar la cámara',
        pos: { x: a.pos.x, y: a.pos.y, z: a.pos.z },
        radius: 1.6,
        holdTime: 5,
        holdLabel: 'REPARANDO CÁMARA',
        enabled: () => this.mode === 'playing' && this.night === 2 && !this.missions.objectives.find((o) => o.def.id === objId)?.done,
        action: () => {
          this.cams.repairCam(camIdx);
          this.audio.repairClick();
          this.missions.completeObjective(objId);
        },
      });
    }

    // banco del taller (misión 3)
    const bench = world.anchors.get('workbench');
    if (bench) {
      this.interactables.push({
        id: 'workbench',
        label: 'Reiniciar la estación de mantenimiento',
        pos: { x: bench.pos.x, y: bench.pos.y, z: bench.pos.z },
        radius: 1.7,
        holdTime: 8,
        holdLabel: 'REINICIANDO ESTACIÓN',
        enabled: () => this.mode === 'playing' && this.night === 3 && !this.missions.objectives.find((o) => o.def.id === 'n3_station')?.done,
        action: () => {
          this.audio.powerUp();
          this.missions.completeObjective('n3_station');
        },
      });
    }

    // interruptores del cuarto eléctrico (misiones 4 y 5)
    for (const [targetId, x0, n] of [['west_switches', -15.5, 4], ['master_switches', -12.7, 4]] as Array<[string, number, number]>) {
      for (let i = 0; i < n; i++) {
        const sx = x0 + 0.42 - i * 0.28;
        const switchNo = i + 1;
        this.interactables.push({
          id: `sw_${targetId}_${i}`,
          label: `Interruptor ${switchNo}`,
          pos: { x: sx, y: 1.55, z: 16.55 },
          radius: 1.4,
          enabled: () => {
            if (this.mode !== 'playing') return false;
            if (targetId === 'west_switches') return this.night >= 4 && !this.missions.objectives.find((o) => o.def.id === 'n4_seq')?.done;
            return this.night >= 5 && !this.missions.objectives.find((o) => o.def.id === 'n5_master')?.done;
          },
          action: () => {
            if (!this.missions.sequenceActive() || this.missions.sequenceTargetId !== targetId) {
              this.missions.sequenceTargetId = targetId;
              this.missions.sequenceTarget = targetId === 'west_switches' ? [2, 4, 1, 3] : [3, 1, 4, 2];
              this.missions.sequenceProgress = [];
              this.notify(targetId === 'west_switches' ? 'SECTOR OESTE — introduce la secuencia' : 'FUSIBLE MAESTRO — introduce la secuencia');
            }
            this.missions.pressSwitch(switchNo);
          },
        });
      }
    }

    // tapas de conducto: instalar
    for (const ventId of ['vent_office', 'vent_machinery']) {
      const v = world.vents.get(ventId);
      if (!v) continue;
      const px = v.def.coverAt === 'a' ? v.def.a[0] : v.def.b[0];
      const pz = v.def.coverAt === 'a' ? v.def.a[1] : v.def.b[1];
      this.interactables.push({
        id: `install_${ventId}`,
        label: 'Colocar tapa de conducto',
        pos: { x: px, y: 0.6, z: pz },
        radius: 1.5,
        enabled: () => this.mode === 'playing' && this.night === 4 && this.missions.coversHeld > 0 && !v.coverClosed,
        action: () => {
          this.missions.coversHeld--;
          v.coverClosed = true;
          v.blocked = true;
          if (v.coverMesh) v.coverMesh.visible = true;
          if (v.coverCollider) v.coverCollider.active = true;
          this.nav.setVentBlocked(ventId, true);
          this.audio.switchClick();
          this.missions.progressObjective('n4_covers');
          if (this.missions.coversHeld === 0) {
            const o = this.missions.objectives.find((x) => x.def.id === 'n4_covers');
            if (o && o.count >= 2) this.missions.completeObjective('n4_covers');
          }
        },
      });
      // quitar la tapa
      this.interactables.push({
        id: `remove_${ventId}`,
        label: 'Quitar tapa de conducto',
        pos: { x: px, y: 0.6, z: pz },
        radius: 1.5,
        enabled: () => this.mode === 'playing' && v.coverClosed,
        action: () => {
          v.coverClosed = false;
          v.blocked = false;
          if (v.coverMesh) v.coverMesh.visible = false;
          if (v.coverCollider) v.coverCollider.active = false;
          this.nav.setVentBlocked(ventId, false);
          this.audio.switchClick();
        },
      });
    }

    // monitor de la oficina abre la tableta
    const monitor = world.anchors.get('desk_monitor');
    if (monitor) {
      this.interactables.push({
        id: 'monitor',
        label: 'Consultar el monitor',
        pos: { x: monitor.pos.x, y: monitor.pos.y, z: monitor.pos.z },
        radius: 1.5,
        enabled: () => this.mode === 'playing' && this.missions.hasTablet && !useHud.getState().tabletOpen,
        action: () => this.toggleTablet(),
      });
    }
  }

  private updateInteractions(dt: number) {
    const st = useHud.getState();
    if (this.mode !== 'playing' || st.tabletOpen || st.note || st.keypadDoor) {
      if (st.prompt) st.setPrompt(null);
      this.holdInteract = null;
      return;
    }
    const p = this.player;
    const look = p.lookDir;
    let best: Interactable | null = null;
    let bestScore = -1;
    for (const inter of this.interactables) {
      if (!inter.enabled()) continue;
      const dx = inter.pos.x - p.pos.x;
      const dz = inter.pos.z - p.pos.z;
      const dy = (inter.pos.y ?? 1) - (p.pos.y + 1.5);
      const d = Math.hypot(dx, dz, dy * 0.5);
      if (d > inter.radius) continue;
      let score = 1 - d / inter.radius;
      if (inter.requireLook !== false) {
        const len = Math.hypot(dx, dz) || 1;
        const dot = (dx / len) * look.x + (dz / len) * look.z;
        if (dot < 0.35) continue;
        score += dot * 0.5;
      }
      if (score > bestScore) {
        bestScore = score;
        best = inter;
      }
    }
    // recogidas automáticas (objetos de misión)
    const item = this.missions.itemAt(p.pos, 0.95);
    if (item) {
      this.pickupItem(item.id, item.kind);
    }
    if (best) {
      const holding = this.player.keys['KeyE'];
      if (best.holdTime) {
        if (holding) {
          if (!this.holdInteract || this.holdInteract.inter !== best) {
            this.holdInteract = { inter: best, progress: 0 };
          }
          this.holdInteract.progress += dt / best.holdTime;
          this.addNoise(p.pos.x, p.pos.z, 13);
          if (Math.random() < dt * 6) this.audio.repairClick();
          if (this.holdInteract.progress >= 1) {
            best.action();
            this.holdInteract = null;
            st.setPrompt(null);
          } else {
            st.setPrompt(`${best.holdLabel ?? 'MANTÉN E'} — [E]`, this.holdInteract.progress);
          }
        } else {
          if (this.holdInteract?.inter !== best) this.holdInteract = null;
          st.setPrompt(`${best.label} — mantén [E]`);
        }
      } else {
        this.holdInteract = null;
        st.setPrompt(`${best.label} [E]`);
        if (this.interactPressed) {
          best.action();
          this.interactPressed = false;
        }
      }
    } else {
      if (this.holdInteract) this.holdInteract = null;
      if (st.prompt) st.setPrompt(null);
    }
    if (this.interactPressed) this.interactPressed = false;
  }

  private interactPressed = false;

  private tryInteract() {
    this.interactPressed = true;
  }

  private pickupItem(id: string, kind: string) {
    this.missions.removeItem(id);
    this.audio.pickup();
    switch (kind) {
      case 'fuse':
        this.missions.fusesHeld++;
        this.notify(`Fusible conseguido (${this.missions.fusesHeld})`);
        this.missions.progressObjective(this.night === 1 ? 'n1_fuses' : this.night === 2 ? 'n2_fuses' : 'n3_tapes');
        break;
      case 'battery':
        this.player.addBattery(34);
        this.notify('Batería +34%');
        break;
      case 'cover':
        this.missions.coversHeld++;
        this.notify(`Tapa de conducto (${this.missions.coversHeld}/2)`);
        this.missions.progressObjective('n4_covers');
        break;
      case 'key':
        this.missions.hasKey = true;
        this.notify('LLAVE MAESTRA — ve al vestíbulo de salida');
        this.missions.completeObjective('n5_key');
        break;
      case 'note': {
        const noteId = id.replace('_pick', '');
        const note = (storyData.notes as StoryNote[]).find((x) => x.id === noteId);
        if (note) {
          useHud.getState().setNote({ id: note.id, title: note.title, text: note.text });
        }
        if (noteId === 'note_code') this.notify('La nota contiene un código...');
        break;
      }
      case 'tape': {
        const tape = (storyData.tapes as StoryTape[]).find((x) => x.id === id);
        if (tape) {
          useHud.getState().setNote({ id: tape.id, title: tape.title, text: tape.text });
          const save = addTape(tape.id);
          useHud.getState().setProgress(save.unlockedNight, save.tapes);
        }
        this.missions.progressObjective('n3_tapes');
        break;
      }
    }
  }

  /* ============ LÓGICA DE NOCHE ============ */

  notify(msg: string) {
    const st = useHud.getState();
    st.setAlert(msg);
    window.setTimeout(() => {
      if (useHud.getState().alert === msg) useHud.getState().setAlert(null);
    }, 3200);
  }

  private startCall(lines: string[]) {
    this.callQueue = [...lines];
    this.callLineIdx = 0;
    this.callLineTimer = 1.2;
    const totalDur = lines.reduce((s, l) => s + 2.2 + l.length * 0.036, 0);
    this.audio.phoneBeep();
    this.audio.startPhoneVoice(totalDur);
    useHud.getState().syncHud({ callActive: true });
  }

  private updateCall(dt: number) {
    if (!this.callQueue.length) return;
    this.callLineTimer -= dt;
    if (this.callLineTimer <= 0) {
      const line = this.callQueue[this.callLineIdx];
      if (line !== undefined) {
        useHud.getState().setSubtitle(`☎ ${line}`);
        this.callLineTimer = 2.2 + line.length * 0.036;
        this.callLineIdx++;
        if (this.callLineIdx >= this.callQueue.length) {
          // fin de la llamada
          const finish = window.setTimeout(() => {
            useHud.getState().setSubtitle(null);
            useHud.getState().syncHud({ callActive: false });
            this.audio.stopPhoneVoice();
            this.audio.phoneBeep();
          }, this.callLineTimer * 1000);
          void finish;
          this.callQueue = [];
        }
      }
    }
  }

  keypadSubmit(code: string) {
    const st = useHud.getState();
    const doorId = st.keypadDoor;
    if (!doorId) return;
    const door = this.world.doors.get(doorId);
    if (!door) return;
    if (code === (door.code ?? '1987')) {
      door.locked = false;
      this.nav.setDoorBlocked(doorId, false);
      door.open = true;
      door.targetAngle = door.group.rotation.y + 1.9;
      this.audio.keypadBeep(true);
      this.audio.doorCreak(new THREE.Vector3(door.def.x, 1, door.def.z));
      st.setKeypad(null);
      this.notify('ALMACÉN SUR ABIERTO');
      this.missions.completeObjective('n3_code');
    } else {
      this.audio.keypadBeep(false);
      this.notify('Código incorrecto');
    }
  }

  closeNote() {
    useHud.getState().setNote(null);
    this.audio.pickup();
  }

  private addNoise(x: number, z: number, radius: number) {
    this.noises.push({ x, z, radius, worldTime: this.time });
    if (this.noises.length > 40) this.noises.shift();
  }

  /* ============ MUERTE Y VICTORIA ============ */

  private onDeath(ai: Animatronic) {
    if (this.mode !== 'playing') return;
    this.mode = 'dying';
    this.dyingAnimatronic = ai;
    this.deathTimer = 1.7;
    this.jumpscareTimer = 0;
    this.audio.jumpscare(ai.def.voice);
    this.audio.setChase(false);
    useHud.getState().setJumpscare(ai.def.kind);
    useHud.getState().setTablet(false);
    this.player.setShake(1.4);
    this.holdInteract = null;
    useHud.getState().setPrompt(null);
  }

  private updateDying(dt: number) {
    this.jumpscareTimer += dt;
    // el animatrónico se lanza contra la cámara
    const ai = this.dyingAnimatronic;
    if (ai) {
      const target = this.camera.position.clone();
      const dir = target.clone().sub(ai.pos).normalize();
      ai.pos.addScaledVector(dir, dt * 5.5);
      ai.rig.root.position.copy(ai.pos);
      ai.yaw = Math.atan2(dir.x, dir.z);
      ai.rig.root.rotation.y = ai.yaw;
      const b = ai.rig.bones;
      b.armL.rotation.x = -2.6;
      b.armR.rotation.x = -2.6;
      b.jaw.rotation.x = 0.8;
      this.player.setShake(1.2);
    }
    this.player.update(dt * 0.35);
    this.deathTimer -= dt;
    if (this.deathTimer <= 0) {
      this.mode = 'dead';
      useHud.getState().setMode('dead');
      useHud.getState().setDead(ai ? ai.def.name : 'Algo');
      useHud.getState().setJumpscare(null);
      useHud.getState().setSubtitle(null);
      this.audio.setStatic(0.6);
      this.audio.setBreathing(false);
    }
  }

  retryNight() {
    this.audio.setStatic(0);
    useHud.getState().setDead(null);
    useHud.getState().setJumpscare(null);
    this.startNight(this.night);
    useHud.getState().setMode('playing');
  }

  private finishNight(reason: 'clock' | 'escape') {
    if (this.mode !== 'playing') return;
    this.audio.setChase(false);
    this.audio.setBreathing(false);
    this.audio.victory();
    const st = useHud.getState();
    if (reason === 'escape') {
      const save = loadSave();
      const ending = save.tapes.length >= 10 ? 'secret' : 'normal';
      const lines = ending === 'secret' ? storyData.endingSecret : storyData.endingNormal;
      addEnding(ending);
      st.setEnding(ending, lines);
      this.mode = 'ending';
      st.setMode('ending');
      return;
    }
    const save = unlockNight(this.night + 1);
    st.setProgress(save.unlockedNight, save.tapes);
    this.mode = 'complete';
    st.setMode('complete');
    st.syncHud({ nightComplete: true });
  }

  returnToMenu() {
    this.mode = 'menu';
    this.audio.setStatic(0);
    this.audio.setBreathing(false);
    this.audio.setChase(false);
    this.audio.stopPhoneVoice();
    useHud.getState().setSubtitle(null);
    const st = useHud.getState();
    st.setMode('menu');
    st.setTablet(false);
    st.setDead(null);
    st.setKeypad(null);
    st.setNote(null);
    st.setJumpscare(null);
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    useHud.getState().setMode('paused');
    this.audio.suspend();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    useHud.getState().setMode('playing');
    this.audio.resume();
  }

  applySettings() {
    const s = useHud.getState().settings;
    this.audio.setVolumes(s.master, s.music, s.sfx);
    if (s.quality !== this.quality) {
      this.quality = s.quality;
      this.autoQuality = false;
      this.applyQuality();
    }
  }

  private applyQuality() {
    const dpr = window.devicePixelRatio || 1;
    const pr = this.quality === 'low' ? 0.7 : this.quality === 'medium' ? Math.min(1, dpr) : Math.min(1.75, dpr);
    this.renderer?.setPixelRatio(pr);
    if (this.player) {
      this.player.flashlight.castShadow = this.quality !== 'low';
      this.renderer.shadowMap.enabled = this.quality !== 'low';
    }
  }

  /* ============ BUCLE PRINCIPAL ============ */

  private render = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.render);
    const now = performance.now();
    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (dt > 0.06) dt = 0.06;
    if (dt <= 0) return;

    // auto-ajuste de calidad
    this.fpsAcc += dt;
    this.fpsCount++;
    if (this.fpsAcc > 1) {
      const fps = this.fpsCount / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsCount = 0;
      if (this.autoQuality && this.mode === 'playing') {
        if (fps < 32) this.fpsLowTime += 1;
        else this.fpsLowTime = Math.max(0, this.fpsLowTime - 0.5);
        if (this.fpsLowTime >= 5) {
          if (this.quality === 'high') this.quality = 'medium';
          else if (this.quality === 'medium') this.quality = 'low';
          this.applyQuality();
          this.fpsLowTime = 0;
        }
      }
    }

    if (this.mode === 'playing') {
      this.tick(dt);
    } else if (this.mode === 'dying') {
      this.updateDying(dt);
      this.world.update(dt, this.player.pos);
    } else if (this.mode === 'menu' || this.mode === 'boot') {
      // menú: rotación lenta de cámara ambiental
      this.menuCamera(dt);
    }

    // audio siempre actualizado (para menús)
    if (this.audio.available) {
      this.audio.update(dt);
      this.audio.updateListener(this.camera.position, this.camera.quaternion);
    }

    // render con la cámara activa
    const st = useHud.getState();
    const activeCam = st.tabletOpen && this.mode === 'playing' ? this.cams.camera : this.camera;
    this.renderer.render(this.scene, activeCam);
  };

  private menuCamera(dt: number) {
    const t = performance.now() / 1000;
    this.camera.position.set(Math.sin(t * 0.05) * 3 + 0, 1.7, 13.5 + Math.cos(t * 0.04) * 0.6);
    this.camera.rotation.set(0, Math.PI + Math.sin(t * 0.03) * 0.12, 0);
    this.camera.rotation.order = 'YXZ';
    if (this.world) this.world.update(dt, this.camera.position);
  }

  private tick(dt: number) {
    const st = useHud.getState();
    this.time += dt;
    this.maskBlockTimer = Math.max(0, this.maskBlockTimer - dt);

    // hora del juego
    const minutes = this.nightDef.minutes;
    const hourFloat = (this.time / (minutes * 60)) * 6;
    if (hourFloat >= 6) {
      this.finishNight('clock');
      return;
    }

    // jugador (bloqueado si tablet/nota/teclado abiertos)
    const uiBlocked = st.tabletOpen || !!st.note || !!st.keypadDoor;
    if (!uiBlocked) {
      this.player.update(dt);
    } else {
      this.player.keys = {};
    }

    // IA host actualizado
    const host = this.animatronics[0] ? (this.animatronics[0] as unknown as { host: AIHost }).host : null;
    if (host) {
      host.time = this.time;
      host.hour = hourFloat;
      host.night = this.night;
      host.aggression = this.nightDef.animatronicAggression;
      host.musicBoxLevel = this.musicBox / 100;
      // reutiliza el array compartido de ruidos
    }

    // animatrónicos
    const playerLike = this.player as unknown as PlayerLike;
    for (const a of this.animatronics) {
      a.update(dt, playerLike);
    }

    // máscara: la IA la detecta a través de player.masked
    // sistema de eventos
    this.events.update(dt);
    this.events.checkKitchenNoise(this.time / 60);
    if (!this.events.callDone && this.time / 60 >= this.nightDef.call.atMinute) {
      this.events.triggerCall(this.nightDef.call.lines);
    }
    this.updateCall(dt);

    // objetivo: ir a la cocina (N2)
    if (this.night === 2 && this.events.kitchenNoiseDone) {
      const o = this.missions.objectives.find((x) => x.def.id === 'n2_kitchen');
      if (o && !o.done && this.world.roomIdAt(this.player.pos.x, this.player.pos.z) === 'kitchen') {
        this.missions.completeObjective('n2_kitchen');
      }
    }
    // objetivo: caja musical (N1): completar al dar cuerda (manejado abajo)
    if (this.night === 1 && this.missions.musicBoxWoundOnce) {
      this.missions.completeObjective('n1_musicbox', true);
    }

    // caja musical
    if (this.musicBox > 0) {
      this.musicBox = Math.max(0, this.musicBox - dt * 1.42);
    }
    const windingNow = this.winding && st.tabletOpen && st.tabletCam === 4;
    if (windingNow && this.musicBox < 100) {
      this.musicBox = Math.min(100, this.musicBox + dt * 16);
      if (Math.random() < dt * 3) this.audio.repairClick();
      if (!this.missions.musicBoxWoundOnce) {
        this.missions.musicBoxWoundOnce = true;
        this.missions.completeObjective('n1_musicbox', true);
      }
    }
    this.audio.setMusicBox(this.musicBox / 100, { x: -2, y: 1.2, z: -14.5 });
    if (this.musicBox < 25 && this.musicBox > 0) {
      if (Math.floor(this.time) % 8 === 0 && Math.floor(this.time) !== Math.floor(this.time - dt)) {
        this.audio.alertBeep();
        this.notify('CAJA MUSICAL SIN CUERDA — CAM 04');
      }
    }

    // energía
    let drain = 0.045;
    if (st.tabletOpen) drain += 0.29;
    if (this.player.flashlightOn) drain += 0.05;
    if (this.player.running) drain += 0.06;
    this.power = Math.max(0, this.power - drain * dt);
    this.world.setPowerFactor(this.power > 25 ? 1 : this.power / 25);
    if (this.power <= 0) {
      // apagón total
      for (const r of this.world.rooms.values()) r.lightOn = false;
      if (this.night === 4) {
        // fallo del objetivo de energía
        const o = this.missions.objectives.find((x) => x.def.id === 'n4_power');
        if (o && !o.done) o.done = true; // completado en falso (sobrevive igualmente)
        this.missions.syncObjectives();
      }
    } else if (this.power > 3) {
      for (const r of this.world.rooms.values()) r.lightOn = true;
    }

    // puertas animadas
    for (const d of this.world.doors.values()) {
      if (d.angle !== d.targetAngle) {
        const diff = d.targetAngle - d.group.rotation.y;
        d.group.rotation.y += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
        d.angle = d.group.rotation.y;
        d.collider.active = Math.abs(d.angle - (d.def.axis === 'x' ? 0 : Math.PI / 2)) < 0.5 && !d.open;
        if (Math.abs(diff) < 0.02) {
          d.angle = d.targetAngle;
          d.group.rotation.y = d.targetAngle;
        }
      }
    }

    // tapas de conducto: Clara las tumba
    for (const v of this.world.vents.values()) {
      if (!v.coverClosed) continue;
      const clara = this.animatronics.find((a) => a.def.id === 'clara');
      if (clara && clara.active) {
        const px = v.def.coverAt === 'a' ? v.def.a[0] : v.def.b[0];
        const pz = v.def.coverAt === 'a' ? v.def.a[1] : v.def.b[1];
        const d = Math.hypot(clara.pos.x - px, clara.pos.z - pz);
        if (d < 1.6 && (clara.state === 'chase' || clara.state === 'hunt')) {
          v.coverTimer -= dt;
          if (v.coverTimer < 0 && Math.random() < dt * 1.4) {
            this.audio.ventBang({ x: px, y: 0.6, z: pz });
            v.coverTimer = 2.4;
          }
          if (Math.random() < dt * 0.11) {
            // ¡tapa derribada!
            v.coverClosed = false;
            v.blocked = false;
            if (v.coverMesh) v.coverMesh.visible = false;
            if (v.coverCollider) v.coverCollider.active = false;
            this.nav.setVentBlocked(v.def.id, false);
            this.audio.doorSlam({ x: px, y: 0.6, z: pz });
            this.notify('¡TAPA DE CONDUCTO DERRIBADA!');
          }
        }
      }
    }

    // detección de escondites: si te vieron entrar
    if (this.player.hidden) {
      for (const a of this.animatronics) {
        if (!a.active || a.state === 'dormant') continue;
        const d = a.pos.distanceTo(this.player.pos);
        if (d < 2.0 && (a.state === 'search' || a.state === 'chase' || a.state === 'hunt')) {
          if (Math.random() < dt * 0.35) {
            // te encontró en el escondite
            const spot = mapData.hidingSpots.find((s) => s.id === this.player.hiddenSpotId);
            this.player.unhide(new THREE.Vector3(spot ? spot.pos[0] : this.player.pos.x, 0, spot ? spot.pos[1] : this.player.pos.z));
            a.state = 'chase';
            a.stateTimer = 0;
            this.notify('¡TE HAN ENCONTRADO!');
            break;
          }
        }
      }
    }

    // peligro (para latido y viñeta)
    let danger = 0;
    let chase = false;
    for (const a of this.animatronics) {
      if (!a.active) continue;
      if (a.state === 'chase' || a.state === 'hunt' || a.state === 'attack') {
        chase = true;
        danger = Math.max(danger, 1);
      } else {
        const d = a.pos.distanceTo(this.player.pos);
        danger = Math.max(danger, Math.max(0, 1 - d / 14) * 0.5);
      }
    }
    this.danger = danger;
    this.audio.danger = danger;
    this.audio.setChase(chase);

    // mundo (luces, parpadeos, ventiladores) — foco: jugador o cámara activa
    const focus = st.tabletOpen ? this.cams.camera.position : this.player.pos;
    this.world.update(dt, focus);
    this.updateDust(dt);
    this.updateInteractions(dt);
    this.cams.update(dt, this.animatronics, st.tabletOpen);

    // HUD a 10 Hz
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      useHud.getState().syncHud({
        hour: hourFloat,
        battery: this.player.flashlightBattery,
        stamina: this.player.stamina,
        power: this.power,
        musicBox: this.musicBox,
        maskOn: this.player.masked,
        flashlightOn: this.player.flashlightOn,
        crouching: this.player.crouching,
        inVent: this.player.inVent,
        danger,
        musicBoxCam: st.tabletOpen && st.tabletCam === 4,
        tabletGlitch: this.cams.glitchLevel > 0.55,
      });
    }
  }

  /* ============ LIMPIEZA ============ */

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const [name, fn] of this.windowListeners) {
      window.removeEventListener(name, fn);
    }
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.audio.suspend();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
    disposeTextures();
    disposeMaterials();
    this.renderer?.dispose();
  }
}

function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}
