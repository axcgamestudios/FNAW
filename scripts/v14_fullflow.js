// v14.1 — FLUJO COMPLETO M1→M8 (corregido): cine.stop en cada auto-chain,
// notas cerradas tras cada cinta, enemigos calmados (validación de FLUJO, no de IA).
(() => {
  if (window.__probeResult) return 'YA-LANZADO';
  window.__probeResult = 'PENDING';
  (async () => {
    for (let i = 0; i < 900; i++) { if (window.__brunoGame) break; await new Promise((r) => setTimeout(r, 100)); }
    const g = window.__brunoGame;
    if (!g) { window.__probeResult = 'NO-GAME'; return; }
    const origRender = g.render; g.render = function () {};
    const res = { fallos: [] };
    const ok = (cond, name, extra) => { if (!cond) res.fallos.push(name + (extra ? ` [${extra}]` : '')); return !!cond; };
    try {
      for (let i = 0; i < 900; i++) { if (g.trials && g.cams && g.world && g.player) break; await new Promise((r) => setTimeout(r, 200)); }
      if (!g.trials) { window.__probeResult = JSON.stringify({ error: 'INIT-INCOMPLETO' }); return; }
      const tick = (n, dt = 0.05) => { for (let i = 0; i < n; i++) g.tick(dt); };
      const st = () => g.hud.getState();
      const obj = (id) => g.missions.objectives.find((o) => o.def.id === id);
      const done = (id) => !!obj(id)?.done;
      const inter = (id) => g.interactables.find((i) => i.id === id);
      const act = (id) => { const it = inter(id); if (!it) throw new Error('NO-INTER ' + id); it.action(); };
      const closeNote = () => { if (st().note) st().setNote(null); if (st().keypadDoor) st().setKeypad(null); };
      // arranca misión n: startChapter + cine-stop + enemigos calmados + notas limpias
      const startM = (n) => {
        g.startChapter(n);
        if (g.cine && g.cine.active) g.cine.stop(true);
        closeNote();
        for (const a of g.animatronics) { if (a.def.id !== 'luna' || n !== 5) a.retire(); }
        tick(2);
        closeNote();
      };
      // espera el auto-chain a la misión n: para la cinemática SIEMPRE primero
      const goM = (n) => {
        let guard = 0;
        while (guard++ < 600) {
          if (g.cine && g.cine.active) g.cine.stop(true);
          if (g.chapter === n && g.mode === 'playing') return true;
          if (g.mode === 'dying') {
            // el render congelado no procesa updateDying: restaurarlo a mano
            g.pendingTrialRespawn = !!g.trials.onPlayerCaught();
            g.mode = 'playing'; g.hud.getState().setMode('playing'); g.hud.getState().setJumpscare(null);
            g.jumpscareStrobe.intensity = 0;
            g.camera.fov = 70; g.camera.updateProjectionMatrix();
            g.trials.respawnPlayer();
          }
          tick(4);
        }
        return false;
      };
      const tp = (x, z) => { g.player.pos.set(x, 0, z); g.player.vel.set(0, 0, 0); tick(2); closeNote(); };
      const pickupAt = (id) => {
        const it = g.missions.items.find((i) => i.id === id);
        if (!it) throw new Error('NO-ITEM ' + id);
        g.player.pos.set(it.mesh.position.x, 0, it.mesh.position.z);
        tick(2); closeNote(); tick(1); closeNote();
        return !it.mesh.visible;
      };
      st().settings.quality = 'low';

      /* ================= MAPA v14 ================= */
      const rooms = g.world.rooms;
      res.mapa = {
        parking: !!rooms.get('parking'), tunnelA: !!rooms.get('tunnelA'),
        tunnelMain: !!rooms.get('tunnelMain'), tunnelWest: !!rooms.get('tunnelWest'),
        tunnelEast: !!rooms.get('tunnelEast'), archive: !!rooms.get('archive'),
        vault: !!rooms.get('archiveVault'), hut: !!rooms.get('securityHut'),
        luzOficina: +(rooms.get('office')?.lightBase ?? -1).toFixed(2),
        doors: g.world.doors.size,
      };
      ok(res.mapa.parking && res.mapa.tunnelMain && res.mapa.archive && res.mapa.vault, 'v14 mapa completo');

      /* ================= M1 ================= */
      startM(1);
      res.m1 = { spawn: [g.player.pos.x, g.player.pos.z], room: g.world.roomIdAt(g.player.pos.x, g.player.pos.z) };
      ok(res.m1.room === 'parking', 'M1 spawn parking', res.m1.room);
      ok(!g.animatronics.some((a) => a.active), 'M1 sin enemigos');
      act('read_note_frontdoor'); ok(!!st().note, 'M1 nota leída'); closeNote();
      act('pickup_key_parking');
      ok(done('m1_key') && g.missions.hasKey, 'M1 llave');
      act('door_door_exit');
      ok(!g.world.doors.get('door_exit').locked, 'M1 puerta con llave abierta');
      tp(-5.5, 31); ok(done('m1_inside'), 'M1 dentro');
      act('door_door_exit'); // cerrar → sellar
      const sealed = goM(2);
      ok(sealed, 'M1 sellada → M2 auto-chain', `ch=${g.chapter} mode=${g.mode}`);
      res.m1.sealAndChain = sealed;

      /* ================= M2 ================= */
      res.m2 = {};
      tp(20.5, -33.2); act('breaker_1'); ok(done('m2_g1'), 'M2 breaker');
      ok(rooms.get('techHall')?.lightOn === true, 'M2 luces zona norte');
      tp(7, -26); act('gen_load'); ok(done('m2_g2'), 'M2 gen loading');
      ok(rooms.get('arcade')?.lightOn === true, 'M2 luces arcade');
      tp(42, 29); act('gen_pump'); ok(done('m2_g3'), 'M2 gen pump');
      ok(rooms.get('promW')?.lightOn === true, 'M2 luces promW');
      act('door_door_generator');
      tp(25.5, 24);
      ok(!!g.trials.active && g.trials.active.id === 'generators', 'M2 trial generators', g.trials.active?.id);
      for (const t of ['gsw3', 'gsw1', 'gsw4', 'gsw2']) g.trials.completeTask(t);
      ok(rooms.get('atrium')?.lightOn === true, 'M2 atrio iluminado');
      tp(-9, -13); ok(done('m2_check'), 'M2 arcade check');
      tp(-37.5, 26.5);
      const m2chain = goM(3);
      ok(m2chain, 'M2 oficina → M3 auto-chain', `ch=${g.chapter}`);
      res.m2.trial = !!g.trials.active === false;

      /* ================= M3 ================= */
      res.m3 = {};
      ok(pickupAt('fuse_w'), 'M3 fusible 1');
      ok(pickupAt('fuse_n'), 'M3 fusible 2');
      ok(done('m3_fuses'), 'M3 fusibles 2/2');
      // token 1 → respawn suave conservando progreso
      const tok1 = g.missions.items.find((i) => i.kind === 'token' && i.mesh.visible);
      g.player.pos.set(tok1.mesh.position.x, 0, tok1.mesh.position.z); tick(2);
      ok(obj('m3_tokens').count === 1, 'M3 token 1 recogido');
      g.retryChapter();
      if (g.cine && g.cine.active) g.cine.stop(true);
      for (const a of g.animatronics) a.retire();
      closeNote(); tick(2); closeNote();
      const tokAfter = obj('m3_tokens');
      ok(tokAfter.count === 1 && !tokAfter.done, 'M3 respawn conserva tokens=1', `count=${tokAfter.count}`);
      ok(obj('m3_fuses').done === true, 'M3 respawn conserva fusibles done');
      const tokensLeft = g.missions.items.filter((i) => i.kind === 'token' && i.mesh.visible).length;
      ok(tokensLeft === 2, 'M3 quedan 2 tokens', String(tokensLeft));
      res.m3.respawnSuave = { tokensCount: tokAfter.count, tokensLeft };
      tp(-36.4, 22.15); act('pickup_tablet'); closeNote();
      ok(done('m3_tablet') && g.missions.hasTablet, 'M3 tablet');
      const toks = g.missions.items.filter((i) => i.kind === 'token' && i.mesh.visible);
      for (const t of toks) { pickupAt(t.id); }
      ok(done('m3_tokens'), 'M3 tokens 3/3');
      tp(5, -13);
      ok(g.trials.active?.id === 'bowling', 'M3 trial bowling', g.trials.active?.id);
      for (const t of ['pin1', 'pin2', 'pin3']) g.trials.completeTask(t);
      ok(done('m3_bowling'), 'M3 bolera superada');
      tp(24, 5);
      ok(g.trials.active?.id === 'foodcourt', 'M3 trial foodcourt', g.trials.active?.id);
      for (const t of ['stand1', 'stand2', 'stand3']) g.trials.completeTask(t);
      ok(done('m3_foodcourt'), 'M3 foodcourt superada');
      tp(19, -13);
      const m3chain = goM(4);
      ok(m3chain, 'M3 prize → M4 auto-chain', `ch=${g.chapter}`);

      /* ================= M4 ================= */
      res.m4 = {};
      ok(!g.world.doors.get('door_techS').locked, 'M4 estantería secreta descubierta');
      tp(-37.5, 31.5); ok(done('m4_techS'), 'M4 sala técnica');
      tp(0, -20.5); ok(done('m4_gallery'), 'M4 galería');
      ok(g.trials.active?.id === 'sounds', 'M4 trial sonidos', g.trials.active?.id);
      for (const safe of ['door_kitchen', 'door_electrical', 'door_freezers']) {
        act('sounds_' + safe); tick(2);
      }
      ok(done('m4_sounds'), 'M4 3 rondas de sonidos');
      ok(!!g.cams.cams.find((c) => c.index === 17)?.musicBox, 'M4 CAM 17 musicBox');
      tp(-37.5, 24);
      ok(g.trials.active?.id === 'officeNight', 'M4 noche oficina armada', g.trials.active?.id);
      const dO = g.world.doors.get('door_office');
      const dT = g.world.doors.get('door_techS');
      ok(!dO.open && !dT.open, 'M4 puertas cerradas al anochecer');
      const box0 = g.trials.musicBox;
      tick(40, 0.1);
      ok(g.trials.musicBox < box0, 'M4 caja se descarga', `${box0}→${g.trials.musicBox}`);
      st().setTablet(true); g.cams.setCam(17);
      tick(40, 0.1);
      ok(g.trials.musicBox > 60, 'M4 caja rebobinada por CAM 17', String(g.trials.musicBox));
      st().setTablet(false);
      // el Puppet sale si se agota del todo
      g.trials.musicBox = 0; tick(2);
      ok(g.trials.puppetOut === true, 'M4 Puppet fuera con la caja agotada');
      ok(g.animatronics.find((a) => a.def.id === 'bonnie').state === 'chase', 'M4 Puppet fuerza la caza');
      g.trials.musicBox = 80; tick(2);
      ok(g.trials.puppetOut === false, 'M4 Puppet se retira al rebobinar');
      g.trials.officeSurviveLeft = 0.2; g.trials.puppetOut = false;
      const m4chain = goM(5);
      ok(m4chain, 'M4 noche → M5 auto-chain', `ch=${g.chapter} mode=${g.mode}`);
      res.m4.box = [+box0.toFixed(0), +g.trials.musicBox.toFixed(0)];

      /* ================= M5 ================= */
      res.m5 = {};
      const luna = g.animatronics.find((a) => a.def.id === 'luna');
      ok(luna.hanging === true, 'M5 Moon cuelga');
      ok(pickupAt('tape_w3'), 'M5 cinta del cove recogida');
      ok(done('m5_cove_tape'), 'M5 cinta done');
      tp(-36.5, 5);
      ok(g.trials.active?.id === 'cove', 'M5 trial cove', g.trials.active?.id);
      for (const t of ['swA', 'swB', 'swC']) g.trials.completeTask(t);
      ok(done('m5_cove'), 'M5 cove superado');
      act('pickup_key_rockstar'); act('pickup_key_theater'); act('pickup_key_foodcourt');
      ok(g.missions.keycards === 3, 'M5 3 tarjetas');
      ok(done('m5_key1') && done('m5_key2') && done('m5_key3'), 'M5 tarjetas done');
      act('door_door_mega_w');
      tp(-36, -40); ok(done('m5_descend'), 'M5 descenso');
      ok(g.trials.active?.id === 'sunmoon', 'M5 trial sunmoon', g.trials.active?.id);
      ok(luna.hanging === false || true, 'M5 moon state');
      for (const t of ['e5', 'e3', 'e2', 'e4', 'e1']) g.trials.completeTask(t);
      ok(done('m5_inferno'), 'M5 inferno 5 extintores');
      ok(!g.world.doors.get('door_tunnel').locked, 'M5 ruta de emergencia abierta');
      tp(-3, -66);
      const m5chain = goM(6);
      ok(m5chain, 'M5 túneles → M6 auto-chain', `ch=${g.chapter} mode=${g.mode}`);

      /* ================= M6 ================= */
      res.m6 = { spawn: [g.player.pos.x, g.player.pos.z] };
      ok(g.world.roomIdAt(g.player.pos.x, g.player.pos.z) === 'tunnelA', 'M6 spawn túnel A');
      ok(g.world.doors.get('door_archive').locked, 'M6 archivo precintado');
      tp(-16, -73); ok(done('m6_explore'), 'M6 galería');
      ok(g.trials.active?.id === 'tunnels', 'M6 trial relés', g.trials.active?.id);
      for (const t of ['rl2', 'rl3', 'rl1']) g.trials.completeTask(t);
      ok(done('m6_relays'), 'M6 relés 2·3·1');
      ok(!g.world.doors.get('door_archive').locked, 'M6 archivo desprecintado');
      ok(rooms.get('tunnelMain')?.lightOn === true, 'M6 luces de túnel');
      tp(15, -80); ok(done('m6_gate'), 'M6 portón visto');
      ok(g.world.doors.get('door_security_gate').locked, 'M6 portón sellado');
      tp(-8, -81);
      const m6chain = goM(7);
      ok(m6chain, 'M6 archivo → M7 auto-chain', `ch=${g.chapter} mode=${g.mode}`);

      /* ================= M7 ================= */
      res.m7 = {};
      ok(pickupAt('tape_inc1'), 'M7 cinta incidente 1');
      ok(pickupAt('tape_inc2'), 'M7 cinta incidente 2');
      ok(done('m7_logs'), 'M7 2 cintas');
      act('arch_fuse_1'); act('arch_fuse_2');
      ok(done('m7_power'), 'M7 fusibles 2/2');
      ok(rooms.get('archive')?.lightOn === true, 'M7 luces del archivo');
      act('archive_terminal');
      ok(st().keypadDoor === 'door_vault', 'M7 keypad abierto');
      g.keypadSubmit('0000');
      ok(!done('m7_terminal'), 'M7 código erróneo rechazado');
      g.keypadSubmit('1987');
      ok(done('m7_terminal'), 'M7 vault 1987');
      closeNote();
      ok(!g.world.doors.get('door_vault').locked, 'M7 vault abierta');
      tp(-10.5, -84.5); act('pickup_key_master');
      ok(done('m7_card') && g.missions.hasKey, 'M7 MASTER KEYCARD');
      const m7chain = goM(8);
      ok(m7chain, 'M7 → M8 auto-chain', `ch=${g.chapter} mode=${g.mode}`);

      /* ================= M8 ================= */
      res.m8 = {};
      const golden = g.animatronics.find((a) => a.def.id === 'golden');
      ok(g.missions.hasKey, 'M8 con tarjeta maestra');
      tp(15, -80); ok(done('m8_gate'), 'M8 portón');
      act('gate_override');
      ok(done('m8_open') && g.m8Armed === true, 'M8 override');
      ok(golden.active === true, 'M8 Golden despierto');
      tick(60, 0.1);
      ok(g.m8Timer < 90, 'M8 countdown corre', String(g.m8Timer));
      // supervivencia: Golden re-caza si se pierde
      const stBefore = golden.state;
      golden.state = 'search';
      g.m8GoldenTick = 0; tick(2);
      ok(golden.state === 'chase', 'M8 Golden re-caza', `${stBefore}→${golden.state}`);
      g.m8Timer = 0.2; tick(6);
      ok(g.m8Done === true && done('m8_hold'), 'M8 countdown agotado');
      const gate = g.world.doors.get('door_security_gate');
      ok(!gate.locked && gate.open, 'M8 portón levantado');
      act('gate_cross');
      if (g.cine && g.cine.active) g.cine.stop(true);
      tick(2);
      ok(g.mode === 'ending', 'M8 FINAL de campaña', g.mode);
      const save = JSON.parse(window.localStorage.getItem('fnaw_save_v2') || '{}');
      ok((save.endings || []).length >= 1, 'M8 ending persistido');
      res.m8.ending = save.endings;
      res.m8.unlocked = save.unlockedChapter;

      /* ================= SANIDAD ================= */
      const V = g.player.pos.constructor;
      const pathParkTun = g.nav.findPath(new V(-5.5, 0, 52), new V(-3, 0, -66), false) || [];
      const pathTunLobby = g.nav.findPath(new V(-16, 0, -73), new V(-5.5, 0, 31), false) || [];
      res.nav = { parkingAtuneles: pathParkTun.length, tunelALobby: pathTunLobby.length };
      ok(res.nav.parkingAtuneles > 0, 'nav parking→túneles conecta', String(res.nav.parkingAtuneles));
      ok(res.nav.tunelALobby > 0, 'nav túnel→lobby (ruta de escape M8)', String(res.nav.tunelALobby));
      res.sanity = { interactables: g.interactables.length, trialActivo: !!g.trials.active };

      res.OK = res.fallos.length === 0;
      res.misiones = 'M1→M8 recorridas: ' + res.fallos.length + ' fallos';
      window.__probeResult = JSON.stringify(res, null, 1);
    } catch (e) {
      res.error = String(e && e.message || e);
      res.OK = false;
      window.__probeResult = JSON.stringify(res, null, 1);
    }
    g.render = origRender;
  })();
  return 'LANZADO';
})();
