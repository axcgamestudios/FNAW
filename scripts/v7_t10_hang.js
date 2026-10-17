(() => {
  const g = window.__brunoGame;
  const luna = g.animatronics.find(a => a.def.id === 'luna');
  // colgarla del techo (percha central)
  luna.teleportTo(0, -48, 0.6);
  luna.hangFromCeiling(6.55);
  luna.rig.root.position.set(0, 6.55, -48);
  luna.rig.root.rotation.set(0, 0.6, 0);
  luna.rig.model.rotation.x = Math.PI; // boca abajo
  const r = g.renderer;
  r.setSize(512, 480, false);
  const cam = g.camera;
  cam.position.set(0, 1.6, -43.5);
  cam.rotation.order = 'YXZ';
  cam.rotation.set(0.62, 0, 0); // mirando arriba
  cam.fov = 60; cam.far = 60; cam.updateProjectionMatrix();
  const st = g.jumpscareStrobe;
  st.color.setHex(0xffe2c8); st.intensity = 12; st.distance = 14;
  st.position.set(0, 3.5, -46);
  r.render(g.scene, cam);
  window.__lastShot = r.domElement.toDataURL('image/jpeg', 0.8);
  st.intensity = 0;
  return 'HANG ' + window.__lastShot.length;
})()
