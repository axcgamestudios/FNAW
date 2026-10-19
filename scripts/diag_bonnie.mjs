// Diagnóstico: dónde caen el "Cube" residual y el halo de ojos en Bonnie
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
import { readFileSync } from 'fs';
const data = readFileSync('/home/z/my-project/public/models/bonnie.glb');
loader.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '', (gltf) => {
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  // normalizar como el juego (altura 2.56)
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = 2.56 / Math.max(0.0001, size.y);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  // Cube residual
  let cube = null, eyesMesh = null;
  model.traverse((o) => {
    if (o.name === 'Cube' || o.name === 'Cube_Material_0') cube = cube ?? o.parent;
    if (o instanceof THREE.Mesh && /eye/i.test(o.name)) eyesMesh = o;
  });
  const bb = (o) => new THREE.Box3().setFromObject(o);
  const report = (name, b) => {
    const c = b.getCenter(new THREE.Vector3());
    const s = b.getSize(new THREE.Vector3());
    console.log(`${name}: center=(${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)}) size=(${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)})`);
  };
  report('MODELO COMPLETO', bb(model));
  if (cube) report('CUBE residual', bb(cube));
  if (eyesMesh) {
    report('MESH OJOS (Bonnie_Eyes)', bb(eyesMesh));
    // dónde quedaría el glow actual: centro de la caja del mesh
    const b = bb(eyesMesh);
    const c = b.getCenter(new THREE.Vector3());
    const s = b.getSize(new THREE.Vector3());
    const r = Math.max(0.03, s.length() * 0.16);
    console.log(`GLOW ACTUAL: r=${r.toFixed(3)} en (${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)}) — cabeza está en Y≈2.1-2.5`);
  }
}, undefined, (e) => console.error('ERROR', e));
