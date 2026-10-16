/**
 * Parchea jeremy.glb: los materiales solo referencian normalTexture pero el
 * archivo trae los mapas de color embebidos sin usar (índices 0,3,6,9,12).
 * Añade baseColorTexture + factores físicos razonables y reconstruye el GLB.
 */
import fs from 'fs';

const SRC = '/home/z/my-project/public/models/jeremy.glb';

function parseGLB(file) {
  const buf = fs.readFileSync(file);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const header = { magic: buf.readUInt32LE(0), version: dv.getUint32(4, true), length: dv.getUint32(8, true) };
  let off = 12;
  let json = null;
  let bin = null;
  while (off < buf.length) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
    else if (type === 0x004e4942) bin = Buffer.from(data);
    off += 8 + len;
  }
  return { header, json, bin };
}

function buildGLB(json, bin) {
  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const jsonPadded = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);
  const binPad = (4 - (bin.length % 4)) % 4;
  const binPadded = Buffer.concat([bin, Buffer.alloc(binPad, 0)]);
  const total = 12 + 8 + jsonPadded.length + 8 + binPadded.length;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0); // glTF
  out.writeUInt32LE(2, 4);          // version
  out.writeUInt32LE(total, 8);
  let off = 12;
  out.writeUInt32LE(jsonPadded.length, off); off += 4;
  out.writeUInt32LE(0x4e4f534a, off); off += 4;  // JSON
  jsonPadded.copy(out, off); off += jsonPadded.length;
  out.writeUInt32LE(binPadded.length, off); off += 4;
  out.writeUInt32LE(0x004e4942, off); off += 4;  // BIN
  binPadded.copy(out, off);
  return out;
}

const { header, json, bin } = parseGLB(SRC);
if (header.magic !== 0x46546c67) throw new Error('No es un GLB válido');

// mapa: material -> [índice baseColor, roughness, metalness]
const WIRE = {
  Body:    { tex: 0,  rough: 0.72, metal: 0.0 },  // piel + uniforme superior
  Bottom:  { tex: 3,  rough: 0.85, metal: 0.0 },  // pantalones
  Hair:    { tex: 6,  rough: 0.55, metal: 0.0 },  // pelo
  Shoes:   { tex: 9,  rough: 0.80, metal: 0.0 },  // zapatillas
  material:{ tex: 12, rough: 0.85, metal: 0.0 },  // chaqueta/torsos
};

let patched = 0;
for (const m of json.materials) {
  const w = WIRE[m.name];
  if (!w) continue;
  if (!m.pbrMetallicRoughness) m.pbrMetallicRoughness = {};
  const pbr = m.pbrMetallicRoughness;
  pbr.baseColorTexture = { index: w.tex, texCoord: 0 };
  pbr.roughnessFactor = w.rough;
  pbr.metallicFactor = w.metal;
  if (!pbr.baseColorFactor) pbr.baseColorFactor = [1, 1, 1, 1];
  patched++;
  console.log(`material "${m.name}": baseColorTexture=images[${w.tex}] rough=${w.rough}`);
}

if (patched === 0) throw new Error('Ningún material parcheado');
const out = buildGLB(json, bin);
fs.writeFileSync(SRC, out);
console.log(`OK: jeremy.glb parcheado (${patched} materiales), ${(out.length / 1024 / 1024).toFixed(2)} MB`);
