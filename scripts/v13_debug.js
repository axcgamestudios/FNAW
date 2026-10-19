(() => {
  window.__dbg = 'PENDING';
  (async () => {
    const g = window.__brunoGame;
    if (!g) { window.__dbg = 'NO-GAME'; return; }
    const out = {};
    const tick = (n, dt = 0.05) => { for (let i = 0; i < n; i++) g.tick(dt); };

    g.startChapter(1);
    if (g.cine && g.cine.active) g.cine.stop(true);

    // estado base
    out.playerPos0 = [g.player.pos.x, g.player.pos.z];

    g.player.pos.set(0, 0, 0);
    g.player.yaw = 0;
    g.player.pitch = 0;
    // forzar recálculo de lookDir
    g.player.update(0.016);
    out.lookDir = [g.player.lookDir.x, g.player.lookDir.y, g.player.lookDir.z];

    const freddy = g.animatronics.find((a) => a.def.id === 'freddy');
    freddy.teleportTo(0, 1.0, Math.PI);
    freddy.wake();
    freddy.state = 'patrol';
    freddy.stateTimer = 0;
    freddy.path = [];

    out.freddyPos = [freddy.pos.x, freddy.pos.z];
    out.los = g.nav ? g.nav.los(freddy.pos, g.player.pos, false) : 'sin-nav';
    // host real:
    out.hostNav = !!(freddy.host && freddy.host.nav);
    out.losHost = freddy.host.nav.los(freddy.pos, g.player.pos, freddy.def.ventAccess);

    const d = freddy.pos.distanceTo(g.player.pos);
    out.d = d;
    // simular el dot manual
    const v = { x: freddy.pos.x - g.player.pos.x, y: 0, z: freddy.pos.z - g.player.pos.z };
    const len = Math.hypot(v.x, v.z);
    out.dot = (v.x / len) * g.player.lookDir.x + (v.z / len) * g.player.lookDir.z;

    // 1 tick y ver el estado de freddy
    tick(1, 0.1);
    out.tras1tick = { estado: freddy.state, activo: freddy.active, modo: g.mode };
    tick(5, 0.1);
    out.tras6ticks = { estado: freddy.state, modo: g.mode, freddyPos: [freddy.pos.x, freddy.pos.z] };

    // ¿funcionó onDeath directamente?
    if (g.mode !== 'dying') {
      // probar llamando onDeath manual para confirmar el path de muerte
      // (probe only) — y luego revisar por qué no se disparó el check
      const canSee = freddy.canSee ? freddy.canSee(g.player) : 'sin-canSee';
      out.canSee = canSee;
    }

    // ============ LUNA caza con forceChase ============
    g.startChapter(7);
    if (g.cine && g.cine.active) g.cine.stop(true);
    const luna = g.animatronics.find((a) => a.def.id === 'luna');
    luna.descendAndWake();
    luna.forceChase(g.player.pos);
    for (let i = 0; i < 40; i++) g.tick(0.05);
    const arms = luna.moonArms || (luna.rig && luna.rig.moonArms);
    out.lunaCaza = {
      estado: luna.state,
      pivotR_y: arms ? +arms.pivotR.rotation.y.toFixed(2) : null,
      meshR_z: arms ? +arms.meshR.rotation.z.toFixed(2) : null,
    };

    window.__dbg = JSON.stringify(out, null, 1);
  })();
  return 'OK';
})();
