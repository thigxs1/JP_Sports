/* JP SPORT — motion e comportamentos compartilhados entre as telas */
(function () {
  const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Linhas de quadra por modalidade (SVG, viewBox 0 0 400 240) */
  const QUADRAS = {
    futebol: '<rect x="8" y="8" width="384" height="224"/><line x1="200" y1="8" x2="200" y2="232"/><circle cx="200" cy="120" r="36"/><rect x="8" y="62" width="54" height="116"/><rect x="338" y="62" width="54" height="116"/><rect x="8" y="94" width="20" height="52"/><rect x="372" y="94" width="20" height="52"/>',
    basquete: '<rect x="8" y="8" width="384" height="224"/><line x1="200" y1="8" x2="200" y2="232"/><circle cx="200" cy="120" r="30"/><rect x="8" y="88" width="76" height="64"/><rect x="316" y="88" width="76" height="64"/><path d="M8 28 H40 A92 92 0 0 1 40 212 H8"/><path d="M392 28 H360 A92 92 0 0 0 360 212 H392"/>',
    volei: '<rect x="40" y="20" width="320" height="200"/><line x1="200" y1="10" x2="200" y2="230"/><line x1="146" y1="20" x2="146" y2="220"/><line x1="254" y1="20" x2="254" y2="220"/>',
    society: '<rect x="8" y="8" width="384" height="224"/><line x1="200" y1="8" x2="200" y2="232"/><circle cx="200" cy="120" r="28"/><path d="M8 70 A52 52 0 0 1 8 170"/><path d="M392 70 A52 52 0 0 0 392 170"/>'
  };
  document.querySelectorAll("[data-quadra]").forEach((el) => {
    const tipo = el.getAttribute("data-quadra") || "futebol";
    el.classList.add("quadra");
    el.innerHTML = `<svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice">${QUADRAS[tipo] || QUADRAS.futebol}</svg>`;
  });

  /* Títulos: cada linha (separada por <br>) ganha máscara de entrada */
  document.querySelectorAll("[data-titulo]").forEach((h) => {
    const linhas = h.innerHTML.split(/<br\s*\/?>/i);
    h.innerHTML = linhas
      .map((l, i) => `<span class="linha-mascara"><span style="transition-delay:${0.08 + i * 0.11}s">${l.trim()}</span></span>`)
      .join("");
    h.setAttribute("data-reveal-titulo", "");
  });

  /* Reveal no scroll */
  const alvos = document.querySelectorAll("[data-reveal], [data-reveal-titulo], .mira");
  if (reduz || !("IntersectionObserver" in window)) {
    alvos.forEach((el) => el.classList.add("em-cena"));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const atraso = parseFloat(e.target.dataset.atraso || "0");
          setTimeout(() => e.target.classList.add("em-cena"), atraso * 1000);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
    alvos.forEach((el) => io.observe(el));
  }

  /* Contadores (placar) */
  document.querySelectorAll("[data-conta]").forEach((el) => {
    const fim = parseFloat(el.dataset.conta);
    const casas = (el.dataset.conta.split(".")[1] || "").length;
    const rodar = () => {
      if (reduz) { el.textContent = fim.toFixed(casas); return; }
      const t0 = performance.now(), dur = 1600;
      const passo = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - p, 4);
        el.textContent = (fim * e).toFixed(casas);
        if (p < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    };
    const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { rodar(); io.disconnect(); } }, { threshold: 0.6 });
    io.observe(el);
  });

  /* Header sólido ao rolar + barra de progresso */
  const header = document.querySelector(".jp-header");
  const barra = document.querySelector(".progresso");
  const onScroll = () => {
    const y = window.scrollY;
    if (header && !header.classList.contains("fixo-solido")) header.classList.toggle("solido", y > 40);
    if (barra) {
      const max = document.documentElement.scrollHeight - innerHeight;
      barra.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    }
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Menu mobile */
  const toggle = document.querySelector(".menu-toggle");
  if (toggle) toggle.addEventListener("click", () => document.querySelector(".jp-nav").classList.toggle("aberta"));

  /* Parallax leve em elementos [data-parallax] */
  const para = document.querySelectorAll("[data-parallax]");
  if (para.length && !reduz) {
    const loop = () => {
      para.forEach((el) => {
        const r = el.getBoundingClientRect();
        const f = parseFloat(el.dataset.parallax);
        const centro = r.top + r.height / 2 - innerHeight / 2;
        el.style.transform = `translate3d(0, ${(-centro * f).toFixed(1)}px, 0)`;
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* Botões magnéticos */
  if (!reduz && matchMedia("(pointer:fine)").matches) {
    document.querySelectorAll("[data-magnetico]").forEach((b) => {
      b.addEventListener("mousemove", (e) => {
        const r = b.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        b.style.transform = `translate(${dx * 0.18}px, ${dy * 0.28}px)`;
      });
      b.addEventListener("mouseleave", () => { b.style.transform = ""; });
    });
  }

  /* Cortina de transição entre telas */
  const cortina = document.querySelector(".cortina");
  if (cortina) {
    requestAnimationFrame(() => setTimeout(() => cortina.classList.add("aberta"), 120));
    document.querySelectorAll('a[href$=".html"], a[href*=".html?"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        if (reduz || e.metaKey || e.ctrlKey || a.target === "_blank") return;
        e.preventDefault();
        cortina.classList.remove("aberta");
        cortina.classList.add("fechando");
        setTimeout(() => { location.href = a.href; }, 650);
      });
    });
    addEventListener("pageshow", (e) => { if (e.persisted) { cortina.classList.remove("fechando"); cortina.classList.add("aberta"); } });
  }

  /* Ano no rodapé */
  document.querySelectorAll("[data-ano]").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* Config comercial (editar aqui) */
  window.JP_CONFIG = {
    whatsapp: "5500000000000", // TODO: número oficial com DDI+DDD, só dígitos
    precos: { futebol: 89.9, basquete: 84.9, volei: 79.9, calcao: 49.9, meiao: 24.9 }
  };
})();
