# JP Sport — Telas, modalidades e motion (aplicação do Brandbook v1.0)

## Telas (`app/`)
| Tela | Arquivo | Conteúdo |
|---|---|---|
| Home | `index.html` | Banner claro "JOGUE NO SEU NÍVEL." com camisa 3D ao vivo (`js/hero3d.js`) e mira técnica, faixa corrida, cards de modalidade (linhas de quadra + número vazado + barra que fica elétrica no hover), Tecnologia "SUOR ↓ RENDIMENTO ↑", teaser do simulador e CTA "UNIFORME PRO SEU TIME." |
| Coleção 26 | `colecao.html` | Grade de produtos 4:5 com fotos renderizadas no Blender, filtros animados, card "Uniforme pro seu time" e faixa de garantias |
| Simulador 3D | `simulador.html` (antigo `index.html`) | Abas FUTEBOL · BASQUETE · VÔLEI, tema JP (`css/simulador-jp.css`), projeto salvo em `localStorage` (`jpSportProjeto`) |
| Orçamento | `orcamento.html` | Modalidade, grade P–XG/infantil, dados do time, resumo navy com estimativa animada e envio pelo WhatsApp (`wa.me`) |

Design system: `assets/jp-sport.css` (cores, Anton/Poppins/JetBrains Mono, rótulo de seção, tags, botões retos, linhas de quadra, números vazados, faixa corrida, mira HUD) e `assets/jp-sport.js` (motion).

## Motion
Cortina navy entre telas, títulos com máscara por linha, reveal no scroll, contadores, parallax, botões magnéticos, faixa corrida, mira com pulso, barra de progresso de rolagem, cards com zoom e seta girando 45°, total do orçamento animado. Tudo é desligado com `prefers-reduced-motion`.

## Modelos 3D (Blender, `scripts/blender_refine_kit.py`)
- **Futebol:** `Camisa_Corpo` + golas (V, redonda, polo) + `Punhos` (`kit_completo.obj`).
- **Basquete:** `Regata_Corpo` (cava funda, decote aberto) + `Regata_Vies` → `modal_basquete.obj`.
- **Vôlei:** `Volei_Corpo` (manga curta) + `Volei_Vies` → `modal_volei.obj`.
Todos derivam da mesma UV da camisa, então estampa, nome, número e escudo funcionam nas três modalidades. As fotos de produto saem de `scripts/blender_render_produtos.py` → `app/assets/produtos/*.png`.

## Pendências (precisam de vocês)
1. **Vetor oficial do símbolo JP** (SVG/AI). Hoje `assets/logo-jp-provisorio.svg` é um provisório e não deve ir para peças finais.
2. **Número de WhatsApp** e **preços** reais em `assets/jp-sport.js` → `JP_CONFIG`.
3. **Fotos de atleta** (ação, banner 16:9). Os renders 3D cobrem foto de produto e detalhe, mas não foto de ação.
4. As fontes vêm do Google Fonts (precisa de internet). Para uso offline, hospedar os arquivos localmente.
