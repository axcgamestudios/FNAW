// captura del ATRIO NUEVO v9: desde el arco sur mirando la estatua y el escenario
(() => {
  const g = window.__brunoGame;
  if (!g) return 'NO-GAME';
  const r = g.renderer;
  r.setSize(896, 504, false);
  const cam = g.camera;
  // desde la galería sur del atrio, mirando al norte (estatua + escenario)
  cam.position.set(0, 1.75, 17.5);
  cam.rotation.set(0, Math.PI, 0);
  cam.fov = 68;
  cam.far = 60;
  cam.updateProjectionMatrix();
  // linterna encendida para ver
  g.player.flashlightOn = true;
  g.player.flashlight.intensity = 26;
  r.render(g.scene, cam);
  window.__lastShot = r.domElement.toDataURL('image/jpeg', 0.72);
  return 'SHOT-OK ' + window.__lastShot.length;
})()