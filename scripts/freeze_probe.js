(() => {
  window.__freezeDone = 'PENDING';
  (async () => {
    for (let i = 0; i < 600; i++) {
      if (window.__brunoGame) break;
      await new Promise(r => setTimeout(r, 100));
    }
    const g = window.__brunoGame;
    if (!g) { window.__freezeDone = 'NO-GAME'; return; }
    window.__origRender = g.render;
    // esperar a que init() termine
    for (let i = 0; i < 900; i++) {
      if (g.trials && g.cams && g.world && g.player && (g.animatronics || []).length > 0) break;
      await new Promise(r => setTimeout(r, 200));
    }
    // dejar renderizar 6 s (menú con Freddy 3D) y congelar el último frame
    await new Promise(r => setTimeout(r, 6000));
    g.render = function () {};
    window.__freezeDone = 'CONGELADO';
  })();
  return 'FREEZE-PROBE-LANZADO';
})()
