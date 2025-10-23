// Amazon Sponsored tamer: normal | gray | push | hide
(function () {
  const SPONSOR_TEXTS = new Set([
    "sponsored","gesponsert","patrocinado","sponsorizzato","sponsorisé","реклама",
    "スポンサー", "스폰서", "sponsrad", "sponsoreret"
  ]);

  const MODE_DEFAULT = "gray";
  let currentMode = MODE_DEFAULT;

  // --- Utilities ---
  const debounce = (fn, ms = 120) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  const getResultsContainer = () =>
    document.querySelector("#search .s-main-slot") ||
    document.querySelector(".s-main-slot") ||
    document.querySelector("#search");

  const qCards = (container) =>
    container.querySelectorAll("div[data-component-type='s-search-result']");

  function nodeLooksSponsored(node) {
    if (!node) return false;
    const aria = node.getAttribute && node.getAttribute("aria-label");
    if (aria && SPONSOR_TEXTS.has(aria.trim().toLowerCase())) return true;
    const txt = (node.textContent || "").trim().toLowerCase();
    if (SPONSOR_TEXTS.has(txt)) return true;
    return false;
  }

  function cardIsSponsored(card) {
    // Try strong signals first
    const badgeSelectors = [
      "span[aria-label]",
      "span.s-label-popover-default",
      ".puis-sponsored-label-text",
      "[data-component-type='sp-sponsored-result']"
    ];
    for (const sel of badgeSelectors) {
      const el = card.querySelector(sel);
      if (nodeLooksSponsored(el)) return true;
    }
    // Lightweight fallback: scan early spans
    const spans = card.querySelectorAll("span");
    for (let i = 0; i < Math.min(spans.length, 12); i++) {
      if (nodeLooksSponsored(spans[i])) return true;
    }
    return false;
  }

  // --- Styling helpers ---
  function tagSponsored(card, isSponsored) {
    if (isSponsored) {
      card.dataset._sponsored = "1";
    } else {
      delete card.dataset._sponsored;
    }
  }

  function applyVisualModeToCard(card, mode) {
    // Reset
    card.style.opacity = "";
    card.style.filter = "";
    card.style.display = "";
    card.style.order = ""; // in case we used CSS order in the future

    if (mode === "gray") {
      card.style.opacity = "0.45";
      card.style.filter = "grayscale(0.9)";
      card.style.transition = "opacity 0.2s ease";
    } else if (mode === "hide") {
      card.style.display = "none";
    }
    // push handled separately by DOM re-append
  }

  function classifyAndMark(container) {
    const cards = qCards(container);
    for (const card of cards) {
      // we re-check because badges can render late
      const sponsored = cardIsSponsored(card);
      tagSponsored(card, sponsored);
    }
  }

  function applyMode(container, mode) {
    const cards = qCards(container);
    if (mode === "push") {
      // Move sponsored cards to end (stable order)
      const sponsored = [];
      for (const c of cards) if (c.dataset._sponsored === "1") sponsored.push(c);
      for (const c of sponsored) container.appendChild(c);
      // No style changes
      for (const c of cards) {
        if (c.dataset._sponsored === "1") {
          c.style.display = ""; c.style.opacity = ""; c.style.filter = "";
        }
      }
    } else {
      // Normal/Gray/Hide are just style changes
      for (const c of cards) {
        if (c.dataset._sponsored === "1") {
          applyVisualModeToCard(c, mode);
        } else {
          // non-sponsored: reset styles
          c.style.opacity = ""; c.style.filter = ""; c.style.display = "";
        }
      }
    }
  }

  const reapply = debounce(() => {
    const container = getResultsContainer();
    if (!container) return;
    classifyAndMark(container);
    applyMode(container, currentMode);
  }, 80);

  // --- Storage wiring ---
  function loadMode(cb) {
    chrome.storage.sync.get({ mode: MODE_DEFAULT }, (v) => {
      currentMode = v.mode || MODE_DEFAULT;
      cb && cb(currentMode);
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.mode) {
      currentMode = changes.mode.newValue || MODE_DEFAULT;
      reapply();
    }
  });

  // Message from popup to reapply now
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "reapply") reapply();
  });

  // --- Boot ---
  function bootstrap() {
    const container = getResultsContainer();
    if (!container) return;

    loadMode(() => {
      reapply();
      // Observe for lazy-loaded blocks / SPA nav
      const mo = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.addedNodes && m.addedNodes.length) { reapply(); break; }
        }
      });
      mo.observe(container, { childList: true, subtree: true });

      // Watch URL changes (Amazon SPA-ish)
      let last = location.href;
      setInterval(() => {
        if (location.href !== last) {
          last = location.href;
          reapply();
        }
      }, 500);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();

