// v13 — verificación final: espalda en zona despejada + capturas (lockers,
// dentro del locker, Luna de pie con brazos, cinemática).
(() => {
  window.__shot = 'PENDING';
  (async () => {
    const g = window.__brunoGame;
    if (!g) { window.__shot = 'NO-GAME'; return; }
    const out = {};
    const tick = (n, dt = 0.05) => { for (let i = 0; i < n; i++) g.tick(dt); };

    // ===== A. ESPALDA en zona despejada (lobby) =====
    g.startChapter(1);
    if (g.cine && g.cine.active) g.cine.stop(true);
    g.player.pos.set(-5.0, 0, 28);
    g.player.yaw = 0;      // mirando -Z
    g.player.pitch = 0;
    g.player.update(0.016);
    const fr = g.animatronics.find((a) => a.def.id === 'freddy');
    fr.teleportTo(-5.0, 29.4, Math.PI); // a la ESPALDA (+Z)
    fr.wake();
    fr.state = 'patrol';
    out.losLobby = fr.host.nav.los(fr.pos, g.player.pos, fr.def.ventAccess);
    tick(2, 0.1);
    out.espaldaLobby = { modo: g.mode, muerteInstant: g.mode === 'dying' };

    // ===== B. CAPTURA: banco de lockers del atrio (muro oeste) =====
    g.startChapter(1);
    if (g.cine && g.cine.active) g.cine.stop(true);
    g.player.pos.set(-10.5, 0, 7.8);
    g.player.yaw = -Math.PI / 2; // mirando -X (hacia el muro oeste/banco)
    g.player.pitch = 0;
    g.player.flashlightOn = true;
    g.player.update(0.05);
    g.updateGuardArms(0.05);
    await new Promise((r) => setTimeout(r, 2500));
    window.__shot = JSON.stringify(out);
    window.__stage = 'lockers';
  })();
  return 'OK';
})();
