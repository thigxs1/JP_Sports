/* Importa um molde do Audaces exportado em PLT (HPGL) para app/moldes/<modelo>/<tamanho>.json.
   Uso: node scripts/importar_molde_plt.js "<arquivo.plt>" <modelo> <tamanho> [versao]
   HPGL: 40 unidades = 1 mm. No JSON, x é a largura da peça e y vai do topo
   (decote / cabeça da manga) até a barra, em mm. */
const fs = require('fs');
const path = require('path');

const UNIDADES_POR_MM = 40;
const RIBANA_ALTURA_MM = 55;

function polilinhas(texto) {
  const lista = [];
  let atual = null;
  texto.split(';').forEach((c) => {
    const m = /^\s*(PU|PD)(-?\d+),(-?\d+)/.exec(c);
    if (!m) return;
    const p = [Number(m[2]), Number(m[3])];
    if (m[1] === 'PU' || !atual) { atual = [p]; lista.push(atual); } else atual.push(p);
  });
  return lista;
}

const igual = (a, b) => a[0] === b[0] && a[1] === b[1];
function caixa(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
function area(pts) {
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) s += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  return Math.abs(s / 2);
}
const dentro = (p, c) => p[0] >= c.x0 && p[0] <= c.x1 && p[1] >= c.y0 && p[1] <= c.y1;

/* Contorno = polilinha que volta ao primeiro vértice; o que vem depois é pique. */
function separar(lista) {
  const contornos = [], segmentos = [];
  lista.forEach((pl) => {
    const k = pl.findIndex((p, i) => i > 2 && igual(p, pl[0]));
    if (k < 0) { segmentos.push(pl); return; }
    contornos.push(pl.slice(0, k + 1));
    if (k < pl.length - 1) segmentos.push(pl.slice(k));
  });
  return { contornos, segmentos };
}

/* Menor y em que o contorno cruza a vertical x = cx (referencial da peça). */
function topoNaVertical(contorno, cx) {
  let melhor = Infinity;
  for (let i = 0; i < contorno.length - 1; i++) {
    const [ax, ay] = contorno[i], [bx, by] = contorno[i + 1];
    if ((ax - cx) * (bx - cx) > 0 || ax === bx) {
      if (ax === cx) melhor = Math.min(melhor, ay);
      continue;
    }
    const t = (cx - ax) / (bx - ax);
    melhor = Math.min(melhor, ay + t * (by - ay));
  }
  return melhor;
}

function importarPLT(texto, meta) {
  const { contornos, segmentos } = separar(polilinhas(texto));
  // letras dos rótulos também fecham laços: peça tem os dois lados > 20 mm
  const comCaixa = contornos.map((pts) => ({ pts, c: caixa(pts), a: area(pts) }))
    .filter((o) => Math.min(o.c.x1 - o.c.x0, o.c.y1 - o.c.y0) > 20 * UNIDADES_POR_MM);
  comCaixa.sort((a, b) => b.a - a.a);
  const moldura = comCaixa.find((o) => o.pts.length === 5);
  const pecasBrutas = comCaixa.filter((o) => o !== moldura);
  const curto = (o) => Math.min(o.c.x1 - o.c.x0, o.c.y1 - o.c.y0) / UNIDADES_POR_MM;
  const ribana = pecasBrutas.find((o) => o.pts.length === 5 && Math.abs(curto(o) - RIBANA_ALTURA_MM) < 2);
  const outras = pecasBrutas.filter((o) => o !== ribana);
  if (!ribana || outras.length !== 4) throw new Error('PLT inesperado: ' + outras.length + ' peças além da ribana');
  const corpos = outras.slice(0, 2), mangas = outras.slice(2).sort((a, b) => a.c.y0 - b.c.y0);

  const vertices = new Set();
  outras.concat([ribana]).forEach((o) => o.pts.forEach((p) => vertices.add(p.join(','))));

  function converter(o, id, nome, centroPorFio) {
    const { x0, y0 } = o.c;
    const loc = ([px, py]) => [+((py - y0) / UNIDADES_POR_MM).toFixed(2), +((px - x0) / UNIDADES_POR_MM).toFixed(2)];
    const contorno = o.pts.map(loc);
    const largura = +((o.c.y1 - o.c.y0) / UNIDADES_POR_MM).toFixed(2);
    const altura = +((o.c.x1 - o.c.x0) / UNIDADES_POR_MM).toFixed(2);
    const doPeca = segmentos.filter((s) => s.length === 2 && s.every((p) => dentro(p, o.c)));
    // linha de fio: o único segmento solto e longo (> 30 mm) dentro da peça
    const fioBruto = doPeca.find((s) => Math.hypot(s[0][0] - s[1][0], s[0][1] - s[1][1]) > 30 * UNIDADES_POR_MM);
    const piques = segmentos.filter((s) => s.length === 2 && s.some((p) => vertices.has(p.join(',')) && dentro(p, o.c)))
      .map((s) => s.map(loc));
    const fio = fioBruto ? fioBruto.map(loc) : [];
    const centro = centroPorFio && fio.length ? fio[0][0] : +(largura / 2).toFixed(2);
    const topo = topoNaVertical(contorno, centro);
    return {
      id, nome, largura, altura, contorno, fio, piques,
      pontos: { centro, decote: [centro, +(isFinite(topo) ? topo : 0).toFixed(2)], barra: altura }
    };
  }

  // a frente tem o decote mais fundo que as costas
  const [a, b] = corpos.map((o) => converter(o, '', '', true));
  const frenteEhA = a.pontos.decote[1] > b.pontos.decote[1];
  const frente = converter(frenteEhA ? corpos[0] : corpos[1], 'frente', 'Frente', true);
  const costas = converter(frenteEhA ? corpos[1] : corpos[0], 'costas', 'Costas', true);

  return {
    modelo: meta.modelo, tamanho: meta.tamanho, versao: meta.versao || 'audaces-2026-11', unidade: 'mm',
    pecas: [
      frente, costas,
      converter(mangas[0], 'manga-esquerda', 'Manga esquerda', false),
      converter(mangas[1], 'manga-direita', 'Manga direita', false),
      converter(ribana, 'ribana', 'Ribana da gola', false)
    ]
  };
}

module.exports = { importarPLT, UNIDADES_POR_MM };

if (require.main === module) {
  const [arquivo, modelo, tamanho, versao] = process.argv.slice(2);
  if (!arquivo || !modelo || !tamanho) {
    console.error('Uso: node scripts/importar_molde_plt.js "<arquivo.plt>" <modelo> <tamanho> [versao]');
    process.exit(1);
  }
  const molde = importarPLT(fs.readFileSync(arquivo, 'utf8'), { modelo, tamanho, versao });
  const destino = path.join(__dirname, '..', 'app', 'moldes', modelo, tamanho + '.json');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, JSON.stringify(molde) + '\n');
  console.log('Gravado ' + destino + ': ' + molde.pecas.map((p) => `${p.id} ${p.largura}x${p.altura}`).join(', '));
}
