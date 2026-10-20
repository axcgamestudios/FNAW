// v14 DIAG — por qué no se recoge la cinta del cove en M5 y quién mata al jugador.
(() => {
  if (window.__probeResult) return 'YA';
  window.__probeResult = 'PENDING';
  (async () => {
    for (let i = 0; i < 900; i++) { if (window.__brunoGame) break; await new Promise((r) => setTimeout(r, 100)); }
    const g = window.__brunoGame;
    if (!g) { window.__probeResult = 'NO-GAME'; return; }
    const origRender = g.render; g.render = function () {};
    const res = { pasos: [] };
    const log = (k, v) => res.pasos.push(`${k}: ${JSON.stringify(v)}`);
    try {
      for (let i = 0; i < 900; i++) { if (g.trials && g.world && g.player) break; await new Promise((r) => setTimeout(r, 200)); }
      const tick = (n, dt = 0.05) => { for (let i = 0; i < n; i++) g.tick(dt); };
      const st = () => g.hud.getState();

      window.localStorage.setItem('fnaw_save_v2', JSON.stringify({ unlockedChapter: 1, tapes: [], endings: [], settings: { master: 0.9, music: 0.7, sfx: 0.95, sensitivity: 1, invertY: false, quality: 'low', subtitleSize: 'medium' } }));

      // M4 rápido: techS + gallery + sounds + officeNight
      g.startChapter(4);
      if (g.cine && g.cine.active) g.cine.stop(true);
      tick(2);
      log('M4 start', { ch: g.chapter, mode: g.mode });
      g.player.pos.set(-37.5, 0, 31.5); tick(3);
      g.player.pos.set(0, 0, -20.5); tick(3);
      log('M4 gallery', { mode: g.mode, trial: g.trials.active?.id });
      for (const safe of ['door_kitchen', 'door_electrical', 'door_freezers']) {
        g.interactables.find((i) => i.id === 'sounds_' + safe)?.action();
        tick(2);
      }
      log('M4 sounds', { done: !!g.missions.objectives.find(o => o.def.id === 'm4_sounds')?.done, mode: g.mode, trial: g.trials.active?.id });
      g.player.pos.set(-37.5, 0, 24); tick(3);
      log('M4 office', { mode: g.mode, trial: g.trials.active?.id, note: !!st().note });
      g.trials.officeSurviveLeft = 0.2; g.trials.puppetOut = false;
      tick(6);
      log('M4 night', { mode: g.mode, ch: g.chapter });
      let guard = 0;
      while (g.chapter !== 5 && guard++ < 200) { tick(4); if (g.cine && g.cine.active) g.cine.stop(true); }
      log('M5 auto', { ch: g.chapter, mode: g.mode, dying: g.mode === 'dying' ? g.dyingAnimatronic?.def?.id : null });

      // M5: cinta del cove
      const tapeCove = g.missions.items.find((i) => i.id === 'tape_w3');
      log('M5 cinta item', { hay: !!tapeCove, pos: tapeCove ? [tapeCove.mesh.position.x, tapeCove.mesh.position.z] : null, visible: tapeCove?.mesh.visible });
      if (tapeCove) {
        g.player.pos.set(tapeCove.mesh.position.x, 0, tapeCove.mesh.position.z);
        tick(1);
        log('tras tick1', { mode: g.mode, note: !!st().note, visible: tapeCove.mesh.visible, itemAt: !!g.missions.itemAt(g.player.pos, 0.95) });
        tick(3);
        log('tras tick3', { mode: g.mode, note: !!st().note, visible: tapeCove.mesh.visible });
      }
      // intento directo del pickup por interacción
      if (tapeCove && tapeCove.mesh.visible) {
        const it = g.missions.itemAt(g.player.pos, 0.95);
        if (it) { g.missions.removeItem(it.id); g.pickupItem ? log('pickupItem?', { tiene: typeof g.pickupItem }) : null; }
      }
      // cerrar nota si abierta y reintentar
      st().setNote(null);
      tick(3);
      log('nota cerrada', { mode: g.mode, m5cove: !!g.missions.objectives.find(o => o.def.id === 'm5_cove_tape')?.done });
      // trial cove
      g.player.pos.set(-36.5, 0, 5); tick(3);
      log('cove trial', { trial: g.trials.active?.id, mode: g.mode });
      res.estadoFinal = {
        ch: g.chapter, mode: g.mode,
        dying: g.mode === 'dying' ? { quien: g.dyingAnimatronic?.def?.id, pos: [g.dyingAnimatronic?.pos?.x, g.dyingAnimatronic?.pos?.z] } : null,
        playerPos: [g.player.pos.x, g.player.pos.z],
        hidden: g.player.hidden,
        enemies: g.animatronics.filter(a => a.active).map(a => ({ id: a.def.id, st: a.state, pos: [a.pos.x.toFixed(1), a.pos.z.toFixed(1)] })),
      };
      res.OK = true;
      window.__probeResult = JSON.stringify(res, null, 1);
    } catch (e) {
      res.error = String(e && e.message || e);
      window.__probeResult = JSON.stringify(res, null, 1);
    }
    g.render = origRender;
  })();
  return 'LANZADO';
})();
