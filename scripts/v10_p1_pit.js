(() => {
  const g = window.__brunoGame;
  if (g.cine && g.cine.active) g.cine.stop(true);
  const parado = g.mode;
  // teletransporte DENTRO de la alberca de la guardería
  g.player.pos.set(-22.5, 0, 6.5);
  const luna = g.animatronics.find(a => a.def.id === 'luna');
  return JSON.stringify({
    modo: parado,
    enAlberca: g.player.inBallPit,
    objCheck: g.missions.objectives.find(o => o.def.id === 'c1_check').done,
    lunaEstado: luna.state,
  });
})()
