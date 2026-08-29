/* ==========================================================================
   AUTH / SESSION HELPERS
   Checks entered credentials against js/credentials.js and manages a
   simple session so the portal + test pages know who is logged in.
   ========================================================================== */

const IA_SESSION_KEY = "ia_session_v1";

function iaFindCredential(id, password) {
  return IA_CREDENTIALS.find(
    (c) => c.id.trim().toLowerCase() === id.trim().toLowerCase() && c.password === password
  );
}

function iaCredentialAlreadyFinished(id) {
  return localStorage.getItem("ia_finished_" + id.trim().toLowerCase()) === "1";
}

function iaMarkCredentialFinished(id) {
  localStorage.setItem("ia_finished_" + id.trim().toLowerCase(), "1");
}

function iaLogin(id, password) {
  const cred = iaFindCredential(id, password);
  if (!cred) {
    return { ok: false, reason: "invalid" };
  }
  if (iaCredentialAlreadyFinished(cred.id)) {
    return { ok: false, reason: "already_used" };
  }
  sessionStorage.setItem(IA_SESSION_KEY, JSON.stringify({ id: cred.id, loggedInAt: Date.now() }));
  return { ok: true };
}

function iaGetSession() {
  const raw = sessionStorage.getItem(IA_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function iaRequireSession(redirectTo) {
  const s = iaGetSession();
  if (!s) {
    window.location.href = redirectTo || "login.html";
    return null;
  }
  return s;
}

function iaLogout() {
  sessionStorage.removeItem(IA_SESSION_KEY);
  window.location.href = "index.html";
}
