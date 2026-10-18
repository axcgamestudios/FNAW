(() => {
  window.__audioResult = 'PENDING';
  (async () => {
    for (let i = 0; i < 600; i++) {
      if (window.__brunoGame) break;
      await new Promise(r => setTimeout(r, 100));
    }
    const g = window.__brunoGame;
    if (!g) { window.__audioResult = 'NO-GAME'; return; }
    const origRender = g.render;
    g.render = function () {};
    const res = {};
    try {
      // simular la interacción del usuario (GameShell la hace al primer clic)
      res.initOk = g.audio.init();
      // esperar a que carguen los SFX del repo en segundo plano
      for (let i = 0; i < 60; i++) {
        if (g.audio.sfxBufs.size >= 5) break;
        await new Promise(r => setTimeout(r, 250));
      }
      res.sfx = { buffers: g.audio.sfxBufs.size, nombres: [...g.audio.sfxBufs.keys()].join(',') };
      res.jumpscare = !!g.audio.jumpscareBuf;
      res.theme = g.audio.themeAvailable;
      res.daycare = !!g.audio.daycareBuf;
      // voz de la llamada cap1 (archivos recuperados)
      const d1 = await g.audio.loadCall(1);
      res.vozCap1 = { lineas: d1 ? d1.length : null, duraciones: d1 ? d1.map(d => +d.toFixed(1)) : null };
      // voz cap7
      const d7 = await g.audio.loadCall(7);
      res.vozCap7 = { lineas: d7 ? d7.length : null };
      // reproducir la línea 0 de cap1 (debe arrancar el source)
      res.playLinea0 = g.audio.playCallLine(0);
      res.ctxEstado = g.audio.ctx ? g.audio.ctx.state : 'sin ctx';
    } catch (e) {
      res.error = String(e && e.message ? e.message : e);
    }
    g.render = origRender;
    try { requestAnimationFrame(g.render); } catch (e) {}
    window.__audioResult = JSON.stringify(res);
  })();
  return 'AUDIO-PROBE-LANZADO';
})()
