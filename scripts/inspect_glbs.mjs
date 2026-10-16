/** Inspección de GLB: jerarquía, materiales, texturas, animaciones, bounding box */
import fs from 'fs';
import path from 'path';

const FILES = ['freddy.glb', 'bonnie.glb', 'chica.glb', 'foxy.glb', 'jeremy.glb', 'flashlight.glb'];
const DIR = '/home/z/my-project/public/models';

// GLB parser mínimo (sin dependencias)
function parseGLB(file) {
  const buf = fs.readFileSync(file);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let off = 12;
  let json = null;
  let bin = null;
  while (off < buf.length) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004e4942) bin = data;
    off += 8 + len;
  }
  return { json, bin };
}

function fmt(n) { return n.toFixed(3); }

for (const f of FILES) {
  const p = path.join(DIR, f);
  if (!fs.existsSync(p)) { console.log(`### ${f}: NO EXISTE`); continue; }
  const { json, bin } = parseGLB(p);
  console.log(`\n================ ${f} (${(fs.statSync(p).size / 1024 / 1024).toFixed(2)} MB) ================`);
  console.log(`animaciones (${(json.animations || []).length}):`, (json.animations || []).map(a => `"${a.name}" dur=${a.duration?.toFixed(2)}s ch=${a.channels?.length}`).join(' | '));
  const mats = json.materials || [];
  console.log(`materiales (${mats.length}):`);
  for (const m of mats) {
    const texRefs = [];
    const pbr = m.pbrMetallicRoughness || {};
    for (const [k, v] of Object.entries(pbr)) {
      if (v && typeof v === 'object' && v.index !== undefined) texRefs.push(`${k}->tex${v.index}`);
    }
    ['normalTexture', 'emissiveTexture', 'occlusionTexture'].forEach(k => {
      if (m[k] && m[k].index !== undefined) texRefs.push(`${k}->tex${m[k].index}`);
    });
    const baseC = pbr.baseColorFactor ? pbr.baseColorFactor.map(x => x.toFixed(2)).join(',') : 'none';
    console.log(`  - "${m.name}": baseColor=${baseC} metal=${pbr.metallicFactor ?? 1} rough=${pbr.roughnessFactor ?? 1} tex=[${texRefs.join(', ')}] emissive=${(m.emissiveFactor || [0, 0, 0]).join(',')}`);
  }
  const imgs = json.images || [];
  console.log(`imágenes (${imgs.length}):`, imgs.map(i => `${i.mimeType || '?'}:${(i.uri || 'embedded').slice(0, 40)}`).join(' | '));
  // meshes -> primitives -> material
  const meshes = json.meshes || [];
  let totalPrims = 0;
  for (const mesh of meshes) totalPrims += (mesh.primitives || []).length;
  console.log(`meshes: ${meshes.length}, primitivas: ${totalPrims}`);
  // skins
  console.log(`skins: ${(json.skins || []).length}`, (json.skins || []).map(s => `${s.joints?.length} joints`).join(','));
  // nodes resumen
  const nodes = json.nodes || [];
  console.log(`nodos: ${nodes.length}`);
  // calcular bounding box aproximada desde accessors de POSITION de todas las primitivas
  const accs = json.accessors || [];
  let minV = [Infinity, Infinity, Infinity], maxV = [-Infinity, -Infinity, -Infinity];
  let hasPos = false;
  for (const mesh of meshes) {
    for (const prim of (mesh.primitives || [])) {
      const ai = prim.attributes?.POSITION;
      if (ai === undefined) continue;
      const a = accs[ai];
      if (a.min && a.max) {
        hasPos = true;
        for (let i = 0; i < 3; i++) {
          minV[i] = Math.min(minV[i], a.min[i]);
          maxV[i] = Math.max(maxV[i], a.max[i]);
        }
      }
    }
  }
  if (hasPos) {
    console.log(`bbox local: min=[${minV.map(fmt).join(', ')}] max=[${maxV.map(fmt).join(', ')}] tamaño=[${(maxV[0] - minV[0]).toFixed(2)}, ${(maxV[1] - minV[1]).toFixed(2)}, ${(maxV[2] - minV[2]).toFixed(2)}]`);
  }
  // primeros 30 nodos con nombre
  const named = nodes.filter(n => n.name).slice(0, 40).map(n => n.name);
  console.log(`nombres (40): ${named.join(', ')}`);
}
