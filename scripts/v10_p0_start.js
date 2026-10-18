(() => {
  const g = window.__brunoGame;
  if (!g) return 'NO-GAME';
  g.startChapter(1);
  if (g.cine && g.cine.active) g.skipCinematic();
  const luna = g.animatronics.find(a => a.def.id === 'luna');
  const r1 = {
    modo: g.mode, cap: g.chapter, titulo: g.chapterDef.title,
    jugador: [g.player.pos.x.toFixed(1), g.player.pos.z.toFixed(1)],
    agachado: g.player.crouching, linterna: g.player.flashlightOn,
    lunaEstado: luna.state, lunaPos: [luna.pos.x.toFixed(1), luna.pos.z.toFixed(1)],
    rejaNBloqueada: g.world.doors.get('gate_daycare_n').locked,
    objetivos: g.missions.objectives.map(o => o.def.id),
  };
  // coger linterna del ESCRITORIO de la oficina
  const torch = g.interactables.find(i => i.id === 'pickup_torch');
  g.player.pos.set(-37.4, 0, 22.3);
  torch.action();
  const r2 = {
    linternaOk: g.missions.hasFlashlight,
    objTorch: g.missions.objectives.find(o => o.def.id === 'c1_torch').done,
    rejasAbiertas: !g.world.doors.get('gate_daycare_n').locked,
  };
  return JSON.stringify({ r1, r2 });
})()
