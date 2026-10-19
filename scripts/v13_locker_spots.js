// v13 — actualiza los hidingSpots de map.json para coincidir EXACTAMENTE con
// los bancos de lockers de buildLockerBanks (la unidad escondite = índice 1).
const fs = require('fs');

const FILE = 'src/data/map.json';
const map = JSON.parse(fs.readFileSync(FILE, 'utf8'));

// spots tipo locker: nueva posición + dirección de mirada (look) hacia delante
const lockerSpots = {
  locker_tech_w: { pos: [-32.4, -23.35], look: [-32.4, -19.4], room: 'techHall' },
  locker_tech_c: { pos: [-6.0, -23.35], look: [-6.0, -19.4], room: 'techHall' },
  locker_tech_e: { pos: [20.0, -23.35], look: [20.0, -19.4], room: 'techHall' },
  locker_promS_w: { pos: [-40.8, 13.65], look: [-40.8, 17.0], room: 'promW' },
  locker_promS_e: { pos: [39.2, 13.65], look: [39.2, 17.0], room: 'promE' },
  locker_atrium_w: { pos: [-15.5, 7.8], look: [-11.5, 7.8], room: 'atrium' },
  locker_atrium_e: { pos: [15.5, 10.8], look: [11.5, 10.8], room: 'atrium' },
  locker_westN: { pos: [-38.4, -8.35], look: [-38.4, -5.0], room: 'westPromN' },
  locker_eastN: { pos: [39.2, -8.35], look: [39.2, -5.0], room: 'eastPromN' },
  locker_rockstar: { pos: [-43.35, -13.8], look: [-39.4, -13.8], room: 'rockstar' },
  locker_arcade: { pos: [-10.0, -9.65], look: [-10.0, -13.5], room: 'arcade' },
  locker_foodcourt: { pos: [30.45, 9.8], look: [26.5, 9.8], room: 'foodcourt' },
  locker_lobby: { pos: [-15.6, 33.35], look: [-15.6, 29.5], room: 'lobby' },
  locker_bowling: { pos: [10.85, -16.35], look: [10.85, -12.5], room: 'bowling' },
  locker_techS: { pos: [-42.5, 32.5], look: [-42.5, 29.0], room: 'techS' },
};

// 1. actualizar los spots locker existentes y eliminar los que cambien de sala
map.hidingSpots = map.hidingSpots.filter((s) => {
  if (lockerSpots[s.id]) return true;
  // la cabina del daycare viejo ya no aplica (la sala es WEST STORAGE ahora):
  // se mantiene como cofre de archivo
  return true;
});

for (const [id, def] of Object.entries(lockerSpots)) {
  const existing = map.hidingSpots.find((s) => s.id === id);
  if (existing) {
    existing.pos = def.pos;
    existing.look = def.look;
    existing.room = def.room;
    existing.type = 'locker';
  } else {
    map.hidingSpots.push({ id, room: def.room, pos: def.pos, type: 'locker', look: def.look });
  }
}

fs.writeFileSync(FILE, JSON.stringify(map, null, 1));
console.log(`hidingSpots: ${map.hidingSpots.length} (lockers: ${Object.keys(lockerSpots).length})`);
for (const s of map.hidingSpots) console.log(' ', s.id.padEnd(18), s.room.padEnd(10), s.pos, 'look', s.look);
