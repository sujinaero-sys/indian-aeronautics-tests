/* ==========================================================================
   INDIAN AERONAUTICS
   AUTHENTICATION + PACKAGE ACCESS CONTROL
   ========================================================================== */

const IA_SESSION_KEY = "ia_session_v1";

const IA_AUTH_URL =
  "https://script.google.com/macros/s/AKfycbzfZwoF7StscCZZ2GC0TqI9Z98gA3d3CZz3VZmjChw4BUNT6hsfrjic5xpZR0c0KfJy/exec";


/* =========================================================
   ONE-ATTEMPT HELPERS
   ========================================================= */

function iaCredentialAlreadyFinished(id) {

  return localStorage.getItem(
    "ia_finished_" +
    String(id || "").trim().toLowerCase()
  ) === "1";

}


function iaMarkCredentialFinished(id) {

  localStorage.setItem(
    "ia_finished_" +
    String(id || "").trim().toLowerCase(),
    "1"
  );

}


/* =========================================================
   PASSWORD HASH
   ========================================================= */

async function iaHashPassword(password) {

  const encoder = new TextEncoder();

  const data = encoder.encode(password);

  const hashBuffer =
    await crypto.subtle.digest("SHA-256", data);

  return Array
    .from(new Uint8Array(hashBuffer))
    .map(byte =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");

}


/* =========================================================
   PACKAGE NORMALISATION
   ========================================================= */

function iaGetAccessPackage(student) {

  const raw =
    String(
      student &&
      student.package
        ? student.package
        : ""
    )
    .trim()
    .toUpperCase();


  /*
   * BOTH / ALL ACCESS
   */

  if (
    raw.includes("HAL + ISRO") ||
    raw.includes("ISRO + HAL") ||
    raw.includes("HAL AND ISRO") ||
    raw.includes("ISRO AND HAL") ||
    raw.includes("BOTH") ||
    raw.includes("ALL ACCESS")
  ) {

    return "BOTH";

  }


  /*
   * ISRO ACCESS
   */

  if (
    raw.includes("ISRO") ||
    raw.includes("ICRB")
  ) {

    return "ISRO";

  }


  /*
   * HAL ACCESS
   *
   * Existing "Premium 7 Days" test account
   * is treated as HAL.
   */

  if (
    raw.includes("HAL") ||
    raw.includes("PREMIUM")
  ) {

    return "HAL";

  }


  /*
   * Unknown package
   */

  return "NONE";

}


/* =========================================================
   ACCESS CHECKS
   ========================================================= */

function iaHasAccess(requiredSeries) {

  const session =
    iaGetSession();

  if (!session) {
    return false;
  }


  const access =
    iaGetAccessPackage(session);


  if (access === "BOTH") {
    return true;
  }


  return access ===
    String(requiredSeries || "")
      .trim()
      .toUpperCase();

}


function iaGetAccess() {

  const session =
    iaGetSession();

  if (!session) {
    return "NONE";
  }

  return iaGetAccessPackage(session);

}


/* =========================================================
   LOGIN
   ========================================================= */

async function iaLogin(id, password) {

  const studentId =
    String(id || "").trim();

  const studentPassword =
    String(password || "");


  if (!studentId || !studentPassword) {

    return {
      ok: false,
      reason: "invalid",
      message:
        "Student ID and password are required."
    };

  }


  if (
    iaCredentialAlreadyFinished(studentId)
  ) {

    return {
      ok: false,
      reason: "already_used",
      message:
        "This login has already been used."
    };

  }


  try {

    const passwordHash =
      await iaHashPassword(
        studentPassword
      );


    const body =
      new URLSearchParams();

    body.append(
      "action",
      "login"
    );

    body.append(
      "studentId",
      studentId
    );

    body.append(
      "passwordHash",
      passwordHash
    );


    const response =
      await fetch(
        IA_AUTH_URL,
        {
          method: "POST",
          body: body
        }
      );


    if (!response.ok) {

      return {
        ok: false,
        reason: "server",
        message:
          "Authentication server error."
      };

    }


    const result =
      await response.json();


    if (!result.success) {

      return {
        ok: false,
        reason: "invalid",
        message:
          result.error ||
          "Invalid student ID or password."
      };

    }


    const student =
      result.student;


    /*
     * Store complete authenticated student
     * information in sessionStorage.
     */

    sessionStorage.setItem(
      IA_SESSION_KEY,
      JSON.stringify({

        id:
          student.id,

        name:
          student.name,

        email:
          student.email,

        package:
          student.package,

        startDate:
          student.startDate,

        expiryDate:
          student.expiryDate,

        loggedInAt:
          Date.now()

      })
    );


    return {
      ok: true,
      student: student,
      access:
        iaGetAccess()
    };


  } catch (error) {

    console.error(
      "Login error:",
      error
    );


    return {
      ok: false,
      reason: "server",
      message:
        "Unable to connect to the authentication service."
    };

  }

}


/* =========================================================
   SESSION
   ========================================================= */

function iaGetSession() {

  const raw =
    sessionStorage.getItem(
      IA_SESSION_KEY
    );


  if (!raw) {
    return null;
  }


  try {

    const session =
      JSON.parse(raw);


    if (
      session.expiryDate &&
      new Date(
        session.expiryDate
      ).getTime() <= Date.now()
    ) {

      sessionStorage.removeItem(
        IA_SESSION_KEY
      );

      return null;

    }


    return session;


  } catch (error) {

    sessionStorage.removeItem(
      IA_SESSION_KEY
    );

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
      redirectTo ||
      "login.html";

    return null;

  }


  return session;

}


/* =========================================================
   REQUIRE SPECIFIC SERIES
   ========================================================= */

function iaRequireAccess(
  series,
  loginPath
) {

  const session =
    iaGetSession();


  if (!session) {

    window.location.href =
      loginPath ||
      "login.html";

    return null;

  }


  if (
    !iaHasAccess(series)
  ) {

    alert(
      "Your account does not include access to this mock-test series."
    );


    window.location.href =
      loginPath ||
      "login.html";


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
