(() => {
  const g = window.__brunoGame;
  const luna = g.animatronics.find(a => a.def.id === 'luna');
  // colocarla quieta frente a la cámara
  luna.teleportTo(-30, -40, 0);
  luna.calmDown();
  luna.currentSpeed = 0;
  const r = g.renderer;
  r.setSize(512, 480, false);
  const cam = g.camera;
  cam.position.set(-30, 1.6, -37.5);
  cam.rotation.order = 'YXZ';
  cam.rotation.set(0.06, 0, 0);
  cam.fov = 55; cam.far = 40; cam.updateProjectionMatrix();
  luna.rig.root.position.set(-30, 0, -40);
  luna.rig.root.rotation.set(0, 0, 0);
  luna.rig.model.rotation.x = 0;
  r.render(g.scene, cam);
  window.__lastShot = r.domElement.toDataURL('image/jpeg', 0.78);
  return 'LUNA-SHOT ' + window.__lastShot.length;
})()
