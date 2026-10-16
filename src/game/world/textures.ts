/**
 * Texturas procedurales PBR generadas en canvas.
 * Todas las superficies usan color + bump + roughness derivados,
 * sin dependencias externas (evita CORS / assets faltantes).
 */
import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();
const setCache = new Map<string, PbrSet>();

function makeCanvas(size = 512): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

/** Ruido de grano / suciedad */
function grain(ctx: CanvasRenderingContext2D, size: number, amount: number, alpha = 0.14) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  // manchas grandes translúcidas
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 8 + Math.random() * 46;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = Math.random() > 0.35;
    g.addColorStop(0, dark ? `rgba(20,16,10,${alpha})` : `rgba(120,105,80,${alpha * 0.5})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Arañazos lineales */
function scratches(ctx: CanvasRenderingContext2D, size: number, count: number, color = 'rgba(30,25,18,0.25)') {
  ctx.strokeStyle = color;
  for (let i = 0; i < count; i++) {
    ctx.lineWidth = 0.5 + Math.random() * 1.6;
    ctx.beginPath();
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 90, y + (Math.random() - 0.5) * 30);
    ctx.stroke();
  }
}

function toTex(c: HTMLCanvasElement, repeat: [number, number] = [1, 1]): THREE.Texture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function toBump(c: HTMLCanvasElement, repeat: [number, number]): THREE.Texture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 2;
  return t;
}

/** Versión en escala de grises para bump */
function grayCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (d[i] * 0.33 + d[i + 1] * 0.5 + d[i + 2] * 0.17) | 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export interface PbrSet {
  map: THREE.Texture;
  bumpMap: THREE.Texture;
  bumpScale: number;
  roughness: number;
  metalness?: number;
  emissiveMap?: THREE.Texture;
}

function set(
  key: string,
  repeat: [number, number],
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  opts: { roughness: number; metalness?: number; bumpScale?: number; noBump?: boolean }
): PbrSet {
  const ck = `${key}_set`;
  if (setCache.has(ck)) return setCache.get(ck)!;
  const [c, ctx] = makeCanvas(512);
  draw(ctx, 512);
  const map = toTex(c, repeat);
  let bumpMap: THREE.Texture;
  if (opts.noBump) {
    bumpMap = map;
  } else {
    bumpMap = toBump(grayCanvas(c), repeat);
  }
  const s: PbrSet = {
    map,
    bumpMap,
    bumpScale: opts.bumpScale ?? 0.02,
    roughness: opts.roughness,
    metalness: opts.metalness ?? 0,
  };
  setCache.set(ck, s);
  return s;
}

/* ============ SUELOS ============ */

// Baldosa blanca/negra clásica de pizzería, sucia
function drawTile(ctx: CanvasRenderingContext2D, size: number, a: string, b: string) {
  const n = 8;
  const s = size / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? a : b;
      ctx.fillRect(i * s, j * s, s, s);
      // bordes de lechada
      ctx.strokeStyle = 'rgba(40,36,30,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(i * s, j * s, s, s);
    }
  }
  grain(ctx, size, 36, 0.20);
  scratches(ctx, size, 24);
}

export const floorTile = () =>
  set('floorTile', [6, 6], (ctx, s) => drawTile(ctx, s, '#b9b2a4', '#20201e'), { roughness: 0.55, bumpScale: 0.03 });

export const floorChecker = () =>
  set('floorChecker', [10, 10], (ctx, s) => drawTile(ctx, s, '#9b948a', '#17181a'), { roughness: 0.5, bumpScale: 0.03 });

export const floorWood = () =>
  set('floorWood', [4, 4], (ctx, s) => {
    ctx.fillStyle = '#5c3d22';
    ctx.fillRect(0, 0, s, s);
    const planks = 8;
    const ph = s / planks;
    for (let i = 0; i < planks; i++) {
      const shade = 0.75 + Math.random() * 0.5;
      ctx.fillStyle = `rgb(${(92 * shade) | 0},${(61 * shade) | 0},${(34 * shade) | 0})`;
      ctx.fillRect(0, i * ph, s, ph - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, i * ph + ph - 2, s, 2);
      // vetas
      ctx.strokeStyle = 'rgba(30,18,8,0.35)';
      ctx.lineWidth = 1;
      for (let v = 0; v < 6; v++) {
        const y = i * ph + Math.random() * ph;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(s * 0.3, y + 4, s * 0.6, y - 4, s, y + 2);
        ctx.stroke();
      }
    }
    grain(ctx, s, 30, 0.25);
    scratches(ctx, s, 40);
  }, { roughness: 0.7, bumpScale: 0.035 });

export const floorConcrete = () =>
  set('floorConcrete', [5, 5], (ctx, s) => {
    ctx.fillStyle = '#4a463f';
    ctx.fillRect(0, 0, s, s);
    grain(ctx, s, 46, 0.3);
    // grietas
    ctx.strokeStyle = 'rgba(15,14,12,0.5)';
    for (let i = 0; i < 8; i++) {
      ctx.lineWidth = 0.8 + Math.random();
      ctx.beginPath();
      let x = Math.random() * s;
      let y = Math.random() * s;
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (Math.random() - 0.5) * 80;
        y += (Math.random() - 0.5) * 80;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, { roughness: 0.92, bumpScale: 0.05 });

export const floorCarpet = () =>
  set('floorCarpet', [6, 6], (ctx, s) => {
    ctx.fillStyle = '#6e2030';
    ctx.fillRect(0, 0, s, s);
    // patrón de confeti
    const colors = ['#d8b13a', '#3a8fd8', '#d84a3a', '#4ad86e', '#c98ad8'];
    for (let i = 0; i < 140; i++) {
      ctx.save();
      ctx.translate(Math.random() * s, Math.random() * s);
      ctx.rotate(Math.random() * Math.PI);
      ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
      ctx.globalAlpha = 0.55;
      ctx.fillRect(-3, -1.2, 6, 2.4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    grain(ctx, s, 40, 0.35);
  }, { roughness: 0.95, bumpScale: 0.06 });

export const floorMetal = () =>
  set('floorMetal', [4, 4], (ctx, s) => {
    ctx.fillStyle = '#3c4044';
    ctx.fillRect(0, 0, s, s);
    // placas metálicas
    ctx.strokeStyle = 'rgba(12,14,16,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, s - 2, s - 2);
    ctx.strokeRect(1, s / 2, s - 2, s / 2);
    // remaches
    ctx.fillStyle = '#1c2024';
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(20 + (i % 4) * 157, 20 + ((i / 4) | 0) * 236, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // óxido
    for (let i = 0; i < 16; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const r = 6 + Math.random() * 22;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(96,52,24,0.4)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    grain(ctx, s, 24, 0.12);
  }, { roughness: 0.45, metalness: 0.75, bumpScale: 0.04 });

/* ============ PAREDES ============ */

export const wallTile = () =>
  set('wallTile', [6, 3], (ctx, s) => {
    ctx.fillStyle = '#8f8a80';
    ctx.fillRect(0, 0, s, s);
    // azulejos con banda superior
    const rows = 6;
    const rh = s / rows;
    for (let r = 0; r < rows; r++) {
      for (let cIdx = 0; cIdx < 4; cIdx++) {
        ctx.fillStyle = `rgba(${(150 + Math.random() * 18) | 0},${(146 + Math.random() * 16) | 0},${(136 + Math.random() * 14) | 0},1)`;
        ctx.fillRect(cIdx * (s / 4) + 2, r * rh + 2, s / 4 - 4, rh - 4);
      }
    }
    // franja decorativa
    ctx.fillStyle = '#7a3434';
    ctx.fillRect(0, rh * 2.5, s, rh);
    grain(ctx, s, 26, 0.22);
    scratches(ctx, s, 30);
  }, { roughness: 0.4, bumpScale: 0.05 });

export const wallWallpaper = () =>
  set('wallWallpaper', [6, 2], (ctx, s) => {
    ctx.fillStyle = '#4f5a52';
    ctx.fillRect(0, 0, s, s);
    // rayas verticales festivas
    for (let x = 0; x < s; x += 64) {
      ctx.fillStyle = x % 128 === 0 ? '#5d6b60' : '#434e47';
      ctx.fillRect(x, 0, 64, s);
      ctx.fillStyle = 'rgba(216,177,58,0.16)';
      ctx.fillRect(x + 28, 0, 6, s);
    }
    // estrellitas
    ctx.fillStyle = 'rgba(220,190,90,0.22)';
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        const r = k % 2 ? 3 : 7;
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    }
    // franja inferior ajada
    const g = ctx.createLinearGradient(0, s * 0.62, 0, s);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(24,20,14,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, s * 0.62, s, s * 0.38);
    grain(ctx, s, 34, 0.28);
  }, { roughness: 0.8, bumpScale: 0.02 });

export const wallConcrete = () =>
  set('wallConcrete', [5, 2], (ctx, s) => {
    ctx.fillStyle = '#565148';
    ctx.fillRect(0, 0, s, s);
    grain(ctx, s, 44, 0.32);
    ctx.strokeStyle = 'rgba(20,18,15,0.4)';
    for (let i = 0; i < 6; i++) {
      ctx.lineWidth = 0.7 + Math.random() * 0.8;
      ctx.beginPath();
      let x = Math.random() * s;
      let y = 0;
      ctx.moveTo(x, y);
      while (y < s) {
        y += 30 + Math.random() * 50;
        x += (Math.random() - 0.5) * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // mancha de humedad
    const g = ctx.createRadialGradient(s * 0.7, s * 0.3, 10, s * 0.7, s * 0.3, 130);
    g.addColorStop(0, 'rgba(28,34,26,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }, { roughness: 0.9, bumpScale: 0.06 });

export const wallMetal = () =>
  set('wallMetal', [4, 2], (ctx, s) => {
    ctx.fillStyle = '#474d52';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(18,22,26,0.85)';
    ctx.lineWidth = 4;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (i * s) / 4);
      ctx.lineTo(s, (i * s) / 4);
      ctx.stroke();
    }
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = '#2b3136';
      ctx.beginPath();
      ctx.arc(24 + Math.random() * (s - 48), 30 + Math.random() * (s - 60), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const r = 8 + Math.random() * 26;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(88,50,22,0.45)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    grain(ctx, s, 20, 0.1);
  }, { roughness: 0.42, metalness: 0.7, bumpScale: 0.05 });

/* ============ TECHOS ============ */

export const ceilingTex = () =>
  set('ceiling', [8, 8], (ctx, s) => {
    ctx.fillStyle = '#38352f';
    ctx.fillRect(0, 0, s, s);
    // paneles de techo
    const n = 2;
    const ps = s / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = `rgb(${(56 + Math.random() * 10) | 0},${(53 + Math.random() * 10) | 0},${(47 + Math.random() * 10) | 0})`;
        ctx.fillRect(i * ps + 3, j * ps + 3, ps - 6, ps - 6);
      }
    }
    grain(ctx, s, 30, 0.3);
  }, { roughness: 0.85, bumpScale: 0.04 });

/* ============ OBJETOS ============ */

export const woodDeskTex = () =>
  set('woodDesk', [2, 2], (ctx, s) => {
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(0, 0, s, s);
    for (let v = 0; v < 26; v++) {
      ctx.strokeStyle = `rgba(40,24,10,${0.15 + Math.random() * 0.3})`;
      ctx.lineWidth = 1 + Math.random() * 3;
      const y = Math.random() * s;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(s * 0.3, y + 12, s * 0.6, y - 12, s, y + 6);
      ctx.stroke();
    }
    grain(ctx, s, 22, 0.2);
    scratches(ctx, s, 30);
  }, { roughness: 0.55, bumpScale: 0.03 });

export const metalTex = () =>
  set('metal', [2, 2], (ctx, s) => {
    ctx.fillStyle = '#5a5f64';
    ctx.fillRect(0, 0, s, s);
    scratches(ctx, s, 50, 'rgba(200,210,220,0.13)');
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const r = 5 + Math.random() * 18;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(98,54,24,0.5)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    grain(ctx, s, 16, 0.1);
  }, { roughness: 0.35, metalness: 0.85, bumpScale: 0.03 });

export const darkMetalTex = () =>
  set('darkMetal', [2, 2], (ctx, s) => {
    ctx.fillStyle = '#23262a';
    ctx.fillRect(0, 0, s, s);
    scratches(ctx, s, 30, 'rgba(160,170,180,0.08)');
    grain(ctx, s, 12, 0.08);
  }, { roughness: 0.5, metalness: 0.8, bumpScale: 0.02 });

/* ============ PÓSTERS Y CARTeles (canvas dibujados) ============ */

function posterBase(ctx: CanvasRenderingContext2D, s: number, bg: string) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, s - 4, s - 4);
}

function drawBearFace(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, body: string, muzzle: string) {
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // orejas
  ctx.beginPath();
  ctx.arc(x - r * 0.75, y - r * 0.75, r * 0.32, 0, Math.PI * 2);
  ctx.arc(x + r * 0.75, y - r * 0.75, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = muzzle;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.35, r * 0.55, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(x, y + r * 0.18, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // ojos
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.15, r * 0.16, 0, Math.PI * 2);
  ctx.arc(x + r * 0.35, y - r * 0.15, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.15, r * 0.07, 0, Math.PI * 2);
  ctx.arc(x + r * 0.35, y - r * 0.15, r * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

export const posterBruno = () => {
  const key = 'posterBruno';
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = makeCanvas(256);
  posterBase(ctx, 256, '#c8b464');
  drawBearFace(ctx, 128, 110, 62, '#8a5a2c', '#c9a06a');
  ctx.fillStyle = '#5a1d1d';
  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('¡BRUNO Y SUS', 128, 205);
  ctx.fillText('AMIGOS!', 128, 236);
  grain(ctx, 256, 26, 0.3);
  const t = toTex(c, [1, 1]);
  cache.set(key, t);
  return t;
};

export const posterParty = () => {
  const key = 'posterParty';
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = makeCanvas(256);
  posterBase(ctx, 256, '#7a2634');
  // pastel
  ctx.fillStyle = '#e8d9b8';
  ctx.fillRect(64, 150, 128, 70);
  ctx.fillStyle = '#d84a4a';
  ctx.fillRect(64, 140, 128, 14);
  ctx.fillStyle = '#d8b13a';
  ctx.fillRect(58, 118, 10, 40);
  ctx.beginPath();
  ctx.arc(63, 112, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0e6cc';
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('FIESTAS', 128, 60);
  ctx.font = 'bold 22px monospace';
  ctx.fillText('CUMPLEAÑOS', 128, 92);
  grain(ctx, 256, 24, 0.3);
  const t = toTex(c, [1, 1]);
  cache.set(key, t);
  return t;
};

/** Dibujos infantiles — variantes */
export const kidDrawing = (variant: number) => {
  const key = `kidDraw_${variant}`;
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = makeCanvas(256);
  ctx.fillStyle = '#d9d2be';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#3a3a5a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const stick = (x: number, y: number, h: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.arc(x, y - h, h * 0.22, 0, Math.PI * 2);
    ctx.moveTo(x, y - h + h * 0.2);
    ctx.lineTo(x, y);
    ctx.moveTo(x - h * 0.35, y - h * 0.55);
    ctx.lineTo(x + h * 0.35, y - h * 0.55);
    ctx.moveTo(x, y);
    ctx.lineTo(x - h * 0.3, y + h * 0.5);
    ctx.moveTo(x, y);
    ctx.lineTo(x + h * 0.3, y + h * 0.5);
    ctx.stroke();
  };
  if (variant === 0) {
    stick(70, 180, 70, '#3a3a5a');
    stick(160, 190, 60, '#7a3a5a');
    ctx.fillStyle = '#c33';
    ctx.font = '26px monospace';
    ctx.fillText('bruno y yo', 40, 235);
  } else if (variant === 1) {
    // figura con ojos negros grandes
    ctx.strokeStyle = '#222';
    ctx.beginPath();
    ctx.arc(128, 100, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(114, 95, 11, 0, Math.PI * 2);
    ctx.arc(142, 95, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(128, 140, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.font = '22px monospace';
    ctx.fillText('el seno de la caja', 30, 235);
  } else {
    // cinco figuras de la mano
    for (let i = 0; i < 5; i++) stick(50 + i * 40, 190, 46, i === 2 ? '#a33' : '#345');
    ctx.beginPath();
    ctx.moveTo(50, 120);
    for (let i = 0; i < 5; i++) ctx.lineTo(50 + i * 40, 125);
    ctx.stroke();
  }
  grain(ctx, 256, 14, 0.12);
  const t = toTex(c, [1, 1]);
  cache.set(key, t);
  return t;
};

/** Textura de pantalla con estática (monitor / cámaras) */
export const screenStaticTex = () => {
  const key = 'screenStatic';
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = makeCanvas(256);
  ctx.fillStyle = '#0a1408';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = Math.random() * 90;
    ctx.fillStyle = `rgba(${v * 0.5 | 0},${v | 0},${v * 0.45 | 0},0.5)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  ctx.strokeStyle = 'rgba(120,255,120,0.05)';
  for (let y = 0; y < 256; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  const t = toTex(c, [1, 1]);
  cache.set(key, t);
  return t;
};

/** Rostro de la máscara (usado en el HUD 3D y prop) */
export const maskFaceTex = () => {
  const key = 'maskFace';
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = makeCanvas(256);
  ctx.fillStyle = '#caa06a';
  ctx.fillRect(0, 0, 256, 256);
  drawBearFace(ctx, 128, 128, 100, '#8a5a2c', '#caa06a');
  grain(ctx, 256, 20, 0.2);
  const t = toTex(c, [1, 1]);
  cache.set(key, t);
  return t;
};

/** Libera todas las texturas en caché */
export function disposeTextures() {
  for (const t of cache.values()) {
    t.dispose();
  }
  cache.clear();
  for (const s of setCache.values()) {
    s.map.dispose();
    s.bumpMap.dispose();
  }
  setCache.clear();
}
