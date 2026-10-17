(() => {
  const g = window.__brunoGame;
  if (!g) return 'NO-GAME';
  const r = g.renderer;
  r.setSize(448, 252, false);
  const cam = g.camera;
  cam.position.set(-37.5, 2.18, 24.5);
  cam.rotation.set(0.08, 0, 0);
  cam.fov = 70;
  cam.far = 18;
  cam.near = 0.1;
  cam.updateProjectionMatrix();
  r.render(g.scene, cam);
  window.__lastShot = r.domElement.toDataURL('image/jpeg', 0.7);
  cam.far = 120;
  cam.updateProjectionMatrix();
  return 'SHOT-OK ' + window.__lastShot.length;
})()
