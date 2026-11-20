const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const kitObj = fs.readFileSync(path.join(root, 'app', 'models', 'kit_completo.obj'), 'utf8');
const origObj = fs.readFileSync(path.join(root, 'app', 'models', 'objeto.obj'), 'utf8');
const svgText = fs.readFileSync(path.join(root, 'app', 'models', 'formas2048.svg'), 'utf8');
const normB64 = fs.readFileSync(path.join(root, 'app', 'assets', 'textures', 'dryfit_normal.png')).toString('base64');
const roughB64 = fs.readFileSync(path.join(root, 'app', 'assets', 'textures', 'dryfit_roughness.png')).toString('base64');

const basqObj = fs.readFileSync(path.join(root, 'app', 'models', 'modal_basquete.obj'), 'utf8');
const voleiObj = fs.readFileSync(path.join(root, 'app', 'models', 'modal_volei.obj'), 'utf8');

const out = [
  `window.__EMBEDDED_MODAL_BASQUETE__ = ${JSON.stringify(basqObj)};`,
  `window.__EMBEDDED_MODAL_VOLEI__ = ${JSON.stringify(voleiObj)};`,
  `window.__EMBEDDED_KIT_OBJ__ = ${JSON.stringify(kitObj)};`,
  `window.__EMBEDDED_OBJ__ = ${JSON.stringify(origObj)};`,
  `window.__EMBEDDED_SVG__ = ${JSON.stringify(svgText)};`,
  `window.__EMBEDDED_NORMAL_MAP__ = "data:image/png;base64,${normB64}";`,
  `window.__EMBEDDED_ROUGHNESS_MAP__ = "data:image/png;base64,${roughB64}";`
].join('\n');

fs.writeFileSync(path.join(root, 'app', 'js', 'embedded_assets.js'), out, 'utf8');
console.log('Built app/js/embedded_assets.js successfully (' + out.length + ' bytes)');
