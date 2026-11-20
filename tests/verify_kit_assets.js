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
