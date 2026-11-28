/* Prova do PDF: escala 1:1 em mm, fontes incorporadas, recorte e transparência
   via doc.context2d do jsPDF (o mesmo caminho que o pacote de impressão usa). */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { jsPDF } = require('jspdf');

const RAIZ = path.join(__dirname, '..');
const fontes = require(path.join(RAIZ, 'app', 'js', 'pdf-fontes.js'));
const carregarTTF = async (arquivo) => fs.readFileSync(path.join(RAIZ, 'app', 'assets', 'fontes', arquivo)).toString('base64');
const MM = 72 / 25.4;
let falhas = 0;
const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);

async function pdfDeProva() {
  const doc = new jsPDF({ unit: 'mm', format: [1600, 1000], orientation: 'landscape', compress: false });
  await fontes.registrarFontes(doc, carregarTTF);
  const ctx = doc.context2d;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(50, 50); ctx.lineTo(650, 50); ctx.lineTo(650, 850); ctx.lineTo(50, 850); ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#0F1F3D';
  ctx.fillRect(0, 0, 800, 900);
  const alfa = fontes.alfaPDF(doc);
  alfa(0.5);
  ctx.fillStyle = '#2F5BFF';
  ctx.fillRect(100, 100, 200, 200);
  alfa(1);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = fontes.fontePDF('Montserrat', '900', 40);
  ctx.fillText('JOÃO 10', 300, 500);
  ctx.restore();
  fontes.quadradoControle(doc, 1450, 850);
  return { doc, texto: doc.output() };
}

teste('página 1600 × 1000 mm (MediaBox em pt)', async () => {
  const { texto } = await pdfDeProva();
  const m = /\/MediaBox \[([\d. ]+)\]/.exec(texto);
  const [, , w, h] = m[1].trim().split(/\s+/).map(Number);
  assert.ok(Math.abs(w - 1600 * MM) < 0.1 && Math.abs(h - 1000 * MM) < 0.1, `MediaBox ${w} x ${h}`);
});

teste('quadrado de controle mede 100 × 100 mm', async () => {
  const { texto } = await pdfDeProva();
  assert.ok(/ 283\.46\d* -?283\.46\d* re/.test(texto), 'retângulo de 283.46 pt');
});

teste('Montserrat incorporada como TrueType', async () => {
  const { texto } = await pdfDeProva();
  assert.ok(/\/FontFile2/.test(texto), 'FontFile2');
  assert.ok(/JPMontserratBlack/.test(texto), 'nome da fonte registrada');
  assert.ok(//Fd+ 113 Tf/.test(texto), 'texto de 40 mm = 113 pt');
});

teste('recorte e transparência', async () => {
  const { texto } = await pdfDeProva();
  assert.ok(/\bW\s+n\b/.test(texto), 'operador de clip');
  assert.ok(/\/ca 0\.5/.test(texto), 'ExtGState com opacidade 0.5');
});

teste('glifoSuportado: acentos sim, emoji não', async () => {
  const { doc } = await pdfDeProva();
  assert.strictEqual(fontes.glifoSuportado(doc, 'Montserrat', '900', 'Ã'), true);
  assert.strictEqual(fontes.glifoSuportado(doc, 'Montserrat', '900', '🔥'), false);
});

(async () => {
  for (const [nome, fn] of testes) {
    try { await fn(); console.log('PASS: ' + nome); } catch (e) { falhas++; console.error('FAIL: ' + nome + '\n      ' + e.message); }
  }
  console.log((falhas ? 'FAIL' : 'PASS') + ': PDF básico, ' + (testes.length - falhas) + '/' + testes.length);
  if (falhas) process.exit(1);
})();
