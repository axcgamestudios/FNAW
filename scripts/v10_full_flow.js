(() => {
  const g = window.__brunoGame;
  if (!g) return 'NO-GAME';
  const res = {};
  // === 1) arranque del cap 1 (mundo nuevo, menú fuera) ===
  g.startChapter(1);
  if (g.cine && g.cine.active) g.cine.stop(true);
  res.arranque = {
    modo: g.mode, titulo: g.chapterDef.title,
    jugador: [g.player.pos.x.toFixed(1), g.player.pos.z.toFixed(1)],
    agachado: g.player.crouching,
  };
  // === 2) linterna del escritorio ===
  const torch = g.interactables.find(i => i.id === 'pickup_torch');
  g.player.pos.set(-37.4, 0, 22.3);
  torch.action();
  res.linterna = {
    ok: g.missions.hasFlashlight,
    obj: g.missions.objectives.find(o => o.def.id === 'c1_torch').done,
    rejas: !g.world.doors.get('gate_daycare_n').locked,
  };
  // === 3) alberca de la guardería (frames manuales SIN render) ===
  g.player.pos.set(-22.5, 0, 6.5);
  for (let i = 0; i < 6; i++) g.tick(0.05);
  const luna = g.animatronics.find(a => a.def.id === 'luna');
  res.alberca = {
    enAlberca: g.player.inBallPit,
    objCheck: g.missions.objectives.find(o => o.def.id === 'c1_check').done,
    lunaEstado: luna.state,
  };
  // === 4) vuelta a la oficina ===
  g.player.pos.set(-37.4, 0, 26.5);
  for (let i = 0; i < 6; i++) g.tick(0.05);
  res.oficina = {
    objExit: g.missions.objectives.find(o => o.def.id === 'c1_exit').done,
    modo: g.mode,
    capCompleto: g.mode === 'cinematic' || g.mode === 'complete',
    pendiente: g.chapterEndPending,
  };
  // === 5) cap 2 sigue arrancando en la oficina con tableta ===
  if (g.mode !== 'complete') { g.cine.stop(true); }
  g.startChapter(2);
  if (g.cine && g.cine.active) g.cine.stop(true);
  res.cap2 = {
    jugador: [g.player.pos.x.toFixed(1), g.player.pos.z.toFixed(1)],
    titulo: g.chapterDef.title,
    objTablet: g.missions.objectives.some(o => o.def.id === 'c2_tablet'),
    tabletAnchor: !!g.world.anchors.get('desk_tablet'),
  };
  return JSON.stringify(res);
})()
