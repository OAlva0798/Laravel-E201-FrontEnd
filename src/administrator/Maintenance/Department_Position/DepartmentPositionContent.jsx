
import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Swal from "sweetalert2";
import { API_BASE_URL } from "../../../assets/js/appConfig";
import {
  showErrorAlert,
  showLoadingPopup,
  showSuccessAlert,
} from "../../../assets/js/swalHelpers";
import LoadingState from "../../../assets/function/LoadingState";
import DepartmentPositionForm, {
  LABEL,
  PREFIX,
  ToggleStatusButton,
  buttonClass,
  firstDefined,
  getName,
  getReference,
  inputClass,
} from "./DepartmentPositionForm";

/* ------------------------------ Constants ------------------------------ */

const URLS = {
  centers: `${API_BASE_URL}/centers/active-centers`,
  departments: `${API_BASE_URL}/departments`,
  positions: `${API_BASE_URL}/positions`,
};

const NO_ROWS = [];

const EMPTY_DEPARTMENT = {
  md_name: "",
  md_center_reference: "",
  md_status: "Active",
};

const EMPTY_POSITION = {
  mp_name: "",
  mp_department_reference: "",
  mp_status: "Active",
};

/* -------------------------------- Helpers ------------------------------- */

const getToken = () =>
  localStorage.getItem("access_token") ||
  sessionStorage.getItem("access_token") ||
  "";

async function apiRequest(url, options = {}) {
  const token = getToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const text = await response.text();
  let result = {};

  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    result = { message: text };
  }

  if (!response.ok) {
    const errors = result?.errors
      ? Object.values(result.errors).flat().join("\n")
      : "";

    throw new Error(
      errors ||
        result?.message ||
        result?.detail ||
        `Request failed (${response.status}).`,
    );
  }

  return result;
}

function getRows(result, key) {
  return (
    [
      result,
      result?.data,
      result?.[key],
      result?.data?.[key],
    ].find(Array.isArray) || NO_ROWS
  );
}

const getCenterReference = (item) =>
  firstDefined(
    item?.md_center_reference,
    item?.md_mc_reference,
    item?.center?.mc_reference,
    item?.mc_reference,
  );

const getDepartmentReference = (item) =>
  firstDefined(
    item?.mp_department_reference,
    item?.mp_md_reference,
    item?.department?.md_reference,
    item?.md_reference,
  );

const getStatus = (item, type) =>
  item?.[`${PREFIX[type]}_status`] || "Unknown";

const matches = (value, query) =>
  String(value ?? "").toLowerCase().includes(query);

function groupBy(items, getKey) {
  const groups = new Map();

  for (const item of items) {
    const key = getKey(item);
    const group = groups.get(key);

    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return groups;
}

function getCreatedDepartmentReference(result) {
  return String(
    [
      result?.md_reference,
      result?.data?.md_reference,
      result?.department?.md_reference,
      result?.data?.department?.md_reference,
      result?.data?.data?.md_reference,
    ].find(Boolean) || "",
  );
}

let newRowCounter = 0;

function createPositionRow(position = {}) {
  const reference = getReference(position, "position");

  return {
    mp_reference: reference,
    mp_name: position.mp_name || "",
    mp_status: position.mp_status || "Active",
    _key: reference || `new-${++newRowCounter}`,
    _isNew: !reference,
  };
}

function snapshotOf(form, rows) {
  return JSON.stringify([
    form,
    rows.map(({ _key, mp_name, mp_status }) => [
      _key,
      mp_name,
      mp_status,
    ]),
  ]);
}

function notifySuccess(title, message, timer = 1400) {
  Swal.close();
  showSuccessAlert(`${title}: ${message}`, timer);
}

const expandNew = (rows, type) => (previous) => {
  const next = { ...previous };

  for (const row of rows) {
    const reference = getReference(row, type);

    if (!(reference in next)) {
      next[reference] = true;
    }
  }

  return next;
};

/* --------------------------- Position persistence -------------------------- */

async function syncPositions(rows, originals, departmentReference) {
  const results = await Promise.allSettled(
    rows.map(async (row) => {
      const name = row.mp_name.trim();

      if (row._isNew) {
        await apiRequest(URLS.positions, {
          method: "POST",
          body: JSON.stringify({
            mp_name: name,
            mp_department_reference: departmentReference,
            mp_status: row.mp_status || "Active",
          }),
        });

        return;
      }

      const original = originals.get(row.mp_reference);
      if (!original) return;

      const url = `${URLS.positions}/${encodeURIComponent(
        row.mp_reference,
      )}`;

      if (name !== String(original.mp_name || "").trim()) {
        await apiRequest(url, {
          method: "PUT",
          body: JSON.stringify({
            mp_name: name,
            mp_department_reference: departmentReference,
          }),
        });
      }

      if (row.mp_status !== (original.mp_status || "Active")) {
        await apiRequest(url, {
          method: "PATCH",
          body: JSON.stringify({ mp_status: row.mp_status }),
        });
      }
    }),
  );

  return results.filter((result) => result.status === "rejected");
}

/* ---------------------------- Small components ---------------------------- */

const IconButton = memo(function IconButton({
  title,
  onClick,
  children,
  color = "slate",
}) {
  const colors = {
    slate: "border-slate-200 text-slate-600 hover:bg-slate-50",
    amber: "border-amber-200 text-amber-700 hover:bg-amber-50",
    blue: "border-blue-200 text-blue-700 hover:bg-blue-50",
    emerald: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
    red: "border-red-200 text-red-600 hover:bg-red-50",
  };

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm transition ${colors[color] || colors.slate}`}
    >
      {children}
    </button>
  );
});

const PositionRow = memo(function PositionRow({
  position,
  onToggleStatus,
}) {
  const active = getStatus(position, "position") === "Active";

  const handleToggle = useCallback(
    () => onToggleStatus("position", position),
    [onToggleStatus, position],
  );

  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded-lg border border-slate-100 px-2 py-1 ${
        active ? "" : "bg-slate-50 opacity-75"
      }`}
    >
      <i className="bi bi-person-badge text-lg text-violet-600" />

      <div className="min-w-0 flex-1">
        <p className="break-words text-[13px] font-medium leading-5 text-slate-700">
          {getName(position, "position")}
        </p>
        <p className="mt-0.5 break-all text-xs text-slate-500">
          {getReference(position, "position")}
        </p>
      </div>

      <ToggleStatusButton
        active={active}
        label="position"
        onClick={handleToggle}
      />
    </div>
  );
});

const DepartmentCard = memo(function DepartmentCard({
  department,
  expanded,
  onEdit,
  onToggleStatus,
}) {
  const reference = getReference(department, "department");
  const active = getStatus(department, "department") === "Active";
  const positions = department.positions || NO_ROWS;

  return (
    <article
      className={`flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white ${
        active ? "" : "opacity-75"
      }`}
    >
      <div className="flex items-start gap-2 bg-slate-50 p-2">
        <i className="bi bi-diagram-3 mt-0.5 text-base text-blue-600" />

        <div
          className="min-w-0 flex-1 text-left"
        >
          <p className="break-words text-[13px] font-bold leading-5 text-slate-800">
            {getName(department, "department")}
            {!active && (
              <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                Inactive
              </span>
            )}
          </p>

          <p className="mt-0.5 break-all text-xs text-slate-500">
            {reference}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            title="Edit department and positions"
            color="blue"
            onClick={() => onEdit(department)}
          >
            <i className="bi bi-pencil" />
          </IconButton>

          <IconButton
            title={
              active ? "Deactivate department" : "Activate department"
            }
            color={active ? "emerald" : "red"}
            onClick={() => onToggleStatus("department", department)}
          >
            <i
              className={`bi text-lg ${
                active
                  ? "bi-toggle-on text-emerald-600"
                  : "bi-toggle-off text-red-500"
              }`}
            />
          </IconButton>
        </div>
      </div>

      {expanded && (
        <div className="flex-1 space-y-2 p-2">
          <div className="flex items-center gap-2">
            <i className="bi bi-people text-base text-violet-600" />
            <span className="text-xs font-bold text-slate-600">
              Positions
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {positions.length}
            </span>
          </div>

          {positions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-2 text-center text-xs text-slate-500">
              No positions yet. Edit this department to add some.
            </p>
          ) : (
            positions.map((position, index) => (
              <PositionRow
                key={
                  getReference(position, "position") ||
                  position._key ||
                  index
                }
                position={position}
                onToggleStatus={onToggleStatus}
              />
            ))
          )}
        </div>
      )}
    </article>
  );
});

const CenterSection = memo(function CenterSection({
  center,
  query,
  expanded,
  expandedDepartments,
  onToggleCenter,
  onToggleDepartment,
  onEdit,
  onToggleStatus,
}) {
  const reference = getReference(center, "center");
  const isOpen = query ? true : (expanded ?? true);
  const departments = center.departments || NO_ROWS;
  const count = departments.length;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 bg-emerald-50/60 pr-3 hover:bg-emerald-50">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => onToggleCenter(reference)}
          className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left"
        >
          <i className="bi bi-buildings text-lg text-emerald-700" />

          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-bold text-slate-800">
              {getName(center, "center")}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {reference} · {count}{" "}
              {count === 1 ? "department" : "departments"}
            </p>
          </div>
        </button>
      </div>

      {isOpen && (
        <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2">
          {count === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 p-2 text-center text-xs text-slate-500 sm:col-span-2">
              No departments in this center yet.
            </p>
          )}

          {departments.map((department) => {
            const departmentReference = getReference(
              department,
              "department",
            );

            return (
              <DepartmentCard
                key={departmentReference}
                department={department}
                expanded={
                  query
                    ? true
                    : (expandedDepartments[departmentReference] ?? true)
                }
                onEdit={onEdit}
                onToggleStatus={onToggleStatus}
              />
            );
          })}
        </div>
      )}
    </section>
  );
});

/* ------------------------------- Main component ------------------------------- */

export default function DepartmentPositionContent() {
  const [centers, setCenters] = useState(NO_ROWS);
  const [departments, setDepartments] = useState(NO_ROWS);
  const [positions, setPositions] = useState(NO_ROWS);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [expandedCenters, setExpandedCenters] = useState({});
  const [expandedDepartments, setExpandedDepartments] = useState({});
  const [departmentPositions, setDepartmentPositions] = useState(NO_ROWS);

  const [modal, setModal] = useState({
    open: false,
    type: "department",
    mode: "create",
  });

  const [form, setForm] = useState(EMPTY_DEPARTMENT);

  const initialSnapshot = useRef("");
  const fetchRequestId = useRef(0);
  const savingRef = useRef(false);
  const statusRequests = useRef(new Set());

  const isDepartment = modal.type === "department";
  const prefix = PREFIX[modal.type];
  const nameKey = `${prefix}_name`;
  const parentKey = isDepartment
    ? "md_center_reference"
    : "mp_department_reference";

  /* ------------------------------ Data loading ------------------------------ */

  const fetchItems = useCallback(async () => {
    const requestId = ++fetchRequestId.current;

    setLoading(true);
    setError("");

    try {
      const [centerResult, departmentResult, positionResult] =
        await Promise.all([
          apiRequest(URLS.centers),
          apiRequest(URLS.departments),
          apiRequest(URLS.positions),
        ]);

      if (requestId !== fetchRequestId.current) return false;

      const centerRows = getRows(centerResult, "centers");
      const departmentRows = getRows(departmentResult, "departments");

      setCenters(centerRows);
      setDepartments(departmentRows);
      setPositions(getRows(positionResult, "positions"));

      setExpandedCenters(expandNew(centerRows, "center"));
      setExpandedDepartments(expandNew(departmentRows, "department"));

      return true;
    } catch (err) {
      if (requestId === fetchRequestId.current) {
        setError(err.message || "Unable to load organization records.");
      }

      return false;
    } finally {
      if (requestId === fetchRequestId.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchItems();

    return () => {
      fetchRequestId.current += 1;
    };
  }, [fetchItems]);

  /* ------------------------------ Derived data ------------------------------ */

  const deferredSearch = useDeferredValue(search);
  const query = deferredSearch.trim().toLowerCase();

  const departmentsByCenter = useMemo(
    () => groupBy(departments, getCenterReference),
    [departments],
  );

  const positionsByDepartment = useMemo(
    () => groupBy(positions, getDepartmentReference),
    [positions],
  );

  const groupedCenters = useMemo(() => {
    const result = [];

    for (const center of centers) {
      const centerReference = getReference(center, "center");

      const centerMatches =
        !query ||
        matches(
          `${getName(center, "center")} ${centerReference}`,
          query,
        );

      const visibleDepartments = [];

      for (const department of
        departmentsByCenter.get(centerReference) || NO_ROWS) {
        const departmentReference = getReference(
          department,
          "department",
        );

        const allPositions =
          positionsByDepartment.get(departmentReference) || NO_ROWS;

        const departmentMatches =
          centerMatches ||
          matches(
            `${getName(department, "department")} ${departmentReference}`,
            query,
          );

        const visiblePositions = departmentMatches
          ? allPositions
          : allPositions.filter((position) =>
              matches(
                `${getName(position, "position")} ${getReference(position, "position")}`,
                query,
              ),
            );

        if (departmentMatches || visiblePositions.length > 0) {
          visibleDepartments.push({
            ...department,
            positions: visiblePositions,
          });
        }
      }

      if (centerMatches || visibleDepartments.length > 0) {
        result.push({
          ...center,
          departments: visibleDepartments,
        });
      }
    }

    return result;
  }, [
    centers,
    departmentsByCenter,
    positionsByDepartment,
    query,
  ]);

  const hasNoData = !error && centers.length === 0;
  const currentParentReference = form[parentKey];

  const selectOptions = useMemo(() => {
    const source = isDepartment ? centers : departments;
    const type = isDepartment ? "center" : "department";

    return source.filter(
      (item) =>
        getStatus(item, type) === "Active" ||
        getReference(item, type) === currentParentReference,
    );
  }, [
    isDepartment,
    centers,
    departments,
    currentParentReference,
  ]);

  const isDirty = useMemo(
    () =>
      modal.open &&
      snapshotOf(form, departmentPositions) !== initialSnapshot.current,
    [modal.open, form, departmentPositions],
  );

  /* ------------------------------- Modal logic ------------------------------- */

  const openModal = useCallback(
    (type, mode, nextForm, nextPositions = NO_ROWS) => {
      initialSnapshot.current = snapshotOf(nextForm, nextPositions);

      setModal({ open: true, type, mode });
      setForm(nextForm);
      setDepartmentPositions(nextPositions);
    },
    [],
  );

  const openCreate = useCallback(
    (type, defaults = {}) => {
      const base =
        type === "department" ? EMPTY_DEPARTMENT : EMPTY_POSITION;

      openModal(type, "create", { ...base, ...defaults });
    },
    [openModal],
  );

  const openEditDepartment = useCallback(
    (department) => {
      const reference = getReference(department, "department");

      openModal(
        "department",
        "edit",
        {
          md_reference: reference,
          md_name: department.md_name || "",
          md_center_reference: getCenterReference(department),
          md_status: department.md_status || "Active",
        },
        (positionsByDepartment.get(reference) || NO_ROWS).map(
          createPositionRow,
        ),
      );
    },
    [openModal, positionsByDepartment],
  );

  const closeModal = useCallback(async () => {
    if (savingRef.current || Swal.isVisible()) return;

    if (isDirty) {
      const result = await Swal.fire({
        title: "Discard changes?",
        text: "You have unsaved changes that will be lost.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Discard",
        cancelButtonText: "Keep editing",
        confirmButtonColor: "#e11d48",
      });

      if (!result.isConfirmed) return;
    }

    setModal((previous) => ({ ...previous, open: false }));
  }, [isDirty]);

  const updateField = useCallback((key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  }, []);

  // Prepend new positions so the newest row always appears first.
  const addPositionRow = useCallback(() => {
    setDepartmentPositions((previous) => [
      createPositionRow(),
      ...previous,
    ]);
  }, []);

  const updatePositionRow = useCallback((key, field, value) => {
    setDepartmentPositions((previous) =>
      previous.map((position) =>
        position._key === key
          ? { ...position, [field]: value }
          : position,
      ),
    );
  }, []);

  const removeNewPositionRow = useCallback((key) => {
    setDepartmentPositions((previous) =>
      previous.filter(
        (position) => position._key !== key || !position._isNew,
      ),
    );
  }, []);

  /* -------------------------------- Saving -------------------------------- */

  const handleSave = async (event) => {
    event.preventDefault();

    if (savingRef.current) return;

    const name = String(form[nameKey] || "").trim();
    const parentReference = String(form[parentKey] || "").trim();

    if (!name || !parentReference) {
      showErrorAlert(
        `Enter a name and select a ${
          isDepartment ? "maintenance center" : "department"
        }.`,
      );
      return;
    }

    if (isDepartment) {
      const names = departmentPositions.map((position) =>
        position.mp_name.trim().toLowerCase(),
      );

      if (names.some((positionName) => !positionName)) {
        showErrorAlert(
          "Enter a name for every position or remove the empty new positions.",
        );
        return;
      }

      if (new Set(names).size !== names.length) {
        showErrorAlert(
          "Duplicate position names are not allowed in the same department.",
        );
        return;
      }
    }

    savingRef.current = true;
    setSaving(true);

    try {
      showLoadingPopup(
        isDepartment
          ? "Saving department and positions..."
          : "Saving position...",
      );

      if (!isDepartment) {
        await apiRequest(URLS.positions, {
          method: "POST",
          body: JSON.stringify({
            mp_name: name,
            mp_department_reference: parentReference,
            mp_status: form.mp_status || "Active",
          }),
        });

        setModal((previous) => ({ ...previous, open: false }));
        await fetchItems();
        notifySuccess("Position added", `${name} was added successfully.`);
        return;
      }

      const isEdit = modal.mode === "edit";
      const reference = form.md_reference;

      const departmentResult = await apiRequest(
        isEdit
          ? `${URLS.departments}/${encodeURIComponent(reference)}`
          : URLS.departments,
        {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify({
            md_name: name,
            md_center_reference: parentReference,
            md_status: form.md_status || "Active",
          }),
        },
      );

      const departmentReference = isEdit
        ? reference
        : getCreatedDepartmentReference(departmentResult);

      if (!isEdit && departmentPositions.length && !departmentReference) {
        await fetchItems();

        throw new Error(
          "The department was created, but its reference was not returned. Refresh the page, then edit the department to add positions.",
        );
      }

      const originals = new Map(
        (positionsByDepartment.get(reference) || NO_ROWS).map(
          (position) => [
            getReference(position, "position"),
            position,
          ],
        ),
      );

      const failures = await syncPositions(
        departmentPositions,
        originals,
        departmentReference,
      );

      setModal((previous) => ({ ...previous, open: false }));
      await fetchItems();

      if (failures.length) {
        Swal.close();

        await Swal.fire({
          icon: "warning",
          title: "Some changes were not saved",
          text: `${failures.length} position change(s) failed. Other changes may already be saved. ${
            failures[0].reason?.message || ""
          }`,
          confirmButtonText: "OK",
        });

        return;
      }

      notifySuccess(
        "Changes saved",
        departmentResult?.message ||
          "Department and positions were saved successfully.",
        1600,
      );
    } catch (err) {
      Swal.close();
      showErrorAlert(err.message || "Unable to save records.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  /* ------------------------------- Status updates ------------------------------- */

  const handleToggleStatus = useCallback(
    async (type, record) => {
      const reference = getReference(record, type);
      const requestKey = `${type}:${reference}`;

      if (!reference || statusRequests.current.has(requestKey)) return;

      const nextStatus =
        getStatus(record, type) === "Active" ? "Inactive" : "Active";

      const label = LABEL[type].toLowerCase();
      const name = getName(record, type);
      const verb = nextStatus === "Active" ? "Activate" : "Deactivate";

      const confirmation = await Swal.fire({
        title: `${verb} ${label}?`,
        text: `${name} will be marked ${nextStatus.toLowerCase()}.`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: `Yes, ${nextStatus.toLowerCase()}`,
        cancelButtonText: "Cancel",
        confirmButtonColor:
          nextStatus === "Active" ? "#059669" : "#e11d48",
      });

      if (!confirmation.isConfirmed) return;
      if (statusRequests.current.has(requestKey)) return;

      statusRequests.current.add(requestKey);

      try {
        showLoadingPopup(`Updating ${label} status...`);

        const endpoint =
          type === "department" ? URLS.departments : URLS.positions;

        await apiRequest(
          `${endpoint}/${encodeURIComponent(reference)}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              [`${PREFIX[type]}_status`]: nextStatus,
            }),
          },
        );

        await fetchItems();

        notifySuccess(
          "Status updated",
          `${name} is now ${nextStatus.toLowerCase()}.`,
          1300,
        );
      } catch (err) {
        Swal.close();
        showErrorAlert(err.message || "Unable to update status.");
      } finally {
        statusRequests.current.delete(requestKey);
      }
    },
    [fetchItems],
  );

  const toggleCenter = useCallback((reference) => {
    setExpandedCenters((previous) => ({
      ...previous,
      [reference]: !(previous[reference] ?? true),
    }));
  }, []);

  const toggleDepartment = useCallback((reference) => {
    setExpandedDepartments((previous) => ({
      ...previous,
      [reference]: !(previous[reference] ?? true),
    }));
  }, []);

  const clearSearch = useCallback(() => setSearch(""), []);

  /* -------------------------------- Render -------------------------------- */

  if (loading) return <LoadingState />;

  const trimmedSearch = search.trim();

  return (
    <div className="space-y-3 text-[13px] text-slate-700">
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search centers, departments or positions..."
            aria-label="Search organization"
            className={`${inputClass} px-9`}
          />

          {search && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>

        {!trimmedSearch && (
          <button
            type="button"
            onClick={() =>
              openCreate("department", {
                md_center_reference:
                  centers.length === 1
                    ? getReference(centers[0], "center")
                    : "",
              })
            }
            disabled={centers.length === 0}
            className={`${buttonClass} border-emerald-600 text-emerald-700 hover:bg-emerald-50`}
          >
            <i className="bi bi-plus-lg" />
            Add department
          </button>
        )}
      </div>

      {trimmedSearch && !error && (
        <p className="text-xs text-slate-500" role="status">
          {groupedCenters.length === 0
            ? `No results for “${trimmedSearch}”.`
            : `Showing results for “${trimmedSearch}”.`}
        </p>
      )}

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchItems}
            className="font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}

      {hasNoData && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-500">
          <i className="bi bi-buildings mb-2 block text-2xl" />
          No active maintenance centers found. Add a center first, then
          create departments under it.
        </div>
      )}

      {!hasNoData && !error && groupedCenters.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs text-slate-500">
          <i className="bi bi-search mb-2 block text-2xl" />
          Nothing matches your search.
          <button
            type="button"
            onClick={clearSearch}
            className="ml-1 font-semibold text-emerald-700 underline"
          >
            Clear search
          </button>
        </div>
      )}

      {!error && (
        <div className="space-y-3">
          {groupedCenters.map((center) => {
            const reference = getReference(center, "center");

            return (
              <CenterSection
                key={reference}
                center={center}
                query={query}
                expanded={expandedCenters[reference]}
                expandedDepartments={expandedDepartments}
                onToggleCenter={toggleCenter}
                onToggleDepartment={toggleDepartment}
                onEdit={openEditDepartment}
                onToggleStatus={handleToggleStatus}
              />
            );
          })}
        </div>
      )}

      <DepartmentPositionForm
        modal={modal}
        form={form}
        isDepartment={isDepartment}
        selectOptions={selectOptions}
        saving={saving}
        departmentPositions={departmentPositions}
        isDirty={isDirty}
        updateField={updateField}
        closeModal={closeModal}
        handleSave={handleSave}
        addPositionRow={addPositionRow}
        updatePositionRow={updatePositionRow}
        removeNewPositionRow={removeNewPositionRow}
      />
    </div>
  );
}
