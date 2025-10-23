const buttons = Array.from(document.querySelectorAll("button[data-mode]"));

async function getMode() {
  return new Promise((res) => {
    chrome.storage.sync.get({ mode: "gray" }, (v) => res(v.mode));
  });
}
function setMode(mode) {
  chrome.storage.sync.set({ mode });
}

function paintActive(mode) {
  buttons.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
}

(async () => {
  const mode = await getMode();
  paintActive(mode);

  buttons.forEach((b) => {
    b.addEventListener("click", () => {
      const m = b.dataset.mode;
      setMode(m);
      paintActive(m);
      // Optional: poke tabs to re-apply immediately
      chrome.tabs.query({ url: ["*://*.amazon.*/*"] }, (tabs) => {
        for (const t of tabs) chrome.tabs.sendMessage(t.id, { type: "reapply" });
      });
    });
  });
})();

