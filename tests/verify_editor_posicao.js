const path = require('path');
const assert = require('assert');

const RAIZ = path.join(__dirname, '..');
global.JPArtePecas = require(path.join(RAIZ, 'app', 'js', 'arte-pecas.js'));
const ed = require(path.join(RAIZ, 'app', 'js', 'editor-posicao.js'));
const arte = global.JPArtePecas;
const molde = require(path.join(RAIZ, 'app', 'moldes', 'camiseta-basica', 'M.json'));
const el = (l, id) => l.elementos.find((e) => e.id === id);
const peca = (id) => molde.pecas.find((p) => p.id === id);

let falhas = 0;
const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);

teste('moverElemento soma em cm e não altera o original', () => {
  const l = arte.layoutPadrao('camiseta-basica');
  const n = ed.moverElemento(l, 'numero', 2, -3, molde);
  assert.strictEqual(el(n, 'numero').dx, el(l, 'numero').dx + 2);
  assert.strictEqual(el(n, 'numero').dy, el(l, 'numero').dy - 3);
  assert.strictEqual(el(l, 'numero').dx, 0, 'original intacto');
});

teste('moverElemento não deixa o centro sair da peça', () => {
  const l = arte.layoutPadrao('camiseta-basica');
  const n = ed.moverElemento(l, 'numero', 500, 500, molde);
  const pos = arte.posicao(el(n, 'numero'), peca('costas'));
  assert.ok(pos.x <= peca('costas').largura + 0.01 && pos.y <= peca('costas').altura + 0.01, JSON.stringify(pos));
  const m = ed.moverElemento(l, 'escudo', -500, -500, molde);
  const q = arte.posicao(el(m, 'escudo'), peca('frente'));
  assert.ok(q.x >= -0.01 && q.y >= -0.01, JSON.stringify(q));
});

teste('redimensionar respeita os limites de cada elemento', () => {
  const l = arte.layoutPadrao('camiseta-basica');
  assert.strictEqual(el(ed.redimensionar(l, 'escudo', 1), 'escudo').largura, 3);
  assert.strictEqual(el(ed.redimensionar(l, 'escudo', 99), 'escudo').largura, 15);
  assert.strictEqual(el(ed.redimensionar(l, 'numero', 50), 'numero').largura, 35);
  assert.strictEqual(el(ed.redimensionar(l, 'patrocinio', 20), 'patrocinio').largura, 20);
  assert.deepStrictEqual(ed.LIMITES.nome, [8, 40]);
});

teste('passo do teclado: seta 0,5 cm; Shift + seta 2 cm', () => {
  assert.deepStrictEqual(ed.passoTeclado('ArrowRight', false), [0.5, 0]);
  assert.deepStrictEqual(ed.passoTeclado('ArrowUp', true), [0, -2]);
  assert.strictEqual(ed.passoTeclado('Enter', false), null);
});

teste('dimensoesEscudo limita a 1500 px mantendo a proporção', () => {
  assert.deepStrictEqual(ed.dimensoesEscudo(6000, 4000), { w: 1500, h: 1000 });
  assert.deepStrictEqual(ed.dimensoesEscudo(1000, 3000), { w: 500, h: 1500 });
  assert.deepStrictEqual(ed.dimensoesEscudo(800, 600), { w: 800, h: 600 });
});

teste('avisos: elemento perto da costura', () => {
  const l = arte.layoutPadrao('camiseta-basica');
  assert.deepStrictEqual(ed.avisos(l, molde, 20), []);
  const perto = ed.moverElemento(l, 'escudo', 14, 0, molde);
  assert.deepStrictEqual(ed.avisos(perto, molde, 20), [{ id: 'escudo', texto: 'Muito perto da costura' }]);
});

(async () => {
  for (const [nome, fn] of testes) {
    try { await fn(); console.log('PASS: ' + nome); } catch (e) { falhas++; console.error('FAIL: ' + nome + '\n      ' + e.message); }
  }
  console.log((falhas ? 'FAIL' : 'PASS') + ': editor de posição, ' + (testes.length - falhas) + '/' + testes.length);
  if (falhas) process.exit(1);
})();
