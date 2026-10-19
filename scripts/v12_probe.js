(() => {
  window.__v12 = { steps: [] };
  window.__v12Done = 'PENDING';
  (async () => {
    for (let i = 0; i < 600; i++) {
      if (window.__brunoGame) break;
      await new Promise(r => setTimeout(r, 100));
    }
    const g = window.__brunoGame;
    if (!g) { window.__v12Done = 'NO-GAME'; return; }
    window.__origRender = g.render;
    for (let i = 0; i < 900; i++) {
      if (g.trials && g.cams && g.world && g.player && (g.animatronics || []).length > 0) break;
      await new Promise(r => setTimeout(r, 200));
    }
    // congelar el render (GL software) — el estado se maneja con tick() manual
    g.render = function () {};
    await new Promise(r => setTimeout(r, 300));

    const R = window.__v12;
    const fireCols = () => g.world.colliders.filter(c => (c.id || '').startsWith('vent_cover_fire_'));
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(0.05); };

    /* ================= CAP 1 — empezar YA con linterna ================= */
    g.startChapter(1);
    await new Promise(r => setTimeout(r, 400));
    g.mode = 'playing'; // saltar la cinemática congelada
    R.cap1 = {
      hasFlashlight: g.missions.hasFlashlight,
      flashlightOn: g.player.flashlightOn,
      armsVisible: g.guardArms ? g.guardArms.visible : null,
      torchInHand: g.flashlightModel ? g.flashlightModel.visible : null,
      objectives: g.missions.objectives.map(o => o.def.id),
      torchPickupGone: !g.interactables.some(i => i.id === 'pickup_torch'),
      breakers: g.interactables.filter(i => i.id === 'breaker_1' || i.id === 'breaker_2').length,
      enemies: g.chapterDef.enemies,
    };
    // toggle F
    const fPrev = g.player.flashlightOn;
    g.player.toggleFlashlight();
    R.cap1.toggleFWorks = g.player.flashlightOn !== fPrev;
    g.player.toggleFlashlight();
    // goto storage
    g.player.pos.set(-22.5, 0, 5); tick(6);
    R.cap1.storageDone = !!g.missions.objectives.find(o => o.def.id === 'c1_storage')?.done;
    // goto arcade
    g.player.pos.set(-12, 0, -14); tick(6);
    R.cap1.arcadeDone = !!g.missions.objectives.find(o => o.def.id === 'c1_arcade')?.done;
    // breakers (acción directa)
    const br1 = g.interactables.find(i => i.id === 'breaker_1');
    const br2 = g.interactables.find(i => i.id === 'breaker_2');
    if (br1) br1.action();
    if (br2) br2.action();
    R.cap1.breakersDone = g.missions.objectives.filter(o => o.def.id === 'c1_b1' || o.def.id === 'c1_b2').every(o => o.done);
    // volver a la oficina → c1_office + fin de capítulo
    g.player.pos.set(-37.5, 0, 24); tick(6);
    R.cap1.officeDone = !!g.missions.objectives.find(o => o.def.id === 'c1_office')?.done;
    R.cap1.allDone = g.missions.allRequiredDone();

    /* ================= CAP 2 — fusibles ================= */
    g.startChapter(2);
    await new Promise(r => setTimeout(r, 400));
    g.mode = 'playing';
    R.cap2 = {
      objectives: g.missions.objectives.map(o => o.def.id),
      fuseItems: g.missions.items.filter(i => i.kind === 'fuse').map(i => i.id),
      tokens: g.missions.items.filter(i => i.kind === 'token').length,
      // recoger un fusible → progreso
    };
    const fuse = g.missions.items.find(i => i.kind === 'fuse');
    if (fuse) { g.player.pos.set(fuse.mesh.position.x, 0, fuse.mesh.position.z); tick(4); }
    R.cap2.fusePicked = g.missions.items.filter(i => i.kind === 'fuse').every(i => !i.mesh.visible) === false && g.missions.fusesHeld >= 0;
    R.cap2.fusesHeld = g.missions.fusesHeld;
    R.cap2.c2FusesProgress = g.missions.objectives.find(o => o.def.id === 'c2_fuses')?.count ?? null;

    /* ================= CAP 7 — EL SÓTANO EN LLAMAS ================= */
    g.startChapter(7);
    await new Promise(r => setTimeout(r, 600));
    g.mode = 'playing';
    const luna = g.animatronics.find(a => a.def.id === 'luna');
    R.cap7 = {
      objectives: g.missions.objectives.map(o => o.def.id),
      luna: luna ? { hanging: luna.hanging, x: +luna.pos.x.toFixed(1), z: +luna.pos.z.toFixed(1), retired: luna.retired, activeCh: luna.def.activeChapters } : null,
      fireDoorsLocked: ['door_mega_w', 'door_mega_c', 'door_mega_e'].map(id => g.world.doors.get(id)?.locked),
      keycards: g.interactables.filter(i => i.id.startsWith('pickup_key_')).length,
      extAnchors: [1, 2, 3, 4, 5].map(n => !!g.world.anchors.get('dcgen_e' + n)),
      rackColliders: g.world.colliders.filter(c => (c.id || '').startsWith('rack_')).length,
      basementProps: g.world.colliders.filter(c => /basement_|bpillar_|megachest_|dcext_|drum_/.test(c.id || '')).length,
      noDaycareJunk: !g.world.colliders.some(c => /mega_carousel|mega_piano|mega_castle|mega_shelf|mega_rainbow|mega_tube/.test(c.id || '')),
    };
    R.audio = {
      jumpscareDur: g.audio.jumpscareBuf ? +g.audio.jumpscareBuf.duration.toFixed(2) : null,
      sfxLoaded: g.audio.sfxBufs ? g.audio.sfxBufs.size : 0,
      foxyRunDur: g.audio.sfxBufs && g.audio.sfxBufs.get('foxy_run') ? +g.audio.sfxBufs.get('foxy_run').duration.toFixed(2) : null,
    };

    /* ============ SIMULACIÓN: 3 tarjetas → sótano → prueba ============ */
    R.sim = {};
    g.missions.keycards = 3;
    R.sim.fireBarriersBefore = fireCols().map(c => c.id.replace('vent_cover_fire_', ''));
    const doorW = g.world.doors.get('door_mega_w');
    R.sim.doorWLockedBefore = doorW.locked;
    const doorInter = g.interactables.find(i => i.id === 'door_door_mega_w');
    if (doorInter) doorInter.action();
    R.sim.doorWUnlockedAfter = !doorW.locked;
    // descender
    g.player.pos.set(-36, 0, -37);
    tick(8);
    R.sim.descendDone = !!g.missions.objectives.find(o => o.def.id === 'c7_descend')?.done;
    R.sim.trial = g.trials.active
      ? { id: g.trials.active.id, tasks: g.trials.active.tasks.map(t => t.id), scares: g.trials.active.scares.length, aggression: g.trials.active.aggression, dark: g.trials.active.darkFromStart }
      : null;
    R.sim.taskCards = g.trialInteractables.length;
    R.sim.firstHold = g.trialInteractables[0] ? g.trialInteractables[0].holdTime : null;
    R.sim.moonAfterBegin = luna ? { active: luna.active, state: luna.state, hanging: luna.hanging } : null;
    // completar la tarea e5 (NW) — acción directa
    const t1 = g.trialInteractables.find(i => i.id.includes('_e5'));
    if (t1) t1.action();
    R.sim.tasksDone = [...g.trials.tasksDone];
    const e5col = fireCols().find(c => c.id === 'vent_cover_fire_e5');
    R.sim.e5BarrierOff = e5col ? !e5col.active : null;
    // completar el resto
    for (const id of ['e3', 'e2', 'e4', 'e1']) {
      const tk = g.trialInteractables.find(i => i.id.includes('_' + id));
      if (tk) tk.action();
    }
    R.sim.allTasksDone = g.trials.tasksDone.length === 5;
    R.sim.exitUnlocked = g.exitUnlocked;
    R.sim.sunRetired = luna ? { dayNight: luna.isSun ?? null, retired: luna.retired } : null;
    // el capítulo no termina hasta escapar
    R.sim.chapterPending = !g.chapterEndPending;

    window.__v12Done = 'DONE';
  })().catch(e => { window.__v12Done = 'ERROR: ' + (e && e.message); });
  return 'V12-PROBE-LANZADO';
})()
