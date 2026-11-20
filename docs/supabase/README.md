# Banco de dados (Supabase) · JP Sport

O site grava cada pedido do formulário de Orçamento (`app/orcamento.html`) na tabela
`orcamentos` do Supabase. Se o banco estiver fora do ar ou mal configurado, o pedido
continua saindo pelo WhatsApp; o erro aparece só no console do navegador (`[JP_DB]`).

## 1. Criar a tabela
1. Abra o projeto no painel do Supabase.
2. Vá em **SQL Editor › New query**.
3. Cole todo o conteúdo de [`schema.sql`](schema.sql) e clique em **Run**.

Isso cria:
- a tabela `public.orcamentos` (time, cidade, responsável, modalidade, kit, grade de
  tamanhos em JSON, total de peças, estimativa, prazo, observações e o projeto 3D);
- RLS ligado, com uma única política: o papel `anon` (a chave publishable usada no
  site) **só pode inserir**. Ninguém lê os pedidos pelo navegador.

O script pode ser rodado de novo sem erro (`if not exists` / `drop policy if exists`).

## 2. Conectar o site ao projeto
Edite [`app/assets/supabase-config.js`](../../app/assets/supabase-config.js):

```js
window.SUPABASE_URL = "https://<ref-do-projeto>.supabase.co"; // Project Settings › API › Project URL
window.SUPABASE_KEY = "sb_publishable_...";                  // Project Settings › API Keys › Publishable key
```

> **Pendente:** a URL atual veio do Projeto 01 e **não** pertence ao projeto da chave
> `sb_publishable_iktc...` (o Supabase responde `401 Invalid API key`). Troque a URL pela
> do projeto novo antes do deploy.

Use apenas a chave **publishable**. Nunca coloque a `service_role` / secret key no front-end.

## 3. Testar
1. `npm start` e abra `http://localhost:3000/orcamento.html` (ou o deploy da Vercel).
2. Preencha nome do time, seu nome e ao menos um tamanho; clique em **Pedir orçamento**.
3. No Supabase, em **Table Editor › orcamentos**, a linha nova deve aparecer.
4. Se não aparecer, abra o console do navegador e procure mensagens `[JP_DB]`:
   - `Invalid API key`: URL e chave são de projetos diferentes.
   - `relation "public.orcamentos" does not exist`: o `schema.sql` não foi rodado.
   - `new row violates row-level security policy`: a política de insert não foi criada.

## 4. Deploy (Vercel)
O `vercel.json` publica `app/` como site estático (sem build). A configuração do
Supabase vai junto no `supabase-config.js`; não é preciso variável de ambiente na Vercel.
