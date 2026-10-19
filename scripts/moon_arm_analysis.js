// Analiza los vértices del mesh del cuerpo de moon.glb (histograma x/z) para
// planificar la separación de brazos (T-pose -> brazos abajo).
const fs = require('fs');

const buf = fs.readFileSync('public/models/moon.glb');
let off = 12;
let json = null;
let binStart = -1;
while (off + 8 <= buf.length) {
  const chunkLen = buf.readUInt32LE(off);
  const chunkType = buf.readUInt32LE(off + 4);
  if (chunkType === 0x4e4f534a) {
    json = JSON.parse(buf.slice(off + 8, off + 8 + chunkLen).toString('utf8'));
  } else if (chunkType === 0x004e4942) { // 'BIN'
    binStart = off + 8;
  }
  off += 8 + chunkLen;
}

// mesh 9 = node Object_11 (cuerpo con brazos en T)
const meshes = json.meshes;
const node = json.nodes.find((n) => n.name === 'Object_11');
const meshIdx = node.mesh;
const prim = meshes[meshIdx].primitives[0];
const posAcc = json.accessors[prim.attributes.POSITION];
const bv = json.bufferViews[posAcc.bufferView];
const byteOff = (bv.byteOffset || 0) + (posAcc.byteOffset || 0) + binStart;
const compType = posAcc.componentType; // 5126 = float
const count = posAcc.count;
console.log(`Object_11: mesh ${meshIdx}, ${count} vértices, indexed: ${prim.indices !== undefined}`);

// leer posiciones
const positions = [];
for (let i = 0; i < count; i++) {
  positions.push([
    buf.readFloatLE(byteOff + i * 12),
    buf.readFloatLE(byteOff + i * 12 + 4),
    buf.readFloatLE(byteOff + i * 12 + 8),
  ]);
}

// histograma x (columnas) vs z (filas)
const zBins = 27; // 0..5.4 en pasos de 0.2
const xBins = 33; // -3.3..3.3 en pasos de 0.2
const grid = Array.from({ length: zBins }, () => new Array(xBins).fill(0));
for (const [x, y, z] of positions) {
  const zi = Math.max(0, Math.min(zBins - 1, Math.floor(z / 0.2)));
  const xi = Math.max(0, Math.min(xBins - 1, Math.floor((x + 3.3) / 0.2)));
  grid[zi][xi]++;
}
console.log('\nHistograma (z filas de arriba=alto · x columnas izq=negativo):');
const header = '       ' + Array.from({ length: xBins }, (_, i) => {
  const v = (i * 0.2 - 3.3).toFixed(0);
  return v.length > 1 ? v.slice(-1) : '·';
}).join('');
console.log(header);
for (let zi = zBins - 1; zi >= 0; zi--) {
  const row = grid[zi].map((c) => (c === 0 ? ' ' : c < 10 ? '.' : c < 60 ? 'o' : 'O')).join('');
  console.log(`z=${(zi * 0.2).toFixed(1).padStart(4)} |${row}|`);
}

// estadísticas por franjas de x
for (const [x0, x1] of [[-3.3, -2.0], [-2.0, -1.2], [-1.2, -0.65], [-0.65, 0.65], [0.65, 1.2], [1.2, 2.0], [2.0, 3.3]]) {
  const pts = positions.filter(([x]) => x >= x0 && x < x1);
  if (!pts.length) continue;
  const zs = pts.map((p) => p[2]);
  const zmin = Math.min(...zs), zmax = Math.max(...zs);
  // percentiles de z
  const sorted = zs.slice().sort((a, b) => a - b);
  const q = (p) => sorted[Math.floor(p * (sorted.length - 1))].toFixed(2);
  console.log(`x in [${x0}, ${x1}): n=${pts.length}, z ${zmin.toFixed(2)}..${zmax.toFixed(2)} q10=${q(0.1)} q50=${q(0.5)} q90=${q(0.9)}`);
}
