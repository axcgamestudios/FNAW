(() => {
  if (window.__probeResult) return 'YA-LANZADO';
  window.__probeResult = 'PENDING';
  (async () => {
    // esperar a que exista el juego (se asigna ANTES de init())
    for (let i = 0; i < 600; i++) {
      if (window.__brunoGame) break;
      await new Promise(r => setTimeout(r, 100));
    }
    const g = window.__brunoGame;
    if (!g) { window.__probeResult = 'NO-GAME'; return; }
    // matar el render pesado INMEDIATAMENTE (antes de que init() lo arranque)
    const origRender = g.render;
    g.render = function () {};
    const res = {};
    try {
      // esperar a que init() termine (campos listos)
      for (let i = 0; i < 900; i++) {
        if (g.trials && g.cams && g.world && g.player && (g.animatronics || []).length > 0) break;
        await new Promise(r => setTimeout(r, 200));
      }
      if (!g.trials) { window.__probeResult = JSON.stringify({ error: 'INIT-INCOMPLETO' }); return; }
      // 1) arranque cap 1 (mundo nuevo: "El Primer Turno", spawn en vestíbulo)
      g.startChapter(1);
      if (g.cine && g.cine.active) g.cine.stop(true);
      res.arranque = {
        modo: g.mode, titulo: g.chapterDef.title,
        jugador: [g.player.pos.x.toFixed(1), g.player.pos.z.toFixed(1)],
        agachado: g.player.crouching, linternaOn: g.player.flashlightOn,
      };
      // 2) Luna: estado, rig y animator
      const luna = g.animatronics.find(a => a.def.id === 'luna');
      res.luna = {
        estado: luna.state, y: luna.pos.y.toFixed(2),
        animator: !!luna.animator,
        bones: luna.rig && luna.rig.bones ? Object.keys(luna.rig.bones).length : 0,
      };
      // 3) VOZ de la llamada cap1 — archivos RECUPERADOS de git
      const durs = await g.audio.loadCall(1);
      res.voz = { lineas: durs ? durs.length : null, duraciones: durs ? durs.map(d => +d.toFixed(1)) : null };
      // 4) SFX del repo cargados
      try { res.sfx = { buffers: g.audio.sfxBufs.size, nombres: [...g.audio.sfxBufs.keys()].join(',') }; } catch (e) { res.sfx = String(e); }
      // 5) linterna del escritorio de la Oficina + rejas
      const torch = g.interactables.find(i => i.id === 'pickup_torch');
      g.player.pos.set(-37.4, 0, 22.3);
      if (torch) torch.action();
      res.linterna = {
        ok: g.missions.hasFlashlight,
        rejaAbierta: !g.world.doors.get('gate_daycare_n').locked,
      };
      // 6) animación: Luna despierta y cae, ticks manuales
      if (luna.descendAndWake) luna.descendAndWake();
      for (let i = 0; i < 10; i++) g.tick(0.08);
      res.lunaDespierta = {
        estado: luna.state,
        walkPhase: typeof luna.walkPhase === 'number' ? +luna.walkPhase.toFixed(3) : luna.walkPhase,
        pos: [luna.pos.x.toFixed(1), luna.pos.z.toFixed(1)],
      };
      // 7) mapa nuevo: puertas/anclas del mundo
      res.mapa = {
        puertas: g.world.doors.size,
        anchors: g.world.anchors.size,
      };
      // 8) voz cap7 (sótano en llamas)
      const d7 = await g.audio.loadCall(7);
      res.vozCap7 = { lineas: d7 ? d7.length : null };
    } catch (e) {
      res.error = String(e && e.stack ? e.stack.slice(0, 500) : e);
    }
    // restaurar el render para el usuario
    g.render = origRender;
    try { requestAnimationFrame(g.render); } catch (e) {}
    window.__probeResult = JSON.stringify(res);
  })();
  return 'PROBE-LANZADO';
})()
