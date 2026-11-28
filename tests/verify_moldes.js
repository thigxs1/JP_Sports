const fs = require('fs');
const path = require('path');
const assert = require('assert');

const DIR = path.join(__dirname, '..', 'app', 'moldes', 'camiseta-basica');
// largura × altura em mm (±1), x = largura da peça, y = altura (decote/cabeça → barra)
const esperado = {
  P: { frente: [557, 772], costas: [560, 820], manga: [421, 246], ribana: [408, 55] },
  M: { frente: [587, 788], costas: [590, 835], manga: [445, 252], ribana: [420, 55] },
  G: { frente: [617, 804], costas: [620, 852], manga: [469, 258], ribana: [432, 55] }
};
const IDS = ['frente', 'costas', 'manga-esquerda', 'manga-direita', 'ribana'];
const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

let falhas = 0;
function teste(nome, fn) {
  try { fn(); console.log('PASS: ' + nome); } catch (e) { falhas++; console.error('FAIL: ' + nome + '\n      ' + e.message); }
}

teste('index.json lista a camiseta básica', () => {
  const idx = JSON.parse(fs.readFileSync(path.join(DIR, '..', 'index.json'), 'utf8'));
  assert.deepStrictEqual(idx['camiseta-basica'].tamanhos, ['P', 'M', 'G']);
  assert.strictEqual(idx['camiseta-basica'].modalidade, 'futebol');
  assert.strictEqual(idx['camiseta-basica'].gola, 'redonda');
});

for (const t of Object.keys(esperado)) {
  teste('molde ' + t, () => {
    const m = JSON.parse(fs.readFileSync(path.join(DIR, t + '.json'), 'utf8'));
    assert.strictEqual(m.modelo, 'camiseta-basica');
    assert.strictEqual(m.tamanho, t);
    assert.strictEqual(m.unidade, 'mm');
    assert.deepStrictEqual(m.pecas.map((p) => p.id), IDS);
    const por = Object.fromEntries(m.pecas.map((p) => [p.id, p]));
    for (const p of m.pecas) {
      const e = esperado[t][p.id.startsWith('manga') ? 'manga' : p.id];
      perto(p.largura, e[0], 1, `${t} ${p.id} largura`);
      perto(p.altura, e[1], 1, `${t} ${p.id} altura`);
      const a = p.contorno[0], z = p.contorno[p.contorno.length - 1];
      assert.deepStrictEqual(a, z, `${t} ${p.id} contorno fechado`);
      p.contorno.forEach(([x, y]) => assert.ok(x >= -0.01 && x <= p.largura + 0.01 && y >= -0.01 && y <= p.altura + 0.01, `${t} ${p.id} ponto fora`));
      perto(p.pontos.centro, p.largura / 2, 2, `${t} ${p.id} centro`);
      assert.ok(p.pontos.barra > p.altura - 1, `${t} ${p.id} barra`);
      if (p.id !== 'ribana') {
        assert.strictEqual(p.fio.length, 2);
        p.fio.forEach(([x, y]) => assert.ok(x >= 0 && x <= p.largura && y >= 0 && y <= p.altura, `${t} ${p.id} fio dentro`));
      }
    }
    assert.ok(por.frente.pontos.decote[1] > por.costas.pontos.decote[1], `${t} frente com decote mais fundo`);
    perto(por.frente.pontos.decote[0], por.frente.pontos.centro, 1, `${t} decote no centro`);
  });
}

console.log((falhas ? 'FAIL' : 'PASS') + ': moldes');
if (falhas) process.exit(1);
