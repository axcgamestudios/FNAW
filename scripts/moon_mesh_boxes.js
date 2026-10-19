// Mide la caja de cada malla de moon.glb usando los min/max de los accessors
// (todos los nodos tienen transform identidad → espacio local = espacio modelo).
const fs = require('fs');

const buf = fs.readFileSync('public/models/moon.glb');
let off = 12;
while (off + 8 <= buf.length) {
  const chunkLen = buf.readUInt32LE(off);
  const chunkType = buf.readUInt32LE(off + 4);
  if (chunkType === 0x4e4f534a) {
    const json = JSON.parse(buf.slice(off + 8, off + 8 + chunkLen).toString('utf8'));
    const nodes = json.nodes || [];
    const meshes = json.meshes || [];
    const accessors = json.accessors || [];
    console.log('mesh # | node | min(x,y,z) | max(x,y,z) | size | center');
    nodes.forEach((n) => {
      if (n.mesh === undefined) return;
      const m = meshes[n.mesh];
      const prim = m.primitives[0];
      const acc = accessors[prim.attributes.POSITION];
      const min = acc.min, max = acc.max;
      const size = [0, 1, 2].map((i) => +(max[i] - min[i]).toFixed(3));
      const center = [0, 1, 2].map((i) => +((min[i] + max[i]) / 2).toFixed(3));
      console.log(
        `${n.mesh} | ${n.name} | (${min.map((v) => +v.toFixed(3))}) | (${max.map((v) => +v.toFixed(3))}) | ` +
        `size(${size}) center(${center})`
      );
    });
    break;
  }
  off += 8 + chunkLen;
}
