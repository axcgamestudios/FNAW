// Mide la caja del flashlight.glb para verificar su eje largo
globalThis.self = globalThis; // stub para GLTFLoader en Node
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'node:fs';

const loader = new GLTFLoader();
const buf = fs.readFileSync('/home/z/my-project/public/models/flashlight.glb');
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  console.log('size  x,y,z =', size.x.toFixed(4), size.y.toFixed(4), size.z.toFixed(4));
  console.log('center      =', center.x.toFixed(4), center.y.toFixed(4), center.z.toFixed(4));
  console.log('min         =', box.min.x.toFixed(4), box.min.y.toFixed(4), box.min.z.toFixed(4));
  console.log('max         =', box.max.x.toFixed(4), box.max.y.toFixed(4), box.max.z.toFixed(4));
  const axes = [['x', size.x], ['y', size.y], ['z', size.z]].sort((a, b) => b[1] - a[1]);
  console.log('EJE LARGO   =', axes[0][0], '(' + axes[0][1].toFixed(4) + ')');
  // listar nodos de primer nivel para entender jerarquía/orientación
  model.traverse((o) => {
    if (o instanceof THREE.Mesh || o.type === 'Object3D') {
      console.log(`- ${o.type} "${o.name}" pos(${o.position.x.toFixed(3)},${o.position.y.toFixed(3)},${o.position.z.toFixed(3)}) rot(${o.rotation.x.toFixed(2)},${o.rotation.y.toFixed(2)},${o.rotation.z.toFixed(2)})`);
    }
  });
}, (err) => console.error(err));
