/* Camisa JP Sport 3D ao vivo no banner da Home (leve: só corpo + gola + punhos). */
(function () {
  const host = document.getElementById("hero3d");
  if (!host || !window.THREE) return;
  const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const W = () => host.clientWidth, H = () => host.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, W() / H(), 0.1, 100);
  camera.position.set(0, 0.1, 7.4);

  // luz lateral dura + rim frio (direção de arte do brandbook)
  scene.add(new THREE.HemisphereLight(0xdde6ff, 0x0a1630, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-5, 4, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fb0ff, 1.4); rim.position.set(5, 3, -5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.25); fill.position.set(3, -2, 5); scene.add(fill);

  // textura navy com símbolo no peito esquerdo e assinatura nas costas
  const cv = document.createElement("canvas"); cv.width = cv.height = 2048;
  const g = cv.getContext("2d");
  const pinta = () => {
    g.fillStyle = "#0F1F3D"; g.fillRect(0, 0, 2048, 2048);
    // micro-relevo de malha (pontilhado sutil)
    g.fillStyle = "rgba(255,255,255,0.025)";
    for (let y = 0; y < 2048; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < 2048; x += 6) g.fillRect(x, y, 2, 2);
    // gola e punhos em azul elétrico (detalhe)
    g.fillStyle = "#2F5BFF"; g.fillRect(680, 410, 690, 175); g.fillRect(750, 330, 540, 75);
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#FFFFFF";
    g.font = "italic 400 92px Anton, Impact, sans-serif"; g.fillText("JP", 1745, 1070);
    g.font = "500 16px 'JetBrains Mono', monospace"; g.fillText("J P   S P O R T", 1745, 1130);
    g.font = "italic 400 300px Anton, Impact, sans-serif"; g.fillText("JP", 578, 1000);
    g.font = "500 30px 'JetBrains Mono', monospace"; g.fillText("D A   I N D Ú S T R I A   P A R A   V O C Ê .", 578, 1190);
  };
  pinta();
  if (document.fonts) document.fonts.ready.then(() => { pinta(); tex.needsUpdate = true; });
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0.02, side: THREE.DoubleSide });

  const grupo = new THREE.Group(); scene.add(grupo);
  const loader = new THREE.OBJLoader();
  const montar = (obj) => {
    const manter = ["Camisa_Corpo", "Gola_V", "Punhos"];
    const rem = [];
    obj.traverse((c) => {
      if (!c.isMesh) return;
      if (!manter.some((n) => c.name.includes(n))) rem.push(c);
      else { c.material = mat; if (!c.geometry.attributes.normal) c.geometry.computeVertexNormals(); }
    });
    rem.forEach((c) => c.parent.remove(c));
    const box = new THREE.Box3().setFromObject(obj);
    const s = 2.55 / Math.max(...box.getSize(new THREE.Vector3()).toArray());
    const ctr = box.getCenter(new THREE.Vector3());
    obj.scale.setScalar(s); obj.position.set(-ctr.x * s, -ctr.y * s, -ctr.z * s);
    grupo.add(obj);
    host.classList.add("pronto");
  };
  if (window.__EMBEDDED_KIT_OBJ__) montar(loader.parse(window.__EMBEDDED_KIT_OBJ__));
  else loader.load(host.dataset.modelo || "models/kit_completo.obj", montar);

  // interação: arrastar gira; mouse inclina levemente; auto-giro lento
  let alvoY = -0.5, rotY = -0.5, alvoX = 0, rotX = 0, arrastando = false, ultimoX = 0;
  host.addEventListener("pointerdown", (e) => { arrastando = true; ultimoX = e.clientX; host.setPointerCapture(e.pointerId); });
  host.addEventListener("pointerup", () => (arrastando = false));
  host.addEventListener("pointermove", (e) => {
    if (arrastando) { alvoY += (e.clientX - ultimoX) * 0.012; ultimoX = e.clientX; }
    const r = host.getBoundingClientRect();
    alvoX = ((e.clientY - r.top) / r.height - 0.5) * 0.25;
  });

  const t0 = performance.now();
  const loop = (t) => {
    requestAnimationFrame(loop);
    const s = (t - t0) / 1000;
    if (!arrastando && !reduz) alvoY += 0.0035;
    rotY += (alvoY - rotY) * 0.06; rotX += (alvoX - rotX) * 0.06;
    grupo.rotation.set(rotX, rotY, 0);
    grupo.position.y = reduz ? 0 : Math.sin(s * 1.2) * 0.05; // respiração
    renderer.render(scene, camera);
  };
  requestAnimationFrame(loop);

  addEventListener("resize", () => {
    renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix();
  });
})();
