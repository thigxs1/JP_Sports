const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const ler = (arquivo) => fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
const testes = [];
const teste = (nome, fn) => testes.push({ nome, fn });

/* ---------- Arquivos e sintaxe ---------- */
['app/operacao.html', 'app/css/operacao.css', 'app/js/operacao.js', 'app/js/molde-matricial.js', 'app/js/feed-promocoes.js'].forEach((a) => {
  teste('arquivo existe: ' + a, () => assert.ok(fs.existsSync(path.join(RAIZ, a))));
});
['app/assets/supabase-config.js', 'app/js/molde-matricial.js', 'app/js/operacao.js', 'app/js/feed-promocoes.js'].forEach((a) => {
  teste('sintaxe válida: ' + a, () => { new vm.Script(ler(a), { filename: a }); });
});

/* ---------- SQL e HTML ---------- */
teste('schema.sql: status, tabelas, funções e RLS', () => {
  const sql = ler('docs/supabase/schema.sql');
  assert.match(sql, /alter table public\.orcamentos add column if not exists status /i);
  ['perfis', 'promocoes'].forEach((t) => assert.match(sql, new RegExp('create table if not exists public\\.' + t + '\\b', 'i')));
  ['is_admin_global', 'is_operacao'].forEach((f) => assert.match(sql, new RegExp('create or replace function public\\.' + f + '\\(\\)', 'i')));
  ['orcamentos', 'perfis', 'promocoes'].forEach((t) => {
    assert.match(sql, new RegExp('alter table public\\.' + t + ' enable row level security', 'i'));
    assert.match(sql, new RegExp('create policy "[^"]+" on public\\.' + t + '\\b', 'i'));
  });
  assert.match(sql, /create policy "admin gerencia perfis" on public\.perfis\s+for all to authenticated\s+using \(public\.is_admin_global\(\)\) with check \(public\.is_admin_global\(\)\)/i);
});
teste('index.html: feed de promoções e link do painel', () => {
  const html = ler('app/index.html');
  assert.match(html, /<section[^>]*\sid="promocoes"/);
  assert.match(html, /<script src="assets\/supabase-config\.js"/);
  assert.match(html, /<script src="js\/feed-promocoes\.js"/);
  assert.match(html, /href="operacao\.html"/);
});
teste('operacao.html: abas e containers', () => {
  const html = ler('app/operacao.html');
  ['pedidos', 'promocoes', 'usuarios'].forEach((a) => {
    assert.ok(html.includes('data-aba="' + a + '"'), 'botão da aba ' + a);
    assert.ok(html.includes('id="tab-' + a + '"'), 'seção da aba ' + a);
  });
  ['promocoes-conteudo', 'usuarios-conteudo'].forEach((id) => assert.ok(html.includes('id="' + id + '"'), id));
});

/* ---------- Molde ---------- */
const XSS = '<script>alert(1)</script>';
const molde = () => require('../app/js/molde-matricial.js');
function pedido(modalidade, gola) {
  return {
    id: 'local-teste', criado_em: '2026-01-02T10:00:00Z', time: 'Time ' + XSS, cidade: 'São Paulo',
    responsavel: 'Responsável ' + 'x'.repeat(120), modalidade, kit_completo: true,
    grade: { P: 2, M: 6, G: 47, GG: 2, XG: 1, Infantil: 3 }, total_pecas: 61,
    observacoes: 'Observação longa com acentuação. '.repeat(12) + '\x1B@\f\r\n' + 'y'.repeat(200),
    projeto_3d: { gola, estampa: 'rajado', numero: '10', nome: 'ÁGUIA', cores: { cor1: { nome: 'Azul', hex: '#1746d1' } } }
  };
}
function conferirColunas(texto) {
  assert.doesNotMatch(texto, /[^\x20-\x7E\r\n]/, 'só ASCII imprimível');
  const linhas = texto.split(/\r?\n/);
  assert.ok(linhas.length > 30, 'ficha completa');
  linhas.forEach((l, i) => assert.ok(l.length <= 80, 'linha ' + (i + 1) + ' tem ' + l.length + ' colunas'));
}
[['futebol', 'v'], ['basquete', 'regata'], ['volei', 'polo']].forEach(([modalidade, gola]) => {
  const rot = modalidade + '/' + gola + ': ';
  teste(rot + 'SVG técnico P&B, com grade e sem XSS', () => {
    const svg = molde().gerarDesenhoTecnicoSVG(pedido(modalidade, gola));
    ['<svg', '#ffffff', '#000000', 'FRENTE', 'COSTAS', 'GRADE DE CORTE', '>Infantil<', '>47<', '>61<'].forEach((t) => {
      assert.ok(svg.includes(t), 'SVG sem ' + t);
    });
    assert.ok(!/<script/i.test(svg), 'payload sem escape');
    assert.ok(svg.includes('&lt;script&gt;'), 'payload escapado');
  });
  [false, true].forEach((condensado) => {
    teste(rot + 'ESC/P ' + (condensado ? 'condensado' : 'normal') + ', até 80 colunas', () => {
      const prn = molde().gerarArquivoMatricialESCP(pedido(modalidade, gola), { condensado });
      assert.ok(prn.startsWith('\x1B@'), 'inicia com ESC @');
      assert.ok(prn.endsWith('\f'), 'termina com form feed');
      // remove só o cabeçalho e o FF final: comando vindo do pedido deve reprovar
      conferirColunas(prn.replace(/^\x1B@\x1B2[\x0F\x12]/, '').slice(0, -1));
    });
  });
  teste(rot + 'texto puro sem ESC, até 80 colunas', () => {
    const p = pedido(modalidade, gola);
    const textoPuro = molde().gerarTextoPuro(p);
    assert.strictEqual(textoPuro, molde().gerarArquivoMatricialESCP(p, { comComandosESCP: false }));
    assert.ok(!textoPuro.includes('\x1B'));
    conferirColunas(textoPuro);
  });
});

/* ---------- Aba Usuários: operacao.js e JP_DB reais (local), DOM mínimo ---------- */
function elemento() {
  const ouvintes = {}, classes = new Set();
  return {
    hidden: false, innerHTML: '', textContent: '', value: '', title: '', dataset: {}, disabled: false,
    classList: { toggle(c, sim) { if (sim) classes.add(c); else classes.delete(c); }, contains: (c) => classes.has(c) },
    addEventListener(tipo, fn) { (ouvintes[tipo] = ouvintes[tipo] || []).push(fn); },
    disparar(tipo, e) { (ouvintes[tipo] || []).forEach((fn) => fn(Object.assign({ preventDefault() {} }, e))); },
    querySelectorAll: () => [], setAttribute() {}, removeAttribute() {}, focus() {}, reset() {}, scrollIntoView() {}
  };
}
async function esperar() { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); }
async function painel(email, senha, preparar) {
  const ids = {}, seletores = {}, armazem = {}, doc = elemento();
  const el = (id) => ids[id] || (ids[id] = elemento());
  Object.assign(doc, {
    body: {}, getElementById: el,
    querySelector: (s) => seletores[s] || (seletores[s] = elemento()),
    dispatchEvent(e) { doc.disparar(e.type, e); }
  });
  doc.activeElement = doc.body;
  const window = { localStorage: { getItem: (k) => (k in armazem ? armazem[k] : null), setItem(k, v) { armazem[k] = String(v); } } };
  const ctx = vm.createContext({
    window, document: doc, console,
    CustomEvent: class { constructor(type, o) { this.type = type; this.detail = o.detail; } }
  });
  const carregar = (a) => vm.runInContext(ler(a), ctx, { filename: a });
  carregar('app/assets/supabase-config.js');
  ctx.JP_DB = window.JP_DB;
  carregar('app/js/molde-matricial.js');
  carregar('app/js/feed-promocoes.js');
  assert.ok((await window.JP_DB.login(email, senha)).ok);
  if (preparar) preparar(armazem);
  carregar('app/js/operacao.js');
  await esperar();
  return {
    el, db: window.JP_DB,
    async abrir() {
      seletores['.op-abas'].disparar('click', { target: { closest: () => ({ dataset: { aba: 'usuarios' } }) } });
      await esperar();
    },
    async forjarEvento() {
      doc.dispatchEvent({ type: 'jp-operacao:aba', detail: { aba: 'usuarios', perfil: { role: 'admin_global' } } });
      await esperar();
    },
    async criar(nome, mail, pass) {
      el('usuario-form-nome').value = nome;
      el('usuario-form-email').value = mail;
      el('usuario-form-senha').value = pass;
      el('form-usuario').disparar('submit');
      await esperar();
    },
    async alternar(id) {
      el('usuario-lista').disparar('click', { target: { closest: (s) => (s === '[data-usuario-id]' ? { dataset: { usuarioId: id } } : null) } });
      await esperar();
    }
  };
}
const admin = (preparar) => painel('admin@jpsport.com', 'admin123', preparar);
const local = (o) => Object.assign({ id: 'local-x', email: 'x@x.com', senha: '123456', nome: 'X', role: 'operacao', ativo: true, criado_em: '2026-01-02T10:00:00Z' }, o);

teste('usuários: admin vê formulário e listagem', async () => {
  const p = await admin();
  await p.abrir();
  const form = p.el('usuarios-conteudo').innerHTML, lista = p.el('usuario-lista').innerHTML;
  assert.match(form, /<input id="usuario-form-nome"[^>]*\brequired/);
  assert.match(form, /<input id="usuario-form-email"[^>]*type="email"[^>]*\brequired/);
  assert.match(form, /<input id="usuario-form-senha"[^>]*type="password"[^>]*\brequired[^>]*minlength="6"/);
  assert.ok(form.includes('Criar usuário de operação'));
  ['Administrador Global', 'admin@jpsport.com', 'Admin Global', 'Operador Produção', '>Operação<', '>Ativo<'].forEach((t) => {
    assert.ok(lista.includes(t), 'lista sem ' + t);
  });
  assert.match(lista, /\d{2}\/\d{2}\/\d{4}/);
});
teste('usuários: próprio usuário não pode ser desativado', async () => {
  const p = await admin();
  await p.abrir();
  const lista = p.el('usuario-lista').innerHTML;
  assert.match(lista, /<button[^>]*data-usuario-id="local-admin"[^>]*\sdisabled[^>]*>[^<]*\(você\)/);
  assert.doesNotMatch(lista, /<button[^>]*data-usuario-id="local-operacao"[^>]*\sdisabled/);
  let chamadas = 0;
  p.db.alternarStatusUsuario = async () => { chamadas++; return { ok: true }; };
  await p.alternar('local-admin');
  assert.strictEqual(chamadas, 0);
});
teste('usuários: operação recebe acesso restrito ao abrir e ao forjar o evento', async () => {
  const p = await painel('operacao@jpsport.com', 'op123');
  let chamadas = 0;
  p.db.listarUsuarios = async () => { chamadas++; return { ok: true, dados: [], modo: 'local' }; };
  for (const tentar of [p.abrir, p.forjarEvento]) {
    p.el('usuarios-conteudo').innerHTML = '';
    await tentar();
    assert.match(p.el('usuarios-conteudo').innerHTML, /Acesso restrito/);
    assert.doesNotMatch(p.el('usuarios-conteudo').innerHTML, /<(form|input|button|table)/);
  }
  assert.strictEqual(chamadas, 0);
});
teste('usuários: criação grava perfil operacao e recarrega a lista', async () => {
  const p = await admin();
  await p.abrir();
  await p.criar(' Maria ', 'Maria@Ex.com', ' abc12');
  const criado = (await p.db.listarUsuarios()).dados.find((u) => u.email === 'maria@ex.com');
  assert.ok(criado && criado.nome === 'Maria' && criado.role === 'operacao');
  assert.ok(p.el('usuario-lista').innerHTML.includes('maria@ex.com'));
  assert.ok(!p.el('usuario-aviso').classList.contains('op-erro'));
  assert.ok((await p.db.login('maria@ex.com', ' abc12')).ok, 'senha não é alterada');
});
teste('usuários: validação impede nome vazio, e-mail vazio e senha curta', async () => {
  const p = await admin();
  await p.abrir();
  let chamadas = 0;
  p.db.criarUsuarioOperacao = async () => { chamadas++; return { ok: true }; };
  for (const dados of [['  ', 'a@a.com', '123456'], ['A', ' ', '123456'], ['A', 'a@a.com', '12345']]) {
    p.el('usuario-aviso').textContent = '';
    await p.criar(...dados);
    assert.ok(p.el('usuario-aviso').textContent);
    assert.ok(p.el('usuario-aviso').classList.contains('op-erro'));
  }
  assert.strictEqual(chamadas, 0);
});
teste('usuários: erro do cadastro aparece na tela', async () => {
  const p = await admin();
  await p.abrir();
  await p.criar('Outro', 'operacao@jpsport.com', '123456');
  assert.match(p.el('usuario-aviso').textContent, /E-mail já cadastrado/);
  assert.ok(p.el('usuario-aviso').classList.contains('op-erro'));
});
teste('usuários: fallback local avisa que ficou só no navegador', async () => {
  const p = await admin();
  await p.abrir();
  p.db.criarUsuarioOperacao = async () => ({ ok: true, usuario: local({}), erro: 'signup desabilitado', modo: 'local' });
  await p.criar('X', 'x@x.com', '123456');
  assert.match(p.el('usuario-aviso').textContent, /apenas localmente neste navegador/);
  assert.match(p.el('usuario-aviso').textContent, /signup desabilitado/);
  assert.ok(p.el('usuario-aviso').classList.contains('op-erro'));
});
teste('usuários: desativar e reativar atualizam a lista', async () => {
  const p = await admin();
  await p.abrir();
  for (const [status, botao] of [['Inativo', 'Ativar'], ['Ativo', 'Desativar']]) {
    await p.alternar('local-operacao');
    const tr = p.el('usuario-lista').innerHTML.split('<tr').find((l) => l.includes('operacao@jpsport.com'));
    assert.ok(tr.includes('>' + status + '<') && tr.includes('>' + botao + '<'), status);
  }
});
teste('usuários: erro ao alternar status aparece na tela', async () => {
  const p = await admin();
  await p.abrir();
  p.db.alternarStatusUsuario = async () => ({ ok: false, erro: 'sem permissão' });
  await p.alternar('local-operacao');
  assert.match(p.el('usuario-lista-aviso').textContent, /sem permissão/);
});
teste('usuários: IDs e textos são escapados', async () => {
  const p = await admin((armazem) => {
    const dados = JSON.parse(armazem.jpDbUsuarios);
    dados.push(local({ id: 'local-"><img src=x>', nome: XSS, email: '"><b>@x.com' }));
    armazem.jpDbUsuarios = JSON.stringify(dados);
  });
  await p.abrir();
  const lista = p.el('usuario-lista').innerHTML;
  assert.ok(lista.includes('&lt;script&gt;'));
  assert.ok(lista.includes('data-usuario-id="local-&quot;&gt;&lt;img src=x&gt;"'));
  assert.doesNotMatch(lista, /<script|<img|<b>/);
});
teste('usuários: sair limpa a aba e descarta listagem em trânsito', async () => {
  const p = await admin();
  let responder;
  p.db.listarUsuarios = () => new Promise((r) => { responder = r; });
  await p.abrir();
  assert.ok(responder, 'listagem não foi pedida');
  p.el('btn-sair').disparar('click');
  await esperar();
  assert.strictEqual(p.el('usuarios-conteudo').innerHTML, '');
  responder({ ok: true, dados: [local({ nome: 'Vazou' })], modo: 'local' });
  await esperar();
  assert.ok(!p.el('usuario-lista').innerHTML.includes('Vazou'));
});

(async () => {
  let falhas = 0;
  for (const t of testes) {
    try {
      await t.fn();
      console.log('PASS: ' + t.nome);
    } catch (e) {
      falhas++;
      console.error('FAIL: ' + t.nome + '\n      ' + ((e && e.stack) || e));
    }
  }
  console.log((falhas ? 'FAIL' : 'PASS') + ': operação, ' + (testes.length - falhas) + '/' + testes.length + ' verificações.');
  if (falhas) process.exit(1);
})();
