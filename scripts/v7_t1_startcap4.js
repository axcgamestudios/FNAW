(() => {
  const g = window.__brunoGame;
  g.startChapter(4);
  const luna = g.animatronics.find(a => a.def.id === 'luna');
  const dw = g.world.doors.get('door_mega_w');
  return JSON.stringify({
    cap: g.chapter, modo: g.mode,
    fuego: !!(window.MEGA_FIRE_TEST ?? true),
    lunaColgada: luna.hanging, lunaActiva: luna.active, lunaY: luna.rig.root.position.y,
    lunaPos: [luna.pos.x.toFixed(1), luna.pos.z.toFixed(1)],
    puertaW: dw && !dw.locked,
    jugador: [g.player.pos.x.toFixed(1), g.player.pos.z.toFixed(1)],
  });
})()
