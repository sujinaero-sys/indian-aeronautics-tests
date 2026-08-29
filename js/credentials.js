/*
==========================================================================
 INDIAN AERONAUTICS — ACCESS LIST
==========================================================================
 This is the ONLY file you edit to control who can log in.

 HOW IT WORKS
 ------------
 1. A student pays you (UPI / bank transfer) and messages you on WhatsApp.
 2. You pick ONE unused login below and send its ID + password to that
    student on WhatsApp.
 3. You DELETE that entry from the list below (or set active to false),
    save the file, then push to GitHub (see README.md → "Revoking a
    login"). Once redeployed, that ID/password no longer works for
    anyone — including the student you just gave it to, after their
    session ends.
 4. Repeat for the next student with a different entry.

 IMPORTANT — READ THIS
 ----------------------
 This site is a fully static site (no server, no database). That keeps
 it free and simple to run from VS Code + GitHub Pages, but it means
 "single use" is enforced by YOU editing this list, not by the website
 automatically detecting reuse across different students' devices.
 The site does add one safety net: once a browser finishes a test with
 a given ID, that SAME browser will refuse to start again with that ID.
 But if you don't remove/rotate a credential after handing it out, nothing
 stops the same student from sharing it with a friend on a different
 device. Rotate promptly and this is a perfectly workable system for a
 small coaching operation.

 ADDING NEW LOGINS
 ------------------
 Just add another { id: "...", password: "...", label: "..." } object
 to the array below, following the exact same format. "label" is just a
 note for yourself (e.g. student's name) — it is never shown to anyone.
==========================================================================
*/

const IA_CREDENTIALS = [
  { id: "IA-STUDENT-001", password: "Fly-Rocket-01", label: "unassigned" },
  { id: "IA-STUDENT-002", password: "Fly-Rocket-02", label: "unassigned" },
  { id: "IA-STUDENT-003", password: "Fly-Rocket-03", label: "unassigned" },
  { id: "IA-STUDENT-004", password: "Fly-Rocket-04", label: "unassigned" },
  { id: "IA-STUDENT-005", password: "Fly-Rocket-05", label: "unassigned" },
];
