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
