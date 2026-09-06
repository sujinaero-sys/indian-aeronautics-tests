# GATE AE integration — where everything goes

Merge this into your existing `D:\site` tree like so:

```
D:\site\
├── code.gs                          → paste into Apps Script (replaces existing code.gs)
├── js\
│   ├── auth.js                      → replaces existing js/auth.js (adds GATE package branch)
│   └── test-engine.js               → NEW — shared exam engine, used by every discipline
├── css\
│   └── exam.css                     → NEW — styling for the exam-taking UI
├── gate-mock-tests\                 → NEW folder, mirrors isro-mock-tests\
│   ├── index.html
│   ├── test.html
│   ├── assets\
│   │   ├── catalog.js
│   │   └── home.js
│   │   └── style.css                → COPY your existing isro-mock-tests/assets/style.css here unchanged
│   └── data\
│       └── ae\
│           └── mock1.json           → GATE AE Mock 1, 65 questions, ready to use
└── isro-mock-tests\
    └── test.html                    → you don't have this page yet — copy gate-mock-tests/test.html
                                        here too (it's discipline-agnostic; it already reads its own
                                        folder's assets/catalog.js) and set IA_EXAM_FAMILY = "ISRO"
```

## Steps

1. **Google Apps Script**: paste `code.gs` over your existing script, save, run `setupDatabase()` once
   (creates the new `Attempts` sheet and adds a `GATE Access` column to `Access`).
2. **Grant a student GATE access**: in the `Access` sheet, set their `GATE Access` cell to `YES`
   (add `Access Start` / `Access Expiry` / `Attempt Limit` if you want them enforced too).
3. **`js/auth.js`**: replace with the version here — adds a `GATE` branch so a package string containing
   "GATE" resolves correctly instead of falling through to `NONE`.
4. Copy the new `gate-mock-tests/` folder into your site root.
5. Copy `gate-mock-tests/test.html` into `isro-mock-tests/test.html` too (change nothing except
   `IA_EXAM_FAMILY = "ISRO"`) — this gives all three ISRO disciplines a working test-taking page,
   which didn't exist yet in what you'd shared.
6. Copy your real `isro-mock-tests/assets/style.css` into `gate-mock-tests/assets/style.css` — I haven't
   seen it, so `index.html`/`test.html` currently reference a file that doesn't exist yet in that folder.
7. Commit and push — GitHub Pages will serve it as-is, no build step needed.

## ⚠️ Before this test goes live: verify these 5 questions

I transcribed and solved all 65 questions from the paper you uploaded, but **5 are flagged
`"needsReview": true`** in `mock1.json` because they depend on precise figure detail (cube nets,
turbomachine blade curvature/rotation direction, a velocity-triangle diagram, a potential-flow topology
question) that I can't fully verify from OCR'd text alone:

- **Q7** — cube-fold net matching (answer left blank)
- **Q27** — turbomachine blade configuration (answer left blank)
- **Q46** — compressor velocity triangle (answer left blank, though axial-velocity-constant is likely correct)
- **Q47** — potential-flow oval / vortex-pair topology (answer left blank)
- **Q64** — Prandtl-Meyer ending-wave angle (answer included at moderate confidence — double-check the
  geometry convention against the figure)

Everything else (60 of 65) has a worked answer and short explanation in the JSON. Fill in the blanks by
checking the original PDF figures directly, or against the official answer key once GATE releases it.

## Made GATE-accurate in this pass

- **Marking scheme, verified against official GATE rules**: MCQ gets negative marking (−1/3 for 1-mark, −2/3
  for 2-mark questions); MSQ requires selecting *every* correct option and *no* incorrect one for full marks,
  with **no negative marking**; NAT is tolerance-checked, also with no negative marking. (I'd floated "partial
  MSQ marking" as an option earlier — that's not actually how GATE works, so it stays all-or-nothing.)
- **5-state question palette**, matching the real interface exactly: Not Visited, Not Answered, Answered,
  Marked for Review, and — importantly — **Answered & Marked for Review**, shown as purple with a green dot.
  GATE evaluates that last state as a normal answer; marking a question for review never discards a response
  you already gave it.
- **Section tabs** (General Aptitude / Core Subject), with the palette scoped to whichever section is active,
  same as the real exam.
- **Pre-exam instructions + declaration screen**: shows question/mark counts, the palette legend, and a
  marking-scheme table generated directly from the loaded question set (so it's always accurate to whatever
  paper is loaded) — the timer only starts once the candidate ticks the declaration and clicks "I am ready
  to begin."
- **On-screen virtual scientific calculator** (sin/cos/tan/log/ln/√/x²/1/x/π/e), since GATE doesn't allow
  physical calculators and provides one on-screen instead.

One honest limit: this matches GATE's real *rules and information architecture* (marking, palette states,
section navigation, pre-exam declaration, calculator). It is not a pixel-for-pixel clone of TCS iON's
proprietary exam interface — that's neither practical nor something I'd want to closely imitate anyway. Your
own `style.css` (once copied in) controls the final look.

## Still open

- `assets/style.css` for `gate-mock-tests/` — copy yours in (see step 6).
- MSQ scoring is currently all-or-nothing (full marks only if every correct option is picked and no
  wrong one). If you want GATE's partial-marking scheme for MSQ, that's a small change in
  `test-engine.js`'s `gradeQuestion()` — say the word and I'll add it.
- Mocks 2–25 for GATE AE: the catalog is pre-wired for all 25 (`available:false` until you add
  `data/ae/mock2.json` etc. following `mock1.json`'s schema). I can help populate more once you've
  reviewed how Mock 1 looks on the live site.
