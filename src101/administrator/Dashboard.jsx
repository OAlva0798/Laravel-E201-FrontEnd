import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, extractList, getErrorMessage, getFullName, getInitials } from "./Employees/employeeShared";
import { useOrgData } from "../data/OrgDataContext";
import { getStoredUser } from "../lib/auth";
import { hasRoleAccess } from "../assets/js/roleAccess";
import {
  STATUS_CARDS, UPCOMING_WINDOWS, countByStatus, hasStatus, upcomingDates,
  hireDate, dayLabel, formatDate,
} from "./dashboardUtils";

const PAGE = 50; // rows shown before "Show more"

// ---------- small building blocks ----------
// Every status gets its own palette color (edit tones in dashboardUtils.js STATUS_CARDS).
// Full class names are written out so Tailwind can see them.
const TONES = {
  emerald: { chip: "bg-emerald-light text-emerald-dark", bar: "bg-emerald", solid: "border-emerald bg-emerald", hover: "hover:border-emerald" },
  amber:   { chip: "bg-amber-light text-amber-dark",     bar: "bg-amber",   solid: "border-amber bg-amber",     hover: "hover:border-amber" },
  indigo:  { chip: "bg-indigo-light text-indigo-dark",   bar: "bg-indigo",  solid: "border-indigo bg-indigo",   hover: "hover:border-indigo" },
  cyan:    { chip: "bg-cyan-light text-cyan-dark",       bar: "bg-cyan",    solid: "border-cyan bg-cyan",       hover: "hover:border-cyan" },
  purple:  { chip: "bg-purple-light text-purple-dark",   bar: "bg-purple",  solid: "border-purple bg-purple",   hover: "hover:border-purple" },
  teal:    { chip: "bg-teal-light text-teal-dark",       bar: "bg-teal",    solid: "border-teal bg-teal",       hover: "hover:border-teal" },
  rose:    { chip: "bg-rose-light text-rose-dark",       bar: "bg-rose",    solid: "border-rose bg-rose",       hover: "hover:border-rose" },
};

function StatCard({ label, icon, tone = "emerald", count, active, loading, onClick }) {
  const t = TONES[tone] || TONES.emerald;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group relative overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition
        focus:outline-none focus-visible:ring-4 focus-visible:ring-input-ring
        ${active ? `${t.solid} text-white` : `border-line bg-surface hover:shadow-md ${t.hover}`}`}
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${active ? "bg-white/40" : t.bar}`} />
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-bold uppercase tracking-wider ${active ? "text-white/80" : "text-muted"}`}>{label}</span>
        <span className={`flex size-8 items-center justify-center rounded-lg ${active ? "bg-white/20 text-white" : t.chip}`}>
          <i className={`bi ${icon}`} />
        </span>
      </div>
      <p className={`mt-2 text-3xl font-extrabold tabular-nums ${active ? "text-white" : "text-heading"}`}>
        {loading ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-slate-200/70" /> : count}
      </p>
    </button>
  );
}

function Avatar({ emp, tone = "blue" }) {
  const tones = { blue: "bg-blue-light text-blue-dark", amber: "bg-amber-light text-amber-dark" };
  return (
    <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tones[tone]}`}>
      {getInitials(getFullName(emp, ""))}
    </span>
  );
}

function Panel({ title, icon, right, children }) {
  return (
    <section className="card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-subheading">
          <i className={`bi ${icon} text-blue`} /> {title}
        </h2>
        {right}
      </header>
      {children}
    </section>
  );
}

function UpcomingList({ rows, empty, tone, icon, badge, sub }) {
  if (!rows.length) return <p className="px-5 py-10 text-center text-sm text-subtle">{empty}</p>;
  return (
    <ul className="max-h-96 divide-y divide-line overflow-y-auto">
      {rows.map(({ emp, date, days, years }) => (
        <li key={`${emp.ee_id_number}-${emp.ee_lastname}-${date.getTime()}`} className="flex items-center gap-3 px-4 py-3 sm:px-5">
          <Avatar emp={emp} tone={tone} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-heading">{getFullName(emp)}</p>
            <p className="truncate text-xs text-muted">{sub(emp, years)}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-subheading">
              <i className={`bi ${icon} mr-1 ${tone === "amber" ? "text-amber" : "text-blue"}`} />
              {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
            <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${days === 0 ? "bg-btn-accent text-btn-accent-text" : "bg-status-info-soft text-status-info-text"}`}>
              {badge(days, years)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- main screen ----------
function EmployeeDashboard() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(STATUS_CARDS[0].value);
  const [search, setSearch] = useState("");
  const [windowDays, setWindowDays] = useState(30);
  const [shown, setShown] = useState(PAGE);

  const { department, position } = useOrgData(["department", "position"]);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      setEmployees(extractList(await apiRequest("/employees", {}, signal)));
    } catch (err) {
      if (err?.name !== "AbortError") setError(getErrorMessage(err, "Unable to load employees."));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const counts = useMemo(() => countByStatus(employees), [employees]);
  const birthdays = useMemo(() => upcomingDates(employees, "ee_birth_date", windowDays), [employees, windowDays]);
  const anniversaries = useMemo(() => upcomingDates(employees, hireDate, windowDays), [employees, windowDays]);

  const statusRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees
      .filter((e) => hasStatus(e, status))
      .filter((e) => !q || `${getFullName(e, "")} ${e.ee_id_number ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => getFullName(a, "").localeCompare(getFullName(b, "")));
  }, [employees, status, search]);

  const deptName = (e) => department.map.get(String(e.ee_department_reference)) || "—";
  const posName = (e) => position.map.get(String(e.ee_position_reference)) || "—";

  const pickStatus = (value) => { setStatus(value); setSearch(""); setShown(PAGE); };

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-heading sm:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted">
            {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="btn btn-secondary btn-sm shadow-sm"
        >
          <i className={`bi bi-arrow-clockwise ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-status-danger-line bg-status-danger-soft px-4 py-3 text-sm text-status-danger-text">
          <span>{error}</span>
          <button type="button" onClick={() => load()} className="font-semibold underline">Try again</button>
        </div>
      )}

      {/* counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        <div className="relative col-span-2 overflow-hidden rounded-2xl bg-slate-dark p-4 text-white shadow-sm sm:col-span-3 lg:col-span-4 xl:col-span-1">
          <span className="absolute inset-x-0 top-0 h-1 bg-blue" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">Total</span>
            <i className="bi bi-people text-lg text-white/80" />
          </div>
          <p className="mt-2 text-3xl font-extrabold tabular-nums">
            {loading ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-white/20" /> : employees.length}
          </p>
        </div>
        {STATUS_CARDS.map((s) => (
          <StatCard
            key={s.value}
            label={s.value}
            icon={s.icon}
            tone={s.tone}
            count={counts[s.value]}
            loading={loading}
            active={status === s.value}
            onClick={() => pickStatus(s.value)}
          />
        ))}
      </div>

      {/* employees of the chosen status */}
      <Panel
        title={`${status} employees (${statusRows.length})`}
        icon="bi-list-ul"
        right={
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShown(PAGE); }}
            placeholder="Search name or ID…"
            aria-label={`Search ${status} employees`}
            className="field sm:w-64 py-2"
          />
        }
      >
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-subtle">Loading employees…</p>
        ) : statusRows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-subtle">No {status.toLowerCase()} employees found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-th-bg text-[11px] uppercase tracking-wider text-th-text">
                  <tr>
                    <th className="px-4 py-2.5 font-bold sm:px-5">Employee</th>
                    <th className="px-4 py-2.5 font-bold">ID No.</th>
                    <th className="hidden px-4 py-2.5 font-bold md:table-cell">Department</th>
                    <th className="hidden px-4 py-2.5 font-bold lg:table-cell">Position</th>
                    <th className="hidden px-4 py-2.5 font-bold sm:table-cell">Date hired</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {statusRows.slice(0, shown).map((e, i) => (
                    <tr key={`${e.ee_id_number}-${i}`} className="hover:bg-row-hover">
                      <td className="px-4 py-2.5 sm:px-5">
                        <div className="flex items-center gap-3">
                          <Avatar emp={e} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-heading">{getFullName(e)}</p>
                            <p className="truncate text-xs text-muted md:hidden">{deptName(e)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-body">{e.ee_id_number || "—"}</td>
                      <td className="hidden px-4 py-2.5 text-body md:table-cell">{deptName(e)}</td>
                      <td className="hidden px-4 py-2.5 text-body lg:table-cell">{posName(e)}</td>
                      <td className="hidden whitespace-nowrap px-4 py-2.5 text-body sm:table-cell">{formatDate(hireDate(e))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {statusRows.length > shown && (
              <div className="border-t border-line p-3 text-center">
                <button type="button" onClick={() => setShown((n) => n + PAGE)} className="text-sm font-semibold text-link hover:text-link-hover">
                  Show more ({statusRows.length - shown} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </Panel>

      {/* birthdays + anniversaries */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-extrabold text-heading">Coming up</h2>
        <div role="group" aria-label="Time window" className="inline-flex rounded-xl border border-line bg-surface p-1 shadow-sm">
          {UPCOMING_WINDOWS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setWindowDays(d)}
              aria-pressed={windowDays === d}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${windowDays === d ? "bg-btn-primary text-btn-primary-text" : "text-body hover:bg-surface-muted"}`}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={`Birthdays (${birthdays.length})`} icon="bi-cake2">
          <UpcomingList
            rows={loading ? [] : birthdays}
            empty={loading ? "Loading…" : `No birthdays in the next ${windowDays} days.`}
            tone="amber"
            icon="bi-cake2"
            sub={(e) => `${deptName(e)} · ${posName(e)}`}
            badge={(days) => dayLabel(days)}
          />
        </Panel>
        <Panel title={`Work anniversaries (${anniversaries.length})`} icon="bi-award">
          <UpcomingList
            rows={loading ? [] : anniversaries}
            empty={loading ? "Loading…" : `No work anniversaries in the next ${windowDays} days.`}
            tone="blue"
            icon="bi-award"
            sub={(e, years) => `${years} year${years === 1 ? "" : "s"} of service · ${deptName(e)}`}
            badge={(days) => dayLabel(days)}
          />
        </Panel>
      </div>
    </div>
  );
}

// ---------- entry (default export keeps the old name so AdminIndex needs no change) ----------
export default function DashboardLayout() {
  // UI hint only. The server must still refuse /employees to people without access.
  const [canView] = useState(() => hasRoleAccess(getStoredUser(), "employees"));

  if (!canView) {
    return (
      <div className="card p-8 text-center">
        <i className="bi bi-shield-lock text-3xl text-blue" />
        <h1 className="mt-3 text-lg font-extrabold text-heading">Welcome</h1>
        <p className="mt-1 text-sm text-muted">Employee statistics are available to accounts with Employees access.</p>
      </div>
    );
  }
  return <EmployeeDashboard />;
}
