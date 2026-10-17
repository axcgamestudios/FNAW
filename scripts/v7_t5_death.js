(() => {
  const g = window.__brunoGame;
  // reiniciar cap 4 y armar la prueba de nuevo
  g.startChapter(4);
  if (g.cine.active) g.skipCinematic();
  g.mode = 'playing';
  g.player.pos.set(-34, 0, -37);
  g.trials.update(0.05, 'megadaycare');
  g.trials.completeTask('e1');
  g.trials.completeTask('e2');
  // MUERTE por Luna
  const luna = g.animatronics.find(a => a.def.id === 'luna');
  g.onDeath(luna);
  const col = id => { const c = g.world.colliders.find(q => q.id === id); return c ? c.active : 'no'; };
  return JSON.stringify({
    modo: g.mode, respawnPendiente: g.pendingTrialRespawn,
    intentos: g.trials.attempts, tareas: g.trials.tasksDone.length,
    e1Relit: col('vent_cover_fire_e1'), e2Relit: col('vent_cover_fire_e2'),
    lunaReset: [luna.pos.x.toFixed(1), luna.pos.z.toFixed(1)], lunaEstado: luna.state,
  });
})()
