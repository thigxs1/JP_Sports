/* Supabase · configuração pública do front-end.
   A chave "publishable" é feita para ficar no navegador; a segurança vem das
   políticas RLS do banco (ver docs/supabase/schema.sql).
   CONFIRMAR: a URL abaixo veio do Projeto 01. Se o banco novo for outro projeto,
   troque pela URL em Supabase › Project Settings › API. */
window.SUPABASE_URL = "https://sskzuaftgqqhhpctqzid.supabase.co";
window.SUPABASE_KEY = "sb_publishable_iktcQtEK7g78zerhDwiGEQ_3R9zfkb0";

window.JP_DB = (function () {
  var cliente = null;
  function sb() {
    if (cliente) return cliente;
    try {
      if (window.supabase && window.SUPABASE_URL && window.SUPABASE_KEY) {
        cliente = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
      }
    } catch (e) { console.warn("[JP_DB] Supabase indisponível:", e); }
    return cliente;
  }
  /* Grava um registro; nunca lança erro (o site segue funcionando sem o banco). */
  async function salvar(tabela, dados) {
    var c = sb();
    if (!c) return { ok: false, erro: "sem cliente" };
    try {
      var r = await c.from(tabela).insert(dados);
      if (r.error) { console.warn("[JP_DB]", tabela, r.error.message); return { ok: false, erro: r.error.message }; }
      return { ok: true };
    } catch (e) { console.warn("[JP_DB]", e); return { ok: false, erro: String(e) }; }
  }
  return { cliente: sb, salvar: salvar };
})();
