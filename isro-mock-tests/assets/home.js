document.querySelectorAll(".test-grid").forEach(grid => {
  const discipline = grid.dataset.discipline;
  const tests = TEST_CATALOG.filter(t => t.discipline === discipline);

  grid.innerHTML = tests.map(t => {
    const numStr = String(t.num).padStart(2, "0");
    if (t.available) {
      return `
        <a class="test-card" href="test.html?test=${encodeURIComponent(t.file)}">
          <span class="num">MOCK ${numStr}</span>
          <span class="title">${t.label} — Set ${t.num}</span>
          <span class="meta">95 Q · 120 min · full pattern</span>
        </a>`;
    }
    return `
      <div class="test-card locked">
        <span class="num">MOCK ${numStr}</span>
        <span class="title">${t.label} — Set ${t.num}</span>
        <span class="meta">coming soon</span>
      </div>`;
  }).join("");
});
