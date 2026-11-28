const path = require('path');
const assert = require('assert');
const A = require(path.join(__dirname, '..', 'app', 'js', 'atletas.js'));

let falhas = 0;
const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);

teste('normalizarAtleta: maiúsculas, número como texto, tamanho sem diferenciar caixa', () => {
  assert.deepStrictEqual(A.normalizarAtleta({ nome: ' silva ', numero: '007', tamanho: 'gg' }), { ok: true, atleta: { nome: 'SILVA', numero: '007', tamanho: 'GG' } });
  assert.deepStrictEqual(A.normalizarAtleta({ nome: 'ana', numero: '10', tamanho: 'infantil' }).atleta.tamanho, 'Infantil');
  assert.strictEqual(A.normalizarAtleta({ nome: '', numero: '9', tamanho: 'M' }).ok, true, 'só número vale');
});

teste('normalizarAtleta: erros de nome, número e tamanho', () => {
  assert.strictEqual(A.normalizarAtleta({ nome: 'A'.repeat(16), numero: '1', tamanho: 'M' }).erro, 'nome com mais de 15 caracteres');
  assert.strictEqual(A.normalizarAtleta({ nome: 'A', numero: '1234', tamanho: 'M' }).erro, 'número com mais de 3 dígitos');
  assert.strictEqual(A.normalizarAtleta({ nome: 'A', numero: '1a', tamanho: 'M' }).erro, 'número só com dígitos');
  assert.strictEqual(A.normalizarAtleta({ nome: 'A', numero: '1', tamanho: '' }).erro, 'tamanho ausente');
  assert.strictEqual(A.normalizarAtleta({ nome: 'A', numero: '1', tamanho: 'XXL' }).erro, 'tamanho XXL não existe');
  assert.strictEqual(A.normalizarAtleta({ nome: '', numero: '', tamanho: 'M' }).erro, 'informe nome ou número');
});

teste('lerColado: separadores ; , e tab; erro por linha', () => {
  const r = A.lerColado('silva; 007; gg\nana,10,infantil\nlima\t9\tm\n\nsem tamanho; 5\n');
  assert.deepStrictEqual(r.atletas.map((a) => a.nome + '/' + a.numero + '/' + a.tamanho), ['SILVA/007/GG', 'ANA/10/Infantil', 'LIMA/9/M']);
  assert.deepStrictEqual(r.erros, [{ linha: 5, motivo: 'tamanho ausente' }]);
});

teste('limite de 200 atletas', () => {
  const muitos = Array.from({ length: 201 }, (_, i) => 'A; ' + (i % 999) + '; M').join('\n');
  const r = A.lerColado(muitos);
  assert.strictEqual(r.atletas.length, 200);
  assert.ok(r.erros.some((e) => /limite de 200 atletas/.test(e.motivo)));
  assert.strictEqual(A.LIMITE, 200);
});

teste('gradeDeAtletas e avisos de número repetido', () => {
  const at = [{ tamanho: 'M', numero: '10' }, { tamanho: 'M', numero: '10' }, { tamanho: 'G', numero: '7' }];
  assert.deepStrictEqual(A.gradeDeAtletas(at), { P: 0, M: 2, G: 1, GG: 0, XG: 0, Infantil: 0 });
  assert.deepStrictEqual(A.avisos(at), ['Número 10 repetido']);
});

(async () => {
  for (const [nome, fn] of testes) {
    try { await fn(); console.log('PASS: ' + nome); } catch (e) { falhas++; console.error('FAIL: ' + nome + '\n      ' + e.message); }
  }
  console.log((falhas ? 'FAIL' : 'PASS') + ': atletas, ' + (testes.length - falhas) + '/' + testes.length);
  if (falhas) process.exit(1);
})();
