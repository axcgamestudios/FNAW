// v13 — misiones más largas: un objetivo goto extra por capítulo (1,3,4,5,6).
const fs = require('fs');
const FILE = 'src/data/chapters.json';
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const extra = {
  1: {
    id: 'c1_kitchen',
    title: 'Sweep the INDUSTRIAL KITCHEN',
    hint: 'South-west service corridor — watch the dark',
    type: 'goto',
    room: 'kitchen',
    after: 'c1_arcade',
  },
  3: {
    id: 'c3_arcade',
    title: 'Patrol the FAZER BLAST arcade',
    hint: 'North-west arcade hall — lockers available',
    type: 'goto',
    room: 'arcade',
    after: 'c3_kitchen',
  },
  4: {
    id: 'c4_theater',
    title: 'Inspect the THEATER backstage',
    hint: 'North-west of the atrium',
    type: 'goto',
    room: 'theater',
    after: 'c4_rockstar',
  },
  5: {
    id: 'c5_freezers',
    title: 'Check the FREEZER ROOM',
    hint: 'North-east services wing — it is cold in there',
    type: 'goto',
    room: 'freezers',
    after: 'c5_techS',
  },
  6: {
    id: 'c6_storageN',
    label: 'Search NORTH STORAGE for the fuse crate',
    type: 'goto',
    room: 'storageN',
    after: 'c6_enter',
  },
};

for (const ch of data.chapters) {
  const def = extra[ch.chapter];
  if (!def) continue;
  if (ch.objectives.some((o) => o.id === def.id)) continue;
  const idx = ch.objectives.findIndex((o) => o.id === def.after);
  const { after, ...obj } = def;
  if (idx >= 0) ch.objectives.splice(idx + 1, 0, obj);
  else ch.objectives.push(obj);
  console.log(`cap ${ch.chapter}: +${def.id} → ${ch.objectives.length} objetivos`);
}

fs.writeFileSync(FILE, JSON.stringify(data, null, 1));
