(() => {
  const g = window.__brunoGame;
  const col = id => {
    const c = g.world.colliders.find(q => q.id === id);
    return c ? c.active : 'no-existe';
  };
  const antes = { e1: col('vent_cover_fire_e1'), e7: col('vent_cover_fire_e7'), d1: col('vent_cover_fire_d1') };
  // apagar la primera tarea como si el jugador usara el extintor
  g.trials.completeTask('e1');
  const anchor = g.world.anchors.get('dcgen_e1');
  const luz = anchor && anchor.mesh && anchor.mesh.material && anchor.mesh.material.emissive.getHex();
  return JSON.stringify({
    antes,
    despues: { e1: col('vent_cover_fire_e1'), e7: col('vent_cover_fire_e7') },
    tareasHechas: g.trials.tasksDone,
    luzEstado: luz && luz.toString(16),
    nextTarea: g.trials.nextTask() && g.trials.nextTask().label,
    hudTareas: g.trials.active && [g.trials.tasksDone.length, g.trials.active.tasks.length],
  });
})()
