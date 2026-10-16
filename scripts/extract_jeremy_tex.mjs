/** Extrae las imágenes embebidas de jeremy.glb para inspección */
import fs from 'fs';

const file = '/home/z/my-project/public/models/jeremy.glb';
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

console.log('bufferViews:', json.bufferViews.length);
console.log('images:');
json.images.forEach((img, i) => {
  const bv = json.bufferViews[img.bufferView];
  console.log(`  [${i}] mime=${img.mimeType} byteOffset=${bv.byteOffset} byteLength=${bv.byteLength}`);
  const chunk = bin.subarray(bv.byteOffset, bv.byteOffset + bv.byteLength);
  const ext = img.mimeType.includes('png') ? 'png' : 'jpg';
  fs.writeFileSync(`/home/z/my-project/scripts/jeremy_tex_${i}.${ext}`, chunk);
});
console.log('materiales:');
json.materials.forEach((m) => {
  console.log(`  "${m.name}" normal=${m.normalTexture?.index} baseColorTex=${m.pbrMetallicRoughness?.baseColorTexture?.index ?? 'NONE'} metal=${m.pbrMetallicRoughness?.metallicFactor} rough=${m.pbrMetallicRoughness?.roughnessFactor}`);
});
console.log('samplers:', JSON.stringify(json.samplers?.map(s => [s.magFilter, s.minFilter, s.wrapS])));
