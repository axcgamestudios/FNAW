/**
 * Game: orquestador principal. Motor Three.js, bucle, entrada,
 * interacciones, capítulos con cinemáticas y modelos GLTF del repo.
 */
import * as THREE from 'three';
import chaptersData from '@/data/chapters.json';
import storyData from '@/data/story.json';
import animData from '@/data/animatronics.json';
import type { ChapterDef, AnimatronicDef, Interactable, NoiseEvent } from './types';
import { WorldBuilder } from '../world/worldbuilder';
import { NavGraph } from '../ai/navgraph';
import { Animatronic, type AIHost, type PlayerLike } from '../ai/animatronic';
import { Player } from '../player/player';
import { SecurityCameras } from '../systems/cameras';
import { MissionSystem } from '../systems/missions';
import { EventDirector } from '../systems/events';
import { CinematicPlayer } from '../systems/cinematic';
import { AudioEngine } from '../audio/audio';
import { useHud } from './state';
import { loadSave, unlockChapter, addTape, addEnding } from '../systems/save';
import { mapData } from '../ai/mapdata';
import { Assets, type GltfRig } from '../world/assets';
import { disposeTextures } from '../world/textures';
import { disposeMaterials } from '../world/materials';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

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
  cine!: CinematicPlayer;
  audio = new AudioEngine();
  chapter = 1;
  chapterDef!: ChapterDef;
  mode = 'boot';
  time = 0; // segundos de juego del capítulo
  power = 100;
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
  private windowListeners: Array<[string, EventListener]> = [];
  private interactPressed = false;
  private menuRig: GltfRig | null = null;
  private menuTwitchT = 0;
  private menuSpot: THREE.SpotLight | null = null;
  private flashlightModel: THREE.Object3D | null = null;
  private flashlightLens: THREE.Mesh | null = null;
  private chapterEndPending = false;
  private powerOut = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /* ============ INICIALIZACIÓN ============ */

  async init(onProgress: (frac: number, label: string) => void) {
    onProgress(0.02, 'Encendiendo motores 3D...');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const save = loadSave();
    this.quality = save.settings.quality;
    useHud.getState().setSettings(save.settings);
    useHud.getState().setProgress(save.unlockedChapter, save.tapes);
    this.audio.setVolumes(save.settings.master, save.settings.music, save.settings.sfx);

    // noche cerrada: fondo casi negro + niebla densa
    this.scene.background = new THREE.Color(0x010102);
    this.scene.fog = new THREE.FogExp2(0x030407, 0.065);
    // hemisferio casi nulo: el edificio está a oscuras, la linterna es esencial
    const hemi = new THREE.HemisphereLight(0x11131c, 0x020203, 0.05);
    this.scene.add(hemi);

    // entorno PMREM sutil: reflejos especulares realistas en metales y suelos
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new RoomEnvironment();
    const envRT = pmrem.fromScene(envScene, 0.06);
    this.scene.environment = envRT.texture;
    (this.scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity = 0.12;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.08, 70);
    this.scene.add(this.camera);

    // cargar modelos GLB y texturas del repositorio
    await Assets.loadAll((f, label) => onProgress(0.05 + f * 0.45, label));

    onProgress(0.55, 'Construyendo la pizzería...');
    await nextFrame();
    this.world = new WorldBuilder(this.scene);
    this.world.buildAll((f, label) => onProgress(0.55 + f * 0.2, label));
    await nextFrame();

    onProgress(0.8, 'Trazando rutas de los animatrónicos...');
    this.nav.build(this.world);

    onProgress(0.84, 'Reclutando al guardia...');
    this.player = new Player(this.camera, {
      world: this.world,
      addNoise: (x, z, r) => this.addNoise(x, z, r),
      sfx: {
        footstep: (pos, surface, running, heavy) => this.audio.footstep(pos, surface, running, heavy),
        locker: (pos) => this.audio.locker(pos),
      },
      power: this.power,
    });
    this.attachFlashlightModel();
    this.buildGuardArms();

    onProgress(0.9, 'Despertando a los animatrónicos...');
    const host = this.makeAIHost();
    for (const def of (animData as { animatronics: AnimatronicDef[] }).animatronics) {
      this.animatronics.push(new Animatronic(def, host));
    }

    this.cams = new SecurityCameras(window.innerWidth / window.innerHeight, {
      camSwitch: () => this.audio.camSwitch(),
      setStatic: (l) => this.audio.setStatic(l),
    });
    this.cine = new CinematicPlayer(this.camera, this.world);

    this.buildDust();

    this.setupInput();
    onProgress(0.97, 'Listo...');
    this.enterMenu();
    this.render();
    onProgress(1, 'Completado');
  }

  /** modelo GLB de la linterna en primera persona (tamaño real, mano derecha) */
  private attachFlashlightModel() {
    const rig = Assets.rigs.get('flashlight');
    if (!rig) return;
    const model = rig.root;
    // el GLB ya está normalizado a ~19 cm por su eje Z (la cabeza apunta a -Z)
    model.position.set(0.3, -0.27, -0.44);
    model.rotation.set(0.05, -0.09, 0.02);
    model.visible = false;
    this.camera.add(model);
    this.flashlightModel = model;
    // lente emisiva en la cabeza del frontal (-Z)
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.022, 16),
      new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffeeb0, emissiveIntensity: 0 })
    );
    lens.position.set(0, 0.0, -0.1);
    lens.rotation.y = Math.PI;
    model.add(lens);
    this.flashlightLens = lens;
  }

  /** brazos del guardia en primera persona sosteniendo la linterna */
  private guardArms: THREE.Group | null = null;
  private guardArmsSway = new THREE.Quaternion();

  private buildGuardArms() {
    const skinTex = Assets.textures?.guardSkin;
    const clothTex = Assets.textures?.guardUniform;
    const group = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({
      map: skinTex ?? null, color: skinTex ? 0xffffff : 0xb08a68, roughness: 0.72, metalness: 0,
    });
    const clothMat = new THREE.MeshStandardMaterial({
      map: clothTex ?? null, color: clothTex ? 0xffffff : 0x27292e, roughness: 0.88, metalness: 0,
    });

    /** miembro cilíndrico del punto A al B (espacio de cámara) */
    const limb = (a: THREE.Vector3, b: THREE.Vector3, rA: number, rB: number, mat: THREE.Material) => {
      const len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rA, rB, len, 10), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      return m;
    };

    // ---- brazo derecho: antebrazo visible desde el borde inferior-derecho ----
    // manga (uniforme) + puño remangado (piel) + mano
    group.add(limb(new THREE.Vector3(0.5, -0.42, -0.1), new THREE.Vector3(0.38, -0.33, -0.24), 0.066, 0.056, clothMat));
    group.add(limb(new THREE.Vector3(0.38, -0.33, -0.24), new THREE.Vector3(0.32, -0.29, -0.33), 0.052, 0.046, skinMat));
    const handR = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.04, 0.09), skinMat);
    handR.position.set(0.305, -0.26, -0.38);
    handR.rotation.y = -0.15;
    const thumbR = new THREE.Mesh(new THREE.BoxGeometry(0.019, 0.018, 0.048), skinMat);
    thumbR.position.set(0.283, -0.242, -0.36);
    group.add(handR, thumbR);

    // ---- brazo izquierdo: sujeta el frente por debajo ----
    group.add(limb(new THREE.Vector3(-0.36, -0.52, -0.12), new THREE.Vector3(-0.08, -0.42, -0.28), 0.064, 0.054, clothMat));
    group.add(limb(new THREE.Vector3(-0.08, -0.42, -0.28), new THREE.Vector3(0.05, -0.37, -0.38), 0.05, 0.045, skinMat));
    const handL = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.044, 0.088), skinMat);
    handL.position.set(0.13, -0.33, -0.43);
    handL.rotation.set(0.2, -0.5, 0);
    const fingersL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.034, 0.052), skinMat);
    fingersL.position.set(0.18, -0.31, -0.48);
    fingersL.rotation.set(0.2, -0.5, 0);
    group.add(handL, fingersL);

    group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        o.frustumCulled = false;
      }
    });
    group.visible = false;
    this.camera.add(group);
    this.guardArms = group;
  }

  /** balanceo de los brazos en primera persona según el paso del jugador */
  private updateGuardArms(dt: number) {
    if (!this.guardArms || !this.guardArms.visible) return;
    const t = performance.now() / 1000;
    const speed = Math.hypot(this.player.vel.x, this.player.vel.z);
    const bobY = Math.sin(t * speed * 2.3) * Math.min(0.02, speed * 0.006);
    const bobX = Math.cos(t * speed * 1.15) * Math.min(0.014, speed * 0.004);
    this.guardArms.position.set(bobX, bobY, 0);
    const target = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.sin(t * speed * 2.3) * 0.012 + Math.sin(t * 1.1) * 0.006, 0, Math.cos(t * speed * 1.15) * 0.01)
    );
    this.guardArmsSway.slerp(target, Math.min(1, dt * 8));
    this.guardArms.quaternion.copy(this.guardArmsSway);
    // lente de la linterna brilla al encender
    if (this.flashlightLens) {
      const m = this.flashlightLens.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = this.player.flashlightOn ? 2.8 : 0.04;
    }
  }

  private makeAIHost(): AIHost {
    return {
      time: 0,
      chapter: 1,
      chapterTime: 0,
      aggression: 1,
      nav: this.nav,
      world: this.world,
      noises: this.noises,
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

  private updateDust(_dt: number) {
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

  /* ============ MENÚ (estilo FNAF: Freddy en estática) ============ */

  enterMenu() {
    this.mode = 'menu';
    useHud.getState().setMode('menu');
    useHud.getState().setTablet(false);
    // Freddy del menú: clon en la oficina mirando a cámara
    if (!this.menuRig && Assets.has('freddy')) {
      this.menuRig = Assets.createVariant('freddy');
      this.menuRig.root.position.set(0, 0, 11.2);
      this.menuRig.root.rotation.y = 0;
      this.scene.add(this.menuRig.root);
    } else if (this.menuRig) {
      this.scene.add(this.menuRig.root);
    }
    // foco cenital tenue sobre Freddy (visible entre la estática)
    if (!this.menuSpot) {
      const spot = new THREE.SpotLight(0xcfd8e8, 60, 9, 0.55, 0.5, 1.6);
      spot.position.set(0.4, 3.05, 12.9);
      spot.target.position.set(0, 2.1, 11.2);
      this.scene.add(spot, spot.target);
      this.menuSpot = spot;
    }
    this.menuSpot.intensity = 60;
    this.audio.setStatic(0);
    this.audio.setBreathing(false);
    this.audio.setChase(false);
    this.audio.stopPhoneVoice();
    useHud.getState().setSubtitle(null);
  }

  private menuCamera(dt: number) {
    const t = performance.now() / 1000;
    // cámara fija frente al rostro de Freddy (2.6 m: mirar ligeramente hacia arriba)
    this.camera.position.set(Math.sin(t * 0.07) * 0.08, 2.18 + Math.sin(t * 0.11) * 0.02, 12.5);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = 0 + Math.sin(t * 0.05) * 0.03;
    this.camera.rotation.x = 0.1;
    // espasmos de cabeza de Freddy
    if (this.menuRig) {
      this.menuTwitchT -= dt;
      const head = this.menuRig.bones.head;
      if (head) {
        if (this.menuTwitchT <= 0) {
          this.menuTwitchT = 1.2 + Math.random() * 3.5;
        }
        const twitch = Math.max(0, this.menuTwitchT - (1.2 + Math.random() * 3.5) + 0.4);
        head.rotation.z = Math.sin(t * 0.8) * 0.03 + (Math.random() < 0.02 ? (Math.random() - 0.5) * 0.2 : 0);
        head.rotation.y = Math.sin(t * 0.33) * 0.08;
      }
      for (const e of this.menuRig.eyes) {
        const mats = Array.isArray(e.material) ? e.material : [e.material];
        for (const m of mats as THREE.MeshStandardMaterial[]) {
          m.emissiveIntensity = 1.2 + (Math.random() < 0.06 ? -1.1 : 0);
        }
      }
      this.menuRig.mixer?.update(dt);
    }
    if (this.world) this.world.update(dt, this.camera.position);
  }

  /* ============ CAPÍTULOS ============ */

  startChapter(n: number) {
    this.chapter = n;
    const chapters = (chaptersData as { chapters: ChapterDef[] }).chapters;
    this.chapterDef = chapters.find((x) => x.chapter === n) ?? chapters[0];
    this.time = 0;
    this.power = this.chapterDef.startPower;
    this.noises = [];
    this.danger = 0;
    this.chapterEndPending = false;
    this.powerOut = false;
    // quitar Freddy del menú y su foco
    if (this.menuRig) this.scene.remove(this.menuRig.root);
    if (this.menuSpot) this.menuSpot.intensity = 0;
    // ocultar linterna/brazos hasta recogerla de nuevo
    if (this.flashlightModel) this.flashlightModel.visible = false;
    if (this.guardArms) this.guardArms.visible = false;
    this.world.reset();
    this.player.reset();
    for (const a of this.animatronics) a.reset();
    this.cams.reset(n);
    this.missions = new MissionSystem(this.chapterDef, this.world, useHud, this.makeMissionHost());
    this.events = new EventDirector(this.makeEventHost());
    this.buildInteractables();
    this.callQueue = [];
    this.callLineIdx = 0;
    this.callLineTimer = 0;
    useHud.getState().syncHud({
      chapter: n,
      chapterTitle: this.chapterDef.title,
      hour: 0,
      power: this.power,
      objectives: [],
      prompt: null,
      subtitle: null,
      deadBy: null,
      chapterComplete: false,
      ending: null,
      jumpscare: null,
    });
    this.missions.syncObjectives();
    this.audio.startAmbient();
    this.audio.setChase(false);
    this.audio.resume();
    // ¿cinemática de entrada?
    if (this.chapterDef.introCinematic) {
      this.playCinematic(this.chapterDef.introCinematic, () => {
        this.beginPlay();
      });
    } else {
      this.beginPlay();
    }
  }

  private beginPlay() {
    this.mode = 'playing';
    useHud.getState().setMode('playing');
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
      night: this.chapter,
      eventRate: this.chapterDef?.eventRate ?? 1,
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
      },
    };
  }

  /* ============ CINEMÁTICAS ============ */

  playCinematic(id: string, onEnd: () => void) {
    this.mode = 'cinematic';
    useHud.getState().setMode('cinematic');
    this.audio.setStatic(0);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    const ok = this.cine.play(id, onEnd);
    if (!ok) {
      this.mode = 'playing';
      useHud.getState().setMode('playing');
      onEnd();
    }
  }

  skipCinematic() {
    if (this.cine.active) this.cine.skip();
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
    if (this.mode === 'cinematic') {
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.skipCinematic();
      } else if (e.code === 'Escape') {
        this.cine.stop(true);
      }
      return;
    }
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
      case 'ArrowLeft':
      case 'KeyA':
        if (useHud.getState().tabletOpen) this.cams.switchCam(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        if (useHud.getState().tabletOpen) this.cams.switchCam(1);
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
    if (e.code === 'KeyE') this.holdInteract = null;
  }

  private onMouseMove(e: MouseEvent) {
    if (this.mode !== 'playing') return;
    const locked = document.pointerLockElement === this.canvas;
    if (!locked) {
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
    if (this.mode === 'cinematic') {
      this.skipCinematic();
      return;
    }
    if (this.mode === 'playing' && document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock?.();
    }
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
    if (open && this.chapter === 1) {
      this.missions.completeObjective('c1_cams', true);
    }
  }

  /* ============ INTERACCIONES ============ */

  private buildInteractables() {
    this.interactables = [];
    const world = this.world;
    const P = () => this.player;
    const ch = this.chapter;

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
              this.finishGame('escape');
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
      if (isStorageB) door.locked = ch >= 3;
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
          this.missions.completeObjective('c1_gear');
          this.notify('Linterna equipada [F]');
          if (this.flashlightModel) this.flashlightModel.visible = true;
          if (this.guardArms) this.guardArms.visible = true;
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
          this.missions.completeObjective('c1_gear');
          this.notify('Tableta equipada [C]');
        },
      });
    }

    // panel de la oficina (cap1)
    const officePanel = world.anchors.get('office_panel');
    if (officePanel) {
      this.interactables.push({
        id: 'office_panel',
        label: 'Reparar el panel de la oficina',
        pos: { x: officePanel.pos.x, y: officePanel.pos.y, z: officePanel.pos.z },
        radius: 1.7,
        holdTime: 5,
        holdLabel: 'REPARANDO',
        enabled: () => this.mode === 'playing' && ch === 1 && !this.missions.objectives.find((o) => o.def.id === 'c1_repair')?.done && this.missions.fusesHeld >= 2,
        action: () => {
          this.missions.fusesHeld -= 2;
          this.audio.repairClick();
          this.missions.completeObjective('c1_repair');
        },
      });
    }

    // panel eléctrico (cap2)
    const elecPanel = world.anchors.get('electrical_panel');
    if (elecPanel) {
      this.interactables.push({
        id: 'electrical_panel',
        label: 'Insertar fusibles en el panel',
        pos: { x: elecPanel.pos.x, y: elecPanel.pos.y, z: elecPanel.pos.z },
        radius: 1.8,
        holdTime: 6,
        holdLabel: 'INSERTANDO FUSIBLES',
        enabled: () => this.mode === 'playing' && ch === 2 && this.missions.fusesHeld >= 3,
        action: () => {
          this.missions.fusesHeld -= 3;
          this.power = Math.min(100, this.power + 30);
          this.audio.powerUp();
          this.missions.completeObjective('c2_fuses');
        },
      });
    }

    // soportes de cámara (cap2)
    for (const [anchorId, objId, camIdx] of [['cam09_mount', 'c2_cam9', 9], ['cam05_mount', 'c2_cam5', 5]] as Array<[string, string, number]>) {
      const a = world.anchors.get(anchorId);
      if (!a) continue;
      this.interactables.push({
        id: anchorId,
        label: 'Reparar la cámara',
        pos: { x: a.pos.x, y: a.pos.y, z: a.pos.z },
        radius: 1.8,
        holdTime: 5,
        holdLabel: 'REPARANDO CÁMARA',
        enabled: () => this.mode === 'playing' && ch === 2 && !this.missions.objectives.find((o) => o.def.id === objId)?.done,
        action: () => {
          this.cams.repairCam(camIdx);
          this.audio.repairClick();
          this.missions.completeObjective(objId);
        },
      });
    }

    // interruptores del fusible maestro (cap4)
    const masterX = -12.7;
    for (let i = 0; i < 4; i++) {
      const sx = masterX + 0.42 - i * 0.28;
      const switchNo = i + 1;
      this.interactables.push({
        id: `sw_master_${i}`,
        label: `Interruptor ${switchNo}`,
        pos: { x: sx, y: 1.55, z: 16.55 },
        radius: 1.4,
        enabled: () => this.mode === 'playing' && ch === 4 && !this.missions.objectives.find((o) => o.def.id === 'c4_master')?.done,
        action: () => {
          if (this.missions.sequenceTargetId !== 'master_switches') {
            this.missions.sequenceTargetId = 'master_switches';
            this.missions.sequenceTarget = [3, 1, 4, 2];
            this.missions.sequenceProgress = [];
            this.notify('FUSIBLE MAESTRO — introduce la secuencia');
          }
          this.missions.pressSwitch(switchNo);
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
        this.missions.progressObjective(this.chapter === 1 ? 'c1_fuses' : 'c2_fuses');
        break;
      case 'battery':
        this.player.addBattery(34);
        this.notify('Batería +34%');
        break;
      case 'key':
        this.missions.hasKey = true;
        this.notify('LLAVE MAESTRA — ve al vestíbulo de salida');
        this.missions.completeObjective('c4_key');
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
          useHud.getState().setProgress(save.unlockedChapter, save.tapes);
        }
        this.missions.progressObjective('c2_tape');
        if (id === 'tape_golden') {
          this.missions.completeObjective('c3_goldtape');
          // ¡Freddy Dorado despierta!
          const golden = this.animatronics.find((a) => a.def.id === 'golden');
          if (golden && !golden.active) {
            this.audio.stinger();
            this.audio.roar(golden.pos, 'deep');
            golden.scriptWake();
            this.notify('ALGO DORADO SE HA LEVANTADO — ¡VUELVE A LA OFICINA!');
            this.player.setShake(0.8);
          }
        }
        break;
      }
    }
  }

  /* ============ LÓGICA DE CAPÍTULO ============ */

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
          const dur = this.callLineTimer;
          this.callQueue = [];
          window.setTimeout(() => {
            useHud.getState().setSubtitle(null);
            useHud.getState().syncHud({ callActive: false });
            this.audio.stopPhoneVoice();
            this.audio.phoneBeep();
          }, dur * 1000);
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
      this.missions.completeObjective('c3_code');
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
    const ai = this.dyingAnimatronic;
    if (ai) {
      const target = this.camera.position.clone();
      const dir = target.clone().sub(ai.pos).normalize();
      ai.pos.addScaledVector(dir, dt * 5.5);
      ai.rig.root.position.copy(ai.pos);
      ai.yaw = Math.atan2(dir.x, dir.z);
      ai.rig.root.rotation.y = ai.yaw;
      ai.poseDying(dt);
      this.player.setShake(1.2);
    }
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

  retryChapter() {
    this.audio.setStatic(0);
    useHud.getState().setDead(null);
    useHud.getState().setJumpscare(null);
    if (this.cine.active) this.cine.stop(false);
    this.startChapter(this.chapter);
  }

  /** fin de capítulo: cinemática de salida + pantalla de completado */
  private completeChapter() {
    if (this.chapterEndPending) return;
    this.chapterEndPending = true;
    this.audio.setChase(false);
    this.audio.setBreathing(false);
    const finish = () => {
      const save = unlockChapter(this.chapter + 1);
      useHud.getState().setProgress(save.unlockedChapter, save.tapes);
      this.mode = 'complete';
      useHud.getState().setMode('complete');
      useHud.getState().syncHud({ chapterComplete: true });
      this.audio.victory();
    };
    if (this.chapterDef.outroCinematic) {
      this.playCinematic(this.chapterDef.outroCinematic, finish);
    } else {
      finish();
    }
  }

  private finishGame(reason: 'escape') {
    if (this.mode !== 'playing') return;
    this.audio.setChase(false);
    this.audio.setBreathing(false);
    const save = loadSave();
    const ending = save.tapes.length >= 10 ? 'secret' : 'normal';
    const lines = ending === 'secret' ? storyData.endingSecret : storyData.endingNormal;
    addEnding(ending);
    const finale = () => {
      useHud.getState().setEnding(ending, lines);
      this.mode = 'ending';
      useHud.getState().setMode('ending');
    };
    if (this.chapterDef.outroCinematic) {
      this.playCinematic(this.chapterDef.outroCinematic, finale);
    } else {
      finale();
    }
  }

  returnToMenu() {
    if (this.cine.active) this.cine.stop(false);
    this.enterMenu();
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
    } else if (this.mode === 'cinematic') {
      this.cine.update(dt);
      this.world.update(dt, this.camera.position);
    } else if (this.mode === 'menu' || this.mode === 'boot') {
      this.menuCamera(dt);
    } else if (this.mode === 'dead' || this.mode === 'complete' || this.mode === 'ending') {
      // escena congelada con la última cámara
      this.world.update(dt, this.camera.position);
    }

    if (this.audio.available) {
      this.audio.update(dt);
      if (this.mode !== 'cinematic') {
        this.audio.updateListener(this.camera.position, this.camera.quaternion);
      } else {
        this.audio.updateListener(this.camera.position, this.camera.quaternion);
      }
    }

    const st = useHud.getState();
    const tabletRendering = st.tabletOpen && this.mode === 'playing';
    // la tableta renderiza con más exposición (visión nocturna de las cámaras)
    this.renderer.toneMappingExposure = tabletRendering ? 3.0 : 1.0;
    // brazos del guardia en primera persona
    if (this.mode === 'playing') this.updateGuardArms(dt);
    const activeCam = tabletRendering ? this.cams.camera : this.camera;
    this.renderer.render(this.scene, activeCam);
  };

  private tick(dt: number) {
    if (!this.chapterDef || !this.missions) return;
    const st = useHud.getState();
    this.time += dt;

    // jugador (bloqueado si tablet/nota/teclado abiertos)
    const uiBlocked = st.tabletOpen || !!st.note || !!st.keypadDoor;
    if (!uiBlocked) {
      this.player.update(dt);
    } else {
      this.player.keys = {};
    }

    // IA host actualizado
    const host = this.animatronics[0]?.host;
    if (host) {
      host.time = this.time;
      host.chapter = this.chapter;
      host.chapterTime = this.time;
      host.aggression = this.chapterDef.aggression;
    }

    // animatrónicos (solo los del capítulo despiertan; el resto sigue dormido)
    const playerLike = this.player as unknown as PlayerLike;
    for (const a of this.animatronics) {
      if (!a.def.activeChapters.includes(this.chapter) && !a.active) {
        a.update(dt * 0.2, playerLike); // dormido: animación mínima
        continue;
      }
      a.update(dt, playerLike);
    }

    // eventos
    this.events.update(dt);
    this.events.checkKitchenNoise(this.time / 60);
    if (!this.events.callDone && this.chapterDef.radio && this.time / 60 >= this.chapterDef.radio.atMinute) {
      this.events.triggerCall(this.chapterDef.radio.lines);
    }
    this.updateCall(dt);

    // objetivos de desplazamiento (los de "volver" solo al final)
    const room = this.world.roomIdAt(this.player.pos.x, this.player.pos.z);
    const othersDoneFor = (excludeId: string) =>
      this.missions.objectives
        .filter((o) => o.def.id !== excludeId && !o.def.optional && o.def.type !== 'survive')
        .every((o) => o.done);
    const gotoChecks: Array<[string, string, boolean]> = [
      ['c2_kitchen', 'kitchen', false],
      ['c1_return', 'office', true],
      ['c2_return', 'office', true],
      ['c3_survive', 'office', false],
    ];
    for (const [objId, roomId, requireOthers] of gotoChecks) {
      const o = this.missions.objectives.find((x) => x.def.id === objId);
      if (o && !o.done && room === roomId && (!requireOthers || othersDoneFor(o.def.id))) {
        this.missions.completeObjective(objId);
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
      // apagón total: solo quedan las rojas de emergencia
      for (const r of this.world.rooms.values()) r.lightOn = false;
      this.powerOut = true;
    } else if (this.powerOut && this.power > 30) {
      // red recuperada: vuelve la tenue luz de la oficina
      this.powerOut = false;
      const office = this.world.rooms.get('office');
      if (office) office.lightOn = true;
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

    // tapas de conducto: Bonnie las tumba
    for (const v of this.world.vents.values()) {
      if (!v.coverClosed) continue;
      const bonnie = this.animatronics.find((a) => a.def.id === 'bonnie');
      if (bonnie && bonnie.active) {
        const px = v.def.coverAt === 'a' ? v.def.a[0] : v.def.b[0];
        const pz = v.def.coverAt === 'a' ? v.def.a[1] : v.def.b[1];
        const d = Math.hypot(bonnie.pos.x - px, bonnie.pos.z - pz);
        if (d < 1.6 && (bonnie.state === 'chase' || bonnie.state === 'hunt')) {
          v.coverTimer -= dt;
          if (v.coverTimer < 0 && Math.random() < dt * 1.4) {
            this.audio.ventBang({ x: px, y: 0.6, z: pz });
            v.coverTimer = 2.4;
          }
          if (Math.random() < dt * 0.11) {
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

    // detección de escondites
    if (this.player.hidden) {
      for (const a of this.animatronics) {
        if (!a.active || a.state === 'dormant') continue;
        const d = a.pos.distanceTo(this.player.pos);
        if (d < 2.0 && (a.state === 'search' || a.state === 'chase' || a.state === 'hunt')) {
          if (Math.random() < dt * 0.35) {
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

    // peligro
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

    // mundo (luces); en modo tableta se impulsa la sala del feed
    this.world.camView = st.tabletOpen;
    const focus = st.tabletOpen ? this.cams.camera.position : this.player.pos;
    this.world.update(dt, focus);
    this.updateDust(dt);
    this.updateInteractions(dt);
    this.cams.update(dt, this.animatronics, st.tabletOpen);

    // fin de capítulo: todos los objetivos requeridos
    if (!this.chapterEndPending && this.missions.allRequiredDone()) {
      this.completeChapter();
      return;
    }

    // HUD a 10 Hz
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      useHud.getState().syncHud({
        battery: this.player.flashlightBattery,
        stamina: this.player.stamina,
        power: this.power,
        maskOn: this.player.masked,
        flashlightOn: this.player.flashlightOn,
        crouching: this.player.crouching,
        inVent: this.player.inVent,
        danger,
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
