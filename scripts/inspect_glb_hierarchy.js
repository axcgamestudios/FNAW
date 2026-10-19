// Inspecciona la jerarquía y transformaciones de los nodos de un GLB (para
// identificar qué Object_N son brazos/piernas/torso por posición relativa).
const fs = require('fs');

function inspect(file) {
  const buf = fs.readFileSync(file);
  let off = 12;
  while (off + 8 <= buf.length) {
    const chunkLen = buf.readUInt32LE(off);
    const chunkType = buf.readUInt32LE(off + 4);
    if (chunkType === 0x4e4f534a) {
      const json = JSON.parse(buf.slice(off + 8, off + 8 + chunkLen).toString('utf8'));
      console.log(`== ${file} ==`);
      console.log(`scenes: ${JSON.stringify(json.scenes)}`);
      console.log(`animations: ${(json.animations || []).length}`);
      const nodes = json.nodes || [];
      nodes.forEach((n, i) => {
        const t = n.translation || [];
        const r = n.rotation || [];
        const s = n.scale || [];
        const meshes = n.mesh !== undefined ? ` mesh:${n.mesh}` : '';
        console.log(
          `[${i}] ${n.name || '(unnamed)'} parent:${n.children || 'leaf'}${meshes} ` +
          `t:(${t.map((v) => +v.toFixed(3)).join(',')}) r:(${r.map((v) => +v.toFixed(3)).join(',')}) s:(${s.map((v) => +v.toFixed(3)).join(',')})`
        );
      });
      return;
    }
    off += 8 + chunkLen;
  }
}

inspect(process.argv[2]);
