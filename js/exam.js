/* ==========================================================================
   EXAM RUNNER
   ========================================================================== */

const SECTIONS = [
  { key: "ga", label: "General Awareness", start: 1, end: 20 },
  { key: "eng", label: "English & Reasoning", start: 21, end: 60 },
  { key: "aero", label: "Aeronautical Engineering", start: 61, end: 160 },
];

function sectionFor(qId) {
  return SECTIONS.find((s) => qId >= s.start && qId <= s.end) || SECTIONS[SECTIONS.length - 1];
}

const params = new URLSearchParams(window.location.search);
const paperNum = params.get("paper");

let session, paperData, answers, current, timerHandle, secondsLeft, startKey, answersKey;

async function initExam() {
  session = iaRequireSession("login.html");
  if (!session) return;

  if (!paperNum || !["1", "2", "3", "4", "5"].includes(paperNum)) {
    window.location.href = "portal.html";
    return;
  }

  if (iaCredentialAlreadyFinished(session.id)) {
    document.getElementById("examRoot").innerHTML =
      '<div class="center-page"><div class="card narrow text-center"><h2>This login has already completed a test</h2><p class="muted mt-24">Each login can be used for one attempt. Please contact your instructor on WhatsApp if you believe this is an error.</p><a class="btn btn-outline mt-24" href="portal.html">Back to portal</a></div></div>';
    return;
  }

  const res = await fetch(`data/paper${paperNum}.json`);
  paperData = await res.json();

  startKey = `ia_start_${session.id}_${paperNum}`;
  answersKey = `ia_answers_${session.id}_${paperNum}`;

  answers = JSON.parse(sessionStorage.getItem(answersKey) || "{}");
  current = 0;

  const durationSec = paperData.duration_minutes * 60;
  let startedAt = sessionStorage.getItem(startKey);
  if (!startedAt) {
    startedAt = Date.now();
    sessionStorage.setItem(startKey, startedAt);
  }
  const elapsed = Math.floor((Date.now() - Number(startedAt)) / 1000);
  secondsLeft = Math.max(durationSec - elapsed, 0);

  renderShell();
  renderRunway();
  renderQuestion();
  startTimer();

  if (secondsLeft <= 0) {
    submitExam(true);
  }
}

function renderShell() {
  document.getElementById("paperTitle").textContent = paperData.title.replace(
    "HAL Design Trainee (Aeronautical) — Model Question ",
    ""
  );
}

function startTimer() {
  updateGauge();
  timerHandle = setInterval(() => {
    secondsLeft--;
    updateGauge();
    if (secondsLeft <= 0) {
      clearInterval(timerHandle);
      submitExam(true);
    }
  }, 1000);
}

function updateGauge() {
  const total = paperData.duration_minutes * 60;
  const frac = Math.max(secondsLeft / total, 0);
  const circumference = 2 * Math.PI * 24;
  const offset = circumference * (1 - frac);
  const fillEl = document.getElementById("gaugeFill");
  if (fillEl) fillEl.style.strokeDashoffset = offset;

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const label = document.getElementById("gaugeTime");
  if (label) label.textContent = `${m}:${String(s).padStart(2, "0")}`;
}

function renderRunway() {
  const el = document.getElementById("runway");
  el.innerHTML = "";
  paperData.questions.forEach((q, i) => {
    const b = document.createElement("button");
    b.className = "tick" + (answers[q.id] ? " answered" : "") + (i === current ? " current" : "");
    b.title = `Question ${q.id}`;
    b.onclick = () => {
      current = i;
      renderQuestion();
    };
    el.appendChild(b);
  });
  document.getElementById("progressLabel").textContent = `Question ${current + 1} of ${paperData.questions.length}`;
}

function renderQuestion() {
  const q = paperData.questions[current];
  const sec = sectionFor(q.id);
  document.getElementById("sectionTag").textContent = sec.label;
  document.getElementById("questionText").textContent = `${q.id}. ${q.question}`;

  const optsEl = document.getElementById("options");
  optsEl.innerHTML = "";
  ["A", "B", "C", "D"].forEach((letter) => {
    const div = document.createElement("div");
    div.className = "option" + (answers[q.id] === letter ? " selected" : "");
    div.innerHTML = `<span class="opt-letter">${letter}</span><span>${q.options[letter]}</span>`;
    div.onclick = () => {
      answers[q.id] = letter;
      sessionStorage.setItem(answersKey, JSON.stringify(answers));
      renderQuestion();
      renderRunway();
    };
    optsEl.appendChild(div);
  });

  document.getElementById("prevBtn").disabled = current === 0;
  const isLast = current === paperData.questions.length - 1;
  document.getElementById("nextBtn").style.display = isLast ? "none" : "inline-flex";
  document.getElementById("submitBtn").style.display = isLast ? "inline-flex" : "none";

  renderRunway();
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("examRoot")) return;
  initExam();

  document.getElementById("prevBtn")?.addEventListener("click", () => {
    if (current > 0) {
      current--;
      renderQuestion();
    }
  });
  document.getElementById("nextBtn")?.addEventListener("click", () => {
    if (current < paperData.questions.length - 1) {
      current++;
      renderQuestion();
    }
  });
  document.getElementById("submitBtn")?.addEventListener("click", () => {
    if (confirm("Submit the test now? You won't be able to change answers after this.")) {
      submitExam(false);
    }
  });
});

function submitExam(auto) {
  clearInterval(timerHandle);
  iaMarkCredentialFinished(session.id);
  sessionStorage.removeItem(startKey);
  sessionStorage.removeItem(answersKey);

  const sectionScores = {};
  SECTIONS.forEach((s) => (sectionScores[s.key] = { correct: 0, total: 0 }));

  let correct = 0;
  const reviewRows = [];

  paperData.questions.forEach((q) => {
    const sec = sectionFor(q.id);
    sectionScores[sec.key].total++;
    const given = answers[q.id];
    const isCorrect = given === q.answer;
    if (isCorrect) {
      correct++;
      sectionScores[sec.key].correct++;
    }
    reviewRows.push({ q, given, isCorrect });
  });

  backupResult({
  studentId: session.id,
  paper: paperNum,
  paperTitle: paperData.title,
  submittedAt: new Date().toISOString(),
  autoSubmitted: auto,
  totalQuestions: paperData.questions.length,
  score: correct,
  percentage: Math.round((correct / paperData.questions.length) * 100),
  sectionScores: sectionScores,
  answers: reviewRows.map((r) => ({
    questionId: r.q.id,
    question: r.q.question,
    studentAnswer: r.given || null,
    correctAnswer: r.q.answer,
    isCorrect: r.isCorrect,
    options: r.q.options
  }))
});

  renderResults(correct, paperData.questions.length, sectionScores, reviewRows, auto);
}

async function backupResult(result) {
  const BACKUP_URL =
    "https://script.google.com/macros/s/AKfycbzjOLtnukHD3bKfgUZ_SkWfQezXGfmQtEzSRWqeGwJg_Sgldl7SpDc8CJ-ir8IYVeoq/exec";

  try {
    await fetch(BACKUP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(result)
    });

    console.log("Result backup request sent.");
  } catch (error) {
    console.error("Result backup failed:", error);
  }
}

function renderResults(correct, total, sectionScores, reviewRows, auto) {
  const root = document.getElementById("examRoot");
  const pct = Math.round((correct / total) * 100);
  const circumference = 2 * Math.PI * 80;
  const offset = circumference * (1 - correct / total);

  let html = `
    <div class="exam-body" style="padding-top:50px;">
      ${auto ? '<p class="form-error visible">Time is up — your test was submitted automatically.</p>' : ""}
      <div class="score-hero">
        <div class="score-ring">
          <svg width="180" height="180" viewBox="0 0 180 180">
            <circle class="score-ring-track" cx="90" cy="90" r="80" fill="none" stroke-width="14"/>
            <circle class="score-ring-fill" cx="90" cy="90" r="80" fill="none" stroke-width="14"
              stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
          </svg>
          <div class="score-ring-label">
            <div class="num">${correct}</div>
            <div class="den">of ${total} (${pct}%)</div>
          </div>
        </div>
        <h2>Test complete</h2>
        <p class="muted">${paperData.title}</p>
      </div>

      <div class="breakdown">
        ${SECTIONS.map(
          (s) => `
          <div class="b-card">
            <div class="b-score">${sectionScores[s.key].correct}/${sectionScores[s.key].total}</div>
            <div class="b-label">${s.label}</div>
          </div>`
        ).join("")}
      </div>

      <h3 class="mt-32">Answer review</h3>
      <div class="mt-24">
        ${reviewRows
          .map(
            (r) => `
          <div class="review-item">
            <div class="q"><strong>${r.q.id}.</strong> ${r.q.question}</div>
            ${
              r.given
                ? `<div class="row ${r.isCorrect ? "correct" : "incorrect"}">Your answer: ${r.given}) ${r.q.options[r.given]}</div>`
                : `<div class="row unanswered">Not answered</div>`
            }
            ${!r.isCorrect ? `<div class="row correct">Correct answer: ${r.q.answer}) ${r.q.options[r.q.answer]}</div>` : ""}
          </div>`
          )
          .join("")}
      </div>

      <div class="text-center mt-32">
        <a class="btn btn-outline" href="portal.html">Back to portal</a>
      </div>
    </div>
  `;
  root.innerHTML = html;
  window.scrollTo(0, 0);
}

