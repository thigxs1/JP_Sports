/**
 * Simulador 3D Ícone / Perfil Sports - Kit Completo Oficial (Blender MCP + Three.js)
 * Carrega o kit completo gerado no Blender (Camisa_Corpo, Gola_V, Gola_Redonda, Gola_Polo, Punhos, Calcao, Meiao),
 * aplica mapas PBR de tecido Dry-Fit (Normal Map + Roughness Map) e gera texturas 2D/3D em tempo real.
 */

const PALETA_CORES = [
  { nomeCor: "Preto", rgb: "0C0C0C" },
  { nomeCor: "Chumbo", rgb: "39393A" },
  { nomeCor: "Concreto", rgb: "6E7071" },
  { nomeCor: "Cinza", rgb: "A3A7A8" },
  { nomeCor: "Branco", rgb: "FFFFFF" },
  { nomeCor: "Celeste Bebê", rgb: "98E0FF" },
  { nomeCor: "Celeste", rgb: "3DA9F5" },
  { nomeCor: "Azul Médio", rgb: "0A3AC9" },
  { nomeCor: "Royal", rgb: "08009E" },
  { nomeCor: "Marinho", rgb: "060C3C" },
  { nomeCor: "Rosa bebê", rgb: "FFBAE6" },
  { nomeCor: "Rosa", rgb: "FF69C8" },
  { nomeCor: "Rosa Shock", rgb: "C9006B" },
  { nomeCor: "Roxo Claro", rgb: "8A0094" },
  { nomeCor: "Roxo", rgb: "67006E" },
  { nomeCor: "Amarelo Bebê", rgb: "FFF759" },
  { nomeCor: "Amarelo", rgb: "FFE600" },
  { nomeCor: "Amarelo Ouro", rgb: "FCC319" },
  { nomeCor: "Dourado", rgb: "D1A347" },
  { nomeCor: "Limão", rgb: "B8ED28" },
  { nomeCor: "Cana", rgb: "6FC900" },
  { nomeCor: "Verde Claro", rgb: "009116" },
  { nomeCor: "Verde", rgb: "005913" },
  { nomeCor: "Verde Goiás", rgb: "003029" },
  { nomeCor: "Laranja", rgb: "FF6700" },
  { nomeCor: "Laranja Escuro", rgb: "FF4000" },
  { nomeCor: "Vermelho", rgb: "BA0006" },
  { nomeCor: "Vermelho Escuro", rgb: "910003" },
  { nomeCor: "Grená", rgb: "680000" }
];

// Cores da marca JP Sport (brandbook p.07) entram no topo da paleta
PALETA_CORES.unshift(
  { nomeCor: "Navy JP", rgb: "0F1F3D" },
  { nomeCor: "Elétrico JP", rgb: "2F5BFF" },
  { nomeCor: "Ink JP", rgb: "0A1630" }
);

// Presets por modalidade (abas FUTEBOL | BASQUETE | VÔLEI e setas laterais).
// Padrão da marca: navy manda, azul elétrico só em detalhes.
const NAVY = { nome: "Navy JP", hex: "#0F1F3D" };
const ELET = { nome: "Elétrico JP", hex: "#2F5BFF" };
const BRANCO = { nome: "Branco", hex: "#FFFFFF" };
const INK = { nome: "Ink JP", hex: "#0A1630" };
const KIT_PRESETS = [
  {
    modo: "futebol",
    nome: "Futebol · Camisa Dry Pro",
    estampa: "rajado",
    gola: "v",
    cores: { cor1: NAVY, cor2: { nome: "Royal", hex: "#08009E" }, cor3: ELET, cor4: BRANCO, cor5: BRANCO, corCalcao: NAVY, corMeiao: NAVY }
  },
  {
    modo: "basquete",
    nome: "Basquete · Regata Dry",
    estampa: "solid",
    gola: "redonda",
    cores: { cor1: NAVY, cor2: ELET, cor3: ELET, cor4: BRANCO, cor5: BRANCO, corCalcao: NAVY, corMeiao: BRANCO }
  },
  {
    modo: "volei",
    nome: "Vôlei · Camisa Dry",
    estampa: "gradient",
    gola: "v",
    cores: { cor1: INK, cor2: NAVY, cor3: ELET, cor4: BRANCO, cor5: BRANCO, corCalcao: INK, corMeiao: BRANCO }
  }
];

let presetIndex = 0;

const estadoSimulador = {
  modalidade: "futebol",
  cores: { ...KIT_PRESETS[0].cores },
  parteAtiva: "cor1",
  estampa: "rajado",
  gola: "v",
  numero: "10",
  nome: "JOGADOR",
  patrocinio: "",
  escudoImg: null,
  autoRotate: false,
  studioLight: true,
  fonte: "Montserrat"
};

// Variáveis Globais Three.js
let scene, camera, renderer, controls;
let kitGroup = null;
const kitMeshes = {
  Regata_Corpo: null,
  Regata_Vies: null,
  Volei_Corpo: null,
  Volei_Vies: null,
  Camisa_Corpo: null,
  Gola_V: null,
  Gola_Redonda: null,
  Gola_Polo: null,
  Punhos: null,
  Calcao: null,
  Meiao: null
};

let shirtTexture = null;
let shortsTexture = null;
let socksTexture = null;
let normalMapTex = null;
let roughnessMapTex = null;

let textureCanvas, textureCtx;
let shortsCanvas, shortsCtx;
let socksCanvas, socksCtx;
let svgTemplateText = "";

document.addEventListener("DOMContentLoaded", async () => {
  initCanvases();
  initDOMEvents();
  initColorSwatches();
  initCorLivre();
  initFontes();
  initThree();
  await loadSVGTemplate();
  await loadPBRMaps();
  await load3DModel();
  await carregarMoldeBase();

  // modalidade vinda da Home/Coleção (?modalidade=basquete)
  const pedida = new URLSearchParams(location.search).get("modalidade");
  const idx = KIT_PRESETS.findIndex((p) => p.modo === pedida);
  applyPreset(idx >= 0 ? idx : 0);
  // redesenha estampas quando Anton/JetBrains Mono terminarem de carregar
  if (document.fonts) document.fonts.ready.then(() => updateAllTextures());
});

/* =========================================================================
   MODALIDADES (futebol | basquete | vôlei) — malhas extras carregadas sob demanda
   ========================================================================= */
const MODAL_ARQUIVOS = { basquete: "models/modal_basquete.obj", volei: "models/modal_volei.obj" };
const MODAL_EMBED = { basquete: "__EMBEDDED_MODAL_BASQUETE__", volei: "__EMBEDDED_MODAL_VOLEI__" };
const modalCarregada = {};
let materiaisKit = null;

// load3DModel usa callback do OBJLoader: espera o kit base existir antes de anexar peças
function kitPronto() {
  return new Promise((ok) => {
    const checa = () => (kitGroup && materiaisKit ? ok() : setTimeout(checa, 60));
    checa();
  });
}

async function carregarModalidade(modo) {
  await kitPronto();
  if (modo === "futebol" || modalCarregada[modo]) return;
  return new Promise((resolve) => {
    const loader = new THREE.OBJLoader();
    const anexar = (obj) => {
      obj.traverse((c) => {
        if (!c.isMesh) return;
        if (!c.geometry.attributes.normal) c.geometry.computeVertexNormals();
        const nome = Object.keys(kitMeshes).find((k) => c.name.includes(k));
        if (!nome) return;
        kitMeshes[nome] = c;
        c.material = nome.endsWith("_Vies") ? materiaisKit.collar : materiaisKit.shirt;
      });
      // filhos herdam escala/posição do kit (mesmo espaço de coordenadas do Blender)
      [...obj.children].forEach((c) => kitGroup.add(c));
      modalCarregada[modo] = true;
      resolve();
    };
    const embed = window[MODAL_EMBED[modo]];
    if (embed) anexar(loader.parse(embed));
    else loader.load(MODAL_ARQUIVOS[modo], anexar, undefined, () => resolve());
  });
}

async function aplicarModalidade(modo) {
  estadoSimulador.modalidade = modo;
  const loading = document.getElementById("loadingOverlay");
  if (modo !== "futebol" && !modalCarregada[modo] && loading) {
    loading.style.display = "flex"; loading.style.opacity = "1";
    document.getElementById("loadingText").innerText = "Carregando modelo de " + (modo === "volei" ? "vôlei" : modo) + "...";
  }
  await carregarModalidade(modo);
  if (loading) { loading.style.opacity = "0"; setTimeout(() => (loading.style.display = "none"), 350); }

  const vis = (nome, v) => { if (kitMeshes[nome]) kitMeshes[nome].visible = v; };
  vis("Camisa_Corpo", modo === "futebol");
  vis("Punhos", modo === "futebol");
  vis("Regata_Corpo", modo === "basquete");
  vis("Regata_Vies", modo === "basquete");
  vis("Volei_Corpo", modo === "volei");
  vis("Volei_Vies", modo === "volei");
  vis("Meiao", modo === "futebol");
  updateCollarVisibility();

  const sel = document.getElementById("selectGola");
  if (sel) sel.disabled = modo === "basquete";
  const titulo = document.getElementById("badgeTitulo");
  const p = KIT_PRESETS.find((k) => k.modo === modo);
  if (titulo && p) titulo.innerText = p.nome;
  salvarProjeto();
}

function salvarProjeto() {
  try {
    localStorage.setItem("jpSportProjeto", JSON.stringify({
      modalidade: estadoSimulador.modalidade,
      gola: estadoSimulador.modalidade === "basquete" ? "regata" : estadoSimulador.gola,
      estampa: estadoSimulador.estampa,
      cores: estadoSimulador.cores,
      numero: estadoSimulador.numero,
      nome: estadoSimulador.nome
    }));
  } catch (e) { /* modo privado: ignora */ }
}

function initCanvases() {
  textureCanvas = document.getElementById("textureCanvas");
  textureCtx = textureCanvas.getContext("2d");

  shortsCanvas = document.getElementById("shortsCanvas");
  if (!shortsCanvas) {
    shortsCanvas = document.createElement("canvas");
    shortsCanvas.width = 1024;
    shortsCanvas.height = 1024;
  }
  shortsCtx = shortsCanvas.getContext("2d");

  socksCanvas = document.getElementById("socksCanvas");
  if (!socksCanvas) {
    socksCanvas = document.createElement("canvas");
    socksCanvas.width = 512;
    socksCanvas.height = 512;
  }
  socksCtx = socksCanvas.getContext("2d");
}

/* =========================================================================
   1. INICIALIZAÇÃO DO THREE.JS (CENA, ILUMINAÇÃO & CÂMERA)
   ========================================================================= */
function initThree() {
  const container = document.getElementById("viewerContainer");
  const canvas = document.getElementById("webglCanvas");

  scene = new THREE.Scene();

  const aspect = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(36, aspect, 0.1, 1000);
  // Posição de câmera levemente angulada como na foto de referência
  camera.position.set(-0.35, 0.35, 6.2);

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.autoRotate = estadoSimulador.autoRotate;
  controls.autoRotateSpeed = 1.6;
  controls.minDistance = 1.8;
  controls.maxDistance = 11.0;
  controls.target.set(0, 0.25, 0);

  // Iluminação de estúdio balanceada para destacar dobras 3D do tecido branco e verde
  // Luz de estúdio fotográfico: céu/chão suave + key forte + rim para recortar a silhueta.
  // Ambiente baixo preserva o volume das dobras (ambiente alto "achata" o tecido).
  // (o environment de estúdio já contribui com luz difusa, por isso hemi/ambiente baixos)
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8a8f99, 0.3);
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.08);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xfff6ea, 1.25);
  keyLight.position.set(3.5, 6, 6);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
  rimLight.position.set(-5, 5, -6);
  scene.add(rimLight);

  const fillLight = new THREE.DirectionalLight(0xe6eeff, 0.35);
  fillLight.position.set(-5, 1, 4);
  scene.add(fillLight);

  scene.environment = buildStudioEnvironment();

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("resize", onWindowResize);
}

/**
 * Ambiente de estúdio procedural (sem arquivos HDR): cúpula em degradê + 3 softboxes.
 * Dá ao tecido o brilho acetinado sutil do poliéster dry-fit em vez do aspecto opaco "CG".
 */
function buildStudioEnvironment() {
  const envScene = new THREE.Scene();

  const domeGeo = new THREE.SphereGeometry(50, 32, 16);
  const colors = [];
  const pos = domeGeo.attributes.position;
  const top = new THREE.Color(0xf4f6fa), mid = new THREE.Color(0xb8bec8), bottom = new THREE.Color(0x55595f);
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 50; // -1..1
    const c = t > 0 ? mid.clone().lerp(top, t) : mid.clone().lerp(bottom, -t);
    colors.push(c.r, c.g, c.b);
  }
  domeGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  envScene.add(new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));

  const box = (w, h, x, y, z, intensity) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity), side: THREE.DoubleSide })
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    envScene.add(m);
  };
  box(22, 14, 18, 22, 26, 3.0);   // key softbox
  box(14, 24, -30, 8, -22, 2.2);  // rim strip
  box(16, 10, -26, 4, 22, 1.2);   // fill

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(envScene, 0.04).texture;
  pmrem.dispose();
  return envTex;
}

/** Sombra de contato suave sob o kit (canvas radial; sem custo de shadow map). */
function addContactShadow(groundY, width) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(0,0,0,0.38)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.12)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width * 0.45),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = groundY - 0.01;
  scene.add(plane);
}

function onWindowResize() {
  const container = document.getElementById("viewerContainer");
  if (!container || !renderer || !camera) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

/* =========================================================================
   2. CARREGAMENTO DE TEXTURAS PBR DRY-FIT & MODELO 3D COMPLETO (BLENDER)
   ========================================================================= */
async function loadSVGTemplate() {
  if (window.__EMBEDDED_SVG__) {
    svgTemplateText = window.__EMBEDDED_SVG__;
    return;
  }
  try {
    const res = await fetch("models/formas2048.svg");
    svgTemplateText = await res.text();
  } catch (err) {
    console.warn("Usando gerador vetorial nativo:", err);
  }
}

function loadTextureFromUrl(url) {
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(28, 28);
        resolve(tex);
      },
      undefined,
      () => resolve(null)
    );
  });
}

async function loadPBRMaps() {
  const normSrc = window.__EMBEDDED_NORMAL_MAP__ || "assets/textures/dryfit_normal.png";
  const roughSrc = window.__EMBEDDED_ROUGHNESS_MAP__ || "assets/textures/dryfit_roughness.png";
  normalMapTex = await loadTextureFromUrl(normSrc);
  roughnessMapTex = await loadTextureFromUrl(roughSrc);
}

function processKitObject(obj) {
  const loadingOverlay = document.getElementById("loadingOverlay");

  // Gera todas as texturas 2D antes de associar aos materiais
  updateAllTextures();

  const shirtMaterial = new THREE.MeshStandardMaterial({
    map: shirtTexture,
    normalMap: normalMapTex,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughnessMap: roughnessMapTex,
    roughness: 0.68,
    metalness: 0.04,
    side: THREE.DoubleSide
  });

  const collarMaterial = new THREE.MeshStandardMaterial({
    map: shirtTexture,
    normalMap: normalMapTex,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.62,
    metalness: 0.03,
    side: THREE.DoubleSide
  });

  const shortsMaterial = new THREE.MeshStandardMaterial({
    map: shortsTexture,
    normalMap: normalMapTex,
    normalScale: new THREE.Vector2(0.32, 0.32),
    roughnessMap: roughnessMapTex,
    roughness: 0.64,
    metalness: 0.03,
    side: THREE.DoubleSide
  });

  // Meião: malha de tricô é bem mais fina que o dry-fit da camisa. A UV dos meiões é
  // pequena, então o mesmo repeat gera "colmeia gigante": usa um clone com tiling denso
  // e relevo fraco; o canelado vertical vem da textura de cor (updateSocksTexture).
  let socksNormal = null;
  if (normalMapTex) {
    socksNormal = normalMapTex.clone();
    socksNormal.needsUpdate = true;
    socksNormal.repeat.set(90, 90);
  }
  const socksMaterial = new THREE.MeshStandardMaterial({
    map: socksTexture,
    normalMap: socksNormal,
    normalScale: new THREE.Vector2(0.12, 0.12),
    roughness: 0.74,
    metalness: 0.02,
    side: THREE.DoubleSide
  });

  // Centraliza e dimensiona o kit completo na cena
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 4.9 / maxDim;

  obj.scale.set(scale, scale, scale);
  obj.position.x = -center.x * scale;
  obj.position.y = -center.y * scale - 0.15;
  obj.position.z = -center.z * scale;

  // Mapeia cada sub-objeto exportado pelo Blender MCP
  obj.traverse((child) => {
    if (child.isMesh) {
      // Usa as normais suaves exportadas pelo Blender; recalcular aqui gera visual facetado
      if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals();
      const name = child.name || "";

      if (name.includes("Gola_V")) {
        kitMeshes.Gola_V = child;
        child.material = collarMaterial;
      } else if (name.includes("Gola_Redonda")) {
        kitMeshes.Gola_Redonda = child;
        child.material = collarMaterial;
      } else if (name.includes("Gola_Polo")) {
        kitMeshes.Gola_Polo = child;
        child.material = collarMaterial;
      } else if (name.includes("Punhos")) {
        kitMeshes.Punhos = child;
        child.material = collarMaterial;
      } else if (name.includes("Calcao")) {
        kitMeshes.Calcao = child;
        child.material = shortsMaterial;
      } else if (name.includes("Meiao")) {
        kitMeshes.Meiao = child;
        child.material = socksMaterial;
      } else {
        kitMeshes.Camisa_Corpo = child;
        child.material = shirtMaterial;
      }
    }
  });

  kitGroup = obj;
  scene.add(kitGroup);
  materiaisKit = { shirt: shirtMaterial, collar: collarMaterial };

  const kitBox = new THREE.Box3().setFromObject(kitGroup);
  addContactShadow(kitBox.min.y, (kitBox.max.x - kitBox.min.x) * 1.1);

  // Aplica a visibilidade da gola ativa (Gola_V, Gola_Redonda ou Gola_Polo)
  updateCollarVisibility();

  loadingOverlay.style.opacity = "0";
  setTimeout(() => {
    loadingOverlay.style.display = "none";
  }, 350);
}

async function load3DModel() {
  const loadingText = document.getElementById("loadingText");
  const loader = new THREE.OBJLoader();

  if (window.__EMBEDDED_KIT_OBJ__) {
    try {
      const obj = loader.parse(window.__EMBEDDED_KIT_OBJ__);
      processKitObject(obj);
      return;
    } catch (err) {
      console.warn("Erro ao fazer parse de __EMBEDDED_KIT_OBJ__, tentando fetch:", err);
    }
  }

  loader.load(
    "models/kit_completo.obj",
    (obj) => processKitObject(obj),
    (xhr) => {
      if (xhr.lengthComputable && loadingText) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        loadingText.innerText = `Carregando Kit 3D: ${percent}%`;
      }
    },
    (err) => {
      console.error("Erro ao carregar kit_completo.obj:", err);
      if (window.__EMBEDDED_OBJ__) {
        const obj = loader.parse(window.__EMBEDDED_OBJ__);
        processKitObject(obj);
      }
    }
  );
}

function updateCollarVisibility() {
  // regata de basquete tem viés próprio no decote: nenhuma gola extra
  const gola = estadoSimulador.modalidade === "basquete" ? "nenhuma" : estadoSimulador.gola;
  if (kitMeshes.Gola_V) kitMeshes.Gola_V.visible = (gola === "v");
  if (kitMeshes.Gola_Redonda) kitMeshes.Gola_Redonda.visible = (gola === "redonda");
  if (kitMeshes.Gola_Polo) kitMeshes.Gola_Polo.visible = (gola === "polo");

  const labels = {
    v: "Gola V Esportiva",
    redonda: "Gola Careca Redonda",
    polo: "Gola Polo Esportiva"
  };
  const labelText = labels[gola] || "Gola V Esportiva";
  const badgeEl = document.getElementById("badgeGolaText");
  const summaryEl = document.getElementById("summaryGola");
  if (badgeEl) badgeEl.innerText = labelText;
  if (summaryEl) summaryEl.innerText = labelText;
}

/* =========================================================================
   3. GERAÇÃO DINÂMICA DE TEXTURAS (CAMISA 2048px, CALÇÃO 1024px, MEIÃO 512px)
   ========================================================================= */
function updateAllTextures() {
  updateDynamicTexture();
  updateShortsTexture();
  updateSocksTexture();
}

function drawRajadoPattern(ctx) {
  // 1. Fundo inteiro com Cor 1 (Verde escuro #005913)
  ctx.fillStyle = estadoSimulador.cores.cor1.hex;
  ctx.fillRect(0, 0, 2048, 2048);

  // 2. Painel Frontal da Camisa fica em X: 1180..2020, Y: 780..2030
  // Desenha os traços diagonais rajados (estilo brush esportivo da foto de referência)
  // Estampa sublimada contínua: frente, costas e mangas (antes só o painel frontal,
  // o que deixava costas/mangas lisas e denunciava o mock).
  ctx.save();
  ctx.translate(1024, 1024);
  ctx.rotate(-0.42); // ~ -24 graus (diagonal ascendente da esquerda para direita)
  // Mesmo tamanho de traço; quantidade e dispersão escalam para cobrir o molde 2048px
  const AREA = 2.6;

  // Semente determinística para manter o rajado idêntico a cada frame
  let seed = 1337;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  // Traços largos de base
  ctx.fillStyle = estadoSimulador.cores.cor2.hex;
  ctx.globalAlpha = 0.38;
  for (let i = 0; i < 65 * AREA * AREA; i++) {
    const rx = (rand() - 0.5) * 1100 * AREA;
    const ry = (rand() - 0.5) * 1450 * AREA;
    const rw = 120 + rand() * 340;
    const rh = 10 + rand() * 26;
    drawBrushSlash(ctx, rx, ry, rw, rh);
  }

  // Traços vibrantes principais (Limão / Cor 2)
  ctx.globalAlpha = 0.88;
  for (let i = 0; i < 95 * AREA * AREA; i++) {
    const rx = (rand() - 0.5) * 1050 * AREA;
    const ry = (rand() - 0.5) * 1400 * AREA;
    const rw = 65 + rand() * 260;
    const rh = 6 + rand() * 16;
    drawBrushSlash(ctx, rx, ry, rw, rh);
  }

  // Recortes em Cor 1 para criar efeito de falha de trincha (grunge/brush)
  ctx.fillStyle = estadoSimulador.cores.cor1.hex;
  ctx.globalAlpha = 0.65;
  for (let i = 0; i < 55 * AREA * AREA; i++) {
    const rx = (rand() - 0.5) * 1050 * AREA;
    const ry = (rand() - 0.5) * 1400 * AREA;
    const rw = 80 + rand() * 240;
    const rh = 5 + rand() * 14;
    drawBrushSlash(ctx, rx, ry, rw, rh);
  }

  ctx.restore();

  // 3. Pinta as faixas de Gola e Punhos (Cor 3 - Branco na referência)
  // Regiões UV da Gola (u: 0.34..0.66, v: 0.72..0.79 -> Y: 420..580) e Detalhe de Punho (u: 0.37..0.62, v: 0.80..0.83 -> Y: 340..400)
  ctx.fillStyle = estadoSimulador.cores.cor3.hex;
  // Gola V / Redonda / Polo UV region
  ctx.fillRect(680, 410, 690, 175);
  // Detalhe branco nas extremidades dos punhos (como na foto de referência)
  ctx.fillRect(750, 330, 540, 75);
}

function drawBrushSlash(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y);
  ctx.lineTo(x - w * 0.35, y - h * 0.5);
  ctx.lineTo(x + w * 0.5, y - h * 0.15);
  ctx.lineTo(x + w * 0.35, y + h * 0.5);
  ctx.closePath();
  ctx.fill();
}

function drawDefaultTeamCrest(ctx, cx, cy, size) {
  ctx.save();
  ctx.translate(cx, cy);
  const r = size * 0.5;

  // Estrela dourada acima do escudo
  ctx.fillStyle = "#FCC319";
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a1 = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const a2 = a1 + Math.PI / 5;
    const x1 = Math.cos(a1) * (r * 0.22);
    const y1 = -r * 1.12 + Math.sin(a1) * (r * 0.22);
    const x2 = Math.cos(a2) * (r * 0.09);
    const y2 = -r * 1.12 + Math.sin(a2) * (r * 0.09);
    if (i === 0) ctx.moveTo(x1, y1);
    else ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.closePath();
  ctx.fill();

  // Formato do escudo moderno (Preto com borda dupla Branca e Verde)
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.88);
  ctx.lineTo(r * 0.78, -r * 0.68);
  ctx.lineTo(r * 0.72, r * 0.18);
  ctx.quadraticCurveTo(r * 0.55, r * 0.68, 0, r * 0.95);
  ctx.quadraticCurveTo(-r * 0.55, r * 0.68, -r * 0.72, r * 0.18);
  ctx.lineTo(-r * 0.78, -r * 0.68);
  ctx.closePath();

  ctx.fillStyle = "#141619";
  ctx.fill();
  ctx.lineWidth = Math.max(3, size * 0.045);
  ctx.strokeStyle = "#FFFFFF";
  ctx.stroke();

  // Faixa interna verde no topo do escudo
  ctx.fillStyle = "#009116";
  ctx.fillRect(-r * 0.52, -r * 0.58, r * 1.04, r * 0.24);

  // Texto "SEU ESCUDO"
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.round(size * 0.12)}px 'Montserrat', sans-serif`;
  ctx.fillText("SEU", 0, -r * 0.45);

  // Faixa preta/branca central para "ESCUDO"
  ctx.fillStyle = "#101214";
  ctx.fillRect(-r * 0.82, -r * 0.22, r * 1.64, r * 0.34);
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = Math.max(2, size * 0.025);
  ctx.strokeRect(-r * 0.82, -r * 0.22, r * 1.64, r * 0.34);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `900 ${Math.round(size * 0.19)}px 'Montserrat', sans-serif`;
  ctx.fillText("ESCUDO", 0, -r * 0.04);

  // Bola de futebol estilizada na base do escudo
  ctx.beginPath();
  ctx.arc(0, r * 0.44, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#141619";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, r * 0.44, r * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = "#141619";
  ctx.fill();

  ctx.restore();
}

function updateDynamicTexture() {
  if (!textureCanvas || !textureCtx) return;

  if (estadoSimulador.estampa === "rajado") {
    drawRajadoPattern(textureCtx);
    desenharDetalhes();
    refreshShirtTexture();
    return;
  }

  // Limpa canvas com a Cor Predominante (cor1)
  textureCtx.fillStyle = estadoSimulador.cores.cor1.hex;
  textureCtx.fillRect(0, 0, 2048, 2048);

  if (estadoSimulador.estampa === "colors" && svgTemplateText) {
    let modifiedSVG = svgTemplateText;
    modifiedSVG = modifiedSVG.replace(/id="cor1"[^>]*fill="[^"]*"/g, `id="cor1" fill="${estadoSimulador.cores.cor1.hex}"`);
    modifiedSVG = modifiedSVG.replace(/id="cor2"[^>]*fill="[^"]*"/g, `id="cor2" fill="${estadoSimulador.cores.cor2.hex}"`);
    modifiedSVG = modifiedSVG.replace(/id="cor3"[^>]*fill="[^"]*"/g, `id="cor3" fill="${estadoSimulador.cores.cor3.hex}"`);
    modifiedSVG = modifiedSVG.replace(/id="cor4"[^>]*fill="[^"]*"/g, `id="cor4" fill="${estadoSimulador.cores.cor4.hex}"`);
    modifiedSVG = modifiedSVG.replace(/id="cor5"[^>]*fill="[^"]*"/g, `id="cor5" fill="${estadoSimulador.cores.cor5.hex}"`);

    const img = new Image();
    const svgBlob = new Blob([modifiedSVG], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      textureCtx.drawImage(img, 0, 0, 2048, 2048);
      URL.revokeObjectURL(url);
      desenharDetalhes();
      refreshShirtTexture();
    };
    img.src = url;
    return;
  } else if (estadoSimulador.estampa === "stripes") {
    const stripeWidth = 75;
    textureCtx.fillStyle = estadoSimulador.cores.cor2.hex;
    for (let x = 1180; x < 2048; x += stripeWidth * 2) {
      textureCtx.fillRect(x, 750, stripeWidth, 1290);
    }
  } else if (estadoSimulador.estampa === "gradient") {
    const grad = textureCtx.createLinearGradient(0, 800, 0, 2048);
    grad.addColorStop(0, estadoSimulador.cores.cor1.hex);
    grad.addColorStop(1, estadoSimulador.cores.cor2.hex);
    textureCtx.fillStyle = grad;
    textureCtx.fillRect(1180, 750, 860, 1290);
  }

  // Gola e Punhos na Cor 3
  textureCtx.fillStyle = estadoSimulador.cores.cor3.hex;
  textureCtx.fillRect(680, 410, 690, 175);
  textureCtx.fillRect(750, 330, 540, 75);

  desenharDetalhes();
  refreshShirtTexture();
}

/* =========================================================================
   ARTE PELO MOLDE: no futebol (camiseta básica), escudo, marca, patrocínio, nome e
   número saem do layout em cm (js/arte-pecas.js), o mesmo que vai para o PDF de
   impressão; a calibração leva mm do molde M para px desta textura.
   ========================================================================= */
let moldeBase = null;
let calibracaoUV = null;
const afinsUV = {};

async function carregarMoldeBase() {
  if (!window.JPArtePecas) return;
  try {
    const [m, c] = await Promise.all([
      fetch("moldes/camiseta-basica/M.json").then((r) => r.json()),
      fetch("moldes/camiseta-basica/calibracao.json").then((r) => r.json())
    ]);
    moldeBase = m;
    calibracaoUV = c;
    Object.keys(c.pecas).forEach((id) => { afinsUV[id] = JPArtePecas.afimDePares(c.pecas[id].pares); });
  } catch (e) {
    console.warn("[simulador] molde não carregado (file:// ou rede); usando a arte fixa:", e);
  }
  updateAllTextures();
}

function projetoAtual() {
  return {
    estampa: estadoSimulador.estampa, cores: estadoSimulador.cores, nome: estadoSimulador.nome,
    numero: estadoSimulador.numero, patrocinio: estadoSimulador.patrocinio, fonte: estadoSimulador.fonte,
    layout: estadoSimulador.layout || null
  };
}

function usaArteDoMolde() {
  return estadoSimulador.modalidade === "futebol" && !!moldeBase && !!calibracaoUV;
}

function desenharDetalhes() {
  if (!usaArteDoMolde()) { drawPlayerDetails(); return; }
  // botões do peitilho da Gola Polo (UV fixa no canto, área sem uso no molde)
  textureCtx.fillStyle = "#2B2F33";
  textureCtx.fillRect(0, 0, 40, 40);
  const projeto = projetoAtual();
  Object.keys(afinsUV).forEach((id) => {
    const peca = moldeBase.pecas.find((p) => p.id === id);
    if (!peca) return;
    textureCtx.save();
    textureCtx.transform(...afinsUV[id]);
    JPArtePecas.desenharPeca(textureCtx, peca, projeto, null, {
      sangria: calibracaoUV.pecas[id].sangria3d || 30, previa: true, escudo: estadoSimulador.escudoImg,
      semFundo: estadoSimulador.estampa === "colors" // o template Colors já pintou o fundo na textura
    });
    textureCtx.restore();
  });
}

function drawPlayerDetails() {
  textureCtx.save();

  // 0. Cor dos botões do peitilho da Gola Polo (UV fixa no canto 0.008/0.992, área sem uso no molde)
  textureCtx.fillStyle = "#2B2F33";
  textureCtx.fillRect(0, 0, 40, 40);

  // 1. Marca JP no peito (provisório em Anton até receber o vetor oficial do símbolo)
  textureCtx.fillStyle = estadoSimulador.cores.cor4.hex;
  textureCtx.textAlign = "center";
  textureCtx.textBaseline = "middle";
  textureCtx.font = "italic 400 70px Anton, Impact, sans-serif";
  textureCtx.fillText("JP", 1465, 1070);
  textureCtx.font = "500 13px 'JetBrains Mono', monospace";
  textureCtx.fillText("J P  S P O R T", 1465, 1112);

  // 2. Escudo do Clube no Peito Esquerdo (X=1745, Y=1075 no mapa UV frontal)
  if (estadoSimulador.escudoImg) {
    textureCtx.drawImage(estadoSimulador.escudoImg, 1660, 990, 170, 170);
  } else {
    drawDefaultTeamCrest(textureCtx, 1745, 1075, 165);
  }

  // 3. Patrocínio Frontal Master (Abaixo do peito: X=1605, Y=1285)
  if (estadoSimulador.patrocinio && estadoSimulador.patrocinio.trim() !== "") {
    textureCtx.fillStyle = estadoSimulador.cores.cor4.hex;
    escreveAjustado(textureCtx, estadoSimulador.patrocinio.toUpperCase(),
      (px) => `800 ${px}px 'Montserrat', sans-serif`, 58, 440, 1605, 1285);
  }

  // 4. Etiqueta Autenticidade na Barra Inferior Direita (como na referência)
  textureCtx.fillStyle = "#22262A";
  textureCtx.fillRect(1345, 1875, 68, 36);
  textureCtx.strokeStyle = "#CCCCCC";
  textureCtx.lineWidth = 2;
  textureCtx.strokeRect(1345, 1875, 68, 36);
  textureCtx.fillStyle = "#FFFFFF";
  textureCtx.font = "700 13px 'Montserrat', sans-serif";
  textureCtx.fillText("PRO", 1379, 1893);

  // 5. Nome e Número nas Costas (Painel Traseiro: centro em X=578, Y=980..1260)
  textureCtx.fillStyle = estadoSimulador.cores.cor5.hex;
  if (estadoSimulador.nome) {
    escreveAjustado(textureCtx, estadoSimulador.nome.toUpperCase(), fonteCamisa, 62, 440, 578, 965);
  }
  if (estadoSimulador.numero) {
    escreveAjustado(textureCtx, estadoSimulador.numero, fonteCamisa, 260, 420, 578, 1210);
  }

  textureCtx.restore();
}

function updateShortsTexture() {
  if (!shortsCtx) return;
  const W = 1024, H = 1024;

  // Cor principal do Calção
  shortsCtx.fillStyle = estadoSimulador.cores.corCalcao.hex;
  shortsCtx.fillRect(0, 0, W, H);

  // Sombreado sutil de cós elástico no topo
  const waistGrad = shortsCtx.createLinearGradient(0, 0, 0, 90);
  waistGrad.addColorStop(0, "rgba(0,0,0,0.12)");
  waistGrad.addColorStop(1, "rgba(0,0,0,0.0)");
  shortsCtx.fillStyle = waistGrad;
  shortsCtx.fillRect(0, 0, W, 90);

  // Faixas laterais esportivas nas pernas com a Cor 1 da camisa (como na foto de referência)
  shortsCtx.fillStyle = estadoSimulador.cores.cor1.hex;
  // Layout UV do Calcao v2 (Blender): lateral externa em u=0.22 / 0.72
  shortsCtx.fillRect(209, 120, 32, H - 120);
  shortsCtx.fillRect(721, 120, 32, H - 120);

  // Cós elástico canelado (topo da UV, v > 0.87)
  shortsCtx.fillStyle = "rgba(0,0,0,0.07)";
  for (let y = 4; y < 118; y += 9) shortsCtx.fillRect(0, y, W, 3);

  // Viés/acabamento da barra na Cor 1
  shortsCtx.fillStyle = estadoSimulador.cores.cor1.hex;
  shortsCtx.fillRect(0, 922, W, 24); // barra em y=1.95 -> v~0.07

  // Escudo (coxa direita, frente) e logo (coxa esquerda, frente) no layout UV do Calcao v2
  shortsCtx.save();
  shortsCtx.translate(113, 760);
  // UV da perna tem ~436 px/unid. na horizontal e ~706 px/unid. na vertical:
  // compensa para o escudo não sair achatado/esticado no 3D
  shortsCtx.scale(0.62, 1.0);
  if (estadoSimulador.escudoImg) {
    shortsCtx.drawImage(estadoSimulador.escudoImg, -62, -65, 125, 125);
  } else {
    drawDefaultTeamCrest(shortsCtx, 0, 0, 125);
  }
  shortsCtx.restore();

  shortsCtx.save();
  shortsCtx.translate(625, 835);
  shortsCtx.scale(0.62, 1.0);
  shortsCtx.fillStyle = estadoSimulador.cores.cor1.hex === "#FFFFFF" ? "#005913" : estadoSimulador.cores.cor1.hex;
  shortsCtx.textAlign = "center";
  shortsCtx.textBaseline = "middle";
  shortsCtx.font = "900 34px 'Montserrat', sans-serif";
  shortsCtx.font = "italic 400 52px Anton, Impact, sans-serif";
  shortsCtx.fillText("JP", 0, 0);
  shortsCtx.restore();

  if (!shortsTexture) {
    shortsTexture = new THREE.CanvasTexture(shortsCanvas);
    shortsTexture.wrapS = THREE.ClampToEdgeWrapping;
    shortsTexture.wrapT = THREE.ClampToEdgeWrapping;
    shortsTexture.encoding = THREE.sRGBEncoding;
  } else {
    shortsTexture.needsUpdate = true;
  }
}

function updateSocksTexture() {
  if (!socksCtx) return;
  const W = 512, H = 512;

  // Cor principal do Meião
  socksCtx.fillStyle = estadoSimulador.cores.corMeiao.hex;
  socksCtx.fillRect(0, 0, W, H);

  // Canelado vertical fino (rib knit) ao longo de todo o meião
  for (let x = 0; x < W; x += 6) {
    socksCtx.fillStyle = "rgba(0,0,0,0.10)";
    socksCtx.fillRect(x, 0, 2, H);
    socksCtx.fillStyle = "rgba(255,255,255,0.05)";
    socksCtx.fillRect(x + 3, 0, 1, H);
  }

  // Punho dobrado no topo: faixa mais escura + 2 frisos na Cor 3
  socksCtx.fillStyle = "rgba(0,0,0,0.14)";
  socksCtx.fillRect(0, 0, W, 46);
  socksCtx.fillStyle = estadoSimulador.cores.cor3.hex;
  socksCtx.fillRect(0, 52, W, 9);
  socksCtx.fillRect(0, 68, W, 9);

  // Sombra suave sob o punho (dá volume à dobra)
  const cuffShadow = socksCtx.createLinearGradient(0, 77, 0, 110);
  cuffShadow.addColorStop(0, "rgba(0,0,0,0.18)");
  cuffShadow.addColorStop(1, "rgba(0,0,0,0)");
  socksCtx.fillStyle = cuffShadow;
  socksCtx.fillRect(0, 77, W, 33);

  if (!socksTexture) {
    socksTexture = new THREE.CanvasTexture(socksCanvas);
    socksTexture.wrapS = THREE.RepeatWrapping;
    socksTexture.wrapT = THREE.ClampToEdgeWrapping;
    socksTexture.encoding = THREE.sRGBEncoding;
  } else {
    socksTexture.needsUpdate = true;
  }
}

function refreshShirtTexture() {
  if (!shirtTexture) {
    shirtTexture = new THREE.CanvasTexture(textureCanvas);
    shirtTexture.wrapS = THREE.RepeatWrapping;
    shirtTexture.wrapT = THREE.RepeatWrapping;
    shirtTexture.encoding = THREE.sRGBEncoding; // cor exibida = cor escolhida na paleta
    shirtTexture.anisotropy = 8;
  } else {
    shirtTexture.needsUpdate = true;
  }
  salvarProjeto();
}

/* =========================================================================
   4. EVENTOS DOM, SWATCHES DE CORES, GOLAS & CONTROLES DE CÂMERA
   ========================================================================= */
function updateSummaryLabels() {
  const s1 = document.getElementById("summaryCorPredominante");
  const s2 = document.getElementById("summaryCorSecundaria");
  const sc = document.getElementById("summaryCorCalcao");
  const sm = document.getElementById("summaryCorMeiao");

  if (s1) s1.innerText = `${estadoSimulador.cores.cor1.nome} (${estadoSimulador.cores.cor1.hex})`;
  if (s2) s2.innerText = `${estadoSimulador.cores.cor2.nome} (${estadoSimulador.cores.cor2.hex})`;
  if (sc) sc.innerText = `${estadoSimulador.cores.corCalcao.nome} (${estadoSimulador.cores.corCalcao.hex})`;
  if (sm) sm.innerText = `${estadoSimulador.cores.corMeiao.nome} (${estadoSimulador.cores.corMeiao.hex})`;
}

// Fonte escolhida para nome e número nas costas.
const FONTES_CAMISA = {
  "Montserrat": "900",
  "Bebas Neue": "400",
  "Teko": "600",
  "Graduate": "400"
};
function fonteCamisa(px) {
  const f = estadoSimulador.fonte in FONTES_CAMISA ? estadoSimulador.fonte : "Montserrat";
  return `${FONTES_CAMISA[f]} ${px}px '${f}', sans-serif`;
}

// Escreve o texto reduzindo a fonte até caber em `max` px (até 60% do tamanho);
// se ainda não couber, o maxWidth do canvas comprime como último recurso.
function escreveAjustado(ctx, texto, fonte, px, max, x, y) {
  let t = px;
  ctx.font = fonte(t);
  while (t > px * 0.6 && ctx.measureText(texto).width > max) { t -= 2; ctx.font = fonte(t); }
  ctx.fillText(texto, x, y, max);
}

// Mostra a cor ativa no banner e sincroniza o campo de cor livre (hex).
function mostrarCorAtiva(hex) {
  const prev = document.getElementById("currentColorPreview");
  if (prev) prev.style.backgroundColor = hex;
  const h = String(hex).toUpperCase();
  const txt = document.getElementById("inputCorHex");
  const pick = document.getElementById("inputCorPicker");
  if (txt && document.activeElement !== txt) txt.value = h;
  if (pick && /^#[0-9A-F]{6}$/.test(h)) pick.value = h.toLowerCase();
}

// Aplica uma cor livre (#RRGGBB) na parte ativa do uniforme.
function aplicarCorLivre(hex) {
  const h = String(hex).trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(h)) return false;
  estadoSimulador.cores[estadoSimulador.parteAtiva] = { nome: h, hex: h };
  document.querySelectorAll(".swatch-item").forEach((el) => el.classList.remove("active"));
  document.getElementById("currentColorName").innerText = h;
  mostrarCorAtiva(h);
  updateSummaryLabels();
  updateAllTextures();
  return true;
}

function initCorLivre() {
  const txt = document.getElementById("inputCorHex");
  const pick = document.getElementById("inputCorPicker");
  if (pick) pick.addEventListener("input", (e) => { if (txt) txt.value = e.target.value.toUpperCase(); aplicarCorLivre(e.target.value); });
  if (txt) {
    txt.addEventListener("input", (e) => {
      let v = e.target.value.trim();
      if (v && v[0] !== "#") v = "#" + v;
      txt.classList.toggle("invalido", v.length === 7 && !aplicarCorLivre(v));
    });
    txt.addEventListener("blur", () => { txt.classList.remove("invalido"); mostrarCorAtiva(estadoSimulador.cores[estadoSimulador.parteAtiva].hex); });
  }
}

function initFontes() {
  document.querySelectorAll(".fonte-btn").forEach((btn) => {
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", String(btn.classList.contains("active")));
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".fonte-btn").forEach((b) => { b.classList.remove("active"); b.setAttribute("aria-checked", "false"); });
      btn.classList.add("active");
      btn.setAttribute("aria-checked", "true");
      estadoSimulador.fonte = btn.dataset.fonte;
      // Garante a fonte carregada antes de redesenhar a textura.
      try { if (document.fonts) await document.fonts.load(fonteCamisa(60)); } catch (e) {}
      updateDynamicTexture();
    });
  });
}

function initColorSwatches() {
  const grid = document.getElementById("swatchesGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const activeHex = estadoSimulador.cores[estadoSimulador.parteAtiva].hex.toUpperCase();

  PALETA_CORES.forEach((cor) => {
    const item = document.createElement("div");
    item.className = "swatch-item";
    if (`#${cor.rgb.toUpperCase()}` === activeHex) {
      item.classList.add("active");
    }

    const circle = document.createElement("div");
    circle.className = "swatch-circle";
    circle.style.backgroundColor = `#${cor.rgb}`;

    const label = document.createElement("span");
    label.className = "swatch-label";
    label.innerText = cor.nomeCor;

    item.appendChild(circle);
    item.appendChild(label);

    item.addEventListener("click", () => {
      document.querySelectorAll(".swatch-item").forEach((el) => el.classList.remove("active"));
      item.classList.add("active");

      estadoSimulador.cores[estadoSimulador.parteAtiva] = {
        nome: cor.nomeCor,
        hex: `#${cor.rgb}`
      };

      mostrarCorAtiva(`#${cor.rgb}`);
      document.getElementById("currentColorName").innerText = cor.nomeCor;

      updateSummaryLabels();
      updateAllTextures();
    });

    grid.appendChild(item);
  });
}

function applyPreset(index) {
  presetIndex = (index + KIT_PRESETS.length) % KIT_PRESETS.length;
  const p = KIT_PRESETS[presetIndex];

  estadoSimulador.estampa = p.estampa;
  estadoSimulador.gola = p.gola;
  Object.keys(p.cores).forEach((k) => {
    estadoSimulador.cores[k] = { ...p.cores[k] };
  });

  // Atualiza UI de Categoria
  document.querySelectorAll(".cat-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.kitMode === p.modo);
  });

  // Atualiza Select de Gola
  const selectGola = document.getElementById("selectGola");
  if (selectGola) selectGola.value = p.gola;

  // Atualiza Pattern Cards
  document.querySelectorAll(".pattern-card").forEach((c) => {
    c.classList.toggle("active", c.dataset.pattern === p.estampa);
  });

  // Atualiza Banner de Cor Ativa
  const currentCor = estadoSimulador.cores[estadoSimulador.parteAtiva];
  if (currentCor) {
    mostrarCorAtiva(currentCor.hex);
    document.getElementById("currentColorName").innerText = currentCor.nome;
  }

  initColorSwatches();
  updateSummaryLabels();
  updateAllTextures();
  aplicarModalidade(p.modo);
}

function initDOMEvents() {
  // Tabs laterais
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const tabId = `tab-${btn.dataset.tab}`;
      document.getElementById(tabId).classList.add("active");
    });
  });

  // Abas Superiores (JOGO | GOLEIRO | PASSEIO)
  document.querySelectorAll(".cat-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = KIT_PRESETS.findIndex((p) => p.modo === btn.dataset.kitMode);
      if (idx !== -1) applyPreset(idx);
    });
  });

  // Setas Laterais de Preset
  const prevBtn = document.getElementById("btnPrevPreset");
  const nextBtn = document.getElementById("btnNextPreset");
  if (prevBtn) prevBtn.addEventListener("click", () => applyPreset(presetIndex - 1));
  if (nextBtn) nextBtn.addEventListener("click", () => applyPreset(presetIndex + 1));

  // Part Selector Buttons
  document.querySelectorAll(".part-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".part-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tag = btn.dataset.tag;
      estadoSimulador.parteAtiva = tag;

      document.getElementById("currentPartName").innerText = btn.innerText;
      const currentCor = estadoSimulador.cores[tag];
      if (currentCor) {
        mostrarCorAtiva(currentCor.hex);
        document.getElementById("currentColorName").innerText = currentCor.nome;
      }
      initColorSwatches();
    });
  });

  // Seletor de Gola 3D (Gola_V, Gola_Redonda, Gola_Polo)
  const selectGola = document.getElementById("selectGola");
  if (selectGola) {
    selectGola.addEventListener("change", (e) => {
      estadoSimulador.gola = e.target.value;
      updateCollarVisibility();
    });
  }

  // Pattern Selector Cards
  document.querySelectorAll(".pattern-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".pattern-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      estadoSimulador.estampa = card.dataset.pattern;
      updateDynamicTexture();
    });
  });

  // Inputs de Número, Nome e Patrocínio
  const inputNumero = document.getElementById("inputNumero");
  const inputNome = document.getElementById("inputNome");
  const inputPatrocinio = document.getElementById("inputPatrocinio");

  if (inputNumero) {
    inputNumero.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, ""); // só dígitos
      estadoSimulador.numero = e.target.value;
      document.getElementById("summaryNumero").innerText = e.target.value;
      updateDynamicTexture();
    });
  }

  if (inputNome) {
    inputNome.addEventListener("input", (e) => {
      estadoSimulador.nome = e.target.value;
      document.getElementById("summaryNome").innerText = e.target.value.toUpperCase();
      updateDynamicTexture();
    });
  }

  if (inputPatrocinio) {
    inputPatrocinio.addEventListener("input", (e) => {
      estadoSimulador.patrocinio = e.target.value;
      updateDynamicTexture();
    });
  }

  // Upload de Escudo PNG
  const dropzone = document.getElementById("dropzoneEscudo");
  const uploadInput = document.getElementById("uploadEscudo");

  if (dropzone && uploadInput) {
    dropzone.addEventListener("click", () => uploadInput.click());
    uploadInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            estadoSimulador.escudoImg = img;
            dropzone.querySelector("span").innerText = `Escudo: ${file.name}`;
            updateAllTextures();
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Alternar Fundo Claro (Referência) / Escuro
  const btnStudio = document.getElementById("btnToggleStudioBg");
  if (btnStudio) {
    btnStudio.addEventListener("click", () => {
      estadoSimulador.studioLight = !estadoSimulador.studioLight;
      const viewer = document.getElementById("viewerContainer");
      viewer.classList.toggle("studio-light", estadoSimulador.studioLight);
      document.getElementById("bgStateText").innerText = estadoSimulador.studioLight ? "Estúdio Claro" : "Estúdio Escuro";
      document.getElementById("bgStateIcon").innerText = estadoSimulador.studioLight ? "light_mode" : "dark_mode";
      btnStudio.title = estadoSimulador.studioLight ? "Estúdio claro (clique para escuro)" : "Estúdio escuro (clique para claro)";
    });
  }

  // Foco de Câmera (Kit Completo | Camisa | Calção)
  function setFocusActive(btnId) {
    ["btnFocusKit", "btnFocusShirt", "btnFocusShorts"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("active", id === btnId);
    });
  }

  const btnFocusKit = document.getElementById("btnFocusKit");
  if (btnFocusKit) {
    btnFocusKit.addEventListener("click", () => {
      setFocusActive("btnFocusKit");
      controls.target.set(0, 0.25, 0);
      camera.position.set(-0.35, 0.35, 6.2);
    });
  }

  const btnFocusShirt = document.getElementById("btnFocusShirt");
  if (btnFocusShirt) {
    btnFocusShirt.addEventListener("click", () => {
      setFocusActive("btnFocusShirt");
      controls.target.set(0, 1.05, 0);
      camera.position.set(0, 1.15, 3.8);
    });
  }

  const btnFocusShorts = document.getElementById("btnFocusShorts");
  if (btnFocusShorts) {
    btnFocusShorts.addEventListener("click", () => {
      setFocusActive("btnFocusShorts");
      controls.target.set(0, -0.95, 0);
      camera.position.set(0, -0.85, 4.2);
    });
  }

  // Rotação e Vistas
  document.getElementById("btnToggleRotate").addEventListener("click", () => {
    estadoSimulador.autoRotate = !estadoSimulador.autoRotate;
    controls.autoRotate = estadoSimulador.autoRotate;
    document.getElementById("rotateStateText").innerText = `Auto Giro: ${estadoSimulador.autoRotate ? "ON" : "OFF"}`;
    const btnRot = document.getElementById("btnToggleRotate");
    btnRot.classList.toggle("active", estadoSimulador.autoRotate);
    btnRot.setAttribute("aria-pressed", String(estadoSimulador.autoRotate));
    btnRot.title = `Auto giro: ${estadoSimulador.autoRotate ? "ligado" : "desligado"}`;
  });

  document.getElementById("btnResetView").addEventListener("click", () => {
    setFocusActive("btnFocusKit");
    controls.reset();
    controls.target.set(0, 0.25, 0);
    camera.position.set(-0.35, 0.35, 6.2);
  });

  document.getElementById("btnZoomIn").addEventListener("click", () => {
    camera.position.multiplyScalar(0.86);
  });

  document.getElementById("btnZoomOut").addEventListener("click", () => {
    camera.position.multiplyScalar(1.15);
  });

  document.getElementById("btnViewFront").addEventListener("click", () => {
    controls.autoRotate = false;
    camera.position.set(0, controls.target.y, 6.0);
    camera.lookAt(controls.target);
  });

  document.getElementById("btnViewBack").addEventListener("click", () => {
    controls.autoRotate = false;
    camera.position.set(0, controls.target.y, -6.0);
    camera.lookAt(controls.target);
  });

  document.getElementById("btnViewRight").addEventListener("click", () => {
    controls.autoRotate = false;
    camera.position.set(6.0, controls.target.y, 0);
    camera.lookAt(controls.target);
  });

  document.getElementById("btnViewLeft").addEventListener("click", () => {
    controls.autoRotate = false;
    camera.position.set(-6.0, controls.target.y, 0);
    camera.lookAt(controls.target);
  });

  // Botões de Orçamento
  // Projeto salvo no navegador segue para a tela de orçamento
  const irOrcamento = () => {
    salvarProjeto();
    location.href = "orcamento.html?modalidade=" + estadoSimulador.modalidade;
  };
  document.getElementById("btnCheckout").addEventListener("click", irOrcamento);
  document.getElementById("btnBudget").addEventListener("click", irOrcamento);
}
