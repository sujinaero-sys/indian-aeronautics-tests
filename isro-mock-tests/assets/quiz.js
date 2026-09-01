(function () {
  const app = document.getElementById("app");
  const params = new URLSearchParams(location.search);
  const file = params.get("test");

  if (!file) {
    app.innerHTML = `<p>No test specified. <a href="index.html">Back to test list</a></p>`;
    return;
  }

  const PART_A_SECONDS = 90 * 60;
  const PART_B_SECONDS = 30 * 60;

  let testData = null;
  let part = "A";          // "A" | "B" | "results"
  let currentIndex = 0;
  let answers = {};        // key `${part}-${index}` -> selected option index
  let timerRemaining = PART_A_SECONDS;
  let timerHandle = null;

  fetch(file)
    .then(r => {
      if (!r.ok) throw new Error("not found");
      return r.json();
    })
    .then(data => {
      testData = data;
      startPart("A");
    })
    .catch(() => {
      app.innerHTML = `<p>Couldn't load this test file (${file}). <a href="index.html">Back to test list</a></p>`;
    });

  function startPart(p) {
    part = p;
    currentIndex = 0;
    timerRemaining = p === "A" ? PART_A_SECONDS : PART_B_SECONDS;
    clearInterval(timerHandle);
    timerHandle = setInterval(tick, 1000);
    render();
  }

  function tick() {
    timerRemaining--;
    if (timerRemaining <= 0) {
      clearInterval(timerHandle);
      if (part === "A") { startPart("B"); }
      else { finish(); }
      return;
    }
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    const el = document.getElementById("timerVal");
    if (!el) return;
    const m = Math.floor(timerRemaining / 60);
    const s = timerRemaining % 60;
    el.textContent = `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    el.parentElement.classList.toggle("low", timerRemaining < 60);
  }

  function currentSet() {
    return part === "A" ? testData.partA : testData.partB;
  }

  function selectOption(qIndex, optIndex) {
    answers[`${part}-${qIndex}`] = optIndex;
    render();
  }

  function finish() {
    clearInterval(timerHandle);
    part = "results";
    render();
  }

  function score() {
    let rawA = 0, rawB = 0, correctA = 0, wrongA = 0, correctB = 0, wrongB = 0, skipped = 0;
    testData.partA.forEach((q, i) => {
      const a = answers[`A-${i}`];
      if (a === undefined) { skipped++; return; }
      if (a === q.correct) { correctA++; rawA += 1; }
      else { wrongA++; rawA -= 1/3; }
    });
    testData.partB.forEach((q, i) => {
      const a = answers[`B-${i}`];
      if (a === undefined) { skipped++; return; }
      if (a === q.correct) { correctB++; rawB += 1; }
      else { wrongB++; }
    });
    return {
      rawA: Math.round(rawA * 100) / 100, rawB,
      total: Math.round((rawA + rawB) * 100) / 100,
      correctA, wrongA, correctB, wrongB, skipped
    };
  }

  function render() {
    if (part === "results") { renderResults(); return; }

    const set = currentSet();
    const q = set[currentIndex];
    const total = set.length;
    const answered = answers[`${part}-${currentIndex}`];
    const answeredCount = set.filter((_, i) => answers[`${part}-${i}`] !== undefined).length;

    app.innerHTML = `
      <div class="quiz-head">
        <h1>${testData.title}</h1>
        <a class="back" href="index.html">Exit</a>
      </div>

      <div class="timer" id="timerBox"><span id="timerVal"></span></div>

      <div class="progress-track"><div class="progress-fill" style="width:${(answeredCount/total)*100}%"></div></div>

      <span class="part-tag">PART ${part} &middot; ${part === "A" ? "Discipline" : "Aptitude"} &middot; Q ${currentIndex+1} of ${total}</span>

      <div class="q-index">Question ${currentIndex+1}</div>
      <p class="q-text">${q.text}</p>

      <div class="options">
        ${q.options.map((opt, i) => `
          <div class="option ${answered === i ? "selected" : ""}" data-opt="${i}">
            <span class="tag">${String.fromCharCode(65+i)}</span>
            <span>${opt}</span>
          </div>
        `).join("")}
      </div>

      <div class="jump-grid">
        ${set.map((_, i) => `
          <div class="jump-cell ${answers[`${part}-${i}`] !== undefined ? "answered" : ""} ${i === currentIndex ? "current" : ""}" data-jump="${i}">${i+1}</div>
        `).join("")}
      </div>

      <div class="nav-row">
        <button id="prevBtn" ${currentIndex === 0 ? "disabled" : ""}>&larr; Previous</button>
        ${currentIndex === total - 1
          ? `<button id="nextPartBtn" class="primary">${part === "A" ? "Submit Part A &rarr;" : "Finish test"}</button>`
          : `<button id="nextBtn" class="primary">Next &rarr;</button>`}
      </div>
    `;

    updateTimerDisplay();

    app.querySelectorAll(".option").forEach(el => {
      el.addEventListener("click", () => selectOption(currentIndex, parseInt(el.dataset.opt, 10)));
    });
    app.querySelectorAll(".jump-cell").forEach(el => {
      el.addEventListener("click", () => { currentIndex = parseInt(el.dataset.jump, 10); render(); });
    });
    const prevBtn = document.getElementById("prevBtn");
    if (prevBtn) prevBtn.addEventListener("click", () => { currentIndex--; render(); });
    const nextBtn = document.getElementById("nextBtn");
    if (nextBtn) nextBtn.addEventListener("click", () => { currentIndex++; render(); });
    const nextPartBtn = document.getElementById("nextPartBtn");
    if (nextPartBtn) nextPartBtn.addEventListener("click", () => {
      if (part === "A") startPart("B"); else finish();
    });
  }

  function renderResults() {
    const s = score();
    const maxA = testData.partA.length;
    const maxB = testData.partB.length;

    function reviewList(set, p) {
      return set.map((q, i) => {
        const a = answers[`${p}-${i}`];
        const cls = a === undefined ? "skipped" : (a === q.correct ? "correct" : "incorrect");
        const yourAns = a === undefined ? "Not attempted" : `${String.fromCharCode(65+a)}. ${q.options[a]}`;
        return `
          <div class="review-item ${cls}">
            <div class="rq">${i+1}. ${q.text}</div>
            <div class="ra">Your answer: ${yourAns} ${cls === "correct" ? '<span class="tick-ok">&#10003;</span>' : (cls === "incorrect" ? '<span class="tick-bad">&#10007;</span>' : '')}</div>
            <div class="ra">Correct answer: ${String.fromCharCode(65+q.correct)}. ${q.options[q.correct]}</div>
            <div class="rex">${q.explanation || ""}</div>
          </div>`;
      }).join("");
    }

    app.innerHTML = `
      <div class="quiz-head">
        <h1>${testData.title} — Results</h1>
        <a class="back" href="index.html">Back to list</a>
      </div>

      <div class="score-board">
        <div class="score-cell"><span class="big">${s.total} / 100</span><span class="lbl">Total score</span></div>
        <div class="score-cell"><span class="big">${s.rawA} / ${maxA}</span><span class="lbl">Part A (with negative marking)</span></div>
        <div class="score-cell"><span class="big">${s.rawB} / ${maxB}</span><span class="lbl">Part B</span></div>
        <div class="score-cell"><span class="big">${s.correctA + s.correctB}</span><span class="lbl">Correct</span></div>
        <div class="score-cell"><span class="big">${s.wrongA + s.wrongB}</span><span class="lbl">Wrong</span></div>
        <div class="score-cell"><span class="big">${s.skipped}</span><span class="lbl">Skipped</span></div>
      </div>

      <h2 style="font-family:var(--font-mono); font-size:15px; border-bottom:1px solid var(--line); padding-bottom:10px;">Part A review — Discipline</h2>
      ${reviewList(testData.partA, "A")}

      <h2 style="font-family:var(--font-mono); font-size:15px; border-bottom:1px solid var(--line); padding-bottom:10px; margin-top:32px;">Part B review — Aptitude</h2>
      ${reviewList(testData.partB, "B")}
    `;
  }
})();
