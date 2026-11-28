/* Lista as ilhas de UV de um objeto do kit_completo.obj, em px da textura 2048
   (y para baixo, como no canvas; o Three.js usa flipY). Serve para calibrar
   app/moldes/<modelo>/calibracao.json.
   Uso: node scripts/uv_ilhas.js [Objeto=Camisa_Corpo] [--pontos] */
const fs = require('fs');
const path = require('path');

const alvo = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'Camisa_Corpo';
const comPontos = process.argv.includes('--pontos');
const TEX = 2048;
const linhas = fs.readFileSync(path.join(__dirname, '..', 'app', 'models', 'kit_completo.obj'), 'utf8').split(/\r?\n/);

const vt = [], v = [];
let atual = null;
const faces = [];
for (const l of linhas) {
  if (l.startsWith('vt ')) { const [, a, b] = l.split(/\s+/); vt.push([Number(a) * TEX, (1 - Number(b)) * TEX]); }
  else if (l.startsWith('v ')) { const [, x, y, z] = l.split(/\s+/); v.push([+x, +y, +z]); }
  else if (/^[og] /.test(l)) atual = l.slice(2).trim();
  else if (l.startsWith('f ') && atual === alvo) {
    faces.push(l.slice(2).trim().split(/\s+/).map((t) => { const [a, b] = t.split('/'); return { v: Number(a) - 1, t: Number(b) - 1 }; }));
  }
}
// ilhas: faces ligadas por índices de UV compartilhados (union-find)
const pai = new Map();
const raiz = (x) => { while (pai.get(x) !== x) { pai.set(x, pai.get(pai.get(x))); x = pai.get(x); } return x; };
const une = (a, b) => { pai.set(raiz(a), raiz(b)); };
faces.forEach((f) => f.forEach((c) => { if (!pai.has(c.t)) pai.set(c.t, c.t); }));
faces.forEach((f) => f.slice(1).forEach((c) => une(f[0].t, c.t)));
const ilhas = new Map();
faces.forEach((f) => {
  const r = raiz(f[0].t);
  if (!ilhas.has(r)) ilhas.set(r, { faces: 0, uv: [], xyz: [] });
  const i = ilhas.get(r);
  i.faces++;
  f.forEach((c) => { i.uv.push(vt[c.t]); i.xyz.push(v[c.v]); });
});
const caixa = (pts, k) => [Math.min(...pts.map((p) => p[k])), Math.max(...pts.map((p) => p[k]))];
[...ilhas.values()].sort((a, b) => b.faces - a.faces).forEach((i, n) => {
  const [u0, u1] = caixa(i.uv, 0), [w0, w1] = caixa(i.uv, 1);
  const [x0, x1] = caixa(i.xyz, 0), [y0, y1] = caixa(i.xyz, 1), [z0, z1] = caixa(i.xyz, 2);
  console.log(`ilha ${n}: ${i.faces} faces · UV x ${u0.toFixed(0)}..${u1.toFixed(0)} y ${w0.toFixed(0)}..${w1.toFixed(0)}` +
    ` · 3D x ${x0.toFixed(2)}..${x1.toFixed(2)} y ${y0.toFixed(2)}..${y1.toFixed(2)} z ${z0.toFixed(2)}..${z1.toFixed(2)}`);
  if (comPontos) {
    // linha central (|x| < 0,02): topo e base, e as laterais na meia altura dessa linha
    const centro = i.uv.map((q, j) => [q, i.xyz[j]]).filter(([, p]) => Math.abs(p[0]) < 0.02);
    if (centro.length) {
      const topo = centro.reduce((m, c) => (c[0][1] < m[0][1] ? c : m)), base = centro.reduce((m, c) => (c[0][1] > m[0][1] ? c : m));
      const meio = (topo[0][1] + base[0][1]) / 2;
      const faixa = i.uv.filter((q) => Math.abs(q[1] - meio) < 15);
      console.log('   centro topo uv ' + topo[0].map((x) => x.toFixed(0)) + ' · centro base uv ' + base[0].map((x) => x.toFixed(0)) +
        ' · meia altura y ' + meio.toFixed(0) + ' u ' + Math.min(...faixa.map((q) => q[0])).toFixed(0) + '..' + Math.max(...faixa.map((q) => q[0])).toFixed(0));
    }
    // extremos úteis para calibrar: topo, base, esquerda e direita da ilha na textura
    const ext = (f) => i.uv.reduce((m, p, j) => (f(p, i.uv[m]) ? j : m), 0);
    [['topo', (p, q) => p[1] < q[1]], ['base', (p, q) => p[1] > q[1]], ['esq', (p, q) => p[0] < q[0]], ['dir', (p, q) => p[0] > q[0]]]
      .forEach(([nome, f]) => { const j = ext(f); console.log(`   ${nome}: uv ${i.uv[j].map((x) => x.toFixed(0))} · 3D ${i.xyz[j].map((x) => x.toFixed(3))}`); });
  }
});
