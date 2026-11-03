// Pure helpers for the dashboard (no React) so they are easy to read and test.
import { firstDefined, normalize } from "./Employees/employeeShared";

// Edit this list to change which statuses get a card, and in what order.
export const STATUS_CARDS = [
  { value: "Regular",      icon: "bi-person-check", tone: "emerald" },
  { value: "Probationary", icon: "bi-hourglass-split", tone: "amber" },
  { value: "Contractual",  icon: "bi-file-earmark-text", tone: "indigo" },
  { value: "Part Time",    icon: "bi-clock", tone: "cyan" },
  { value: "Trainee",      icon: "bi-mortarboard", tone: "purple" },
  { value: "Shipboard",    icon: "bi-water", tone: "teal" },
  { value: "Resigned",     icon: "bi-person-dash", tone: "rose" },
];

export const UPCOMING_WINDOWS = [7, 30, 60, 90]; // "next N days" choices

const key = (v) => normalize(v).toLowerCase();

export const hasStatus = (emp, status) => key(emp.ee_employment_status) === key(status);

// Same counting rule as the Employees page tabs, so the numbers match.
export function countByStatus(employees) {
  const counts = Object.fromEntries(STATUS_CARDS.map((s) => [s.value, 0]));
  for (const e of employees) {
    const hit = STATUS_CARDS.find((s) => hasStatus(e, s.value));
    if (hit) counts[hit.value] += 1;
  }
  return counts;
}

const parseYMD = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalize(v));
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
};

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export const startOfToday = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};

// Next time this month/day happens, on or after today (Feb 29 -> Feb 28 in common years).
function nextOccurrence({ m, d }, today) {
  const make = (yr) => new Date(yr, m - 1, m === 2 && d === 29 && !isLeap(yr) ? 28 : d);
  const thisYear = make(today.getFullYear());
  return thisYear >= today ? thisYear : make(today.getFullYear() + 1);
}

// Only current staff are celebrated: not resigned, not inactive.
const isCurrentStaff = (e) => !hasStatus(e, "Resigned") && key(e.ee_status) !== "inactive";

export function upcomingDates(employees, field, withinDays, today = startOfToday()) {
  const rows = [];
  for (const emp of employees) {
    if (!isCurrentStaff(emp)) continue;
    const ymd = parseYMD(typeof field === "function" ? field(emp) : emp[field]);
    if (!ymd) continue;
    const date = nextOccurrence(ymd, today);
    const days = Math.round((date - today) / 86400000);
    const years = date.getFullYear() - ymd.y;
    if (days > withinDays || years < 1) continue; // years<1: hired this year, no anniversary yet
    rows.push({ emp, date, days, years });
  }
  return rows.sort((a, b) => a.days - b.days || normalize(a.emp.ee_lastname).localeCompare(normalize(b.emp.ee_lastname)));
}

export const hireDate = (e) => firstDefined(e.ee_date_hired, e.ee_date_hired_nykfil, e.ee_date_hired_tdg);

export const dayLabel = (days) => (days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days} days`);

export const formatDate = (v, opts = { year: "numeric", month: "short", day: "numeric" }) => {
  const p = parseYMD(v);
  return p ? new Date(p.y, p.m - 1, p.d).toLocaleDateString(undefined, opts) : "—";
};

/* ---------- friendliness helpers ---------- */
export const ALL = "__all__"; // pseudo-status: everyone

export const SORTS = [
  { key: "name-asc",  label: "Name A–Z" },
  { key: "name-desc", label: "Name Z–A" },
  { key: "hired-new", label: "Newest hired" },
  { key: "hired-old", label: "Longest serving" },
];

const nameKey = (e) => `${normalize(e.ee_lastname)} ${normalize(e.ee_firstname)}`.toLowerCase();
const hiredKey = (e) => {
  const p = parseYMD(hireDate(e));
  return p ? p.y * 10000 + p.m * 100 + p.d : null;
};

export function sortEmployees(list, sortKey) {
  const out = [...list];
  const byName = (a, b) => nameKey(a).localeCompare(nameKey(b));
  const byHired = (dir) => (a, b) => {
    const x = hiredKey(a), y = hiredKey(b);
    if (x === null && y === null) return byName(a, b);
    if (x === null) return 1;            // no date -> always last
    if (y === null) return -1;
    return (x - y) * dir || byName(a, b);
  };
  if (sortKey === "name-desc") return out.sort((a, b) => byName(b, a));
  if (sortKey === "hired-new") return out.sort(byHired(-1));
  if (sortKey === "hired-old") return out.sort(byHired(1));
  return out.sort(byName);
}

export const greeting = (date = new Date()) => {
  const h = date.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

// "New", "8 mo", "6 yrs", "6 yrs 3 mo"
export function tenureLabel(value, today = startOfToday()) {
  const p = parseYMD(value);
  if (!p) return "";
  let months = (today.getFullYear() - p.y) * 12 + (today.getMonth() + 1 - p.m);
  if (today.getDate() < p.d) months -= 1;
  if (months < 0) return "";
  if (months < 1) return "New";
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12), r = months % 12;
  return `${y} yr${y === 1 ? "" : "s"}${r ? ` ${r} mo` : ""}`;
}

// Today / This week / Later (rows must already be sorted by days)
export function groupUpcoming(rows) {
  const groups = [
    { key: "today", label: "Today", rows: rows.filter((r) => r.days === 0) },
    { key: "week",  label: "This week", rows: rows.filter((r) => r.days >= 1 && r.days <= 7) },
    { key: "later", label: "Later", rows: rows.filter((r) => r.days > 7) },
  ];
  return groups.filter((g) => g.rows.length);
}

// Strict on purpose: it ends up inside a mailto: link, so no "?", "&", "#", "," or spaces.
export const isEmail = (v) => /^[^\s@?&#,;<>"']+@[^\s@?&#,;<>"']+\.[^\s@?&#,;<>"']+$/.test(normalize(v));

export const displayName = (e) =>
  [e.ee_firstname, e.ee_lastname].map(normalize).filter(Boolean).join(" ") || "Employee";
