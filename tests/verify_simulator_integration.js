const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'simulador.html'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'app.js'), 'utf8');
const embeddedJs = fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'embedded_assets.js'), 'utf8');

assert.ok(embeddedJs.includes('__EMBEDDED_KIT_OBJ__'), 'embedded_assets.js must contain __EMBEDDED_KIT_OBJ__');
assert.ok(embeddedJs.includes('__EMBEDDED_NORMAL_MAP__'), 'embedded_assets.js must contain __EMBEDDED_NORMAL_MAP__');
assert.ok(appJs.includes('Gola_Redonda') && appJs.includes('Gola_Polo'), 'app.js must control Gola_Redonda and Gola_Polo visibility');
assert.ok(appJs.includes('Calcao') && appJs.includes('Meiao'), 'app.js must handle Calcao and Meiao meshes');
assert.ok(appJs.includes('rajado'), 'app.js must support the reference rajado pattern');
assert.ok(html.includes('data-tag="corCalcao"'), 'index.html must include CalÃ§Ã£o color selector');
assert.ok(html.includes('data-tag="corMeiao"'), 'index.html must include MeiÃ£o color selector');

console.log('PASS: Simulator integration verified.');

