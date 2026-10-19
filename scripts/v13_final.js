// v13 — verificación final tras el fix del banco oeste + capturas correctas
(() => {
  window.__fin = 'PENDING';
  (async () => {
    for (let i = 0; i < 600; i++) {
      if (window.__brunoGame) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const g = window.__brunoGame;
    if (!g) { window.__fin = 'NO-GAME'; return; }
    const out = {};
    const tick = (n, dt = 0.05) => { for (let i = 0; i < n; i++) g.tick(dt); };

    // 1) esconderse en el locker corregido (muro oeste del atrio)
    g.startChapter(1);
    if (g.cine && g.cine.active) g.cine.stop(true);
    const locker = g.interactables.find((i) => i.id === 'hide_locker_atrium_w');
    g.player.pos.set(-14.8, 0, 11.2);
    locker.action();
    out.dentro = { hidden: g.player.hidden, pos: [g.player.pos.x, g.player.pos.z] };
    // la cámara debe quedar DENTRO mirando +X (hacia la puerta)
    g.player.update(0.05);
    out.cam = [g.camera.position.x.toFixed(2), g.camera.position.z.toFixed(2)];
    out.camYaw = g.player.hiddenLookYaw.toFixed(2);
    // 2) tick: salida delante de la puerta (+X)
    g.interactables.find((i) => i.id === 'unhide_locker_atrium_w').action();
    out.salida = { hidden: g.player.hidden, x: g.player.pos.x.toFixed(2) };
    window.__fin = JSON.stringify(out);
  })();
  return 'OK';
})();
