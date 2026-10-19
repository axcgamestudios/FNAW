// Lista los nombres de nodos de un GLB parseando el JSON embebido (sin deps).
const fs = require('fs');

function listGlbNodes(file) {
  const buf = fs.readFileSync(file);
  // GLB header: magic(4) version(4) length(4); chunks: length(4) type(4) data
  let off = 12;
  while (off + 8 <= buf.length) {
    const chunkLen = buf.readUInt32LE(off);
    const chunkType = buf.readUInt32LE(off + 4);
    if (chunkType === 0x4e4f534a) { // 'JSON'
      const json = JSON.parse(buf.slice(off + 8, off + 8 + chunkLen).toString('utf8'));
      const nodes = (json.nodes || []).map((n) => n.name || '(unnamed)');
      console.log(`== ${file} — ${nodes.length} nodos ==`);
      console.log(nodes.join('\n'));
      return;
    }
    off += 8 + chunkLen;
  }
  console.log('No JSON chunk found in', file);
}

const files = process.argv.slice(2);
for (const f of files) listGlbNodes(f);
