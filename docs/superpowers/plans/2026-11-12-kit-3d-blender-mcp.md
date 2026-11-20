# Kit Esportivo 3D Completo (Blender MCP + Three.js) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar no Blender 5.3 via MCP (porta 9876) o modelo 3D completo do uniforme esportivo (Camisa, 3 tipos de Gola, Punhos, Calção e Meião) + texturas PBR de tecido Dry-Fit e estampa rajada da referência, integrando tudo ao simulador Three.js em `app/`.

**Architecture:** Um script cliente Python comunica via socket TCP (`127.0.0.1:9876`) com o `BlenderMCPServer` ativo no Blender para importar `app/models/objeto.obj`, separar os grupos existentes (`Camisa_Corpo`, `Gola_V`, `Punhos`), modelar proceduralmente `Gola_Redonda`, `Gola_Polo`, `Calcao` e `Meiao` com mapeamento UV, aplicar shaders PBR no Blender e exportar `app/models/kit_completo.obj` + mapas PBR (`dryfit_normal.png`, `dryfit_roughness.png`). Em seguida, o `app/js/embedded_assets.js`, `app/index.html` e `app/js/app.js` são atualizados para carregar o kit completo, alternar as 3 golas em tempo real, renderizar a estampa rajada verde com escudo padrão e personalizar cores de camisa, gola/punho, calção e meião.

**Tech Stack:** Blender 5.3 (`bpy`, `bmesh`), MCP Socket Bridge (`127.0.0.1:9876`), Node.js (testes de verificação e empacotamento de assets), Three.js (`r128`), HTML5 Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-11-12-kit-3d-blender-mcp-design.md`

## Global Constraints
- Conexão com o Blender ativa via socket TCP JSON em `127.0.0.1:9876` (`BlenderMCPServer`).
- Toda modificação do simulador web fica contida em `app/`.
- Manter funcionamento offline (`file://`) atualizando `app/js/embedded_assets.js`.

## Review Focus
- Nomes de grupos/objetos no `.obj` exportado pelo Blender devem corresponder exatamente aos identificadores esperados pelo `THREE.OBJLoader` (`Camisa_Corpo`, `Gola_V`, `Gola_Redonda`, `Gola_Polo`, `Punhos`, `Calcao`, `Meiao`).
- Ao alternar `<select id="selectGola">` entre `v`, `redonda` e `polo`, exatamente uma malha de gola deve ficar `visible = true` e as outras duas `visible = false`.
- O modelo deve iniciar com o visual da foto de referência (Camisa Verde com estampa rajada Limão/Verde Claro, Gola V e Punhos Brancos, Escudo e logo "icone" no peito, Calção Branco com detalhe lateral e escudo, Meião Verde).

---

### Task 1: Gerar Modelos 3D (Camisa, 3 Golas, Punhos, Calção e Meião) e Texturas PBR no Blender via MCP

**Files:**
- Create: `scripts/blender_mcp_generate_kit.py`
- Create: `tests/verify_kit_assets.js`
- Create: `app/models/kit_completo.obj`
- Create: `app/assets/textures/dryfit_normal.png`
- Create: `app/assets/textures/dryfit_roughness.png`

**Interfaces:**
- Consumes: `app/models/objeto.obj` e socket MCP `127.0.0.1:9876` (`{"type": "execute_code", "params": {"code": "..."}}`)
- Produces:
  - `app/models/kit_completo.obj` contendo os objetos `o Camisa_Corpo`, `o Gola_V`, `o Gola_Redonda`, `o Gola_Polo`, `o Punhos`, `o Calcao`, `o Meiao` com coordenadas `v`, `vt`, `vn`
  - `app/assets/textures/dryfit_normal.png` (256x256 tileable normal map)
  - `app/assets/textures/dryfit_roughness.png` (256x256 tileable roughness map)

- [ ] **Step 1: Write the failing asset verification test `tests/verify_kit_assets.js`**

```javascript
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const objPath = path.join(__dirname, '..', 'app', 'models', 'kit_completo.obj');
const normPath = path.join(__dirname, '..', 'app', 'assets', 'textures', 'dryfit_normal.png');
const roughPath = path.join(__dirname, '..', 'app', 'assets', 'textures', 'dryfit_roughness.png');

assert.ok(fs.existsSync(objPath), 'kit_completo.obj must exist');
assert.ok(fs.existsSync(normPath), 'dryfit_normal.png must exist');
assert.ok(fs.existsSync(roughPath), 'dryfit_roughness.png must exist');

const objText = fs.readFileSync(objPath, 'utf8');
const requiredObjects = ['Camisa_Corpo', 'Gola_V', 'Gola_Redonda', 'Gola_Polo', 'Punhos', 'Calcao', 'Meiao'];
for (const name of requiredObjects) {
  const regex = new RegExp(`^(?:o|g)\\s+${name}\\b`, 'm');
  assert.ok(regex.test(objText), `OBJ must contain object/group "${name}"`);
}
console.log('PASS: All 3D kit objects and PBR textures verified.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/verify_kit_assets.js`
Expected: FAIL with `AssertionError [ERR_ASSERTION]: kit_completo.obj must exist`

- [ ] **Step 3: Implement `scripts/blender_mcp_generate_kit.py` and execute it against Blender MCP on port 9876**

Write `scripts/blender_mcp_generate_kit.py` to connect to `127.0.0.1:9876`, send an `execute_code` command to Blender 5.3 that:
1. Clears default cube, imports `app/models/objeto.obj`.
2. Inspects the imported mesh groups/materials (`GOLA_FRONT_4019` and `Pattern_1573565`/`1573566` cuffs vs shirt body) and splits them into separate named Blender Mesh objects: `Camisa_Corpo`, `Gola_V`, `Punhos`.
3. Extracts the neck boundary loop from `Gola_V` / `Camisa_Corpo` and constructs:
   - `Gola_Redonda`: smooth crew-neck collar band around the neck opening with proper UV coordinates in the collar UV region.
   - `Gola_Polo`: folded polo collar with raised stand and turned-down collar wings + front placket with UV mapping.
4. Models anatomically proportioned `Calcao` (soccer shorts positioned directly below the shirt hem `y: 1.75..3.18` in OBJ Y-up / Blender Z-up space, with two leg openings, subtle cloth folds, and clean cylindrical/planar UV mapping) and `Meiao` (pair of soccer socks `y: 0.25..1.45` with calf shaping and top turnover cuff).
5. Generates tileable 256x256 `dryfit_normal.png` (hexagonal micro-mesh dimple normal map) and `dryfit_roughness.png` into `app/assets/textures/`.
6. Sets up studio lighting and PBR materials inside the live Blender scene so the user sees the full green/white kit right inside Blender's 3D Viewport, and exports `app/models/kit_completo.obj` with `export_object_groups=True`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/verify_kit_assets.js`
Expected: `PASS: All 3D kit objects and PBR textures verified.`

---

### Task 2: Atualizar Empacotamento Offline (`embedded_assets.js`) e Interface do Simulador (`app/index.html`, `app/js/app.js`)

**Files:**
- Create: `scripts/build_embedded_assets.js`
- Modify: `app/js/embedded_assets.js`
- Modify: `app/index.html`
- Modify: `app/js/app.js`
- Create: `tests/verify_simulator_integration.js`

**Interfaces:**
- Consumes: `app/models/kit_completo.obj`, `app/models/formas2048.svg`, `app/assets/textures/dryfit_normal.png`, `app/assets/textures/dryfit_roughness.png`
- Produces:
  - `window.__EMBEDDED_KIT_OBJ__`, `window.__EMBEDDED_NORMAL_MAP__`, `window.__EMBEDDED_ROUGHNESS_MAP__` in `app/js/embedded_assets.js`
  - Interactive collar switching (`v`, `redonda`, `polo`), full kit coloring (`corCalcao`, `corMeiao`), reference green-slash pattern (`rajado`) with vector team crest and `icone` logo on shirt & shorts, and camera focus presets (`Kit Completo`, `Camisa`, `Calção`, `Meião`).

- [ ] **Step 1: Write the failing integration test `tests/verify_simulator_integration.js`**

```javascript
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'app.js'), 'utf8');
const embeddedJs = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'embedded_assets.js'), 'utf8');

assert.ok(embeddedJs.includes('__EMBEDDED_KIT_OBJ__'), 'embedded_assets.js must contain __EMBEDDED_KIT_OBJ__');
assert.ok(embeddedJs.includes('__EMBEDDED_NORMAL_MAP__'), 'embedded_assets.js must contain __EMBEDDED_NORMAL_MAP__');
assert.ok(appJs.includes('Gola_Redonda') && appJs.includes('Gola_Polo'), 'app.js must control Gola_Redonda and Gola_Polo visibility');
assert.ok(appJs.includes('Calcao') && appJs.includes('Meiao'), 'app.js must handle Calcao and Meiao meshes');
assert.ok(appJs.includes('rajado'), 'app.js must support the reference rajado pattern');
assert.ok(html.includes('data-tag="corCalcao"'), 'index.html must include Calção color selector');
assert.ok(html.includes('data-tag="corMeiao"'), 'index.html must include Meião color selector');

console.log('PASS: Simulator integration verified.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/verify_simulator_integration.js`
Expected: FAIL with `AssertionError [ERR_ASSERTION]: embedded_assets.js must contain __EMBEDDED_KIT_OBJ__`

- [ ] **Step 3: Implement `scripts/build_embedded_assets.js`, update `app/index.html` and `app/js/app.js`**

1. Run `scripts/build_embedded_assets.js` to bundle `kit_completo.obj`, `formas2048.svg`, `dryfit_normal.png` (base64 data URI), and `dryfit_roughness.png` (base64 data URI) into `app/js/embedded_assets.js`.
2. Update `app/index.html`:
   - Add top category bar (`MASCULINO | JOGO | GOLEIRO | PASSEIO`) matching the reference screenshot.
   - Add part buttons for `Calção (Shorts)` (`data-tag="corCalcao"`) and `Meião` (`data-tag="corMeiao"`).
   - Add pattern card `Rajado Esportivo (Ref. Oficial)` (`data-pattern="rajado"`) as the default active pattern.
   - Add camera focus buttons for `Kit Completo`, `Foco Camisa`, `Foco Calção`.
3. Update `app/js/app.js`:
   - Set default state to match the reference screenshot: `cor1: Verde (#005913)`, `cor2: Limão (#B8ED28)`, `cor3: Branco (#FFFFFF)` (Gola V & punho), `corCalcao: Branco (#FFFFFF)`, `corMeiao: Verde (#005913)`, `estampa: "rajado"`, `gola: "v"`.
   - Parse `kit_completo.obj` and separate meshes by name (`Camisa_Corpo`, `Gola_V`, `Gola_Redonda`, `Gola_Polo`, `Punhos`, `Calcao`, `Meiao`).
   - Apply Dry-Fit PBR `normalMap` and `roughnessMap` with repeat tiling (`repeat.set(24, 24)`) to all fabric materials.
   - Create dedicated dynamic canvas textures for the Shirt (`2048x2048`), Collar/Cuffs, Shorts (`1024x1024` with side stripe, `icone` logo and crest on right leg), and Socks (`512x512` with top band).
   - Wire `<select id="selectGola">` change listener to toggle `Gola_V`, `Gola_Redonda`, and `Gola_Polo` visibility in real time.

- [ ] **Step 4: Run tests to verify everything passes**

Run: `node tests/verify_kit_assets.js && node tests/verify_simulator_integration.js`
Expected: Both scripts output `PASS`.
