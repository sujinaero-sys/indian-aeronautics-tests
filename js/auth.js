/* ==========================================================================
   AUTH / SESSION HELPERS
   Google Apps Script + Google Sheet authentication
   ========================================================================== */

const IA_SESSION_KEY = "ia_session_v1";

const IA_AUTH_URL =
  "https://script.google.com/macros/s/AKfycbzfZwoF7StscCZZ2GC0TqI9Z98gA3d3CZz3VZmjChw4BUNT6hsfrjic5xpZR0c0KfJy/exec";


function iaCredentialAlreadyFinished(id) {
  return localStorage.getItem(
    "ia_finished_" + id.trim().toLowerCase()
  ) === "1";
}


function iaMarkCredentialFinished(id) {
  localStorage.setItem(
    "ia_finished_" + id.trim().toLowerCase(),
    "1"
  );
}


/* =========================================================
   SHA-256 PASSWORD HASH
   ========================================================= */

async function iaHashPassword(password) {

  const encoder = new TextEncoder();

  const data = encoder.encode(password);

  const hashBuffer =
    await crypto.subtle.digest("SHA-256", data);

  const hashArray =
    Array.from(new Uint8Array(hashBuffer));

  return hashArray
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}


/* =========================================================
   LOGIN
   ========================================================= */

async function iaLogin(id, password) {

  const studentId = String(id || "").trim();
  const studentPassword = String(password || "");

  if (!studentId || !studentPassword) {
    return {
      ok: false,
      reason: "invalid"
    };
  }

  if (iaCredentialAlreadyFinished(studentId)) {
    return {
      ok: false,
      reason: "already_used"
    };
  }

  try {

    const passwordHash =
      await iaHashPassword(studentPassword);

    const body =
      new URLSearchParams();

    body.append("action", "login");
    body.append("studentId", studentId);
    body.append("passwordHash", passwordHash);

    const response =
      await fetch(IA_AUTH_URL, {
        method: "POST",
        body: body
      });

    if (!response.ok) {
      return {
        ok: false,
        reason: "server"
      };
    }

    const result =
      await response.json();

    if (!result.success) {

      return {
        ok: false,
        reason: "invalid",
        message: result.error || ""
      };

    }

    sessionStorage.setItem(
      IA_SESSION_KEY,
      JSON.stringify({
        id: result.student.id,
        name: result.student.name,
        email: result.student.email,
        package: result.student.package,
        startDate: result.student.startDate,
        expiryDate: result.student.expiryDate,
        loggedInAt: Date.now()
      })
    );

    return {
      ok: true,
      student: result.student
    };

  } catch (error) {

    console.error("Login error:", error);

    return {
      ok: false,
      reason: "server"
    };
  }
}


/* =========================================================
   GET SESSION
   ========================================================= */

function iaGetSession() {

  const raw =
    sessionStorage.getItem(IA_SESSION_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}


/* =========================================================
   REQUIRE LOGIN
   ========================================================= */

function iaRequireSession(redirectTo) {

  const session =
    iaGetSession();

  if (!session) {

    window.location.href =
      redirectTo || "login.html";

    return null;
  }

  return session;
}


/* =========================================================
   LOGOUT
   ========================================================= */

function iaLogout() {

  sessionStorage.removeItem(
    IA_SESSION_KEY
  );

  window.location.href =
    "index.html";
}