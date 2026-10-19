// v13 — prueba completa: lockers, escondite/salida, te-vió-esconderte,
// muerte por la espalda, brazos de Moon, cinemática sin T-pose.
(() => {
  if (window.__probeResult) return 'YA-LANZADO';
  window.__probeResult = 'PENDING';
  (async () => {
    for (let i = 0; i < 600; i++) {
      if (window.__brunoGame) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const g = window.__brunoGame;
    if (!g) { window.__probeResult = 'NO-GAME'; return; }
    const origRender = g.render;
    g.render = function () {};
    const res = {};
    try {
      for (let i = 0; i < 900; i++) {
        if (g.trials && g.cams && g.world && g.player && (g.animatronics || []).length > 0) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!g.trials) { window.__probeResult = JSON.stringify({ error: 'INIT-INCOMPLETO' }); return; }
      const tick = (n, dt = 0.05) => { for (let i = 0; i < n; i++) g.tick(dt); };

      // ============ 1. CAP 1: LOCKERS ============
      g.startChapter(1);
      if (g.cine && g.cine.active) g.cine.stop(true);
      const banks = g.world.colliders.filter((c) => (c.boxName || '').startsWith('lockerbank_'));
      res.lockers = {
        bancosCollider: banks.length,
        spots: g.mapDataHidingSpots ? g.mapDataHidingSpots.filter((s) => s.type === 'locker').length : 'n/a',
        interactables: g.interactables.filter((i) => i.id.startsWith('hide_locker')).length,
      };

      // ============ 2. ESCONDERSE / SALIR ============
      const locker = g.interactables.find((i) => i.id === 'hide_locker_atrium_w');
      if (!locker) throw new Error('no locker_atrium_w');
      g.player.pos.set(-15.5, 0, 5.2); // cerca del banco (muro oeste del atrio)
      g.player.yaw = Math.PI; // mirando -X hacia el banco... (la puerta mira +X)
      locker.action();
      res.esconderse = {
        hidden: g.player.hidden,
        pos: [g.player.pos.x, g.player.pos.z],
        spot: locker.pos ? [locker.pos.x, locker.pos.z] : null,
      };
      // unhide: debe aparecer DELANTE de la puerta (x + 1.05)
      const unhide = g.interactables.find((i) => i.id === 'unhide_locker_atrium_w');
      unhide.action();
      res.salida = {
        hidden: g.player.hidden,
        pos: [+g.player.pos.x.toFixed(2), +g.player.pos.z.toFixed(2)],
        delanteDePuerta: g.player.pos.x < -14.9, // más al ESTE que el locker (-15.5)
      };

      // ============ 3. MUERTE POR LA ESPALDA ============
      g.startChapter(1);
      if (g.cine && g.cine.active) g.cine.stop(true);
      const freddy = g.animatronics.find((a) => a.def.id === 'freddy');
      g.player.pos.set(0, 0, 0);
      g.player.yaw = 0; // mirando -Z: lookDir (0,0,-1)
      // Freddy DETRÁS del jugador (+Z): entre el jugador y su espalda
      freddy.teleportTo(0, 1.0, Math.PI); // de cara al jugador
      freddy.wake();
      freddy.state = 'patrol';
      const modeBefore = g.mode;
      tick(3, 0.1); // 0.3s: suficiente para el check de espalda
      res.espalda = {
        modoAntes: modeBefore,
        modoDespues: g.mode,
        muerte: g.mode === 'dying',
      };

      // ============ 4. TE VIO ESCONDERTE ============
      g.startChapter(1);
      if (g.cine && g.cine.active) g.cine.stop(true);
      const freddy2 = g.animatronics.find((a) => a.def.id === 'freddy');
      const locker2 = g.interactables.find((i) => i.id === 'hide_locker_atrium_w');
      g.player.pos.set(-15.5, 0, 5.2);
      freddy2.teleportTo(-14.0, 5.2, Math.PI / 2);
      freddy2.wake();
      freddy2.state = 'chase';
      locker2.action();
      res.vioEsconderse = {
        sawHideSpot: !!freddy2.sawHideSpot,
        notificado: true,
      };
      // Freddy camina hasta el armario y SAC al guardia
      let deathByAmbush = false;
      for (let i = 0; i < 200; i++) {
        g.tick(0.1);
        if (g.mode === 'dying') { deathByAmbush = true; break; }
        if (i === 100) { freddy2.teleportTo(-16.6, 7.8); }
      }
      res.emboscada = { muerte: deathByAmbush, distFreddy: +Math.hypot(freddy2.pos.x + 15.5, freddy2.pos.z - 7.8).toFixed(2) };

      // ============ 5. CINEMÁTICA SIN T-POSE ============
      g.startChapter(1);
      if (g.cine && g.cine.active) g.cine.stop(true);
      // brazo de Freddy en reposo de juego: dirección MUNDIAL del hueso
      const Vec3 = g.player.pos.constructor;
      const armDir = (a) => {
        const arm = a.rig.bones.armL;
        const child = a.rig.bones.forearmL;
        if (!arm || !child) return null;
        const p1 = arm.getWorldPosition(new Vec3());
        const p2 = child.getWorldPosition(new Vec3());
        return p2.sub(p1).normalize();
      };
      const f3 = g.animatronics.find((x) => x.def.id === 'freddy');
      // 5a. T-pose de FÁBRICA: dirección en bind (antes de cualquier update)
      g.world.scene.updateMatrixWorld(true);
      const bindDir = armDir(f3);
      // 5b. durante la cinemática: tras 1s de poseIdle
      g.playCinematic('cine_sighting', () => {});
      await new Promise((r) => setTimeout(r, 300));
      for (let i = 0; i < 20; i++) g.tick(0.05); // no corre en cinematic... usar cine path
      // el loop de update llama poseIdle en modo cinematic: llamar directamente
      for (let i = 0; i < 30; i++) { g.cine.update(0.05); for (const a of g.animatronics) a.poseIdle(0.05); }
      g.world.scene.updateMatrixWorld(true);
      const cineDir = armDir(f3);
      if (g.cine && g.cine.active) g.cine.stop(false);
      res.cinematica = {
        bindY: bindDir ? +bindDir.y.toFixed(2) : null,   // T-pose: y≈0 (horizontal)
        cineY: cineDir ? +cineDir.y.toFixed(2) : null,   // brazos abajo: y≈-0.9
        ok: cineDir && bindDir ? (cineDir.y < bindDir.y - 0.3) : null,
      };

      // ============ 6. CAP 7: BRAZOS DE MOON ============
      g.startChapter(7);
      if (g.cine && g.cine.active) g.cine.stop(true);
      const luna = g.animatronics.find((a) => a.def.id === 'luna');
      res.moon = {
        colgada: luna.hanging,
        brazosSeparados: !!(luna.moonArms || (luna.rig && luna.rig.moonArms)),
      };
      const arms = luna.moonArms || (luna.rig && luna.rig.moonArms);
      if (arms) {
        // colgada: tras unos ticks los brazos rotan hacia abajo-mundo
        for (let i = 0; i < 40; i++) g.tick(0.05);
        res.moon.pivotR_y = +arms.pivotR.rotation.y.toFixed(2);
        res.moon.pivotL_y = +arms.pivotL.rotation.y.toFixed(2);
        res.moon.meshR_z = +arms.meshR.rotation.z.toFixed(2);
        // despertar (descendAndWake): brazos a pose de caza
        luna.descendAndWake();
        luna.state = 'chase';
        for (let i = 0; i < 60; i++) g.tick(0.05);
        res.moon.caza_pivotR_y = +arms.pivotR.rotation.y.toFixed(2);
        res.moon.caza_meshR_z = +arms.meshR.rotation.z.toFixed(2);
      }

      // ============ 7. DIFICULTAD: STATS ============
      res.stats = g.animatronics.map((a) => ({
        id: a.def.id,
        run: a.def.speedRun,
        walk: a.def.speedWalk,
        windup: a.def.attackWindup,
      }));

      res.OK = true;
      window.__probeResult = JSON.stringify(res, null, 1);
    } catch (e) {
      window.__probeResult = JSON.stringify({ error: String(e && e.message || e) }, null, 1);
    }
    g.render = origRender;
  })();
  return 'LANZADO';
})();
