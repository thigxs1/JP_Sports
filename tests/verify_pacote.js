const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { jsPDF } = require('jspdf');
const JSZip = require('jszip');

const RAIZ = path.join(__dirname, '..');
const pacote = require(path.join(RAIZ, 'app', 'js', 'pacote-impressao.js'));
const indice = require(path.join(RAIZ, 'app', 'moldes', 'index.json'));
const moldes = Object.fromEntries(['P', 'M', 'G'].map((t) => [t, require(path.join(RAIZ, 'app', 'moldes', 'camiseta-basica', t + '.json'))]));
const carregarTTF = async (arquivo) => fs.readFileSync(path.join(RAIZ, 'app', 'assets', 'fontes', arquivo)).toString('base64');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const MM = 72 / 25.4;

function pedido(extra) {
  return Object.assign({
    id: 42, criado_em: '2026-11-28T10:00:00Z', time: 'Unidos da Vila', cidade: 'Campinas', responsavel: 'Ana',
    modalidade: 'futebol', kit_completo: false, grade: { M: 3, G: 2 }, total_pecas: 5, status: 'novo',
    projeto_3d: {
      modalidade: 'futebol', gola: 'redonda', estampa: 'solid', numero: '10', nome: 'JOGADOR', fonte: 'Montserrat',
      patrocinio: 'BANCO', escudo: PNG,
      cores: { cor1: { nome: 'Navy', hex: '#0F1F3D' }, cor2: { nome: 'Elétrico', hex: '#2F5BFF' }, cor3: { hex: '#FFFFFF' }, cor4: { hex: '#FFFFFF' }, cor5: { hex: '#FFFFFF' } }
    },
    atletas: [
      { nome: 'SILVA', numero: '7', tamanho: 'M' }, { nome: 'SOUZA', numero: '8', tamanho: 'M' },
      { nome: 'LIMA', numero: '9', tamanho: 'M' }, { nome: 'COSTA', numero: '10', tamanho: 'G' },
      { nome: 'ROCHA', numero: '11', tamanho: 'G' }
    ]
  }, extra);
}
const gerar = (p, perfil) => pacote.gerarPacote(p, { moldes, indice, perfil, jsPDF, JSZip, carregarTTF });
async function abrir(zip) { return JSZip.loadAsync(zip); }
function mediaBoxes(texto) {
  return [...texto.matchAll(/\/MediaBox \[([\d. ]+)\]/g)].map((m) => m[1].trim().split(/\s+/).slice(2).map((v) => +(Number(v) / MM).toFixed(1)));
}

let falhas = 0;
const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);

teste('podeExportar: só futebol com gola redonda', () => {
  assert.deepStrictEqual(pacote.podeExportar(pedido(), indice), { ok: true, modelo: 'camiseta-basica' });
  const v = pedido(); v.projeto_3d = Object.assign({}, v.projeto_3d, { gola: 'v' });
  assert.strictEqual(pacote.podeExportar(v, indice).motivo, 'Molde de gola V/polo não cadastrado');
  assert.strictEqual(pacote.podeExportar(pedido({ modalidade: 'basquete' }), indice).motivo, 'Molde de basquete não cadastrado');
  assert.strictEqual(pacote.podeExportar(pedido({ modalidade: 'volei' }), indice).motivo, 'Molde de vôlei não cadastrado');
});

teste('copias: um por atleta; sem lista, pela grade com aviso', () => {
  const c = pacote.copias(pedido());
  assert.strictEqual(c.lista.length, 5);
  assert.deepStrictEqual(c.lista.filter((x) => x.tamanho === 'M').map((x) => x.atleta.nome), ['SILVA', 'SOUZA', 'LIMA']);
  assert.deepStrictEqual(c.lista[0], { tamanho: 'M', atleta: { nome: 'SILVA', numero: '7', tamanho: 'M' }, indice: 1, total: 3 });
  const s = pacote.copias(pedido({ atletas: null, grade: { M: 2 } }));
  assert.strictEqual(s.lista.length, 2);
  assert.ok(s.lista.every((x) => x.atleta === null && x.tamanho === 'M'));
  assert.ok(s.avisos.some((a) => /Sem lista de atletas/.test(a)));
});

teste('encaixar: dentro da largura útil, sem sobreposição, várias pranchas', () => {
  const perfil = Object.assign({}, pacote.PERFIL_PADRAO, { comprimentoMax: 2000 });
  const itens = [];
  for (let i = 0; i < 6; i++) itens.push({ id: 'f' + i, nome: 'Frente', largura: 597, altura: 798 });
  const r = pacote.encaixar(itens, perfil);
  assert.ok(!r.erro, r.erro);
  assert.ok(r.pranchas.length > 1, 'mais de uma prancha');
  const L = perfil.larguraUtil - perfil.margemLateral;
  r.pranchas.forEach((pr) => {
    assert.ok(pr.comprimento <= perfil.comprimentoMax);
    pr.itens.forEach((a, i) => {
      const wa = a.girado ? a.altura : a.largura, ha = a.girado ? a.largura : a.altura;
      assert.ok(a.x >= perfil.margemLateral && a.x + wa <= L + 0.01, 'dentro da largura útil');
      assert.ok(a.y + ha <= pr.comprimento);
      pr.itens.slice(i + 1).forEach((b) => {
        const wb = b.girado ? b.altura : b.largura, hb = b.girado ? b.largura : b.altura;
        const separados = a.x + wa + perfil.espaco <= b.x + 0.01 || b.x + wb + perfil.espaco <= a.x + 0.01 ||
          a.y + ha + perfil.espaco <= b.y + 0.01 || b.y + hb + perfil.espaco <= a.y + 0.01;
        assert.ok(separados, 'sem sobreposição');
      });
    });
  });
  assert.strictEqual(r.pranchas.reduce((s, p) => s + p.itens.length, 0), 6);
});

teste('perfil estreito: não reduz a peça, recusa com mensagem', () => {
  const r = pacote.encaixar([{ id: 'f', nome: 'Frente', largura: 597, altura: 798 }], Object.assign({}, pacote.PERFIL_PADRAO, { larguraUtil: 500 }));
  assert.ok(/Perfil de 500 mm não comporta a peça Frente/.test(r.erro), r.erro);
});

teste('gerarPacote: arquivos, cópias por tamanho e páginas na escala', async () => {
  const r = await gerar(pedido());
  const zip = await abrir(r.zip);
  const nomes = Object.keys(zip.files).sort();
  ['ficha-42.txt', 'ficha-42.prn', 'impressao-42-M.pdf', 'impressao-42-G.pdf', 'impressao-42-unificado.pdf', 'manifesto-42.json']
    .forEach((n) => assert.ok(nomes.includes(n), 'falta ' + n));
  const man = JSON.parse(await zip.file('manifesto-42.json').async('string'));
  assert.strictEqual(man.escala, '1:1');
  assert.ok(!r.avisos.some((x) => /não cabe/.test(x)), 'textos curtos cabem: ' + r.avisos.join(' | '));
  assert.strictEqual(man.versaoMolde, 'audaces-2026-11');
  assert.strictEqual(man.perfil.larguraUtil, 1600);
  assert.strictEqual(man.tamanhos.M.copias, 3);
  assert.strictEqual(man.tamanhos.G.copias, 2);
  const costasM = man.tamanhos.M.pecas.filter((p) => /· Costas ·/.test(p.rotulo)).map((p) => p.rotulo);
  assert.deepStrictEqual(costasM, ['#42 · Costas · M · 7 SILVA', '#42 · Costas · M · 8 SOUZA', '#42 · Costas · M · 9 LIMA']);
  assert.strictEqual(man.unificado.pecas.length, 25);
  for (const [arq, desc] of [['impressao-42-M.pdf', man.tamanhos.M], ['impressao-42-unificado.pdf', man.unificado]]) {
    const texto = await zip.file(arq).async('string');
    assert.deepStrictEqual(mediaBoxes(texto), desc.pranchas.map((p) => [1600, p.comprimento]), arq + ' páginas');
  }
});

teste('tamanho sem molde: sem PDF e com aviso', async () => {
  const p = pedido();
  p.atletas = p.atletas.concat([{ nome: 'GOMES', numero: '12', tamanho: 'GG' }]);
  const r = await gerar(p);
  const zip = await abrir(r.zip);
  assert.ok(!zip.file('impressao-42-GG.pdf'));
  assert.ok(r.manifesto.avisos.includes('Tamanho GG sem molde'));
});

teste('nome com acento e emoji; pedido sem layout nem projeto', async () => {
  const p = pedido({ atletas: [{ nome: 'MÜLLER🔥', numero: '5', tamanho: 'M' }] });
  const r = await gerar(p);
  assert.ok(r.manifesto.tamanhos.M.pecas.some((x) => x.rotulo === '#42 · Costas · M · 5 MÜLLER'));
  assert.ok(r.manifesto.avisos.some((a) => /removidos/.test(a) && a.includes('🔥')));
  const semProjeto = await gerar(pedido({ projeto_3d: null, atletas: null, grade: { M: 1 } }));
  assert.ok(semProjeto.manifesto.avisos.some((a) => /Sem projeto 3D/.test(a)));
  assert.strictEqual(semProjeto.manifesto.tamanhos.M.copias, 1);
});

teste('gola V: gerarPacote recusa com o motivo', async () => {
  const v = pedido(); v.projeto_3d = Object.assign({}, v.projeto_3d, { gola: 'polo' });
  const r = await gerar(v);
  assert.strictEqual(r.erro, 'Molde de gola V/polo não cadastrado');
});

(async () => {
  for (const [nome, fn] of testes) {
    try { await fn(); console.log('PASS: ' + nome); } catch (e) { falhas++; console.error('FAIL: ' + nome + '\n      ' + ((e && e.stack) || e)); }
  }
  console.log((falhas ? 'FAIL' : 'PASS') + ': pacote, ' + (testes.length - falhas) + '/' + testes.length);
  if (falhas) process.exit(1);
})();
