/* Cards de modalidade da Home: ao passar o mouse, o ícone dá lugar ao modelo 3D girando.
   Um único renderer WebGL é compartilhado e movido para o card em foco; cada OBJ só é
   baixado no primeiro hover (kit_completo costuma já estar em cache por causa do banner). */
(function () {
  const slots = document.querySelectorAll(".card-3d[data-modelo]");
  if (!slots.length || !window.THREE || !THREE.OBJLoader) return;
  if (!matchMedia("(hover: hover)").matches) return; // telas de toque ficam só com o ícone
  const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Peças visíveis por modo (nomes dos objetos nos OBJ do Blender).
  const PECAS = {
    camisa: ["Camisa_Corpo", "Gola_V", "Punhos"],
    kit: ["Camisa_Corpo", "Gola_V", "Punhos", "Calcao", "Meiao"],
    tudo: null
  };
  const DETALHE = /Gola|Punhos|Vies/; // acabamentos em azul elétrico

  // Cores em sRGB convertidas para linear (o renderer sai em sRGB), senão ficam lavadas.
  const cor = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  const matBase = new THREE.MeshStandardMaterial({ color: cor(0x3a4152), roughness: 0.7, metalness: 0.02, side: THREE.DoubleSide });
  const matDet = new THREE.MeshStandardMaterial({ color: cor(0x2f5bff), roughness: 0.55, metalness: 0.02, side: THREE.DoubleSide });

  let renderer, scene, camera, grupo, ativo = null, rotY = -0.4, raf = 0;
  const textos = {};   // url -> Promise<string> (texto do OBJ)
  const modelos = {};  // url|modo -> THREE.Object3D pronto

  function iniciar() {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.05, 7.2);
    scene.add(new THREE.HemisphereLight(0xdde6ff, 0x0a1630, 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-5, 4, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fb0ff, 1.3); rim.position.set(5, 3, -5); scene.add(rim);
    grupo = new THREE.Group(); scene.add(grupo);
  }

  function texto(url) {
    if (!textos[url]) textos[url] = fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.text(); });
    return textos[url];
  }

  async function modelo(url, modo) {
    const chave = url + "|" + modo;
    if (modelos[chave]) return modelos[chave];
    const src = url.includes("kit_completo") && window.__EMBEDDED_KIT_OBJ__ ? window.__EMBEDDED_KIT_OBJ__ : await texto(url);
    const obj = new THREE.OBJLoader().parse(src);
    const manter = PECAS[modo] || null, rem = [];
    obj.traverse((c) => {
      if (!c.isMesh) return;
      if (manter && !manter.some((n) => c.name.includes(n))) { rem.push(c); return; }
      c.material = DETALHE.test(c.name) ? matDet : matBase;
      if (!c.geometry.attributes.normal) c.geometry.computeVertexNormals();
    });
    rem.forEach((c) => c.parent.remove(c));
    const box = new THREE.Box3().setFromObject(obj);
    const s = 2.6 / Math.max(...box.getSize(new THREE.Vector3()).toArray());
    const ctr = box.getCenter(new THREE.Vector3());
    obj.scale.setScalar(s); obj.position.set(-ctr.x * s, -ctr.y * s, -ctr.z * s);
    return (modelos[chave] = obj);
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!reduz) rotY += 0.012;
    grupo.rotation.set(0.05, rotY, 0);
    renderer.render(scene, camera);
  }

  async function entrar(slot) {
    if (!renderer) iniciar();
    ativo = slot;
    const card = slot.closest(".card-mod") || slot.parentElement;
    card.classList.add("carregando-3d");
    let obj;
    try { obj = await modelo(slot.dataset.modelo, slot.dataset.modo || "tudo"); }
    catch (e) { card.classList.remove("carregando-3d"); return; }   // sem 3D: fica o ícone
    card.classList.remove("carregando-3d");
    if (ativo !== slot) return; // o mouse já saiu
    while (grupo.children.length) grupo.remove(grupo.children[0]);
    grupo.add(obj); rotY = -0.4;
    const w = slot.clientWidth, h = slot.clientHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    slot.appendChild(renderer.domElement);
    card.classList.add("com-3d");
    if (!raf) loop();
  }

  function sair(slot) {
    const card = slot.closest(".card-mod") || slot.parentElement;
    card.classList.remove("com-3d", "carregando-3d");
    if (ativo === slot) {
      ativo = null;
      setTimeout(() => { if (!ativo && raf) { cancelAnimationFrame(raf); raf = 0; } }, 450);
    }
  }

  slots.forEach((slot) => {
    const card = slot.closest(".card-mod") || slot.parentElement;
    card.addEventListener("mouseenter", () => entrar(slot));
    card.addEventListener("mouseleave", () => sair(slot));
    card.addEventListener("focus", () => entrar(slot));
    card.addEventListener("blur", () => sair(slot));
  });
})();
