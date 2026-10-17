(() => {
  const g = window.__brunoGame;
  if (g.cine.active) g.skipCinematic();
  g.mode = 'playing';
  // teletransportar al jugador DENTRO de la Mega Guardería y armar la prueba
  g.player.pos.set(-34, 0, -37);
  g.trials.update(0.05, 'megadaycare');
  const luna = g.animatronics.find(a => a.def.id === 'luna');
  return JSON.stringify({
    prueba: g.trials.active && g.trials.active.id,
    tareas: g.trials.active && g.trials.active.tasks.length,
    intentos: g.trials.attempts,
    lunaActiva: luna.active, lunaEstado: luna.state, lunaColgada: luna.hanging,
    lunaPos: [luna.pos.x.toFixed(1), luna.pos.z.toFixed(1)],
    fuegoEncendido: g.player ? 'si' : 'no',
    salaLuz: g.world.rooms.get('megadaycare').lightOn,
  });
})()
