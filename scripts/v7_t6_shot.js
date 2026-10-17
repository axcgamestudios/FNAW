(() => {
  const g = window.__brunoGame;
  // salir del modo dying: forzar respawn
  if (g.mode === 'dying') { g.updateDying(3); }
  const r = g.renderer;
  r.setSize(512, 288, false);
  const cam = g.camera;
  cam.position.set(-34, 2.0, -36);
  cam.rotation.set(-0.05, Math.PI * 0.62, 0);
  cam.rotation.order = 'YXZ';
  cam.fov = 75; cam.far = 60; cam.updateProjectionMatrix();
  r.render(g.scene, cam);
  window.__lastShot = r.domElement.toDataURL('image/jpeg', 0.72);
  return 'SHOT ' + window.__lastShot.length + ' modo=' + g.mode;
})()
