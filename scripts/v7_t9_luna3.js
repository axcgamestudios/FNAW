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
  // luz de relleno: el estrobo del jumpscare reciclado
  const st = g.jumpscareStrobe;
  st.color.setHex(0xe8eeff);
  st.intensity = 10;
  st.distance = 10;
  st.position.set(10, 2.4, -47);
  r.render(g.scene, cam);
  window.__lastShot = r.domElement.toDataURL('image/jpeg', 0.82);
  st.intensity = 0;
  return 'LUNA3 ' + window.__lastShot.length;
})()
