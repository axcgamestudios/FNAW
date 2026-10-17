(() => {
  const g = window.__brunoGame;
  const luna = g.animatronics.find(a => a.def.id === 'luna');
  luna.teleportTo(10, -50, 0);
  luna.calmDown();
  luna.currentSpeed = 0;
  luna.rig.root.position.set(10, 0, -50);
  luna.rig.root.rotation.set(0, 0, 0);
  luna.rig.model.rotation.x = 0;
  const r = g.renderer;
  r.setSize(512, 480, false);
  const cam = g.camera;
  cam.position.set(10, 1.55, -47.6);
  cam.rotation.order = 'YXZ';
  cam.rotation.set(0.04, 0, 0);
  cam.fov = 50; cam.far = 40; cam.updateProjectionMatrix();
  // luz de relleno neutra para ver el modelo
  const L = new THREE.PointLight(0xdfe8ff, 14, 9, 1.8);
  L.position.set(10, 2.4, -47);
  g.scene.add(L);
  r.render(g.scene, cam);
  window.__lastShot = r.domElement.toDataURL('image/jpeg', 0.82);
  g.scene.remove(L);
  return 'LUNA2 ' + window.__lastShot.length;
})()
