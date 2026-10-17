(() => {
  const g = window.__brunoGame;
  const luna = g.animatronics.find(a => a.def.id === 'luna');
  luna.hanging = false;
  luna.teleportTo(0, -46, 0.4);
  luna.setDayNight('sun');
  luna.rig.root.position.set(0, 0, -46);
  luna.rig.root.rotation.set(0, 0.4, 0);
  luna.rig.model.rotation.x = 0;
  const r = g.renderer;
  r.setSize(512, 480, false);
  const cam = g.camera;
  cam.position.set(0, 1.55, -43.4);
  cam.rotation.order = 'YXZ';
  cam.rotation.set(0.03, 0, 0);
  cam.fov = 50; cam.far = 40; cam.updateProjectionMatrix();
  const st = g.jumpscareStrobe;
  st.color.setHex(0xfff0d0); st.intensity = 10; st.distance = 9;
  st.position.set(0, 2.3, -43);
  r.render(g.scene, cam);
  window.__lastShot = r.domElement.toDataURL('image/jpeg', 0.82);
  st.intensity = 0;
  return 'SOL ' + window.__lastShot.length;
})()
