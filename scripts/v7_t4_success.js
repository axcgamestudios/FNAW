(() => {
  const g = window.__brunoGame;
  for (const id of ['e2','e3','e4','e5','e6','e7']) g.trials.completeTask(id);
  const luna = g.animatronics.find(a => a.def.id === 'luna');
  const col = id => {
    const c = g.world.colliders.find(q => q.id === id);
    return c ? c.active : 'no';
  };
  const obj = g.missions.objectives.find(o => o.def.id === 'c4_trial');
  return JSON.stringify({
    pruebaActiva: g.trials.active && g.trials.active.id,
    objetivoC4: obj && obj.done,
    lunaRetirada: luna.retired, lunaSol: 'modo',
    lunaPos: [luna.pos.x.toFixed(1), luna.pos.z.toFixed(1)],
    salaLuz: g.world.rooms.get('megadaycare').lightOn,
    barreras: [col('vent_cover_fire_e2'), col('vent_cover_fire_e7')],
    rejaN: g.world.doors.get('gate_daycare_n') && !g.world.doors.get('gate_daycare_n').locked,
    capCompletado: g.chapterEndPending,
  });
})()
