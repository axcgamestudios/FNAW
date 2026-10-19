// v13 captura 2: DENTRO del locker (vista por las rendijas)
(() => {
  const g = window.__brunoGame;
  if (!g) return 'NO-GAME';
  g.startChapter(1);
  if (g.cine && g.cine.active) g.cine.stop(true);
  // esconderse en el locker del muro oeste del atrio
  const locker = g.interactables.find((i) => i.id === 'hide_locker_atrium_w');
  g.player.pos.set(-15.5, 0, 5.2);
  g.player.yaw = -Math.PI / 2;
  locker.action();
  g.player.update(0.05);
  return 'OCULTO ' + JSON.stringify({ hidden: g.player.hidden, pos: [g.player.pos.x, g.player.pos.z] });
})()
