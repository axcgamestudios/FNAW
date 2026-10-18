(() => {
  window.__npResult = 'PENDING';
  (async () => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    // 1) esperar el juego
    for (let i = 0; i < 600; i++) {
      if (window.__brunoGame) break;
      await sleep(100);
    }
    const g = window.__brunoGame;
    if (!g) { window.__npResult = 'NO-GAME'; return; }
    const origRender = g.render;
    g.render = function () {};
    // 2) esperar init completo
    for (let i = 0; i < 900; i++) {
      if (g.trials && g.cams && g.world && g.player && (g.animatronics || []).length > 0) break;
      await sleep(200);
    }
    if (!g.trials) { window.__npResult = 'INIT-INCOMPLETO'; return; }
    // 3) un frame del menú: restaurar render 2 s y volver a congelar
    g.render = origRender;
    await sleep(2000);
    g.render = function () {};
    // 4) clic en NUEVA PARTIDA → periódico
    const b = document.querySelector('.menu-btn.fnaf-item');
    if (!b) { window.__npResult = 'NO-BOTON'; return; }
    b.click();
    await sleep(1500);
    const paper = document.querySelector('.np-paper');
    if (!paper) { window.__npResult = 'NO-PAPER (el clic no llegó al periódico)'; return; }
    // 5) forzar fin de la animación de entrada (artefacto headless)
    paper.style.animation = 'none';
    const wrap = document.querySelector('.np-wrap');
    if (wrap) wrap.style.animation = 'none';
    await sleep(1000);
    const cs = getComputedStyle(paper);
    window.__npResult = JSON.stringify({
      paper: true,
      opacity: cs.opacity,
      bg: cs.backgroundColor,
      titular: (document.querySelector('.np-headline') || {}).textContent,
      anuncio: (document.querySelector('.np-ad-role') || {}).textContent,
    });
  })();
  return 'NP-PROBE-LANZADO';
})()
