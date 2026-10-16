// Detecta qué extremo del flashlight.glb es la cabeza (sección más ancha = lente)
globalThis.self = globalThis;
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'node:fs';

const loader = new GLTFLoader();
const buf = fs.readFileSync('/home/z/my-project/public/models/flashlight.glb');
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  // recolectar posiciones mundiales de vértices
  const pts = [];
  model.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry?.attributes?.position) {
      const pos = o.geometry.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        pts.push(v.clone());
      }
    }
  });
  const xs = pts.map((p) => p.x);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const len = maxX - minX;
  const frac = 0.18;
  // sección frontal (maxX) vs trasera (minX)
  const front = pts.filter((p) => p.x > maxX - len * frac);
  const back = pts.filter((p) => p.x < minX + len * frac);
  const extent = (arr) => {
    let minZ = 1e9, maxZ = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of arr) { minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    return { y: maxY - minY, z: maxZ - minZ };
  };
  const f = extent(front), b = extent(back);
  console.log(`len X = ${len.toFixed(4)}  vértices = ${pts.length}`);
  console.log(`FRENTE (+X): ${front.length} vts, alto=${f.y.toFixed(4)} ancho=${f.z.toFixed(4)}`);
  console.log(`TRASERA (-X): ${back.length} vts, alto=${b.y.toFixed(4)} ancho=${b.z.toFixed(4)}`);
  const headAtPlus = (f.y * f.z) > (b.y * b.z);
  console.log(headAtPlus ? '=> LA CABEZA/LENTE ESTÁ EN +X' : '=> LA CABEZA/LENTE ESTÁ EN -X');
}, (err) => console.error(err));
