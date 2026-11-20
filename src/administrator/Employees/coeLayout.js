/* ============================================================================
    coeLayout.js
    SINGLE SOURCE OF TRUTH for the Certificate of Employment.
============================================================================ */

import * as Shared from "../Employees/employeeShared";

/* ---------- page layout (px @ 96 dpi) ---------- */

export const PAGE = {
  width: 794,
  height: 1123,
  marginX: 85,
  marginTop: 48,
  marginBottom: 20,
  continueTop: 96,

  logoHeight: 70,
  headerGap: 16,
  headerPadBottom: 12,
  headerRule: 0,
  schoolSize: 19,
  schoolTracking: 0.025,
  schoolLineHeight: 1.25,
  addressSize: 11,
  addressLineHeight: 1.25,

  bodyPadTop: 40,
  titleSize: 21,
  titleSpacing: 0.3,
  titleLineHeight: 1.5,
  titleMarginBottom: 40,
  titleUnderlineOffset: 0.11,
  titleUnderlineThickness: 0.06,
  bodySize: 15,
  lineHeight: 1.5,
  paragraphGap: 20,

  tableLineHeight: 1.35,
  tableColumnGap: 24,
  tableRowGap: 12,

  signatoryGap: 56,
  signatoryLineHeight: 1.25,

  footerSize: 12,
  footerNoteSize: 10,
  footerLineHeight: 1.375,
  sealLineHeight: 20,
  footerGap: 8,
  footerRevisionGap: 15,
  footerRule: 0,
  badgeHeight: 65,
  pageNumberY: 1108,

  colors: {
    ink: "#0f172a",
    brand: "#6f80a8",
    headerRule: "#1e293b",
    footer: "#000080",
    footerRule: "#e2e8f0",
    revision: "#000000",
  },
};

export const LOGO_URL = "files/setting_image_starter/PDFLogo.png";
export const BADGE_URL = "files/setting_image_starter/ClassNK.png";

export const getFooterMetrics = () => {
  const textHeight =
    3 * PAGE.footerSize * PAGE.footerLineHeight +
    PAGE.footerRevisionGap +
    PAGE.footerNoteSize * PAGE.footerLineHeight;
  const contentHeight = Math.max(textHeight, PAGE.badgeHeight);
  const sealHeight = PAGE.footerNoteSize * PAGE.sealLineHeight;
  const total = sealHeight + PAGE.footerGap * 2 + PAGE.footerRule + contentHeight;
  return { textHeight, contentHeight, sealHeight, total, top: PAGE.height - PAGE.marginBottom - total };
};

/* ---------- letterhead text ---------- */

export const LETTER = {
  school: "NYK-TDG MARITIME ACADEMY",
  address: [
    "Knowledge Avenue, Carmeltown, Canlubang, 4028,",
    "Calamba City, Laguna, Philippines, P.O. Box No. 4037",
  ],
  org: "NYK-Transnational Institute Foundation, Inc.",
  dba: "NYK-TDG Maritime Academy (NTMA)",
  contacts: [
    ["Tel. No.:", "(049) 508-8650; "],
    ["Manila Line:", "(02) 8554-3888 loc 8650"],
  ],
  email: "hr@ntma.edu.ph",
  website: "http://www.ntma.edu.ph",
  revision: "Revision : 03 as of 2023 October 05",
  sealNote: "(not valid without company seal)",
  title: "CERTIFICATION",
};

export const DEFAULT_PURPOSE = "whatever legal purpose it may serve";

const SAMPLE_EMPLOYEE = {
  full_name: "[Employee name]",
  position_name: "[position]",
  department_name: "[department]",
  center_name: "",
};

/* ---------- small helpers ---------- */

export const isBlank = (v) => v == null || String(v).trim() === "";
export const clean = (v) => (v && v !== "—" ? String(v).trim() : "");
export const str = (v) => String(v ?? "").trim();

export const pick = (record, fields) => fields.map((f) => record?.[f]).find((v) => !isBlank(v)) || "";

const EMPLOYEE_FIELDS = {
  key: ["ee_id", "id", "employee_id", "ee_id_number", "id_number"],
  number: ["ee_id_number", "employee_id_number", "id_number"],
  dateHired: ["ee_date_hired", "ee_employment_start", "date_hired", "employment_start"],
  accountStatus: ["ee_status", "status"],
  fullName: ["employee_name", "full_name", "name"],
  first: ["ee_first_name", "first_name", "firstname"],
  middle: ["ee_middle_name", "middle_name", "middlename"],
  last: ["ee_last_name", "last_name", "lastname"],
  gender: ["ee_gender", "gender", "ee_sex", "sex"],
  civilStatus: ["ee_civil_status", "civil_status", "ee_marital_status", "marital_status"],
};

export const get = (employee, key) => pick(employee, EMPLOYEE_FIELDS[key]);

export const getEmployeeName = (employee) => {
  try {
    const shared = Shared.getFullName?.(employee);
    if (!isBlank(shared)) return str(shared);
  } catch {}
  const direct = get(employee, "fullName");
  if (direct) return str(direct);
  return ["first", "middle", "last"].map((k) => get(employee, k)).filter(Boolean).join(" ") || "Unnamed Employee";
};

export const getNaturalName = (employee) => {
  const parts = ["first", "middle", "last"].map((k) => str(get(employee, k))).filter(Boolean);
  if (parts.length) return parts.join(" ");
  const full = getEmployeeName(employee);
  const m = full.match(/^([^,]+),\s*(.+)$/);
  return m ? `${m[2].trim()} ${m[1].trim()}` : full;
};

export const getLastName = (employee) => {
  const last = str(get(employee, "last"));
  if (last) return last;
  const full = getEmployeeName(employee);
  return full.includes(",") ? full.split(",")[0].trim() : full.split(/\s+/).pop() || full;
};

export const getHonorific = (employee) => {
  const g = str(get(employee, "gender")).toLowerCase();
  const civil = str(get(employee, "civilStatus")).toLowerCase();
  if (/^(m|male|man|boy)$/.test(g)) return "Mr.";
  if (/^(f|female|woman|girl)$/.test(g)) return /married|widow/.test(civil) ? "Mrs." : "Ms.";
  return "";
};

export const parseDate = (value) => {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function formatDate(value) {
  const d = parseDate(value);
  return d ? d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : String(value || "");
}

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

const getIssueParts = (value) => {
  const d = parseDate(value);
  return d
    ? { day: ordinal(d.getDate()), monthYear: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) }
    : { day: "N/A", monthYear: "N/A" };
};

export const cleanPurpose = (p) =>
  String(p || "").trim().replace(/^for\s+/i, "").replace(/[.\s]+$/, "") || DEFAULT_PURPOSE;

export function formatMoney(value) {
  const n = Number(str(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0
    ? `PHP ${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : str(value);
}

/* ---------- employment history ---------- */

export const isBlankPeriod = (p) =>
  isBlank(p?.from) && isBlank(p?.to) && !p?.present && isBlank(p?.position) && isBlank(p?.department);

export const activePeriods = (history) => (history || []).filter((p) => !isBlankPeriod(p));

const formatInclusive = (value) => {
  const d = parseDate(value);
  return d ? `${d.getFullYear()} ${d.toLocaleDateString("en-US", { month: "long" })} ${String(d.getDate()).padStart(2, "0")}` : "";
};

const periodDates = (p) => `${formatInclusive(p.from)} to ${p.present ? "Present" : formatInclusive(p.to)}`;

/* ---------- certificate wording ---------- */

const T = (text) => ({ type: "text", text });
const B = (text) => ({ type: "bold", text });
const V = (text) => ({ type: "value", text });

export const buildCertificate = (employeeRecord, form) => {
  const sample = !employeeRecord;
  const employee = employeeRecord || SAMPLE_EMPLOYEE;
  const val = (v) => clean(v) || "N/A";

  const unit = val(employee.department_name);
  const hiredRaw = get(employee, "dateHired");
  const hired = hiredRaw ? formatDate(hiredRaw) : sample ? "[date hired]" : "N/A";
  const issue = getIssueParts(form.issueDate);
  const honorific = sample ? "" : getHonorific(employee);
  const withTitle = (n) => (honorific ? `${honorific} ${n}` : n);
  const name = sample ? getEmployeeName(employee) : withTitle(getNaturalName(employee));
  const surname = sample ? name : withTitle(getLastName(employee));
  const position = val(employee.position_name);
  const remarks = str(form.remarks);
  const periods = sample ? [] : activePeriods(form.history);
  const hasHistory = periods.length > 0;
  const { employmentStatus: status, salary, leaveReason: reason, lastDay } = form;

  const sentences = [
    status && [T("The employee's employment status is "), V(status), T(".")],
    salary && [T("The employee's monthly compensation is "), V(formatMoney(salary)), T(".")],
    reason && [T("Reason for leaving: "), V(reason), T(".")],
  ].filter(Boolean);

  const details = sentences.length ? sentences.reduce((acc, s, i) => (i ? [...acc, T(" "), ...s] : s), []) : null;
  const employer = [B(LETTER.org), T(", doing business under the name of "), B(LETTER.dba)];

  return {
    sample,
    intro: hasHistory
      ? [T("This is to certify that "), V(name), T(" has been employed by "), ...employer, T(", with the following inclusive dates and positions:")]
      : [
          T("This is to certify that "), V(name), T(" is an employee of "), ...employer,
          T(/^[aeiou]/i.test(position) ? ", as an " : ", as a "), T(position), T(", "), T(unit),
          T(", from "), T(hired), T(" to "), lastDay ? T(formatDate(lastDay)) : T("present"), T("."),
        ],
    table: hasHistory ? periods.map((p) => ({ dates: periodDates(p), position: p.position.trim() || position, department: p.department.trim() })) : null,
    details,
    purpose: [T("This certification is issued to "), V(surname), T(" "), T(cleanPurpose(form.purpose)), T(".")],
    remarks: remarks ? [B("Remarks: "), T(remarks)] : null,
    issued: [T("Issued this "), T(issue.day), T(" day of "), T(issue.monthYear), T(".")],
    signatory: str(form.signatory),
    designation: str(form.designation),
  };
};