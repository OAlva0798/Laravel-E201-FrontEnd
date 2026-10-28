import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";

import Modal from "../../assets/function/Modal";
import SearchableSelect from "../../assets/function/SearchableSelect";
import { API_BASE_URL } from "../../assets/js/appConfig";

import {
  EMPLOYMENT_STATUSES,
  JOB_FAMILIES,
  ORG,
  departmentCenterRef,
  positionDepartmentRef,
  normalize,
  getFullName,
  getInitials,
  getTodayLocal,
  toDateInputValue,
  loadOrgList,
} from "./employeeShared";
import { Spinner, SectionHeader } from "./employeeUi";

/* ==========================================================
 * CONSTANTS
 * ======================================================== */
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SPAN = {
  3: "col-span-12 sm:col-span-3",
  4: "col-span-12 sm:col-span-4",
  5: "col-span-12 sm:col-span-5",
  12: "col-span-12",
};

const TABS = [
  { id: "personal", label: "Personal & Contact", shortLabel: "Personal", icon: "bi-person-vcard" },
  { id: "employment", label: "Employment", shortLabel: "Work", icon: "bi-briefcase" },
];

const NON_CONTRACT_STATUSES = EMPLOYMENT_STATUSES.filter((s) => s !== "Contractual");

const DATE_FIELDS = [
  "ee_birth_date",
  "ee_date_hired",
  "ee_date_contractual_start",
  "ee_date_contractual_end",
  "ee_date_resigned",
];
const NOT_IN_FUTURE = {
  ee_birth_date: "Birth date",
  ee_date_hired: "Date hired",
  ee_date_resigned: "Date resigned",
};

/* ==========================================================
 * FIELD BUILDERS
 * ======================================================== */
const input = (name, label, span, extra = {}) => ({
  name, label, type: "input", inputType: "text", defaultValue: "",
  required: false, className: SPAN[span], ...extra,
});

const staticSelect = (name, label, span, values, extra = {}) => ({
  name, label, type: "select",
  options: values.map((value) => ({ label: value, value })),
  labelKey: "label", valueKey: "value",
  placeholder: `Select ${label.toLowerCase()}`,
  searchPlaceholder: `Search ${label.toLowerCase()}...`,
  noOptionsText: `No ${label.toLowerCase()} found`,
  defaultValue: "", required: false, className: SPAN[span], ...extra,
});

// orgKey links the field to the shared ORG lookup (labelKey / valueKey / endpoint)
const remoteSelect = (name, label, span, orgKey) => ({
  name, label, type: "select", orgKey,
  labelKey: ORG[orgKey].labelKey,
  valueKey: ORG[orgKey].valueKey,
  placeholder: `Select a ${label.toLowerCase()}...`,
  searchPlaceholder: `Search ${label.toLowerCase()}...`,
  noOptionsText: `No ${label.toLowerCase()} found`,
  defaultValue: "", required: true, className: SPAN[span],
});

/* ==========================================================
 * FORM SECTIONS  (tab: sidebar | personal | employment)
 * ======================================================== */
const SECTIONS = [
  {
    id: "profile",
    tab: "sidebar",
    fields: [
      {
        name: "ee_profile", label: "Profile", type: "file",
        accept: ALLOWED_IMAGE_TYPES.join(","),
        defaultValue: "", required: false, className: SPAN[12],
      },
    ],
  },
  {
    id: "identity",
    tab: "personal",
    title: "Personal Information",
    description: "Basic information about the employee",
    icon: "bi-person",
    fields: [
      input("ee_firstname", "First Name", 4, { required: true, placeholder: "Enter first name" }),
      input("ee_middlename", "Middle Name", 4, { placeholder: "Optional" }),
      input("ee_lastname", "Last Name", 4, { required: true, placeholder: "Enter last name" }),
      staticSelect("ee_gender", "Gender", 3, ["Male", "Female", "Other"], { required: true }),
      input("ee_birth_date", "Birth Date", 3, { inputType: "date", required: true }),
      staticSelect("ee_civil_status", "Civil Status", 3,
        ["Single", "Married", "Widowed", "Separated", "Divorced"], { required: true }),
      staticSelect("ee_bloodtype", "Blood Type", 3,
        ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
      input("ee_id_number", "Employee ID", 3, { required: true, placeholder: "Enter ID number" }),
      input("ee_id_biometrics", "Biometrics ID", 3, { placeholder: "Optional" }),
      input("ee_sss", "SSS Number", 3, { required: true, placeholder: "Enter SSS number" }),
      input("ee_tinid", "TIN Number", 3, { required: true, placeholder: "Enter TIN number" }),
    ],
  },
  {
    id: "contact",
    tab: "personal",
    title: "Contact Information",
    description: "How to reach the employee",
    icon: "bi-telephone",
    fields: [
      input("ee_email", "Email Address", 4, {
        inputType: "email", required: false, placeholder: "user@example.com",
      }),
      input("ee_mobile_number", "Mobile Number", 4, {
        inputType: "tel", required: true, placeholder: "Enter mobile number",
      }),
      input("ee_telephone", "Telephone Number", 4, { inputType: "tel", placeholder: "Optional" }),
    ],
  },
  {
    id: "emergency",
    tab: "personal",
    title: "Emergency Contact",
    description: "Who to contact in an emergency",
    icon: "bi-telephone-plus",
    fields: [
      input("ee_ecname", "Name", 4, { required: true, placeholder: "Contact person's name" }),
      input("ee_eccontact", "Number", 3, {
        inputType: "tel", required: true, placeholder: "Contact number",
      }),
      input("ee_ecaddress", "Address", 5, { required: true, placeholder: "Contact address" }),
    ],
  },
  {
    id: "organization",
    tab: "employment",
    title: "Organization Assignment",
    description: "Company, center, department, and position",
    icon: "bi-diagram-3",
    fields: [
      remoteSelect("ee_company_reference", "Company", 4, "company"),
      remoteSelect("ee_center_reference", "Center", 4, "center"),
      remoteSelect("ee_department_reference", "Department", 4, "department"),
      remoteSelect("ee_position_reference", "Position", 4, "position"),
      remoteSelect("ee_position_level_reference", "Position Level", 4, "positionLevel"),
      staticSelect("ee_job_family", "Job Family", 4, JOB_FAMILIES),
    ],
  },
  {
    id: "employment-details",
    tab: "employment",
    title: "Employment Details",
    description: "Employment classification, hiring dates, and contract period",
    icon: "bi-calendar-check",
    fields: [
      staticSelect("ee_employment_status", "Employment Status", 4, EMPLOYMENT_STATUSES, {
        required: true,
      }),
      input("ee_date_hired", "Date Hired (NTMA)", 4, {
        inputType: "date",
        showWhen: NON_CONTRACT_STATUSES,
        requiredWhen: NON_CONTRACT_STATUSES,
      }),
      input("ee_date_contractual_start", "Contract Start Date", 4, {
        inputType: "date", showWhen: ["Contractual"], requiredWhen: ["Contractual"],
      }),
      input("ee_date_contractual_end", "Contract End Date", 4, {
        inputType: "date", showWhen: ["Contractual"],
        helpText: "Must be on or after the contract start date.",
      }),
      input("ee_date_resigned", "Date Resigned", 4, {
        inputType: "date", showWhen: ["Resigned"], requiredWhen: ["Resigned"],
        helpText: "Enter the employee's effective resignation date.",
      }),
    ],
  },
];

/* ==========================================================
 * FIELD MAPS
 * ======================================================== */
const FORM_FIELDS = SECTIONS.flatMap((s) => s.fields);
const FIELD_BY_NAME = Object.fromEntries(FORM_FIELDS.map((f) => [f.name, f]));
const PROFILE_FIELD = FIELD_BY_NAME.ee_profile;
const FIELD_TAB = Object.fromEntries(
  SECTIONS.flatMap((s) => s.fields.map((f) => [f.name, s.tab])),
);
const REMOTE_FIELDS = FORM_FIELDS.filter((f) => f.orgKey);

// child -> parent relationships for cascading selects
const SELECT_RELATIONSHIPS = {
  ee_department_reference: { parent: "ee_center_reference", getParentReference: departmentCenterRef },
  ee_position_reference: { parent: "ee_department_reference", getParentReference: positionDepartmentRef },
};

const getDescendantFields = (parentName) =>
  Object.entries(SELECT_RELATIONSHIPS).flatMap(([child, rel]) =>
    rel.parent === parentName ? [child, ...getDescendantFields(child)] : [],
  );

/* ==========================================================
 * HELPERS
 * ======================================================== */
const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isFieldVisible = (field, data) =>
  !field.showWhen || field.showWhen.includes(normalize(data?.ee_employment_status));

const isFieldRequired = (field, data) => {
  if (!isFieldVisible(field, data)) return false;
  if (field.requiredWhen) return field.requiredWhen.includes(normalize(data?.ee_employment_status));
  return Boolean(field.required);
};

const getInitialFormData = (item = {}) => {
  const data = { ee_uniqid: item?.ee_uniqid ?? "" };

  FORM_FIELDS.forEach((field) => {
    const value = item?.[field.name] ?? field.defaultValue ?? "";
    data[field.name] = field.inputType === "date" ? toDateInputValue(value) : value;
  });

  return { ...data, ee_status: item?.ee_status ?? "Active", ee_remove_avatar: "0" };
};

const isValidDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

const validateField = (field, value, data = {}) => {
  const v = normalize(value);

  if (isFieldRequired(field, data) && !v) return `${field.label} is required.`;
  if (!v) return "";

  if (field.name === "ee_email" && !EMAIL_REGEX.test(v)) {
    return "Enter a valid email address, like name@company.com.";
  }

  if (DATE_FIELDS.includes(field.name)) {
    if (!isValidDate(v)) return "Enter a valid date.";
    if (NOT_IN_FUTURE[field.name] && v > getTodayLocal()) {
      return `${NOT_IN_FUTURE[field.name]} cannot be in the future.`;
    }
  }

  if (field.name === "ee_date_contractual_start") {
    const end = normalize(data.ee_date_contractual_end);
    if (end && v > end) return "Contract start date cannot be after the end date.";
  }

  if (field.name === "ee_date_contractual_end") {
    const start = normalize(data.ee_date_contractual_start);
    if (start && v < start) return "Contract end date cannot be before the start date.";
  }

  return "";
};

const CONTRACT_DATES = ["ee_date_contractual_start", "ee_date_contractual_end"];

/* ==========================================================
 * MAIN COMPONENT
 * ======================================================== */
export default function EmployeesForm({
  isOpen,
  onClose,
  title = "Employee",
  currentItem,
  formData,
  setFormData,
  onSubmit,
  isLoading = false,
  modalSize = "6xl",
}) {
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [errorAlert, setErrorAlert] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [dropdownData, setDropdownData] = useState({});
  const [dropdownLoading, setDropdownLoading] = useState({});
  const [failedDropdowns, setFailedDropdowns] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);

  const initialDataRef = useRef(null);
  const previewUrlRef = useRef(null);

  /* ---------- preview URL lifecycle ---------- */
  const releasePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => releasePreview, [releasePreview]);

  /* ---------- remote dropdowns (shared cache; instant after first load) ---------- */
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const force = reloadKey > 0;

    setFailedDropdowns([]);
    setDropdownLoading(Object.fromEntries(REMOTE_FIELDS.map((f) => [f.name, true])));

    Promise.all(
      REMOTE_FIELDS.map(async (field) => {
        try {
          const list = await loadOrgList(field.orgKey, { force });
          if (!cancelled) setDropdownData((prev) => ({ ...prev, [field.name]: list }));
          return null;
        } catch (error) {
          console.error(`Fetch error (${field.orgKey}):`, error);
          return field.label;
        } finally {
          if (!cancelled) setDropdownLoading((prev) => ({ ...prev, [field.name]: false }));
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const failed = results.filter(Boolean);
      setFailedDropdowns(failed);
      if (failed.length) {
        setErrorAlert(
          `Couldn't load: ${failed.join(", ")}. Check your connection and use "Try again".`,
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, reloadKey]);

  /* ---------- initialize form ---------- */
  useEffect(() => {
    if (!isOpen) return;

    const initial = getInitialFormData(currentItem);
    initialDataRef.current = initial;

    releasePreview();
    setFormData(initial);
    setAvatarPreview(null);
    setErrorAlert("");
    setFieldErrors({});
    setTouched({});
    setActiveTab(TABS[0].id);
  }, [isOpen, currentItem, setFormData, releasePreview]);

  /* ---------- derived state ---------- */
  const isDirty = useMemo(() => {
    const initial = initialDataRef.current;
    if (!initial || !formData) return false;

    return (
      formData.ee_profile instanceof File ||
      Object.keys(initial).some(
        (key) => key !== "ee_profile" && normalize(formData[key]) !== normalize(initial[key]),
      )
    );
  }, [formData]);

  const { requiredFields, completedCount } = useMemo(() => {
    const required = FORM_FIELDS.filter((f) => isFieldRequired(f, formData));
    return {
      requiredFields: required,
      completedCount: required.filter((f) => normalize(formData?.[f.name]) !== "").length,
    };
  }, [formData]);

  const remainingCount = requiredFields.length - completedCount;
  const progress = requiredFields.length
    ? Math.round((completedCount / requiredFields.length) * 100)
    : 100;

  const tabErrorCounts = useMemo(() => {
    const counts = {};
    Object.entries(fieldErrors).forEach(([name, error]) => {
      if (error && touched[name]) {
        const tab = FIELD_TAB[name];
        counts[tab] = (counts[tab] || 0) + 1;
      }
    });
    return counts;
  }, [fieldErrors, touched]);

  const activeSections = useMemo(
    () => SECTIONS.filter((s) => s.tab === activeTab),
    [activeTab],
  );

  const fullName = getFullName(formData, "New Employee");

  // Options per remote select, filtered by parent selection
  const centerValue = formData?.ee_center_reference;
  const departmentValue = formData?.ee_department_reference;

  const selectOptions = useMemo(() => {
    const out = {};
    REMOTE_FIELDS.forEach(({ name }) => {
      const list = dropdownData[name] || [];
      const rel = SELECT_RELATIONSHIPS[name];

      if (!rel) {
        out[name] = list;
        return;
      }

      const parent = normalize(rel.parent === "ee_center_reference" ? centerValue : departmentValue);
      out[name] = parent
        ? list.filter((o) => normalize(rel.getParentReference(o)) === parent)
        : [];
    });
    return out;
  }, [dropdownData, centerValue, departmentValue]);

  /* ---------- close ---------- */
  const handleClose = () => {
    if (isLoading) return;
    if (isDirty && !window.confirm("You have unsaved changes. Close without saving?")) return;
    onClose();
  };

  /* ---------- change / blur ---------- */
  const handleChange = (fieldName, value) => {
    const descendants = getDescendantFields(fieldName);
    const next = { ...formData, [fieldName]: value };

    // Changing a parent clears dependent child selections.
    descendants.forEach((name) => (next[name] = ""));

    // Values of fields that become hidden must not be submitted.
    const hidden = FORM_FIELDS.filter((f) => !isFieldVisible(f, next));
    hidden.forEach((f) => {
      if (f.name !== fieldName) next[f.name] = "";
    });

    setFormData(next);
    setErrorAlert("");

    setTouched((prev) => {
      const updated = { ...prev, [fieldName]: true };
      descendants.forEach((name) => (updated[name] = false));
      hidden.forEach((f) => (updated[f.name] = false));
      return updated;
    });

    setFieldErrors((prev) => {
      const updated = { ...prev };

      if (FIELD_BY_NAME[fieldName]) {
        updated[fieldName] = validateField(FIELD_BY_NAME[fieldName], value, next);
      }
      descendants.forEach((name) => (updated[name] = ""));
      hidden.forEach((f) => (updated[f.name] = ""));

      // Keep both contract date errors in sync.
      if (CONTRACT_DATES.includes(fieldName)) {
        CONTRACT_DATES.forEach((name) => {
          updated[name] = validateField(FIELD_BY_NAME[name], next[name], next);
        });
      }
      return updated;
    });
  };

  const handleBlur = (field, value) => {
    setTouched((prev) => ({ ...prev, [field.name]: true }));
    setFieldErrors((prev) => ({ ...prev, [field.name]: validateField(field, value, formData) }));
  };

  /* ---------- profile file ---------- */
  const handleFileChange = (file) => {
    releasePreview();
    if (file) previewUrlRef.current = URL.createObjectURL(file);

    setAvatarPreview(previewUrlRef.current);
    setFormData((prev) => ({
      ...prev,
      ee_profile: file,
      ee_remove_avatar: file ? "0" : "1",
    }));
    setErrorAlert("");
  };

  const getFileSrc = (value) => {
    if (avatarPreview) return avatarPreview;
    if (!value || typeof value !== "string") return null;

    let path = value.trim();
    if (!path) return null;
    if (/^(https?:\/\/|data:image\/|blob:)/i.test(path)) return path;

    path = path.replace(/\\/g, "/").replace(/^\/+/, "");
    const appUrl = API_BASE_URL.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
    return `${appUrl}/${path}`;
  };

  /* ---------- submit ---------- */
  const handleSubmit = (event) => {
    event.preventDefault();
    if (isLoading) return;

    const visibleFields = FORM_FIELDS.filter((f) => isFieldVisible(f, formData));
    const nextErrors = {};

    visibleFields.forEach((field) => {
      const error = validateField(field, formData?.[field.name], formData);
      if (error) nextErrors[field.name] = error;
    });

    // Selected child options must belong to their parent.
    Object.entries(SELECT_RELATIONSHIPS).forEach(([childName, rel]) => {
      const childValue = normalize(formData?.[childName]);
      const options = dropdownData[childName] || [];

      if (!childValue || nextErrors[childName] || options.length === 0) return;

      const match = options.find(
        (o) => normalize(o?.[FIELD_BY_NAME[childName].valueKey]) === childValue,
      );
      const parentValue = normalize(formData?.[rel.parent]);
      const valid = match && normalize(rel.getParentReference(match)) === parentValue;

      if (!valid) {
        nextErrors[childName] =
          `This ${FIELD_BY_NAME[childName].label.toLowerCase()} doesn't belong to the selected ` +
          `${FIELD_BY_NAME[rel.parent].label.toLowerCase()}. Please choose again.`;
      }
    });

    setFieldErrors(nextErrors);
    setTouched(
      Object.fromEntries(FORM_FIELDS.map((f) => [f.name, isFieldVisible(f, formData)])),
    );

    const invalid = visibleFields.filter((f) => nextErrors[f.name]);

    if (invalid.length) {
      const first = invalid[0];
      setErrorAlert(
        `Please fix ${invalid.length} ${invalid.length === 1 ? "field" : "fields"} before saving. ` +
          `We've jumped to the first one.`,
      );

      const targetTab = FIELD_TAB[first.name];
      if (targetTab !== "sidebar") setActiveTab(targetTab);

      window.setTimeout(() => {
        const el = document.getElementById(`field-${first.name}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.focus?.();
      }, 60);
      return;
    }

    setErrorAlert("");

    const payload = new FormData();
    Object.entries(formData || {}).forEach(([key, value]) => {
      if (value == null) return;
      if (key === "ee_profile" && !(value instanceof File)) return; // only upload new images
      if (value instanceof Blob && !value.size) return;
      payload.append(key, value);
    });

    onSubmit(payload);
  };

  /* ---------- renderers ---------- */
  const renderSelect = (field) => {
    const rel = SELECT_RELATIONSHIPS[field.name];
    const isRemote = Boolean(field.orgKey);
    const options = isRemote ? selectOptions[field.name] || [] : field.options;

    const loading = isRemote && Boolean(dropdownLoading[field.name]);
    const parentValue = rel ? normalize(formData?.[rel.parent]) : "";
    const disabled = Boolean(rel && !parentValue);
    const parentLabel = rel ? FIELD_BY_NAME[rel.parent].label.toLowerCase() : "";
    const waitForParent = `Select a ${parentLabel} first`;

    let placeholder = field.placeholder;
    let noOptionsText = field.noOptionsText;

    if (loading) placeholder = "Loading...";
    else if (disabled) placeholder = waitForParent;

    if (disabled) noOptionsText = waitForParent;
    else if (rel && options.length === 0) {
      noOptionsText = `No ${field.label.toLowerCase()} available for this ${parentLabel}`;
    }

    return (
      <SearchableSelect
        {...field}
        id={`field-${field.name}`}
        name={field.name}
        options={options}
        loading={loading}
        disabled={disabled || loading}
        placeholder={placeholder}
        noOptionsText={noOptionsText}
        value={formData?.[field.name] ?? ""}
        onChange={(value) => handleChange(field.name, value)}
        className="w-full text-sm"
      />
    );
  };

  const renderField = (field) => {
    const error = touched[field.name] ? fieldErrors[field.name] : "";
    const fileValue = formData?.[field.name] ?? currentItem?.[field.name] ?? "";

    return (
      <FieldWrapper key={field.name} field={field} error={error}>
        {field.type === "file" && (
          <FileDropzone
            field={field}
            value={fileValue}
            fileSrc={getFileSrc(fileValue)}
            onFileChange={handleFileChange}
            onError={setErrorAlert}
            fullName={fullName}
          />
        )}

        {field.type === "input" && (
          <input
            id={`field-${field.name}`}
            type={field.inputType}
            name={field.name}
            value={formData?.[field.name] ?? ""}
            onChange={(e) => handleChange(field.name, e.target.value)}
            onBlur={(e) => handleBlur(field, e.target.value)}
            placeholder={field.placeholder}
            required={isFieldRequired(field, formData)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `error-${field.name}` : undefined}
            className={`w-full rounded-xl border bg-white px-3 py-2 text-sm font-medium text-slate-800 transition placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
              error
                ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20"
                : "border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20"
            }`}
          />
        )}

        {field.type === "select" && renderSelect(field)}
      </FieldWrapper>
    );
  };

  /* ==========================================================
   * RENDER
   * ======================================================== */
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`${currentItem ? "Edit" : "Add"} ${title}`}
      modalSize={modalSize}
    >
      <div className="flex h-[80vh] min-h-0 flex-col overflow-hidden">
        {errorAlert && (
          <div
            role="alert"
            className="mb-3 flex shrink-0 items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700"
          >
            <i className="bi bi-exclamation-circle mt-0.5 shrink-0" />
            <span className="flex-1">{errorAlert}</span>

            {failedDropdowns.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setErrorAlert("");
                  setReloadKey((k) => k + 1);
                }}
                className="shrink-0 cursor-pointer font-semibold underline hover:text-rose-900"
              >
                Try again
              </button>
            )}

            <button
              type="button"
              onClick={() => setErrorAlert("")}
              className="shrink-0 cursor-pointer text-rose-400 hover:text-rose-600"
              aria-label="Dismiss message"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
        )}

        <form
          id="onSubmit-form"
          onSubmit={handleSubmit}
          encType="multipart/form-data"
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          noValidate
        >
          <div className="grid min-h-0 flex-1 grid-cols-12 items-stretch gap-4 overflow-y-auto lg:overflow-hidden">
            {/* SIDEBAR */}
            <aside className="col-span-12 min-h-0 overflow-hidden lg:col-span-3">
              <div className="flex h-full flex-col overflow-hidden p-4 sm:p-5">
                <div className="flex shrink-0 flex-col items-center text-center">
                  {renderField(PROFILE_FIELD)}

                  <h2 className="mt-3 text-lg font-bold leading-tight text-slate-900">
                    {fullName}
                  </h2>

                  {normalize(formData?.ee_employment_status) && (
                    <span className="mt-3 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                      {formData.ee_employment_status}
                    </span>
                  )}
                </div>

                <div className="shrink-0 border-t border-slate-100 py-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-600">Required fields</p>
                    <p className="text-xs font-semibold text-slate-600">
                      {completedCount}/{requiredFields.length}
                    </p>
                  </div>

                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    aria-label="Required fields completed"
                  >
                    <div
                      className={`h-full rounded-full transition-all ${
                        progress === 100 ? "bg-emerald-500" : "bg-indigo-500"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {remainingCount === 0 ? (
                      <span className="font-medium text-emerald-600">
                        <i className="bi bi-check-circle mr-1" />
                        All required fields are filled in
                      </span>
                    ) : (
                      <>
                        {remainingCount} more required {remainingCount === 1 ? "field" : "fields"} (
                        <span className="text-rose-500">*</span>)
                      </>
                    )}
                  </p>
                </div>
              </div>
            </aside>

            {/* MAIN */}
            <main className="col-span-12 flex min-h-0 min-w-0 flex-col lg:col-span-9 lg:overflow-hidden">
              <div className="shrink-0 rounded-2xl bg-white pb-3">
                <div
                  role="tablist"
                  aria-label="Employee form sections"
                  className="flex gap-1.5 overflow-x-auto"
                >
                  {TABS.map((tab) => {
                    const selected = activeTab === tab.id;
                    const errorCount = tabErrorCounts[tab.id] || 0;

                    return (
                      <button
                        key={tab.id}
                        id={`employee-form-tab-${tab.id}`}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls={`employee-form-panel-${tab.id}`}
                        onClick={() => setActiveTab(tab.id)}
                        className={`relative flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          selected
                            ? "bg-slate-900 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <i className={`bi ${tab.icon} text-base`} />
                        <span className="whitespace-nowrap">
                          <span className="hidden sm:inline">{tab.label}</span>
                          <span className="sm:hidden">{tab.shortLabel}</span>
                        </span>

                        {errorCount > 0 && (
                          <span
                            className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white"
                            title={`${errorCount} ${errorCount === 1 ? "field needs" : "fields need"} attention`}
                          >
                            {errorCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                key={activeTab}
                id={`employee-form-panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`employee-form-tab-${activeTab}`}
                tabIndex={0}
                className="min-h-0 flex-1 space-y-4 overflow-x-hidden overscroll-contain pb-40 focus:outline-none lg:overflow-y-auto lg:pr-2"
              >
                {activeSections.map((section) => {
                  const visible = section.fields.filter((f) => isFieldVisible(f, formData));
                  if (!visible.length) return null;

                  return (
                    <FormCardSection key={section.id} section={section}>
                      {visible.map(renderField)}
                    </FormCardSection>
                  );
                })}
              </div>
            </main>
          </div>
        </form>

        {/* FOOTER */}
        <div className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 bg-white pt-3">
          <p className="text-[11px] text-slate-500" aria-live="polite">
            {isDirty && (
              <>
                <i className="bi bi-dot text-amber-500" />
                Unsaved changes
              </>
            )}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className="bi bi-x-circle" />
              Cancel
            </button>

            <button
              type="submit"
              form="onSubmit-form"
              disabled={isLoading}
              className="inline-flex min-w-[96px] cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Spinner />
                  {currentItem ? "Updating..." : "Saving..."}
                </>
              ) : (
                <>
                  <i className={currentItem ? "bi bi-pencil-square" : "bi bi-plus-lg"} />
                  {currentItem ? "Update" : "Save"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ==========================================================
 * SUB-COMPONENTS
 * ======================================================== */
function FormCardSection({ section, children }) {
  return (
    <section className="relative rounded-2xl border border-slate-200 bg-white shadow-sm focus-within:z-20">
      <SectionHeader section={section} />
      <div className="grid grid-cols-12 gap-x-4 gap-y-3 px-5 pb-5 pt-4">{children}</div>
    </section>
  );
}

function FieldWrapper({ field, error, children }) {
  const showAsterisk = field.required || Boolean(field.requiredWhen);

  return (
    <div className={`relative min-w-0 focus-within:z-30 ${field.className || ""}`}>
      {field.type !== "file" && (
        <label
          htmlFor={`field-${field.name}`}
          className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500"
        >
          {field.label}
          {showAsterisk && <span className="ml-1 text-rose-500">*</span>}
        </label>
      )}

      {children}

      {error ? (
        <p
          id={`error-${field.name}`}
          className="mt-1 flex items-center gap-1 text-[11px] text-rose-600"
        >
          <i className="bi bi-exclamation-circle" />
          {error}
        </p>
      ) : field.helpText ? (
        <p className="mt-1 text-[11px] text-slate-400">{field.helpText}</p>
      ) : null}
    </div>
  );
}

function FileDropzone({ field, value, fileSrc, onFileChange, onError, fullName }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [fileSrc]);

  const selectedFile = value instanceof File ? value : null;
  const fileName = selectedFile
    ? selectedFile.name
    : typeof value === "string"
      ? value.split("/").pop()
      : "";
  const showImage = Boolean(fileSrc) && !imageFailed;

  const validateFile = (file) => {
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      onError("Unsupported file type. Please upload a JPG, PNG, GIF, or WEBP image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      onError(`That image is too large (${formatFileSize(file.size)}). The maximum size is 5 MB.`);
      return;
    }

    onFileChange(file);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <label
        htmlFor={`file-input-${field.name}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          validateFile(e.dataTransfer.files?.[0]);
        }}
        className="group relative flex h-50 w-50 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-indigo-50 text-3xl font-bold text-indigo-600 shadow-md ring-1 ring-slate-200 transition hover:ring-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500"
      >
        {showImage ? (
          <img
            src={fileSrc}
            alt="Profile preview"
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          getInitials(fullName === "New Employee" ? "" : fullName)
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/50 p-2 text-white opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <i className="bi bi-camera mb-0.5 text-lg" />
          <span className="text-sm font-medium leading-tight">
            {showImage ? "Replace photo" : "Upload photo"}
          </span>
        </div>

        <input
          type="file"
          id={`file-input-${field.name}`}
          name={field.name}
          accept={field.accept}
          className="sr-only"
          onChange={(e) => {
            validateFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      <div className="flex flex-col items-center text-center">
        <p className="text-[11px] text-slate-400">
          Click or drop an image · JPG, PNG, GIF, WEBP · max 5 MB
        </p>

        {(selectedFile || showImage) && (
          <div className="mt-1.5 flex max-w-full items-center justify-center gap-2 text-[11px]">
            {fileName && (
              <span className="max-w-[140px] truncate text-slate-500" title={fileName}>
                {fileName}
              </span>
            )}

            {selectedFile && (
              <span className="shrink-0 text-slate-400">{formatFileSize(selectedFile.size)}</span>
            )}

            <button
              type="button"
              onClick={() => onFileChange(null)}
              className="shrink-0 cursor-pointer font-semibold text-rose-600 hover:text-rose-700"
            >
              Remove photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
