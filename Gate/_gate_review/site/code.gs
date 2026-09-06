const FOLDER_ID = "1FSF-wHZZJEj5twEl7eK_NlNaszuvWpWR";

const SPREADSHEET_ID =
  "1im_VCScMXw2i-wDmIviFsEShjXtWaz7YaeRxKolbtOc";


/* =========================================================
   SERIES -> ACCESS COLUMN MAP
   ---------------------------------------------------------
   "series" is sent explicitly by test-engine.js (it's the
   catalog entry's `discipline` field: "electronics",
   "mechanical", "cs", "ae", ...). This is matched directly
   against a column in the "Access" sheet -- no guessing
   from the "paper" string.

   To add a brand-new exam family later: add one line here
   and one column header in ensureAccessSheet(). No other
   code needs to change.
   ========================================================= */

const EXAM_ACCESS_COLUMNS = {
  "ae": "GATE Access",
  "gate": "GATE Access",
  "hal": "HAL Access",
  "electronics": "ISRO Electronics",
  "mechanical": "ISRO Mechanical",
  "cs": "ISRO Computer Science"
};


/* =========================================================
   MAIN POST HANDLER
   ========================================================= */

function doPost(e) {

  try {

    const params = e.parameter || {};
    const action =
      String(params.action || "result").trim();


    if (action === "register") {
      return createStudentAccount(params);
    }

    if (action === "accountLogin") {
      return handleAccountLogin(params);
    }

    if (action === "login") {
      return handleLoginRequest(params);
    }

    if (action === "startAttempt") {
      return startAttempt(params);
    }


    /* -------------------------------------------------------
       TEST RESULT SUBMISSION
       ------------------------------------------------------- */

    const raw =
      e.postData && e.postData.contents
        ? e.postData.contents
        : "{}";

    const data = JSON.parse(raw);

    if (!data.studentId) {
      throw new Error("Student ID is missing.");
    }

    if (!data.attemptToken) {
      throw new Error("Attempt token is missing.");
    }


    /* ---------------------------------------------------
       VALIDATE THE ATTEMPT TOKEN
       Prevents forged / replayed result submissions.
       --------------------------------------------------- */

    const attemptCheck =
      consumeAttemptToken(data.attemptToken, data.studentId, data.paper);

    if (!attemptCheck.ok) {

      return jsonResponse({
        success: false,
        reason: attemptCheck.reason,
        error: attemptCheck.error
      });

    }


    /* ---------------------------------------------------
       PERSIST RESULT
       Each backup step is isolated: if the (slow, fragile)
       DOCX export fails, the Sheet + Drive JSON backups
       -- the parts that actually matter -- are unaffected,
       and the student still gets a success response.
       --------------------------------------------------- */

    const warnings = [];

    try {
      saveResultToDrive(data);
    } catch (err) {
      warnings.push("drive_json: " + String(err));
    }

    try {
      saveResultToSheet(data);
    } catch (err) {
      warnings.push("results_sheet: " + String(err));
      // The sheet row is the source of truth for the student's
      // score -- if this fails, surface it as a real failure.
      return jsonResponse({
        success: false,
        error: "Could not save your result. Please try submitting again."
      });
    }

    try {
      saveResultToWord(data);
    } catch (err) {
      warnings.push("word_report: " + String(err));
    }

    return jsonResponse({
      success: true,
      message: "Result backed up successfully.",
      warnings: warnings
    });


  } catch (error) {

    return jsonResponse({
      success: false,
      error: String(error)
    });

  }

}


/* =========================================================
   MAIN GET HANDLER
   ========================================================= */

function doGet(e) {

  const params = e && e.parameter ? e.parameter : {};
  const action = String(params.action || "").trim();

  if (action === "login") {
    return handleLoginRequest(params);
  }

  if (action === "accountLogin") {
    return handleAccountLogin(params);
  }

  if (action === "startAttempt") {
    return startAttempt(params);
  }

  return jsonResponse({
    success: false,
    error: "Invalid request."
  });

}


/* =========================================================
   JSON RESPONSE
   ========================================================= */

function jsonResponse(data) {

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

}


/* =========================================================
   GENERIC HEADER-INDEX HELPER
   ---------------------------------------------------------
   Lets us read/write sheet columns by header name instead
   of hard-coded numbers, so adding a column never breaks
   existing reads.
   ========================================================= */

function getHeaderIndexMap(sheet) {

  const headers =
    sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];

  const map = {};

  headers.forEach(function (header, index) {
    map[String(header).trim()] = index; // 0-based
  });

  return map;

}

function ensureHeaderColumn(sheet, headerName) {

  const lastCol = sheet.getLastColumn();

  const headers =
    lastCol > 0
      ? sheet.getRange(1, 1, 1, lastCol).getValues()[0]
      : [];

  if (headers.indexOf(headerName) === -1) {
    sheet.getRange(1, lastCol + 1).setValue(headerName);
  }

}


/* =========================================================
   STUDENT ACCOUNTS SHEET  (identity + login)
   ========================================================= */

function ensureStudentAccountsSheet() {

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName("Student Accounts");

  if (!sheet) {
    sheet = spreadsheet.insertSheet("Student Accounts");
  }

  const headers = [
    "Student ID", "Full Name", "Email ID", "Mobile Number",
    "Password Hash", "Status", "Created At", "Last Login", "Notes"
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  return sheet;

}


function generateStudentId() {

  const sheet = ensureStudentAccountsSheet();
  const values = sheet.getDataRange().getValues();
  let highest = 0;

  for (let i = 1; i < values.length; i++) {

    const id = String(values[i][0] || "").trim();
    const match = id.match(/^IA-(\d{4})-(\d+)$/);

    if (match) {
      const number = parseInt(match[2], 10);
      if (number > highest) highest = number;
    }

  }

  const year = new Date().getFullYear();

  return "IA-" + year + "-" + String(highest + 1).padStart(5, "0");

}


function normalizeMobile(mobile) {
  return String(mobile || "").replace(/\D/g, "");
}


function createStudentAccount(params) {

  const name = String(params.name || "").trim();
  const email = String(params.email || "").trim().toLowerCase();
  const mobile = normalizeMobile(params.mobile);
  const passwordHash = String(params.passwordHash || "").trim();

  if (!name) {
    return jsonResponse({ success: false, reason: "validation", error: "Full name is required." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ success: false, reason: "validation", error: "Please enter a valid email ID." });
  }

  if (mobile.length < 10 || mobile.length > 15) {
    return jsonResponse({ success: false, reason: "validation", error: "Please enter a valid mobile number." });
  }

  if (!passwordHash || passwordHash.length !== 64) {
    return jsonResponse({ success: false, reason: "validation", error: "Invalid password." });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {

    const sheet = ensureStudentAccountsSheet();
    const values = sheet.getDataRange().getValues();

    for (let i = 1; i < values.length; i++) {

      const row = values[i];
      const existingEmail = String(row[2] || "").trim().toLowerCase();
      const existingMobile = normalizeMobile(row[3]);

      if (existingEmail === email) {
        return jsonResponse({ success: false, reason: "duplicate_email", error: "An account already exists with this email ID." });
      }

      if (existingMobile === mobile) {
        return jsonResponse({ success: false, reason: "duplicate_mobile", error: "An account already exists with this mobile number." });
      }

    }

    const studentId = generateStudentId();
    const now = new Date();

    sheet.appendRow([studentId, name, email, mobile, passwordHash, "ACTIVE", now, "", "Self-registration"]);

    return jsonResponse({
      success: true,
      message: "Account created successfully.",
      student: { id: studentId, name: name, email: email, mobile: mobile, status: "ACTIVE" }
    });

  } finally {
    lock.releaseLock();
  }

}


function handleAccountLogin(params) {

  const studentId = String(params.studentId || "").trim();
  const passwordHash = String(params.passwordHash || "").trim();

  if (!studentId || !passwordHash) {
    return jsonResponse({ success: false, reason: "validation", error: "Student ID and password are required." });
  }

  const sheet = ensureStudentAccountsSheet();
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {

    const row = values[i];
    const storedId = String(row[0] || "").trim();
    const storedHash = String(row[4] || "").trim();

    if (storedId === studentId && storedHash === passwordHash) {

      const status = String(row[5] || "").trim().toUpperCase();

      if (status !== "ACTIVE") {
        return jsonResponse({ success: false, reason: "inactive", error: "This student account is inactive." });
      }

      sheet.getRange(i + 1, 8).setValue(new Date());

      return jsonResponse({
        success: true,
        student: { id: storedId, name: String(row[1] || ""), email: String(row[2] || ""), mobile: String(row[3] || ""), status: status }
      });

    }

  }

  return jsonResponse({ success: false, reason: "invalid_login", error: "Invalid Student ID or password." });

}


/* =========================================================
   UNIFIED STUDENT LOGIN
   Student Accounts = identity/login
   Students         = optional legacy paid-package info
   ========================================================= */

function handleLoginRequest(params) {

  const studentId = String(params.studentId || "").trim();
  const passwordHash = String(params.passwordHash || "").trim();

  if (!studentId || !passwordHash) {
    return jsonResponse({ success: false, reason: "validation", error: "Student ID and password are required." });
  }

  const accountSheet = ensureStudentAccountsSheet();
  const accountValues = accountSheet.getDataRange().getValues();

  let accountRow = null;
  let accountRowNumber = -1;

  for (let i = 1; i < accountValues.length; i++) {

    const row = accountValues[i];
    const storedId = String(row[0] || "").trim();
    const storedHash = String(row[4] || "").trim();

    if (storedId === studentId && storedHash === passwordHash) {
      accountRow = row;
      accountRowNumber = i + 1;
      break;
    }

  }

  if (!accountRow) {
    return jsonResponse({ success: false, reason: "invalid_login", error: "Invalid Student ID or password." });
  }

  const status = String(accountRow[5] || "").trim().toUpperCase();

  if (status !== "ACTIVE") {
    return jsonResponse({ success: false, reason: "inactive", error: "This student account is inactive." });
  }

  const now = new Date();
  accountSheet.getRange(accountRowNumber, 8).setValue(now);

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const students = spreadsheet.getSheetByName("Students");

  let packageName = "";
  let startDate = "";
  let expiryDate = "";
  let attempts = 0;
  let paidStatus = "NOT_ASSIGNED";

  if (students) {

    const studentValues = students.getDataRange().getValues();

    for (let i = 1; i < studentValues.length; i++) {

      const row = studentValues[i];
      const storedId = String(row[0] || "").trim();

      if (storedId !== studentId) continue;

      packageName = String(row[5] || "");
      startDate = row[6] || "";
      expiryDate = row[7] || "";
      attempts = Number(row[8] || 0);
      paidStatus = "ASSIGNED";

      if (expiryDate instanceof Date && now > expiryDate) {
        paidStatus = "EXPIRED";
      }

      break;

    }

  }

  return jsonResponse({
    success: true,
    student: {
      id: studentId,
      name: String(accountRow[1] || ""),
      email: String(accountRow[2] || ""),
      mobile: String(accountRow[3] || ""),
      status: status,
      package: packageName,
      startDate: startDate,
      expiryDate: expiryDate,
      attempts: attempts,
      paidStatus: paidStatus
    }
  });

}


/* =========================================================
   ACCESS SHEET (per-exam entitlement — the real gate)
   ========================================================= */

function ensureAccessSheet() {

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName("Access");

  if (!sheet) {
    sheet = spreadsheet.insertSheet("Access");
  }

  const headers = [
    "Student ID", "HAL Access", "ISRO Electronics", "ISRO Mechanical",
    "ISRO Computer Science", "GATE Access", "Access Start", "Access Expiry",
    "Attempt Limit", "Notes"
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    // Migration: add any headers (e.g. "GATE Access") missing on an
    // existing sheet, without disturbing existing columns/data.
    headers.forEach(function (h) {
      ensureHeaderColumn(sheet, h);
    });
  }

  return sheet;

}


/**
 * Returns { allowed, reason, error, attemptLimit }.
 * If `series` doesn't match a known exam family, access is
 * treated as open (fail-open on purpose, so an un-mapped
 * "paper"/series never locks a student out by accident).
 */
function checkExamAccess(studentId, series) {

  const key = String(series || "").trim().toLowerCase();
  const columnHeader = EXAM_ACCESS_COLUMNS[key];

  if (!columnHeader) {
    return { allowed: true, reason: "open", attemptLimit: 1 };
  }

  const sheet = ensureAccessSheet();
  const headerMap = getHeaderIndexMap(sheet);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {

    const row = values[i];

    if (String(row[headerMap["Student ID"]] || "").trim() !== studentId) {
      continue;
    }

    const value = String(row[headerMap[columnHeader]] || "").trim().toUpperCase();

    if (value !== "YES") {
      return { allowed: false, reason: "no_access", error: "You do not have access to this exam." };
    }

    const now = new Date();
    const start = row[headerMap["Access Start"]];
    const expiry = row[headerMap["Access Expiry"]];

    if (start instanceof Date && now < start) {
      return { allowed: false, reason: "not_started", error: "Access to this exam has not started yet." };
    }

    if (expiry instanceof Date && now > expiry) {
      return { allowed: false, reason: "expired", error: "Access to this exam has expired." };
    }

    const attemptLimit = Number(row[headerMap["Attempt Limit"]] || 1);

    return { allowed: true, reason: "ok", attemptLimit: attemptLimit };

  }

  return { allowed: false, reason: "no_access", error: "You do not have access to this exam." };

}


/* =========================================================
   ATTEMPTS SHEET (per student + per paper)
   ---------------------------------------------------------
   Replaces the old single global "attempts" counter on the
   Students sheet, which blocked a student from ever taking
   a second exam family after using their one attempt.
   ========================================================= */

function ensureAttemptsSheet() {

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName("Attempts");

  if (!sheet) {
    sheet = spreadsheet.insertSheet("Attempts");
  }

  const headers = [
    "Attempt Token", "Student ID", "Paper", "Status", "Started At", "Submitted At"
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  return sheet;

}


function countUsedAttempts(headerMap, values, studentId, paper) {

  let count = 0;

  for (let i = 1; i < values.length; i++) {

    const row = values[i];

    if (
      String(row[headerMap["Student ID"]] || "").trim() === studentId &&
      String(row[headerMap["Paper"]] || "").trim() === paper
    ) {
      count++;
    }

  }

  return count;

}


/* =========================================================
   START ATTEMPT
   ========================================================= */

function startAttempt(params) {

  const studentId = String(params.studentId || "").trim();
  const paper = String(params.paper || "").trim();
  const series = String(params.series || "").trim();

  if (!studentId) {
    return jsonResponse({ success: false, reason: "not_logged_in", error: "Student ID is required." });
  }

  if (!paper) {
    return jsonResponse({ success: false, reason: "validation", error: "Paper is required." });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {

    /* ---------------------------------------------------
       1. IDENTITY CHECK (always required)
       --------------------------------------------------- */

    const accountSheet = ensureStudentAccountsSheet();
    const accountValues = accountSheet.getDataRange().getValues();

    let accountFound = false;

    for (let i = 1; i < accountValues.length; i++) {

      if (String(accountValues[i][0] || "").trim() === studentId) {

        accountFound = true;
        const status = String(accountValues[i][5] || "").trim().toUpperCase();

        if (status !== "ACTIVE") {
          return jsonResponse({ success: false, reason: "inactive", error: "This student account is inactive." });
        }

        break;

      }

    }

    if (!accountFound) {
      return jsonResponse({ success: false, reason: "student_not_found", error: "Student account not found." });
    }

    /* ---------------------------------------------------
       2. LEGACY PACKAGE CHECK (optional — only applies if
          the student has a row in "Students"; self-registered
          GATE-only students simply skip this layer)
       --------------------------------------------------- */

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const students = spreadsheet.getSheetByName("Students");

    if (students) {

      const studentValues = students.getDataRange().getValues();

      for (let i = 1; i < studentValues.length; i++) {

        const row = studentValues[i];

        if (String(row[0] || "").trim() !== studentId) continue;

        const status = String(row[4] || "").trim().toUpperCase();

        if (status && status !== "ACTIVE") {
          return jsonResponse({ success: false, reason: "inactive", error: "This student account is inactive." });
        }

        const expiryDate = row[7];
        const now = new Date();

        if (expiryDate instanceof Date && now > expiryDate) {
          return jsonResponse({ success: false, reason: "expired", error: "This student account has expired." });
        }

        break;

      }

    }

    /* ---------------------------------------------------
       3. PER-EXAM ACCESS CHECK (the real gate — this is
          where GATE / HAL / ISRO entitlement lives, keyed
          directly off the "series" the frontend sends)
       --------------------------------------------------- */

    const access = checkExamAccess(studentId, series);

    if (!access.allowed) {
      return jsonResponse({ success: false, reason: access.reason, error: access.error });
    }

    /* ---------------------------------------------------
       4. PER-PAPER ATTEMPT LIMIT
       --------------------------------------------------- */

    const attemptsSheet = ensureAttemptsSheet();
    const headerMap = getHeaderIndexMap(attemptsSheet);
    const values = attemptsSheet.getDataRange().getValues();

    const used = countUsedAttempts(headerMap, values, studentId, paper);

    if (used >= access.attemptLimit) {
      return jsonResponse({
        success: false,
        reason: "already_used",
        error: "You have already used your permitted attempt(s) for this exam."
      });
    }

    /* ---------------------------------------------------
       5. RESERVE THE ATTEMPT
       --------------------------------------------------- */

    const attemptToken = Utilities.getUuid();
    const now = new Date();

    attemptsSheet.appendRow([attemptToken, studentId, paper, "STARTED", now, ""]);

    return jsonResponse({
      success: true,
      attemptToken: attemptToken,
      studentId: studentId,
      paper: paper,
      startedAt: now.toISOString()
    });

  } finally {
    lock.releaseLock();
  }

}


/* =========================================================
   CONSUME ATTEMPT TOKEN ON SUBMISSION
   ---------------------------------------------------------
   Rejects results with no matching "STARTED" attempt, and
   rejects a second submission against the same token.
   ========================================================= */

function consumeAttemptToken(attemptToken, studentId, paper) {

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {

    const sheet = ensureAttemptsSheet();
    const headerMap = getHeaderIndexMap(sheet);
    const values = sheet.getDataRange().getValues();

    for (let i = 1; i < values.length; i++) {

      const row = values[i];

      if (String(row[headerMap["Attempt Token"]] || "").trim() !== attemptToken) {
        continue;
      }

      if (String(row[headerMap["Student ID"]] || "").trim() !== String(studentId).trim()) {
        return { ok: false, reason: "invalid_attempt", error: "Attempt token does not match student." };
      }

      const status = String(row[headerMap["Status"]] || "").trim().toUpperCase();

      if (status === "SUBMITTED") {
        return { ok: false, reason: "duplicate_submission", error: "This attempt has already been submitted." };
      }

      sheet.getRange(i + 1, headerMap["Status"] + 1).setValue("SUBMITTED");
      sheet.getRange(i + 1, headerMap["Submitted At"] + 1).setValue(new Date());

      return { ok: true };

    }

    return { ok: false, reason: "invalid_attempt", error: "No matching attempt was found for this submission." };

  } finally {
    lock.releaseLock();
  }

}


/* =========================================================
   DRIVE — JSON BACKUP
   ========================================================= */

function saveResultToDrive(data) {

  const root = DriveApp.getFolderById(FOLDER_ID);
  const jsonFolder = getOrCreateFolder(root, "JSON Backups");
  const timestamp = new Date();

  const safeStudentId = String(data.studentId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safePaper = String(data.paper || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");

  const filename = safeStudentId + "_Paper-" + safePaper + "_" + timestamp.getTime() + ".json";

  jsonFolder.createFile(filename, JSON.stringify(data, null, 2), MimeType.PLAIN_TEXT);

}


function getOrCreateFolder(parent, name) {

  const folders = parent.getFoldersByName(name);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parent.createFolder(name);

}


/* =========================================================
   RESULTS SHEET
   ========================================================= */

function saveResultToSheet(data) {

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName("Results") || spreadsheet.insertSheet("Results");

  ensureResultsHeaders(sheet);

  const sectionScores = data.sectionScores || {};
  const ga = sectionScores.ga || {};
  const eng = sectionScores.eng || {};
  const aero = sectionScores.aero || {};

  sheet.appendRow([
    new Date(),
    data.studentId || "",
    data.paper || "",
    data.paperTitle || "",
    data.score || 0,
    data.totalQuestions || 0,
    data.percentage || 0,
    ga.correct || 0,
    ga.total || 0,
    eng.correct || 0,
    eng.total || 0,
    aero.correct || 0,
    aero.total || 0,
    data.autoSubmitted ? "Automatic" : "Student",
    data.attemptToken || "",
    data.startedAt || "",
    data.submittedAt || ""
  ]);

}


function ensureResultsHeaders(sheet) {

  const headers = [
    "Submitted At", "Student ID", "Paper", "Paper Title", "Score",
    "Total Questions", "Percentage", "GA Correct", "GA Total",
    "English/Reasoning Correct", "English/Reasoning Total",
    "Aeronautical Correct", "Aeronautical Total", "Submission Type",
    "Attempt Token", "Started At", "Student Submitted At"
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

}


/* =========================================================
   DATABASE SETUP
   ========================================================= */

function setupDatabase() {

  ensureStudentAccountsSheet();
  ensureStudentsSheet();

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let results = spreadsheet.getSheetByName("Results");

  if (!results) {
    results = spreadsheet.insertSheet("Results");
  }

  ensureResultsHeaders(results);

  ensureAccessSheet();
  ensureAttemptsSheet();

  return "Database setup completed successfully.";

}


/* =========================================================
   STUDENTS SHEET (legacy — paid package metadata only)
   ========================================================= */

function ensureStudentsSheet() {

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName("Students");

  if (!sheet) {
    sheet = spreadsheet.insertSheet("Students");
  }

  const headers = [
    "Student ID", "Name", "Email", "Password Hash", "Status", "Package",
    "Start Date", "Expiry Date", "Attempts", "Last Login", "Notes"
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  return sheet;

}


/* =========================================================
   PASSWORD HASH
   ========================================================= */

function hashPassword(password) {

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8
  );

  return digest.map(function (byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ("0" + value.toString(16)).slice(-2);
  }).join("");

}


/* =========================================================
   CREATE A TEST ACCOUNT (dev helper — grants HAL/ISRO/GATE)
   ========================================================= */

function createTestStudent() {

  const students = ensureStudentsSheet();
  const studentId = "IA-TEST-001";
  const password = "Test@12345";

  const values = students.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === studentId) {
      Logger.log("Test student already exists.");
      return;
    }
  }

  const startDate = new Date();
  const expiryDate = new Date(startDate);
  expiryDate.setDate(expiryDate.getDate() + 7);

  students.appendRow([
    studentId, "Test Student", "test@example.com", hashPassword(password),
    "ACTIVE", "GATE + HAL + ISRO Premium 7 Days", startDate, expiryDate, 0, "", "Temporary test account"
  ]);

  const access = ensureAccessSheet();
  const headerMap = getHeaderIndexMap(access);
  const row = [];

  row[headerMap["Student ID"]] = studentId;
  row[headerMap["HAL Access"]] = "YES";
  row[headerMap["ISRO Electronics"]] = "YES";
  row[headerMap["ISRO Mechanical"]] = "YES";
  row[headerMap["ISRO Computer Science"]] = "YES";
  row[headerMap["GATE Access"]] = "YES";
  row[headerMap["Access Start"]] = startDate;
  row[headerMap["Access Expiry"]] = expiryDate;
  row[headerMap["Attempt Limit"]] = 1;
  row[headerMap["Notes"]] = "Temporary test account";

  access.appendRow(row);

  Logger.log("Test account created with access to all exam families.");

}


/* =========================================================
   DOCX REPORT
   ========================================================= */

function saveResultToWord(data) {

  const root = DriveApp.getFolderById(FOLDER_ID);
  const wordFolder = getOrCreateFolder(root, "Word Reports");

  const studentId = String(data.studentId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  const paper = String(data.paper || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  const stamp = new Date().getTime();

  const title = studentId + " - " + paper + " - Attempt Report";

  const doc = DocumentApp.create(title);
  const body = doc.getBody();

  body.appendParagraph("INDIAN AERONAUTICS").setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph("Mock Test Attempt Report").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph("Student ID: " + (data.studentId || ""));
  body.appendParagraph("Name: " + (data.studentName || ""));
  body.appendParagraph("Email: " + (data.email || ""));
  body.appendParagraph("Paper: " + (data.paperTitle || data.paper || ""));
  body.appendParagraph("Score: " + (data.score || 0));
  body.appendParagraph("Percentage: " + (data.percentage || 0));
  body.appendParagraph("Total Questions: " + (data.totalQuestions || 0));
  body.appendParagraph("Submission: " + (data.autoSubmitted ? "Automatic" : "Student"));
  body.appendParagraph("Started At: " + (data.startedAt || ""));
  body.appendParagraph("Submitted At: " + (data.submittedAt || ""));
  body.appendHorizontalRule();

  body.appendParagraph("QUESTION-BY-QUESTION ANALYSIS").setHeading(DocumentApp.ParagraphHeading.HEADING1);

  const questions = Array.isArray(data.questions) ? data.questions : [];

  questions.forEach(function (q, index) {

    body.appendParagraph("Question " + (index + 1)).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph("Question: " + String(q.question || q.text || ""));

    const options = Array.isArray(q.options) ? q.options : [];

    if (options.length) {
      body.appendParagraph("Options:");
      options.forEach(function (option, oi) {
        body.appendParagraph(String.fromCharCode(65 + oi) + ". " + String(option));
      });
    }

    body.appendParagraph("Student Response: " + formatAnswer(q.studentAnswer));
    body.appendParagraph("Correct Answer: " + formatAnswer(q.correctAnswer));
    body.appendParagraph("Result: " + (
      q.isCorrect ? "CORRECT" :
      (q.studentAnswer === undefined || q.studentAnswer === null ? "UNANSWERED" : "WRONG")
    ));

    if (q.explanation) {
      body.appendParagraph("Explanation: " + String(q.explanation));
    }

    body.appendParagraph("");

  });

  doc.saveAndClose();

  const tempDoc = DriveApp.getFileById(doc.getId());
  const exportUrl = "https://docs.google.com/document/d/" + doc.getId() + "/export?format=docx";

  const response = UrlFetchApp.fetch(exportUrl, {
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    tempDoc.setTrashed(true);
    throw new Error("DOCX export failed. HTTP " + response.getResponseCode());
  }

  const blob = response.getBlob().setName(studentId + "_Paper-" + paper + "_" + stamp + ".docx");

  wordFolder.createFile(blob);

  tempDoc.setTrashed(true);

}


function formatAnswer(value) {

  if (value === undefined || value === null || value === "") {
    return "Not answered";
  }

  return String(value);

}


/* =========================================================
   DATABASE TEST
   ========================================================= */

function testDatabase() {
  setupDatabase();
  Logger.log("Database setup completed.");
}
