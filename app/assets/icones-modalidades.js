/* Ícones das modalidades JP Sport (origem: Projeto 01 / Playbook).
   Uso: <span data-icone="futebol|basquete|volei|kit"></span>
   Cada instância recebe IDs únicos de gradiente para não colidir na página. */
(function () {
  var n = 0;
  var GRAD = function (id) {
    return '<radialGradient id="' + id + '" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#e3e7ef"/><stop offset="1" stop-color="#9aa6bd"/></radialGradient>';
  };
  var ICONES = {
    futebol: function (u) {
      return '<svg viewBox="0 0 200 200" aria-hidden="true"><defs>' + GRAD("g" + u) + '<clipPath id="c' + u + '"><circle cx="100" cy="100" r="92"/></clipPath></defs><circle cx="100" cy="100" r="92" fill="url(#g' + u + ')"/><g clip-path="url(#c' + u + ')" fill="#0F1F3D" stroke="#0F1F3D" stroke-width="3" stroke-linejoin="round"><polygon points="100,68 130,90 119,125 81,125 70,90"/><polygon points="100,8 122,22 116,44 84,44 78,22"/><polygon points="165,62 188,72 192,104 172,112 152,92"/><polygon points="35,62 48,92 28,112 8,104 12,72"/><polygon points="140,162 160,158 172,182 150,200 128,186"/><polygon points="60,162 72,186 50,200 28,182 40,158"/><path fill="none" d="M100 68V44M130 90l22 2M119 125l21 37M81 125l-21 37M70 90l-22 2"/></g></svg>';
    },
    basquete: function (u) {
      return '<svg viewBox="0 0 200 200" aria-hidden="true"><defs>' + GRAD("g" + u) + '</defs><circle cx="100" cy="100" r="92" fill="url(#g' + u + ')"/><g fill="none" stroke="#0F1F3D" stroke-width="4" stroke-linecap="round"><path d="M100 8v184M8 100h184M36 34c26 24 26 108 0 132M164 34c-26 24-26 108 0 132"/></g></svg>';
    },
    volei: function (u) {
      return '<svg viewBox="0 0 200 200" aria-hidden="true"><defs>' + GRAD("g" + u) + '<clipPath id="c' + u + '"><circle cx="100" cy="100" r="92"/></clipPath></defs><circle cx="100" cy="100" r="92" fill="url(#g' + u + ')"/><g clip-path="url(#c' + u + ')"><path d="M100 100C70 70 60 30 80 0h50c-20 30-15 70-30 100Z" fill="#2F5BFF"/><path d="M100 100c40-8 80 10 100 40v50c-25-40-60-70-100-90Z" fill="#0F1F3D"/><path d="M100 100c-5 40-40 75-80 90L0 160c40-10 85-30 100-60Z" fill="#2F5BFF"/><g fill="none" stroke="#0F1F3D" stroke-width="3.5" stroke-linecap="round"><path d="M100 100C70 70 60 30 80 0M100 100c40-8 80 10 100 40M100 100c-5 40-40 75-80 90M30 40c20 30 20 70-10 110M190 70c-30-10-60-10-75-30M110 192c10-32 40-47 75-42"/></g></g></svg>';
    },
    // Kit completo: camisa estilizada
    kit: function (u) {
      return '<svg viewBox="0 0 200 200" aria-hidden="true"><defs>' + GRAD("g" + u) + '</defs><circle cx="100" cy="100" r="92" fill="url(#g' + u + ')"/><path d="M72 46l-34 20 12 30 16-8v66h68V88l16 8 12-30-34-20c-4 12-16 20-28 20s-24-8-28-20Z" fill="#0F1F3D" stroke="#0F1F3D" stroke-width="3" stroke-linejoin="round"/><path d="M66 120h68" stroke="#2F5BFF" stroke-width="8"/></svg>';
    }
  };
  function aplicar(raiz) {
    (raiz || document).querySelectorAll("[data-icone]").forEach(function (el) {
      var f = ICONES[el.getAttribute("data-icone")];
      if (f && !el.firstElementChild) { el.innerHTML = f("ic" + (++n)); el.classList.add("icone-mod"); }
    });
  }
  window.JP_ICONES = { aplicar: aplicar, lista: Object.keys(ICONES) };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { aplicar(); });
  else aplicar();
})();
