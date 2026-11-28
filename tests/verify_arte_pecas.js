const path = require('path');
const assert = require('assert');

const RAIZ = path.join(__dirname, '..');
const arte = () => require(path.join(RAIZ, 'app', 'js', 'arte-pecas.js'));
const molde = (t) => require(path.join(RAIZ, 'app', 'moldes', 'camiseta-basica', t + '.json'));
const peca = (t, id) => molde(t).pecas.find((p) => p.id === id);

/* ctx falso: grava as chamadas da API Canvas 2D que importam para o teste. */
function ctxFalso(fator = 0.6) {
  const chamadas = [];
  const estado = { fillStyle: '#000000', globalAlpha: 1, font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', strokeStyle: '#000', lineWidth: 1 };
  const ctx = new Proxy(estado, {
    get(alvo, nome) {
      if (nome === 'chamadas') return chamadas;
      if (nome in alvo) return alvo[nome];
      if (nome === 'measureText') {
        return (t) => { const px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(alvo.font)[1]); return { width: fator * px * Array.from(t).length }; };
      }
      return (...args) => { chamadas.push({ fn: nome, args, fillStyle: alvo.fillStyle, font: alvo.font, globalAlpha: alvo.globalAlpha }); };
    },
    set(alvo, nome, v) { alvo[nome] = v; return true; }
  });
  return ctx;
}
const PROJETO = {
  modalidade: 'futebol', gola: 'redonda', estampa: 'solid', numero: '10', nome: 'JOGADOR', patrocinio: 'BANCO',
  fonte: 'Montserrat',
  cores: {
    cor1: { hex: '#0F1F3D' }, cor2: { hex: '#2F5BFF' }, cor3: { hex: '#FFFFFF' }, cor4: { hex: '#FFFFFF' }, cor5: { hex: '#FFFFFF' }
  }
};
const desenhar = (p, projeto, atleta, opcoes) => {
  const ctx = ctxFalso();
  const r = arte().desenharPeca(ctx, p, projeto || PROJETO, atleta || null, Object.assign({ sangria: 5 }, opcoes));
  return { ctx, chamadas: ctx.chamadas, r };
};
const textos = (ch) => ch.filter((c) => c.fn === 'fillText');

let falhas = 0;
const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);

teste('layoutPadrao tem os 5 elementos nas peças certas', () => {
  const l = arte().layoutPadrao('camiseta-basica');
  assert.strictEqual(l.base, 'M');
  const por = Object.fromEntries(l.elementos.map((e) => [e.id, e]));
  assert.deepStrictEqual(Object.keys(por).sort(), ['escudo', 'marca', 'nome', 'numero', 'patrocinio']);
  assert.strictEqual(por.numero.peca, 'costas');
  assert.strictEqual(por.nome.peca, 'costas');
  ['escudo', 'marca', 'patrocinio'].forEach((id) => assert.strictEqual(por[id].peca, 'frente'));
});

teste('número cai no centro das costas, à mesma distância do decote, em P/M/G', () => {
  const l = arte().layoutPadrao('camiseta-basica');
  const el = l.elementos.find((e) => e.id === 'numero');
  const fontes = [];
  ['P', 'M', 'G'].forEach((t) => {
    const p = peca(t, 'costas');
    const { chamadas } = desenhar(p);
    const n = textos(chamadas).find((c) => c.args[0] === '10');
    assert.ok(n, 'número desenhado em ' + t);
    assert.ok(Math.abs(n.args[1] - p.pontos.centro) <= 0.5, t + ' x');
    assert.ok(Math.abs(n.args[2] - (p.pontos.decote[1] + el.dy * 10)) <= 0.5, t + ' y');
    fontes.push(n.font);
  });
  assert.strictEqual(new Set(fontes).size, 1, 'mesmo tamanho de fonte nos três tamanhos');
});

teste('posicao usa decote ou centro como âncora', () => {
  const p = peca('M', 'frente');
  const a = arte().posicao({ ancora: 'decote', dx: 2, dy: 3, largura: 8 }, p);
  assert.deepStrictEqual([+a.x.toFixed(2), +a.y.toFixed(2), a.largura], [+(p.pontos.centro + 20).toFixed(2), +(p.pontos.decote[1] + 30).toFixed(2), 80]);
  const b = arte().posicao({ ancora: 'centro', dx: 0, dy: 0, largura: 8 }, p);
  assert.ok(Math.abs(b.y - p.altura / 2) < 0.01);
});

teste('recorta pelo contorno expandido antes de pintar o fundo', () => {
  const p = peca('M', 'frente');
  const { chamadas } = desenhar(p);
  const iClip = chamadas.findIndex((c) => c.fn === 'clip');
  const iFundo = chamadas.findIndex((c) => c.fn === 'fillRect');
  assert.ok(iClip >= 0 && iClip < iFundo, 'clip antes do fundo');
  const pontos = chamadas.slice(0, iClip).filter((c) => c.fn === 'lineTo' || c.fn === 'moveTo').map((c) => c.args);
  const xs = pontos.map((q) => q[0]);
  assert.ok(Math.min(...xs) < -4 && Math.max(...xs) > p.largura + 4, 'contorno expandido ~5 mm');
});

teste('atleta: nome e número nas costas, nada disso na frente', () => {
  const at = { nome: 'SILVA', numero: '07', tamanho: 'M' };
  const costas = textos(desenhar(peca('M', 'costas'), null, at).chamadas).map((c) => c.args[0]);
  assert.ok(costas.includes('SILVA') && costas.includes('07'));
  const frente = textos(desenhar(peca('M', 'frente'), null, at).chamadas).map((c) => c.args[0]);
  assert.ok(!frente.includes('SILVA') && !frente.includes('07'));
});

teste('texto com marcação sai literal; limparTexto remove o que a fonte não tem', () => {
  const costas = textos(desenhar(peca('M', 'costas'), null, { nome: '<script>', numero: '1' }).chamadas).map((c) => c.args[0]);
  assert.ok(costas.includes('<SCRIPT>'));
  const latin1 = (ch) => ch.codePointAt(0) <= 0xff;
  assert.deepStrictEqual(arte().limparTexto('JOÃO🔥', latin1), { texto: 'JOÃO', removidos: ['🔥'] });
});

teste('estampas solid, stripes e gradient', () => {
  const p = peca('M', 'frente');
  const solid = desenhar(p).chamadas.filter((c) => c.fn === 'fillRect');
  assert.strictEqual(solid[0].fillStyle, '#0F1F3D');
  const faixas = desenhar(p, Object.assign({}, PROJETO, { estampa: 'stripes' })).chamadas.filter((c) => c.fn === 'fillRect' && c.args[2] === 30);
  assert.ok(faixas.length >= 9, 'faixas de 30 mm');
  assert.ok(faixas.every((c) => c.fillStyle === '#2F5BFF'), 'faixas na cor 2 sobre a cor 1');
  const grad = desenhar(p, Object.assign({}, PROJETO, { estampa: 'gradient' })).chamadas.filter((c) => c.fn === 'fillRect');
  assert.strictEqual(grad.length, 64);
  assert.strictEqual(grad[0].fillStyle.toLowerCase(), '#0f1f3d');
  assert.strictEqual(grad[63].fillStyle.toLowerCase(), '#2f5bff');
});

teste('rajado é determinístico', () => {
  const p = peca('M', 'costas');
  const pr = Object.assign({}, PROJETO, { estampa: 'rajado' });
  const a = JSON.stringify(desenhar(p, pr).chamadas), b = JSON.stringify(desenhar(p, pr).chamadas);
  assert.strictEqual(a, b);
  assert.ok(desenhar(p, pr).chamadas.filter((c) => c.fn === 'fill').length > 50);
});

teste('semFundo: só os elementos, sem pintar a estampa', () => {
  const { chamadas } = desenhar(peca('M', 'costas'), null, null, { semFundo: true });
  assert.strictEqual(chamadas.filter((c) => c.fn === 'fillRect').length, 0);
  assert.ok(textos(chamadas).some((c) => c.args[0] === '10'));
});

teste('ribana sai na cor 3, sem textos', () => {
  const { chamadas } = desenhar(peca('M', 'ribana'));
  assert.strictEqual(chamadas.find((c) => c.fn === 'fillRect').fillStyle, '#FFFFFF');
  assert.strictEqual(textos(chamadas).length, 0);
});

teste('foraDaAreaSegura detecta elemento colado na costura', () => {
  const p = peca('M', 'frente');
  assert.strictEqual(arte().foraDaAreaSegura({ id: 'escudo', ancora: 'decote', dx: 0, dy: 20, largura: 8 }, p, 20), false);
  assert.strictEqual(arte().foraDaAreaSegura({ id: 'escudo', ancora: 'decote', dx: 27, dy: 20, largura: 8 }, p, 20), true);
});

teste('nome que não cabe encolhe e avisa', () => {
  const ctx = ctxFalso(1.5); // fonte larga: não cabe nem no tamanho mínimo
  const r = arte().desenharPeca(ctx, peca('M', 'costas'), PROJETO, { nome: 'MAXIMILIANOOOOO', numero: '9' }, { sangria: 5 });
  const n = textos(ctx.chamadas).find((c) => c.args[0] === 'MAXIMILIANOOOOO');
  assert.ok(n, 'desenhado');
  const esc = ctx.chamadas.find((c) => c.fn === 'scale');
  assert.ok(esc && esc.args[0] < 1 && esc.args[1] === 1, 'comprimido só na horizontal');
  assert.ok(r.avisos.some((a) => /não cabe/.test(a)));
});

teste('afimDePares reproduz 3 pares exatos e ajusta 4 por mínimos quadrados', () => {
  const m = arte().afimDePares([[[0, 0], [10, 20]], [[100, 0], [210, 20]], [[0, 50], [10, 120]]]);
  [[0, 0, 10, 20], [100, 0, 210, 20], [0, 50, 10, 120], [50, 25, 110, 70]].forEach(([x, y, u, v]) => {
    const r = arte().aplicarAfim(m, [x, y]);
    assert.ok(Math.abs(r[0] - u) < 0.01 && Math.abs(r[1] - v) < 0.01, JSON.stringify(r));
  });
  const q = arte().afimDePares([[[0, 0], [0, 0]], [[10, 0], [20, 0]], [[0, 10], [0, 30]], [[10, 10], [20, 30]]]);
  assert.deepStrictEqual(arte().aplicarAfim(q, [5, 5]).map((x) => +x.toFixed(3)), [10, 15]);
});

teste('calibração real: decote de frente e costas do M cai na ilha de UV certa', () => {
  const cal = require(path.join(RAIZ, 'app', 'moldes', 'camiseta-basica', 'calibracao.json'));
  const dentro = (p, [u0, u1, v0, v1]) => p[0] >= u0 && p[0] <= u1 && p[1] >= v0 && p[1] <= v1;
  const fr = peca('M', 'frente'), co = peca('M', 'costas');
  assert.ok(dentro(arte().aplicarAfim(arte().afimDePares(cal.pecas.frente.pares), fr.pontos.decote), [1259, 1972, 860, 1987]), 'frente');
  assert.ok(dentro(arte().aplicarAfim(arte().afimDePares(cal.pecas.costas.pares), co.pontos.decote), [131, 1054, 663, 1923]), 'costas');
});

(async () => {
  for (const [nome, fn] of testes) {
    try { await fn(); console.log('PASS: ' + nome); } catch (e) { falhas++; console.error('FAIL: ' + nome + '\n      ' + e.message); }
  }
  console.log((falhas ? 'FAIL' : 'PASS') + ': arte por peça, ' + (testes.length - falhas) + '/' + testes.length);
  if (falhas) process.exit(1);
})();
