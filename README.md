# Indian Aeronautics — HAL DT Mock Test Portal

A simple test-taking website for your HAL Design Trainee (Aeronautical) mock
tests. Students log in with a one-time ID/password you send them on
WhatsApp, take a 160-question timed paper, and get an instant score with
full answer review.

It's a **fully static site** — plain HTML/CSS/JS, no server, no database,
free to host on GitHub Pages. That keeps it easy to run from VS Code, but
it also means you (the admin) are the one enforcing "one login = one
student," not the website itself. Read **"How access control actually
works"** below before you launch — it explains exactly what this does and
doesn't protect against.

---

## 1. What's in this folder

```
index.html          Landing page (branding, how it works, WhatsApp link)
login.html           Student login
portal.html          Paper picker (shown after login)
test.html            The exam itself
css/style.css        All styling
js/credentials.js    ← the file YOU edit to grant/revoke logins
js/auth.js           Login + session logic
js/exam.js           Timer, question navigation, scoring
data/paper1.json ... paper5.json   Your 5 mock papers, parsed from your
                     source files, including the answer keys
assets/logo.png      Your logo
```

## 2. Running it locally before you publish

You don't need any install beyond VS Code. Open this folder in VS Code,
then either:

- Install the **"Live Server"** extension, right-click `index.html` →
  **Open with Live Server**, or
- Open a terminal in VS Code and run:
  ```
  python3 -m http.server 8000
  ```
  then visit `http://localhost:8000` in your browser.

Try logging in with one of the sample IDs already in `js/credentials.js`
(e.g. `IA-STUDENT-001` / `Fly-Rocket-01`) to see the whole flow.

## 3. Publishing it for free on GitHub Pages

1. Create a new **public** repository on GitHub (e.g. `indian-aeronautics-tests`).
2. In VS Code, open this folder, then in the terminal:
   ```
   git init
   git add .
   git commit -m "Initial site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
3. On GitHub: go to the repo → **Settings** → **Pages** → under "Build and
   deployment", set **Source: Deploy from a branch**, branch **main**,
   folder **/ (root)** → **Save**.
4. After a minute, GitHub shows your live URL, something like:
   `https://<your-username>.github.io/<your-repo>/`
   Share that link with students instead of the WhatsApp number alone —
   put it in your WhatsApp profile or in the message you send them.

Every time you edit a file in VS Code, you need to push the change for it
to go live:
```
git add .
git commit -m "Describe what changed"
git push
```

## 4. How access control actually works

There's no backend, so "single use" is enforced two ways working together:

**A. You rotate the credential list.** `js/credentials.js` is the single
source of truth. It only contains the logins that are currently valid.
When you give a login to a student, you should **delete that entry** (or
comment it out) and push the change, so it stops working for anyone,
including that student, once they're done.

**B. The site remembers finished attempts on that device.** Once a
student submits a test (or the timer runs out), their browser marks that
login as "finished" locally, so it can't restart or reuse it on the *same*
device. This stops accidental double attempts but doesn't reach across
different devices — that's what step A is for.

**What this means in practice:** the honest, secure workflow is —
1. Student pays → messages you on WhatsApp.
2. You open `js/credentials.js`, pick an unused entry, send its ID and
   password to that student.
3. You immediately delete that entry from the file, save, and run:
   ```
   git add js/credentials.js
   git commit -m "Assign login to <student>"
   git push
   ```
4. GitHub Pages redeploys automatically (takes ~30–60 seconds), and that
   login can no longer be used by a second person.

If you skip step 3–4 and leave a used credential active, nothing stops it
being shared. For a small coaching operation handing out a handful of
logins a day, this manual rotation is a normal and reasonable amount of
admin effort — just don't treat it as automatic.

If down the road you get more students and want the website to enforce
this by itself (no manual editing), that needs a small shared database
(e.g. Firebase, which has a free tier) — let me know if you'd like that
built later.

## 5. Adding or changing logins

Open `js/credentials.js`. Each login looks like:

```js
{ id: "IA-STUDENT-006", password: "SomethingUnique-06", label: "Rahul (paid 28 Aug)" }
```

- `id` and `password` are what the student types in.
- `label` is just a private note for you — never shown to students.
  Use it to remember who a login is meant for.
- Add as many entries as you like; remove ones you've already handed out
  and finished with.

## 6. Changing the WhatsApp number

The number `+919995863184` appears in two places, written without the
`+` or spaces:
- `index.html` — search for `WA_NUMBER`
- `login.html` — search for `WA_NUMBER`

Change the digits in both places (always country code + number, no `+`
or spaces) if the number ever changes.

## 7. Payment

There's no payment gateway wired in — the flow is manual: you tell
students your UPI ID / bank details separately (e.g. in your WhatsApp
message or a note on the landing page), they pay, then message you for
a login. If you'd later like a "Pay now" button linking to a UPI payment
link or a Razorpay page, that's a small addition — just ask.

## 8. Editing the test papers

Each paper lives in `data/paper1.json` … `data/paper5.json`. The format:

```json
{
  "id": 1,
  "question": "HAL is administratively under which Ministry...",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "answer": "B"
}
```

Fix a typo or a wrong answer key by editing the relevant field directly,
save, and push as usual.

## 9. Section boundaries and timer

Defined in `js/exam.js` at the top (`SECTIONS`): Q1–20 General Awareness,
Q21–60 English & Reasoning, Q61–160 Aeronautical Engineering. The timer
length (150 minutes) is set per paper in each `data/paperN.json` file
under `"duration_minutes"` — change it there if you want a different
duration for a specific paper.

## 10. A note on the branding

"Indian Aeronautics" here is your coaching brand name and logo — the
site includes a small footer note that it isn't affiliated with
Hindustan Aeronautics Limited (HAL), since HAL is a real government
company and the tests are modeled on its exam pattern. Keep that note
in place to avoid any confusion for students.
