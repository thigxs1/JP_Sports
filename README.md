# JP Sport

Site e simulador 3D de uniformes esportivos da **JP Sport** (linha esportiva da JP Produção Têxtil).
*Da indústria para o campo.*

## Telas
| Tela | Arquivo |
|---|---|
| Início | `app/index.html` |
| Coleção 26 | `app/colecao.html` |
| Simulador 3D (futebol · basquete · vôlei) | `app/simulador.html` |
| Orçamento (WhatsApp) | `app/orcamento.html` |

Design system: `app/assets/jp-sport.css` + `app/assets/jp-sport.js` (segue o Brandbook v1.0).

## Rodar localmente
Requer [Node.js](https://nodejs.org) 18+.

```bash
npm start            # http://localhost:3000  (PORT=xxxx para outra porta)
npm test             # verificações dos assets e da integração
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
