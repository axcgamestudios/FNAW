(() => {
  const g = window.__brunoGame;
  g.startChapter(1);
  if (g.cine.active) g.skipCinematic();
  const luna = g.animatronics.find(a => a.def.id === 'luna');
  const gate = g.world.doors.get('gate_daycare_n');
  const cap1 = {
    modo: g.mode, cap: g.chapter,
    jugador: [g.player.pos.x.toFixed(1), g.player.pos.z.toFixed(1)],
    enAlberca: g.player.inBallPit, agachado: g.player.crouching,
    lunaActiva: luna.active, lunaLuna: luna.retired,
    rejas: !gate.locked,
    objetivos: g.missions.objectives.map(o => o.def.id),
  };
  // simular: coger linterna → las rejas se abren
  const torch = g.interactables.find(i => i.id === 'pickup_torch');
  g.player.pos.set(-17.6, 0, 8.2);
  torch.action();
  const despues = {
    linterna: g.missions.hasFlashlight,
    rejasAbiertas: !g.world.doors.get('gate_daycare_n').locked,
    objLinterna: g.missions.objectives.find(o => o.def.id === 'c1_torch').done,
  };
  return JSON.stringify({ cap1, despues });
})()
