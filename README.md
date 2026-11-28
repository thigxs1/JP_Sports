# JP Sport

Site e simulador 3D de uniformes esportivos da **JP Sport** (linha esportiva da JP Produção Têxtil).
*Da indústria para o campo.*

## Telas
| Tela | Arquivo |
|---|---|
| Início | `app/index.html` |
| Coleção 26 | `app/colecao.html` |
| Simulador 3D (futebol · basquete · vôlei) | `app/simulador.html` |
| Orçamento (WhatsApp + Supabase) | `app/orcamento.html` |
| Playbook da marca (referência, Projeto 01) | `app/referencia.html` |

Design system: `app/assets/jp-sport.css` + `app/assets/jp-sport.js` (segue o Brandbook v1.0).

## Ícones de modalidade
`app/assets/icones-modalidades.js` desenha o ícone de cada modalidade (futebol, basquete, vôlei, kit) em qualquer `<span data-icone="futebol"></span>`. Usado na Home, Coleção, Simulador, Orçamento e Playbook.

## Supabase
- Config pública: `app/assets/supabase-config.js` (URL + chave publishable).
- Tabelas e políticas RLS: `docs/supabase/schema.sql` (rodar no SQL Editor).
- Passo a passo completo: `docs/supabase/README.md`.
- O formulário de orçamento grava em `orcamentos`; se o banco falhar, o WhatsApp segue funcionando.

## Deploy (Vercel)
Importe o repositório na Vercel. O `vercel.json` publica a pasta `app/` como site estático, sem build.

## Rodar localmente
Requer [Node.js](https://nodejs.org) 18+.

```bash
npm install          # só para os testes (jsPDF e JSZip)
npm start            # http://localhost:3000  (PORT=xxxx para outra porta)
npm test             # todas as verificações (tests/verify_*.js)
```

Para abrir sem servidor (`file://`), gere o pacote embutido antes:
```bash
npm run build:embed
```

## Modelos 3D (Blender)
Os modelos são gerados por script no Blender 5.x com o add-on **Blender MCP** ativo na porta `9876`:
```bash
npm run blender:kit     # gera app/models/*.obj e kit_completo.blend
npm run blender:fotos   # renderiza app/assets/produtos/*.png
```
- `scripts/blender_refine_kit.py` — camisa, golas (V, redonda, polo), calção, meião, regata de basquete, camisa de vôlei.
- `scripts/blender_render_produtos.py` — fotos de produto 4:5.

## Pacote de impressão (sublimação)
No painel (`app/operacao.html`), cada pedido de futebol com gola careca tem **Baixar pacote de impressão**: um `.zip` com
ficha técnica (`.txt`/`.prn`), um PDF 1:1 por tamanho, um PDF unificado encaixado na largura útil da plotter, o manifesto JSON
e uma prévia PNG. Cada atleta da lista do orçamento gera um jogo de peças com o próprio nome e número.

- Moldes do Audaces em `app/moldes/<modelo>/<tamanho>.json` (os `.plt` originais ficam em `fonte/`). Para um molde novo:
  ```bash
  npm run molde:importar -- "CAMISETA BASICA GG.plt" camiseta-basica GG
  ```
  e acrescente o tamanho (ou o modelo) em `app/moldes/index.json`.
- Arte por peça em mm: `app/js/arte-pecas.js` (o mesmo código pinta o 3D e o PDF). Layout padrão em cm, a partir do decote.
- Calibração molde → textura do 3D: `app/moldes/camiseta-basica/calibracao.json` (pontos tirados com `node scripts/uv_ilhas.js Camisa_Corpo --pontos`).
- Perfil da plotter (largura útil, margens, sangria, espelhamento): editado no painel e salvo no navegador.
- Fontes do PDF: `app/assets/fontes/` (TTF, licença OFL). jsPDF e JSZip vêm por CDN; `npm install` instala as mesmas versões para os testes.
- Só existe o molde da camiseta básica (P, M, G). Gola V/polo, basquete, vôlei, calção, meião e os tamanhos GG, XG e Infantil
  aparecem como "molde não cadastrado".

## Configuração comercial
`app/assets/jp-sport.js` → `JP_CONFIG` (número de WhatsApp e preços).

## Documentação
- `docs/superpowers/specs/` — especificações (telas, modalidades, kit 3D)
- `docs/superpowers/audits/` — auditoria de realismo
- `docs/superpowers/plans/` — planos de implementação

## Pendências
- Vetor oficial do símbolo JP (hoje `app/assets/logo-jp-provisorio.svg`, provisório).
- Número de WhatsApp e tabela de preços reais.
- Fotos de atleta (ação) para banners.
- Malha base da camisa: deriva de um modelo de referência de terceiros; substituir por modelagem própria antes do uso comercial (ver auditoria).

## Fluxo de co-desenvolvimento
1. Crie uma branch a partir de `main`: `git checkout -b feat/minha-mudanca`
2. Rode `npm test` antes de abrir o PR.
3. Abra um Pull Request para `main`.
