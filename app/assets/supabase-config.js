/* Supabase · configuração pública do front-end.
   A chave "publishable" é feita para ficar no navegador; a segurança vem das
   políticas RLS do banco (ver docs/supabase/schema.sql).
   Projeto: rjqzlqtgkuvyxrotejrs (mesmo do MCP em .mcp.json; chave validada). */
window.SUPABASE_URL = "https://rjqzlqtgkuvyxrotejrs.supabase.co";
window.SUPABASE_KEY = "sb_publishable_iktcQtEK7g78zerhDwiGEQ_3R9zfkb0";

/* JP_DB · camada de dados (Supabase com fallback local de protótipo).
   Retornos (tudo é assíncrono, exceto cliente(), e não lança erro):
     salvar                            -> { ok, erro?, modo?, aviso? }
     login                             -> { ok, usuario, erro, modo }
     logout                            -> { ok }
     sessaoAtual                       -> { modo, usuario: { id, email } } | null
     perfilAtual                       -> { id, email, nome, role, ativo, criado_em } | null
     listar*                           -> { ok, dados: [], erro, modo }
     atualizar/salvarPromocao/alternar -> { ok, dados, erro, modo }
     excluirPromocao                   -> { ok, dados: null, erro, modo }
     criarUsuarioOperacao              -> { ok, usuario, erro, modo }
   modo é "supabase" ou "local". O modo local é só demonstração: fica neste navegador,
   com senhas em texto puro, e não oferece segurança alguma. */
window.JP_DB = (function () {
  var STATUS = ["novo", "em_producao", "finalizado", "cancelado"];
  var CAMPOS_PERFIL = "id,email,nome,role,ativo,criado_em";
  var CAMPOS_PROMO = ["titulo", "subtitulo", "badge", "desconto_texto", "modalidade",
    "cta_texto", "cta_link", "ativa", "ordem", "valida_ate"];
  var CHAVES = {
    usuarios: "jpDbUsuarios", orcamentos: "jpDbOrcamentos",
    promocoes: "jpDbPromocoes", sessao: "jpDbSessao"
  };
  var cliente = null;
  var memoria = {}; // usada quando o localStorage está bloqueado ou cheio

  function sb() {
    if (cliente) return cliente;
    try {
      if (window.supabase && window.SUPABASE_URL && window.SUPABASE_KEY) {
        cliente = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
      }
    } catch (e) { console.warn("[JP_DB] Supabase indisponível:", e); }
    return cliente;
  }

  /* ---------- Armazenamento local ---------- */
  function ler(chave) {
    if (Object.prototype.hasOwnProperty.call(memoria, chave)) return JSON.parse(memoria[chave]);
    try { return JSON.parse(window.localStorage.getItem(chave) || "null"); } catch (e) { return null; }
  }
  function gravar(chave, valor) {
    var texto = JSON.stringify(valor);
    try {
      window.localStorage.setItem(chave, texto);
      delete memoria[chave];
    } catch (e) { memoria[chave] = texto; }
  }
  function novoId() {
    return "local-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }
  function ehIdLocal(id) { return String(id).indexOf("local-") === 0; }
  function agora() { return new Date().toISOString(); }

  function semente(nome) {
    var t = agora();
    if (nome === "usuarios") {
      return [
        { id: "local-admin", email: "admin@jpsport.com", senha: "admin123", nome: "Administrador Global", role: "admin_global", ativo: true, criado_em: t },
        { id: "local-operacao", email: "operacao@jpsport.com", senha: "op123", nome: "Operador Produção", role: "operacao", ativo: true, criado_em: t }
      ];
    }
    if (nome === "orcamentos") {
      return [
        {
          id: "local-pedido-1", criado_em: t, time: "Unidos da Vila FC", cidade: "Campinas",
          responsavel: "Responsável Exemplo 1", modalidade: "futebol", kit_completo: true,
          grade: { P: 2, M: 6, G: 6, GG: 2, XG: 0, Infantil: 0 }, total_pecas: 16,
          estimativa: null, prazo: null, observacoes: "Pedido de exemplo.", status: "novo",
          projeto_3d: {
            modalidade: "futebol", gola: "v", estampa: "rajado", numero: "10", nome: "VILA",
            cores: { cor1: { nome: "Azul", hex: "#1746d1" }, cor2: { nome: "Branco", hex: "#ffffff" }, cor3: { nome: "Preto", hex: "#111111" } }
          }
        },
        {
          id: "local-pedido-3", criado_em: t, time: "Estrela do Norte", cidade: "Goiânia",
          responsavel: "Responsável Exemplo 3", modalidade: "futebol", kit_completo: false,
          grade: { P: 0, M: 2, G: 1, GG: 0, XG: 0, Infantil: 0 }, total_pecas: 3,
          estimativa: null, prazo: null, observacoes: "Pedido de exemplo com lista de atletas.", status: "novo",
          projeto_3d: {
            modalidade: "futebol", gola: "redonda", estampa: "rajado", numero: "10", nome: "ESTRELA", fonte: "Montserrat",
            patrocinio: "JP SPORT",
            cores: { cor1: { nome: "Navy JP", hex: "#0F1F3D" }, cor2: { nome: "Elétrico JP", hex: "#2F5BFF" }, cor3: { nome: "Branco", hex: "#FFFFFF" }, cor4: { nome: "Branco", hex: "#FFFFFF" }, cor5: { nome: "Branco", hex: "#FFFFFF" } }
          },
          atletas: [
            { nome: "SILVA", numero: "7", tamanho: "M" }, { nome: "JOÃO", numero: "10", tamanho: "M" },
            { nome: "LIMA", numero: "9", tamanho: "G" }
          ]
        },
        {
          id: "local-pedido-2", criado_em: t, time: "Falcões Basquete", cidade: "Santos",
          responsavel: "Responsável Exemplo 2", modalidade: "basquete", kit_completo: false,
          grade: { P: 0, M: 4, G: 5, GG: 3, XG: 0, Infantil: 0 }, total_pecas: 12,
          estimativa: null, prazo: null, observacoes: "Pedido de exemplo.", status: "em_producao",
          projeto_3d: {
            modalidade: "basquete", gola: "regata", estampa: "gradient", numero: "23", nome: "FALCÕES",
            cores: { cor1: { nome: "Vermelho", hex: "#c8102e" }, cor2: { nome: "Branco", hex: "#ffffff" }, cor3: { nome: "Preto", hex: "#111111" } }
          }
        }
      ];
    }
    return [
      { id: "local-promo-1", titulo: "Kit completo de futebol", subtitulo: "Camisa, calção e meião para o time todo", badge: "Exemplo", desconto_texto: "10% OFF", modalidade: "futebol", cta_texto: "Aproveitar", cta_link: "orcamento.html?modalidade=futebol", ativa: true, ordem: 1, valida_ate: null, criado_em: t },
      { id: "local-promo-2", titulo: "Temporada de basquete", subtitulo: "Regatas personalizadas para sua equipe", badge: "Exemplo", desconto_texto: "15% OFF", modalidade: "basquete", cta_texto: "Aproveitar", cta_link: "orcamento.html?modalidade=basquete", ativa: true, ordem: 2, valida_ate: null, criado_em: t }
    ];
  }
  function lista(nome) {
    var dados = ler(CHAVES[nome]);
    if (!Array.isArray(dados)) {
      dados = semente(nome);
      gravar(CHAVES[nome], dados);
    }
    return dados;
  }
  function atualizarLocal(nome, id, campos) {
    var dados = lista(nome);
    var item = dados.find(function (x) { return String(x.id) === String(id); });
    if (!item) return falha("Registro não encontrado.", "local");
    Object.assign(item, campos);
    gravar(CHAVES[nome], dados);
    return sucesso(item, "local");
  }
  function publico(u) {
    return { id: u.id, email: u.email, nome: u.nome, role: u.role, ativo: u.ativo, criado_em: u.criado_em };
  }
  function perfilLocal() {
    var s = ler(CHAVES.sessao);
    var u = s && lista("usuarios").find(function (x) { return x.id === s.id && x.ativo; });
    return u ? publico(u) : null;
  }
  function maisRecentes(a, b) { return String(b.criado_em).localeCompare(String(a.criado_em)); }

  /* ---------- Resultados e acesso ao Supabase ---------- */
  function sucesso(dados, modo) { return { ok: true, dados: dados, erro: null, modo: modo }; }
  function falha(erro, modo) { return { ok: false, dados: null, erro: erro, modo: modo }; }
  function comLista(r) { r.dados = r.dados || []; return r; }
  function falhaUsuario(erro, modo) { return { ok: false, usuario: null, erro: erro, modo: modo }; }
  function normalizarEmail(email) { return String(email || "").trim().toLowerCase(); }

  /* Só rede fora do ar ou tabela ainda não criada contam como "indisponível".
     Recusas do banco (RLS, validação) são erros reais e não caem no modo local. */
  function indisponivel(r) {
    return r.status === 0 || r.error.code === "42P01" || r.error.code === "PGRST205";
  }
  async function consultar(fn) {
    try {
      var r = await fn();
      return r.error ? { error: r.error, fora: indisponivel(r) } : { data: r.data };
    } catch (e) { return { error: { message: String(e) }, fora: true }; }
  }
  async function sessaoSupabase() {
    var c = sb();
    if (!c) return null;
    try {
      var r = await c.auth.getSession();
      return (r.data && r.data.session) || null;
    } catch (e) { return null; }
  }
  function buscarPerfil(id) {
    return consultar(function () {
      return sb().from("perfis").select(CAMPOS_PERFIL).eq("id", id).maybeSingle();
    });
  }
  /* Com sessão real usa o Supabase; sem ela (ou com ele fora do ar), usa o local. */
  async function executar(remoto, local) {
    if (await sessaoSupabase()) {
      var r = await consultar(remoto);
      if (!r.error) return sucesso(r.data, "supabase");
      if (!r.fora) return falha(r.error.message, "supabase");
      console.warn("[JP_DB] Supabase indisponível, usando modo local:", r.error.message);
    }
    return local();
  }
  /* Update/delete barrado pelo RLS volta sem linhas e sem erro: trata como falha. */
  function exigirLinha(r) {
    if (r.ok && r.modo === "supabase") {
      if (!r.dados || !r.dados.length) return falha("Registro não encontrado ou sem permissão.", "supabase");
      r.dados = r.dados[0];
    }
    return r;
  }

  /* Grava um registro; nunca lança erro (o site segue funcionando sem o banco).
     Orçamentos também ficam no modo local, para aparecerem no painel do protótipo. */
  async function salvar(tabela, dados) {
    var erro = "sem cliente";
    var copiaLocal = false;
    if (tabela === "orcamentos") {
      try {
        var pedidos = lista("orcamentos");
        pedidos.unshift(Object.assign({ status: "novo" }, dados, { id: novoId(), criado_em: agora() }));
        gravar(CHAVES.orcamentos, pedidos);
        copiaLocal = true;
      } catch (e) { console.warn("[JP_DB] cópia local:", e); }
    }
    var c = sb();
    if (c) {
      var r = await consultar(function () { return c.from(tabela).insert(dados); });
      if (!r.error) return { ok: true, modo: "supabase" };
      erro = r.error.message;
      console.warn("[JP_DB]", tabela, erro);
    }
    if (copiaLocal) return { ok: true, modo: "local", aviso: erro };
    return { ok: false, erro: erro };
  }

  /* ---------- Auth ---------- */
  async function login(email, senha) {
    var e = normalizarEmail(email);
    var c = sb();
    if (c) {
      try {
        var r = await c.auth.signInWithPassword({ email: e, password: String(senha || "") });
        if (!r.error && r.data && r.data.user) {
          var p = await buscarPerfil(r.data.user.id);
          if (p.data && p.data.ativo) {
            gravar(CHAVES.sessao, null);
            return { ok: true, usuario: p.data, erro: null, modo: "supabase" };
          }
          await c.auth.signOut({ scope: "local" });
          if (!p.fora) return falhaUsuario(p.error ? p.error.message : "Usuário sem perfil ativo.", "supabase");
        }
      } catch (ex) { console.warn("[JP_DB] login:", ex); }
    }
    var u = lista("usuarios").find(function (x) { return x.email === e && x.senha === senha; });
    if (!u) return falhaUsuario("E-mail ou senha inválidos.", "local");
    if (!u.ativo) return falhaUsuario("Usuário inativo.", "local");
    // a sessão real tem precedência; encerra para não misturar os modos
    if (c) { try { await c.auth.signOut({ scope: "local" }); } catch (ex2) { /* sem rede */ } }
    gravar(CHAVES.sessao, { id: u.id });
    return { ok: true, usuario: publico(u), erro: null, modo: "local" };
  }
  async function logout() {
    gravar(CHAVES.sessao, null);
    var c = sb();
    if (c) { try { await c.auth.signOut({ scope: "local" }); } catch (e) { console.warn("[JP_DB] logout:", e); } }
    return { ok: true };
  }
  async function sessaoAtual() {
    var s = await sessaoSupabase();
    if (s) return { modo: "supabase", usuario: { id: s.user.id, email: s.user.email } };
    var p = perfilLocal();
    return p ? { modo: "local", usuario: { id: p.id, email: p.email } } : null;
  }
  async function perfilAtual() {
    var s = await sessaoSupabase();
    if (!s) return perfilLocal();
    var r = await buscarPerfil(s.user.id);
    return r.data && r.data.ativo ? r.data : null;
  }

  /* ---------- Pedidos ---------- */
  async function listarOrcamentos() {
    return comLista(await executar(function () {
      return sb().from("orcamentos").select("*").order("criado_em", { ascending: false });
    }, function () { return sucesso(lista("orcamentos").sort(maisRecentes), "local"); }));
  }
  async function atualizarStatusOrcamento(id, status) {
    if (STATUS.indexOf(status) < 0) return falha("Status inválido.", "local");
    function local() { return atualizarLocal("orcamentos", id, { status: status }); }
    if (ehIdLocal(id)) return local();
    return exigirLinha(await executar(function () {
      return sb().from("orcamentos").update({ status: status }).eq("id", id).select();
    }, local));
  }

  /* ---------- Promoções ---------- */
  async function listarPromocoes(opcoes) {
    var apenasAtivas = !!(opcoes && opcoes.apenasAtivas);
    function filtrar(dados) {
      var d = new Date();
      var hoje = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
      return dados.filter(function (p) {
        return !apenasAtivas || (p.ativa && (!p.valida_ate || p.valida_ate >= hoje));
      }).sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
    }
    // leitura pública: visitantes consultam o Supabase; quem está no login demo vê o local
    var c = sb();
    if (c && ((await sessaoSupabase()) || !perfilLocal())) {
      var r = await consultar(function () {
        var q = c.from("promocoes").select("*");
        return apenasAtivas ? q.eq("ativa", true) : q;
      });
      if (!r.error) return sucesso(filtrar(r.data || []), "supabase");
      if (!r.fora) return comLista(falha(r.error.message, "supabase"));
    }
    return sucesso(filtrar(lista("promocoes")), "local");
  }
  async function salvarPromocao(promo) {
    var campos = {};
    CAMPOS_PROMO.forEach(function (k) {
      if (promo && promo[k] !== undefined) campos[k] = promo[k];
    });
    if (campos.valida_ate === "") campos.valida_ate = null;
    var id = promo && promo.id;
    var edicao = id !== undefined && id !== null && id !== "";
    if ((!edicao || campos.titulo !== undefined) && !String(campos.titulo || "").trim()) {
      return falha("Informe o título da promoção.", "local");
    }
    function local() {
      if (edicao) return atualizarLocal("promocoes", id, campos);
      var nova = Object.assign({
        subtitulo: null, badge: null, desconto_texto: null, modalidade: null,
        cta_texto: "Aproveitar", cta_link: "orcamento.html", ativa: true, ordem: 0, valida_ate: null
      }, campos, { id: novoId(), criado_em: agora() });
      var dados = lista("promocoes");
      dados.push(nova);
      gravar(CHAVES.promocoes, dados);
      return sucesso(nova, "local");
    }
    if (edicao && ehIdLocal(id)) return local();
    return exigirLinha(await executar(function () {
      var t = sb().from("promocoes");
      return edicao ? t.update(campos).eq("id", id).select() : t.insert(campos).select();
    }, local));
  }
  async function excluirPromocao(id) {
    function local() {
      var dados = lista("promocoes");
      var resto = dados.filter(function (p) { return String(p.id) !== String(id); });
      if (resto.length === dados.length) return falha("Registro não encontrado.", "local");
      gravar(CHAVES.promocoes, resto);
      return sucesso(null, "local");
    }
    if (ehIdLocal(id)) return local();
    var r = exigirLinha(await executar(function () {
      return sb().from("promocoes").delete().eq("id", id).select();
    }, local));
    r.dados = null;
    return r;
  }

  /* ---------- Usuários ---------- */
  function semPermissaoLocal() {
    var p = perfilLocal();
    return !!p && p.role !== "admin_global";
  }
  async function listarUsuarios() {
    return comLista(await executar(function () {
      return sb().from("perfis").select(CAMPOS_PERFIL).order("criado_em");
    }, function () {
      if (semPermissaoLocal()) return falha("Apenas o administrador global pode ver usuários.", "local");
      return sucesso(lista("usuarios").map(publico), "local");
    }));
  }
  function criarUsuarioLocal(novo, aviso) {
    if (semPermissaoLocal()) return falhaUsuario("Apenas o administrador global pode criar usuários.", "local");
    var dados = lista("usuarios");
    if (dados.some(function (u) { return u.email === novo.email; })) {
      return falhaUsuario("E-mail já cadastrado.", "local");
    }
    var u = {
      id: novoId(), email: novo.email, senha: novo.senha, nome: novo.nome,
      role: "operacao", ativo: true, criado_em: agora()
    };
    dados.push(u);
    gravar(CHAVES.usuarios, dados);
    // erro preenchido com ok=true: o cadastro real falhou e só existe neste navegador
    return { ok: true, usuario: publico(u), erro: aviso || null, modo: "local" };
  }
  async function criarUsuarioOperacao(entrada) {
    var d = entrada || {};
    var novo = { nome: String(d.nome || "").trim(), email: normalizarEmail(d.email), senha: String(d.senha || "") };
    if (!novo.nome || !novo.email || !novo.senha) return falhaUsuario("Informe nome, e-mail e senha.", "local");

    var s = await sessaoSupabase();
    if (!s) return criarUsuarioLocal(novo);

    var p = await buscarPerfil(s.user.id);
    if (p.error) {
      return p.fora ? criarUsuarioLocal(novo, p.error.message) : falhaUsuario(p.error.message, "supabase");
    }
    if (!p.data || !p.data.ativo || p.data.role !== "admin_global") {
      return falhaUsuario("Apenas o administrador global pode criar usuários.", "supabase");
    }
    var erro;
    try {
      // cliente separado e sem persistência: o signUp não troca a sessão do admin
      var aux = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "jp-db-cadastro" }
      });
      var r = await aux.auth.signUp({ email: novo.email, password: novo.senha, options: { data: { nome: novo.nome } } });
      var u = r.data && r.data.user;
      if (r.error) {
        erro = r.error.message;
      } else if (!u || (u.identities && !u.identities.length)) {
        erro = "E-mail já cadastrado."; // o Supabase devolve usuário sem identidades nesse caso
      } else {
        var ins = await consultar(function () {
          return sb().from("perfis")
            .insert({ id: u.id, email: novo.email, nome: novo.nome, role: "operacao" })
            .select(CAMPOS_PERFIL).single();
        });
        if (!ins.error) return { ok: true, usuario: ins.data, erro: null, modo: "supabase" };
        erro = ins.error.message;
      }
    } catch (e) { erro = String(e); }
    console.warn("[JP_DB] cadastro no Supabase falhou, usando modo local:", erro);
    return criarUsuarioLocal(novo, erro);
  }
  async function alternarStatusUsuario(id, ativo) {
    var atual = await sessaoAtual();
    if (atual && String(atual.usuario.id) === String(id) && !ativo) {
      return falha("Você não pode desativar o próprio usuário.", atual.modo);
    }
    function local() {
      if (semPermissaoLocal()) return falha("Apenas o administrador global pode alterar usuários.", "local");
      var r = atualizarLocal("usuarios", id, { ativo: !!ativo });
      if (r.ok) r.dados = publico(r.dados);
      return r;
    }
    if (ehIdLocal(id)) return local();
    return exigirLinha(await executar(function () {
      return sb().from("perfis").update({ ativo: !!ativo }).eq("id", id).select(CAMPOS_PERFIL);
    }, local));
  }

  return {
    cliente: sb, salvar: salvar,
    login: login, logout: logout, sessaoAtual: sessaoAtual, perfilAtual: perfilAtual,
    listarOrcamentos: listarOrcamentos, atualizarStatusOrcamento: atualizarStatusOrcamento,
    listarPromocoes: listarPromocoes, salvarPromocao: salvarPromocao, excluirPromocao: excluirPromocao,
    listarUsuarios: listarUsuarios, criarUsuarioOperacao: criarUsuarioOperacao,
    alternarStatusUsuario: alternarStatusUsuario
  };
})();
