# Linguagem visual das novas referências (padel + Barcelona)

Data: 2026-11-20 · Status: aguardando aprovação

## Intenção
Aproximar o site da JP Sport da linguagem visual das duas referências novas em `referencias/`
(`6b6abf79…jpg`, site de padel; `f8506151…jpg`, site do Barcelona), **mantendo as cores da JP**.
As referências servem só como estilo: layout, tipografia, ícones e composição.

## Objetivos
1. Site escuro e de impacto: fundo navy/ink, títulos gigantes condensados com **uma palavra em destaque** no azul elétrico.
2. Ícones **minimalistas**: traço fino, uma cor (`currentColor`), sem degradê nem preenchimento.
3. Simulador ("modelagem"): a escolha de cor aparece **dentro de um ícone** (camisa de traço preenchida com a cor), no lugar dos quadrados/círculos de cor.

## Fora do escopo / o que não pode acontecer
- Não muda a paleta: navy `#0F1F3D`, ink `#0A1630`, elétrico `#2F5BFF`, off, grafite e cinza. Sem limão nem dourado.
- Não muda a lógica do simulador 3D, os preços, o WhatsApp ou o Supabase.
- Sem fotos novas de atletas. Usamos só o que existe (`hero-camisa.jpg`, `hero-uniforme.jpg`, `detalhe-tecido.jpg`, `assets/produtos/*.png` e o 3D).
- Falha: ficar tudo escuro e ilegível, ou o seletor de cor ficar mais difícil de usar que hoje.

## Abordagens consideradas
- **A. Só o CSS compartilhado:** rápido, mas fica "inspirado" e sem a força das referências.
- **B. CSS + reestruturação das seções principais (ESCOLHIDA pelo usuário):** chega à linguagem das referências; o simulador herda o estilo.
- **C. Piloto só na Home:** o site ficaria com dois estilos por um tempo.

## Decisões (do usuário)
- Abordagem B.
- Manter as cores da JP. O azul elétrico ocupa o papel do limão/dourado das referências.
- Ícones minimalistas.
- Cores da modelagem dentro de um ícone, não em blocos.

## Decisões minhas (para revisar)
- **Hero da Home:** fundo escuro em tela cheia (hoje é metade clara e metade escura). Título à esquerda "Jogue / no seu / **nível.**", com o 3D do kit à direita no lugar da foto do atleta. Embaixo, uma faixa de 3 benefícios com ícone de traço (Tecido dry · Feito por quem produz para grandes marcas · Uniforme pro seu time), como a faixa "Dubai & Oman / World class / Community" do padel.
- **Modalidades (Home):** cards escuros com borda fina, número 01–04 em elétrico no canto superior esquerdo, ícone de traço num quadradinho escuro no canto superior direito, título grande embaixo, uma linha de texto e seta → (cards do "Play the club").
- **Moldura deslocada (Barcelona):** um retângulo de linha fina em elétrico, deslocado atrás do título e da imagem, na seção do Simulador e no CTA final.
- **Coleção:** os cards de produto seguem o mesmo padrão de card da Home.
- **Seções claras:** viram escuras na Home e na Coleção. Orçamento e Playbook só herdam tokens, botões e ícones.
- **Botões:** retangulares, preenchidos em elétrico, texto em caixa alta pequena e seta →.
- **Ícones:** reescrever `app/assets/icones-modalidades.js` com SVG de traço 1.5–2px em viewBox 24, com `stroke="currentColor"`. Mesma API (`data-icone`), mais os novos ícones `dry`, `fabrica` e `time` para a faixa de benefícios.
- **Seletor de cor:** cada cor vira um ícone de camisa de traço (`currentColor` no contorno) com o corpo preenchido pela cor. Cor ativa: contorno elétrico e o nome embaixo. Implementado no CSS/JS que hoje gera `.swatch-item` (`app/css/style.css`, `app/css/simulador-jp.css`, `app/js/app.js`). A lógica de `estadoSimulador.cores` não muda.

## Deixado para quem implementa
Espaçamentos exatos, tamanhos responsivos, microanimações (mantendo as já existentes em `jp-sport.js`).

## Como verificar
`npm test` passa. Home, Coleção e Simulador abertos no navegador em desktop e mobile, sem erros no console. A troca de cor no simulador continua pintando o modelo 3D.
