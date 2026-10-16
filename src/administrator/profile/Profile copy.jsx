import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { API_BASE_URL } from "../../assets/js/appConfig";
import Swal from "sweetalert2";

import {
  showErrorAlert,
  showLoadingPopup,
  showSuccessAlert,
} from "../../assets/js/swalHelpers";

import LoadingState from "../../assets/function/LoadingState";

// ==========================================================
// CONSTANTS
// ==========================================================

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const PASSWORD_MIN_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SERVER_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

const EMPTY_FORM = {
  ud_uniqid: "",
  ud_firstname: "",
  ud_middlename: "",
  ud_lastname: "",
  ud_email: "",
  ud_center_reference: "",
  ud_department_reference: "",
  ud_position_reference: "",
  ud_avatar: "",
  ud_esign: "",
  ud_remove_avatar: "0",
  ud_remove_esign: "0",
};

const EMPTY_SECURITY_FORM = {
  current_email: "",
  new_email: "",
  confirm_email: "",
  current_password: "",
  new_password: "",
  confirm_password: "",
};

// ==========================================================
// HELPERS
// ==========================================================

const normalize = (value) => String(value ?? "").trim();

const getToken = () =>
  localStorage.getItem("access_token") ||
  sessionStorage.getItem("access_token") ||
  "";

const getFileUrl = (value) => {
  if (!value) return "";

  const path = String(value);

  if (/^(https?:|data:|blob:)/i.test(path)) {
    return path;
  }

  return `${SERVER_BASE_URL}/${path
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")}`;
};

const getResponseMessage = (result, fallback) => {
  if (result?.message) return result.message;
  if (result?.detail) return result.detail;

  if (result?.errors) {
    const firstError = Object.values(result.errors)[0];

    if (Array.isArray(firstError)) return firstError[0];
    if (firstError) return firstError;
  }

  return fallback;
};

const extractData = (result, keys = []) => {
  for (const key of keys) {
    if (result?.[key] != null) return result[key];
  }

  return result?.data ?? result;
};

const saveAuthUser = (user) => {
  if (!user) return;

  try {
    if (localStorage.getItem("auth_user")) {
      localStorage.setItem("auth_user", JSON.stringify(user));
    }

    if (sessionStorage.getItem("auth_user")) {
      sessionStorage.setItem("auth_user", JSON.stringify(user));
    }
  } catch (error) {
    console.error("Unable to update auth_user:", error);
  }
};

const refreshPageAfterSuccess = (delay = 1000) => {
  window.setTimeout(() => window.location.reload(), delay);
};

const apiFetch = async (url, options = {}) => {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  headers.set("Accept", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let result = null;

  try {
    result = await response.json();
  } catch {
    // The server may return an empty or non-JSON response.
  }

  if (!response.ok) {
    throw new Error(
      getResponseMessage(
        result,
        `Request failed with status ${response.status}.`,
      ),
    );
  }

  return result;
};

const getReference = (record, ...keys) => {
  for (const key of keys) {
    const value = record?.[key];

    if (value != null && value !== "") return value;
  }

  return "";
};

const getCollection = (result, ...keys) => {
  const data = extractData(result, keys);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;

  return [];
};

// ==========================================================
// REUSABLE COMPONENTS
// ==========================================================

function SectionHeading({ icon, title, description }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <i className={`bi ${icon}`} />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-700">{title}</h4>

        {description && (
          <p className="text-xs text-slate-400">{description}</p>
        )}
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
        <i className={`bi ${icon}`} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-xs text-slate-500">{label}</div>

        <div className="mt-0.5 break-words text-sm font-semibold text-slate-700">
          {value || "—"}
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  maxLength = 100,
  type = "text",
  readOnly = false,
  icon,
  optional = false,
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-700"
      >
        <span>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>

        {optional && (
          <span className="font-normal text-slate-400">Optional</span>
        )}
      </label>

      <div className={icon ? "relative" : ""}>
        {icon && (
          <i
            className={`bi ${icon} absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400`}
          />
        )}

        <input
          id={name}
          name={name}
          type={type}
          value={value ?? ""}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
          readOnly={readOnly}
          autoComplete="off"
          className={`w-full rounded-lg border px-3.5 py-2.5 text-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 ${
            icon ? "pl-10" : ""
          } ${
            readOnly
              ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500"
              : "border-slate-300 bg-white text-slate-800 placeholder:text-slate-400"
          }`}
        />
      </div>
    </div>
  );
}

/**
 * Searchable select. It accepts the same `value`, `onChange`, and `children`
 * props as a native select, so existing call sites remain compatible.
 */
function SelectField({
  label,
  icon,
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder,
  children,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = React.useRef(null);

  const options = React.Children.toArray(children).filter(
    (child) => React.isValidElement(child),
  );

  const selectedOption = options.find(
    (option) => String(option.props.value) === String(value),
  );

  const filteredOptions = options.filter((option) => {
    const optionLabel = React.Children.toArray(option.props.children)
      .map((child) => (typeof child === "string" ? child : ""))
      .join("");

    return optionLabel.toLowerCase().includes(query.trim().toLowerCase());
  });

  useEffect(() => {
    if (!open) {
      setQuery("");
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open]);

  const selectOption = (option) => {
    onChange({
      target: {
        value: option.props.value,
      },
    });

    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>

      <div className="relative">
        <i
          className={`bi ${icon} pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400`}
        />

        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((previous) => !previous)}
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-left text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        >
          <span className={selectedOption ? "" : "text-slate-400"}>
            {selectedOption?.props.children ?? placeholder}
          </span>
        </button>

        <i className="bi bi-chevron-down pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>

      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
              }

              if (event.key === "Enter" && filteredOptions[0]) {
                event.preventDefault();
                selectOption(filteredOptions[0]);
              }
            }}
            placeholder={`Search ${label.toLowerCase()}...`}
            aria-label={`Search ${label}`}
            className="w-full border-b border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
          />

          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <li key={option.key ?? option.props.value ?? index}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={
                      String(option.props.value) === String(value)
                    }
                    onClick={() => selectOption(option)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-emerald-50 ${
                      String(option.props.value) === String(value)
                        ? "bg-emerald-50 font-semibold text-emerald-700"
                        : "text-slate-700"
                    }`}
                  >
                    {option.props.children}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-sm text-slate-400">
                No matching options
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Native hidden select preserves required form validation. */}
      <select
        tabIndex={-1}
        aria-hidden="true"
        required={required}
        disabled={disabled}
        value={value}
        onChange={() => {}}
        className="pointer-events-none absolute h-px w-px opacity-0"
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
    </div>
  );
}

function PasswordInput({
  name,
  value,
  onChange,
  placeholder,
  show,
  onToggle,
  icon = "bi-lock",
  autoComplete = "new-password",
}) {
  return (
    <div className="relative">
      <i
        className={`bi ${icon} absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400`}
      />

      <input
        id={name}
        type={show ? "text" : "password"}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
      />

      <button
        type="button"
        title={show ? "Hide password" : "Show password"}
        aria-label={show ? "Hide password" : "Show password"}
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        <i className={`bi ${show ? "bi-eye-slash" : "bi-eye"}`} />
      </button>
    </div>
  );
}

// ==========================================================
// IMAGE FIELD
// ==========================================================

function ImageField({
  label,
  description,
  value,
  file,
  remove,
  accept,
  onChange,
  onRemove,
  onRestore,
  icon = "bi-image",
}) {
  const [dragging, setDragging] = useState(false);

  const filePreview = useMemo(
    () => (file ? URL.createObjectURL(file) : ""),
    [file],
  );

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  const preview = filePreview || (!remove ? getFileUrl(value) : "");

  const handleFile = useCallback(
    (selectedFile) => {
      if (!selectedFile) return;

      if (!ALLOWED_IMAGE_TYPES.includes(selectedFile.type)) {
        onChange(null, "Please select a JPG, PNG, GIF, or WEBP image.");
        return;
      }

      if (selectedFile.size > MAX_FILE_SIZE) {
        onChange(null, "The image must not exceed 5 MB.");
        return;
      }

      onChange(selectedFile, "");
    },
    [onChange],
  );

  const handleInput = (event) => {
    handleFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-semibold text-slate-700">
          <i className={`bi ${icon} mr-2 text-slate-500`} />
          {label}
        </label>

        {description && (
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        )}
      </div>

      <div
        className={`rounded-xl border p-4 transition ${
          dragging
            ? "border-emerald-500 bg-emerald-50"
            : "border-slate-200 bg-slate-50"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setDragging(false);
          }
        }}
        onDrop={handleDrop}
      >
        <div className="flex min-h-[160px] w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
          {preview ? (
            <img
              src={preview}
              alt={label}
              className="max-h-[150px] max-w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400">
              <i className={`bi ${icon} text-6xl`} />
              <span className="mt-3 text-xs font-medium">
                No image available
              </span>
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-center gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95">
            <i className="bi bi-upload mr-1.5" />
            {file || preview ? "Change Image" : "Upload Image"}

            <input
              type="file"
              className="hidden"
              accept={accept}
              onChange={handleInput}
            />
          </label>

          {(file || preview) &&
            (remove ? (
              <button
                type="button"
                onClick={onRestore}
                className="inline-flex items-center rounded-lg border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                <i className="bi bi-arrow-counterclockwise mr-1.5" />
                Restore
              </button>
            ) : (
              <button
                type="button"
                onClick={onRemove}
                className="inline-flex items-center rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <i className="bi bi-trash mr-1.5" />
                Remove
              </button>
            ))}
        </div>

        <div className="mt-3 border-t border-slate-200 pt-3 text-center text-xs text-slate-500">
          <i className="bi bi-cloud-arrow-up mr-1.5" />
          JPG, PNG, GIF, or WEBP • Maximum 5 MB
        </div>
      </div>
    </div>
  );
}

// ==========================================================
// MAIN COMPONENT
// ==========================================================

export default function Profile() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [securityForm, setSecurityForm] = useState(EMPTY_SECURITY_FORM);

  const [avatarFile, setAvatarFile] = useState(null);
  const [esignFile, setEsignFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [centers, setCenters] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [organizationLoading, setOrganizationLoading] = useState(false);

  // ========================================================
  // GENERIC FORM HANDLERS
  // ========================================================

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }, []);

  const handleSecurityChange = useCallback((event) => {
    const { name, value } = event.target;

    setSecurityForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }, []);

  // ========================================================
  // ORGANIZATION DATA
  // ========================================================

  const fetchOrganizationData = useCallback(async () => {
    setOrganizationLoading(true);

    try {
      const [centerResult, departmentResult, positionResult] =
        await Promise.all([
          apiFetch(`${API_BASE_URL}/centers/active-centers`),
          apiFetch(`${API_BASE_URL}/departments/active-departments`),
          apiFetch(`${API_BASE_URL}/positions/active-positions`),
        ]);

      setCenters(getCollection(centerResult, "centers"));
      setDepartments(getCollection(departmentResult, "departments"));
      setPositions(getCollection(positionResult, "positions"));
    } catch (error) {
      console.error("Organization loading error:", error);
      showErrorAlert(
        error.message || "Unable to load organization information.",
      );
    } finally {
      setOrganizationLoading(false);
    }
  }, []);

  // ========================================================
  // PROFILE DATA
  // ========================================================

  const fetchProfile = useCallback(async () => {
    try {
      if (!getToken()) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const [meResult, detailsResult] = await Promise.all([
        apiFetch(`${API_BASE_URL}/me`),
        apiFetch(`${API_BASE_URL}/user-details`),
      ]);

      const currentUser =
        meResult?.user ??
        meResult?.data?.user ??
        meResult?.data ??
        meResult;

      if (!currentUser) {
        throw new Error("Unable to determine the authenticated user.");
      }

      const detailsList = getCollection(
        detailsResult,
        "userDetails",
        "user_details",
      );

      const accountReference =
        currentUser.uacc_reference || currentUser.reference || "";

      const accountEmail =
        currentUser.uacc_email || currentUser.email || "";

      let matchedDetails = detailsList.find((detail) =>
        accountReference
          ? [
              detail.uacc_reference,
              detail.uacc_ref,
              detail.ud_uacc_reference,
              detail.ud_uniqid,
            ].some(
              (reference) =>
                reference &&
                String(reference) === String(accountReference),
            )
          : false,
      );

      if (!matchedDetails && accountEmail) {
        matchedDetails = detailsList.find(
          (detail) =>
            normalize(detail.ud_email).toLowerCase() ===
            normalize(accountEmail).toLowerCase(),
        );
      }

      if (!matchedDetails?.ud_uniqid) {
        throw new Error("Your user profile could not be found.");
      }

      const mergedUser = {
        ...currentUser,
        ...matchedDetails,
      };

      setUser(mergedUser);

      setFormData({
        ...EMPTY_FORM,
        ud_uniqid: matchedDetails.ud_uniqid,
        ud_firstname: matchedDetails.ud_firstname || "",
        ud_middlename: matchedDetails.ud_middlename || "",
        ud_lastname: matchedDetails.ud_lastname || "",
        ud_email: accountEmail || matchedDetails.ud_email || "",

        ud_center_reference:
          getReference(
            matchedDetails,
            "ud_center_reference",
            "center_reference",
            "mc_reference",
          ) || matchedDetails.center?.mc_reference || "",

        ud_department_reference:
          getReference(
            matchedDetails,
            "ud_department_reference",
            "department_reference",
            "md_reference",
          ) || matchedDetails.department?.md_reference || "",

        ud_position_reference:
          getReference(
            matchedDetails,
            "ud_position_reference",
            "position_reference",
            "mp_reference",
          ) || matchedDetails.position?.mp_reference || "",

        ud_avatar: matchedDetails.ud_avatar || "",
        ud_esign: matchedDetails.ud_esign || "",
      });

      setSecurityForm({
        ...EMPTY_SECURITY_FORM,
        current_email: accountEmail || matchedDetails.ud_email || "",
      });

      setAvatarFile(null);
      setEsignFile(null);
    } catch (error) {
      console.error("Profile loading error:", error);
      showErrorAlert(error.message || "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchOrganizationData();
  }, [fetchProfile, fetchOrganizationData]);

  // ========================================================
  // FILTER ORGANIZATION OPTIONS
  // ========================================================

  const filteredDepartments = useMemo(() => {
    if (!formData.ud_center_reference) return [];

    return departments.filter((department) => {
      const reference =
        getReference(
          department,
          "md_center_reference",
          "mc_reference",
          "center_reference",
        ) || department.center?.mc_reference || "";

      return String(reference) === String(formData.ud_center_reference);
    });
  }, [departments, formData.ud_center_reference]);

  const filteredPositions = useMemo(() => {
    if (!formData.ud_department_reference) return [];

    return positions.filter((position) => {
      const reference =
        getReference(
          position,
          "mp_department_reference",
          "md_reference",
          "department_reference",
        ) || position.department?.md_reference || "";

      return String(reference) === String(formData.ud_department_reference);
    });
  }, [positions, formData.ud_department_reference]);

  const handleCenterChange = (event) => {
    setFormData((previous) => ({
      ...previous,
      ud_center_reference: event.target.value,
      ud_department_reference: "",
      ud_position_reference: "",
    }));
  };

  const handleDepartmentChange = (event) => {
    setFormData((previous) => ({
      ...previous,
      ud_department_reference: event.target.value,
      ud_position_reference: "",
    }));
  };

  const handlePositionChange = (event) => {
    setFormData((previous) => ({
      ...previous,
      ud_position_reference: event.target.value,
    }));
  };

  // ========================================================
  // IMAGE HANDLERS
  // ========================================================

  const handleAvatarChange = useCallback((file, message) => {
    if (message) {
      showErrorAlert(message);
      return;
    }

    setAvatarFile(file);
    setFormData((previous) => ({
      ...previous,
      ud_remove_avatar: "0",
    }));
  }, []);

  const handleEsignChange = useCallback((file, message) => {
    if (message) {
      showErrorAlert(message);
      return;
    }

    setEsignFile(file);
    setFormData((previous) => ({
      ...previous,
      ud_remove_esign: "0",
    }));
  }, []);

  const removeAvatar = () => {
    setAvatarFile(null);
    setFormData((previous) => ({
      ...previous,
      ud_remove_avatar: "1",
    }));
  };

  const restoreAvatar = () => {
    setAvatarFile(null);
    setFormData((previous) => ({
      ...previous,
      ud_remove_avatar: "0",
    }));
  };

  const removeEsign = () => {
    setEsignFile(null);
    setFormData((previous) => ({
      ...previous,
      ud_remove_esign: "1",
    }));
  };

  const restoreEsign = () => {
    setEsignFile(null);
    setFormData((previous) => ({
      ...previous,
      ud_remove_esign: "0",
    }));
  };

  // ========================================================
  // VALIDATION
  // ========================================================

  const validateProfile = () => {
    const firstname = normalize(formData.ud_firstname);
    const lastname = normalize(formData.ud_lastname);
    const email = normalize(formData.ud_email);

    if (!firstname) return "Please enter your first name.";
    if (!lastname) return "Please enter your last name.";
    if (!email) return "Please enter your email address.";

    if (!EMAIL_REGEX.test(email)) {
      return "Please enter a valid email address.";
    }

    if (!formData.ud_center_reference) {
      return "Please select your center.";
    }

    if (!formData.ud_department_reference) {
      return "Please select your department.";
    }

    if (!formData.ud_position_reference) {
      return "Please select your position.";
    }

    for (const file of [avatarFile, esignFile]) {
      if (!file) continue;

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return "Please select a valid image file.";
      }

      if (file.size > MAX_FILE_SIZE) {
        return "Images must not exceed 5 MB.";
      }
    }

    return "";
  };

  const validateEmailChange = () => {
    const current = normalize(securityForm.current_email).toLowerCase();
    const next = normalize(securityForm.new_email);
    const confirm = normalize(securityForm.confirm_email);

    if (!next) return "Please enter your new email address.";

    if (!EMAIL_REGEX.test(next)) {
      return "Please enter a valid new email address.";
    }

    if (current === next.toLowerCase()) {
      return "Your new email must differ from your current email.";
    }

    if (!confirm) return "Please confirm your new email address.";

    if (next.toLowerCase() !== confirm.toLowerCase()) {
      return "The email addresses do not match.";
    }

    return "";
  };

  const validatePasswordChange = () => {
    const {
      current_password: current,
      new_password: next,
      confirm_password: confirm,
    } = securityForm;

    if (!current) return "Please enter your current password.";
    if (!next) return "Please enter your new password.";

    if (next.length < PASSWORD_MIN_LENGTH) {
      return `Your new password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    }

    if (!confirm) return "Please confirm your new password.";

    if (next !== confirm) return "The passwords do not match.";

    if (current === next) {
      return "Your new password must differ from your current password.";
    }

    return "";
  };

  // ========================================================
  // SAVE PROFILE
  // ========================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validateProfile();

    if (validationError) {
      showErrorAlert(validationError);
      return;
    }

    if (!formData.ud_uniqid) {
      showErrorAlert("Unable to determine your user profile.");
      return;
    }

    if (!getToken()) {
      showErrorAlert("Your session has expired. Please log in again.");
      return;
    }

    setSaving(true);
    showLoadingPopup("Saving Profile...");

    try {
      const payload = new FormData();

      payload.append("_method", "PUT");

      [
        "ud_firstname",
        "ud_middlename",
        "ud_lastname",
        "ud_email",
        "ud_center_reference",
        "ud_department_reference",
        "ud_position_reference",
      ].forEach((key) => {
        payload.append(key, normalize(formData[key]));
      });

      if (avatarFile instanceof File) {
        payload.append("ud_avatar", avatarFile);
      }

      payload.append("ud_remove_avatar", formData.ud_remove_avatar);

      if (esignFile instanceof File) {
        payload.append("ud_esign", esignFile);
      }

      payload.append("ud_remove_esign", formData.ud_remove_esign);

      const result = await apiFetch(
        `${API_BASE_URL}/user-details/${encodeURIComponent(formData.ud_uniqid)}`,
        {
          method: "POST",
          body: payload,
        },
      );

      const updatedDetails =
        result?.userDetails ??
        result?.user_details ??
        result?.data?.userDetails ??
        result?.data?.user_details ??
        result?.data ??
        result?.user ??
        {};

      const updatedUser = {
        ...user,
        ...updatedDetails,
        ud_uniqid: updatedDetails.ud_uniqid ?? formData.ud_uniqid,
        ud_firstname: updatedDetails.ud_firstname ?? formData.ud_firstname,
        ud_middlename: updatedDetails.ud_middlename ?? formData.ud_middlename,
        ud_lastname: updatedDetails.ud_lastname ?? formData.ud_lastname,
        ud_email: updatedDetails.ud_email ?? formData.ud_email,
        ud_center_reference:
          updatedDetails.ud_center_reference ?? formData.ud_center_reference,
        ud_department_reference:
          updatedDetails.ud_department_reference ??
          formData.ud_department_reference,
        ud_position_reference:
          updatedDetails.ud_position_reference ??
          formData.ud_position_reference,
        ud_avatar:
          updatedDetails.ud_avatar ??
          (formData.ud_remove_avatar === "1" ? "" : formData.ud_avatar),
        ud_esign:
          updatedDetails.ud_esign ??
          (formData.ud_remove_esign === "1" ? "" : formData.ud_esign),
      };

      setUser(updatedUser);

      setFormData((previous) => ({
        ...previous,
        ...updatedUser,
        ud_remove_avatar: "0",
        ud_remove_esign: "0",
      }));

      setAvatarFile(null);
      setEsignFile(null);
      saveAuthUser(updatedUser);

      Swal.close();

      showSuccessAlert(
        result?.message || "Your profile has been updated successfully.",
      );

      refreshPageAfterSuccess();
    } catch (error) {
      console.error("Profile update error:", error);
      Swal.close();
      showErrorAlert(error.message || "Unable to update your profile.");
    } finally {
      setSaving(false);
    }
  };

  // ========================================================
  // CHANGE EMAIL
  // ========================================================

  const handleEmailChange = async () => {
    const validationError = validateEmailChange();

    if (validationError) {
      showErrorAlert(validationError);
      return;
    }

    if (!getToken()) {
      showErrorAlert("Your session has expired. Please log in again.");
      return;
    }

    setEmailSaving(true);
    showLoadingPopup("Updating Email...");

    try {
      const result = await apiFetch(`${API_BASE_URL}/change-email`, {
        method: "POST",
        body: JSON.stringify({
          current_email: securityForm.current_email,
          new_email: normalize(securityForm.new_email),
          new_email_confirmation: normalize(securityForm.confirm_email),
        }),
      });

      const updatedEmail =
        result?.uacc_email ??
        result?.user?.uacc_email ??
        result?.data?.uacc_email ??
        normalize(securityForm.new_email);

      setSecurityForm((previous) => ({
        ...previous,
        current_email: updatedEmail,
        new_email: "",
        confirm_email: "",
      }));

      setFormData((previous) => ({
        ...previous,
        ud_email: updatedEmail,
      }));

      setUser((previous) => ({
        ...previous,
        uacc_email: updatedEmail,
        ud_email: updatedEmail,
      }));

      saveAuthUser({
        ...user,
        uacc_email: updatedEmail,
        ud_email: updatedEmail,
      });

      Swal.close();

      showSuccessAlert(
        result?.message || "Your email address has been updated successfully.",
      );

      refreshPageAfterSuccess();
    } catch (error) {
      console.error("Email change error:", error);
      Swal.close();
      showErrorAlert(error.message || "Unable to update your email address.");
    } finally {
      setEmailSaving(false);
    }
  };

  // ========================================================
  // CHANGE PASSWORD
  // ========================================================

  const handlePasswordChange = async () => {
    const validationError = validatePasswordChange();

    if (validationError) {
      showErrorAlert(validationError);
      return;
    }

    if (!getToken()) {
      showErrorAlert("Your session has expired. Please log in again.");
      return;
    }

    setPasswordSaving(true);
    showLoadingPopup("Changing Password...");

    try {
      const result = await apiFetch(`${API_BASE_URL}/change-password`, {
        method: "POST",
        body: JSON.stringify({
          current_password: securityForm.current_password,
          new_password: securityForm.new_password,
          new_password_confirmation: securityForm.confirm_password,
        }),
      });

      setSecurityForm((previous) => ({
        ...previous,
        current_password: "",
        new_password: "",
        confirm_password: "",
      }));

      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);

      Swal.close();

      showSuccessAlert(
        result?.message || "Your password has been changed successfully.",
      );

      refreshPageAfterSuccess();
    } catch (error) {
      console.error("Password change error:", error);
      Swal.close();
      showErrorAlert(error.message || "Unable to change your password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  // ========================================================
  // RESET
  // ========================================================

  const handleReset = async () => {
    if (saving || emailSaving || passwordSaving) return;

    setLoading(true);

    try {
      await Promise.all([fetchProfile(), fetchOrganizationData()]);
    } finally {
      setLoading(false);
    }
  };

  // ========================================================
  // LOADING STATE
  // ========================================================

  if (loading) {
    return <LoadingState />;
  }

  // ========================================================
  // MAIN UI
  // ========================================================

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* IMAGES */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 md:col-span-5">
              <ImageField
                label="Profile Photo"
                description="Recommended: square JPG or PNG."
                value={formData.ud_avatar}
                file={avatarFile}
                remove={formData.ud_remove_avatar === "1"}
                accept=".jpg,.jpeg,.png,.gif,.webp"
                icon="bi-person-square"
                onChange={handleAvatarChange}
                onRemove={removeAvatar}
                onRestore={restoreAvatar}
              />
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 md:col-span-7">
              <ImageField
                label="Signature Image"
                description="Upload a clear image of your signature."
                value={formData.ud_esign}
                file={esignFile}
                remove={formData.ud_remove_esign === "1"}
                accept=".jpg,.jpeg,.png,.gif,.webp"
                icon="bi-pen"
                onChange={handleEsignChange}
                onRemove={removeEsign}
                onRestore={restoreEsign}
              />
            </div>
          </div>
        </section>

        {/* ACCOUNT AND PERSONAL INFORMATION */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <SectionHeading
              icon="bi-shield-lock"
              title="Account Details"
              description="Account information is read-only."
            />

            <span className="hidden items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 sm:inline-flex">
              <i className="bi bi-lock-fill text-[10px]" />
              Account Read-only
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem
              icon="bi-person-badge"
              label="Account Reference"
              value={user?.uacc_reference}
            />

            <InfoItem
              icon="bi-shield-check"
              label="Account Type"
              value={user?.uacc_type}
            />

            <InfoItem
              icon="bi-toggle-on"
              label="Account Status"
              value={user?.uacc_status}
            />
          </div>

          <div className="my-5 border-t border-slate-100" />

          <SectionHeading
            icon="bi-person"
            title="Personal Information"
            description="Update your personal details."
          />

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <TextField
              label="First Name"
              name="ud_firstname"
              value={formData.ud_firstname}
              onChange={handleChange}
              placeholder="First name"
              required
              maxLength={50}
            />

            <TextField
              label="Middle Name"
              name="ud_middlename"
              value={formData.ud_middlename}
              onChange={handleChange}
              placeholder="Middle name"
              maxLength={50}
              optional
            />

            <TextField
              label="Last Name"
              name="ud_lastname"
              value={formData.ud_lastname}
              onChange={handleChange}
              placeholder="Last name"
              required
              maxLength={50}
            />

            <SelectField
              label="Center"
              icon="bi-building"
              value={formData.ud_center_reference}
              onChange={handleCenterChange}
              disabled={organizationLoading}
              required
              placeholder={
                organizationLoading ? "Loading centers..." : "Select Center"
              }
            >
              {centers.map((center) => (
                <option key={center.mc_reference} value={center.mc_reference}>
                  {center.mc_name}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Department"
              icon="bi-diagram-2"
              value={formData.ud_department_reference}
              onChange={handleDepartmentChange}
              disabled={
                organizationLoading || !formData.ud_center_reference
              }
              required
              placeholder={
                !formData.ud_center_reference
                  ? "Select Center first"
                  : filteredDepartments.length === 0
                    ? "No departments available"
                    : "Select Department"
              }
            >
              {filteredDepartments.map((department) => (
                <option
                  key={department.md_reference}
                  value={department.md_reference}
                >
                  {department.md_name}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Position"
              icon="bi-briefcase"
              value={formData.ud_position_reference}
              onChange={handlePositionChange}
              disabled={
                organizationLoading || !formData.ud_department_reference
              }
              required
              placeholder={
                !formData.ud_department_reference
                  ? "Select Department first"
                  : filteredPositions.length === 0
                    ? "No positions available"
                    : "Select Position"
              }
            >
              {filteredPositions.map((position) => (
                <option
                  key={position.mp_reference}
                  value={position.mp_reference}
                >
                  {position.mp_name}
                </option>
              ))}
            </SelectField>
          </div>
        </section>

        {/* SECURITY */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
          <SectionHeading
            icon="bi-envelope"
            title="Change Email Address"
            description="Change the email address associated with your account."
          />

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <TextField
              label="Current Email"
              name="current_email"
              value={securityForm.current_email}
              readOnly
              icon="bi-envelope"
              type="email"
            />

            <TextField
              label="New Email"
              name="new_email"
              value={securityForm.new_email}
              onChange={handleSecurityChange}
              placeholder="newemail@example.com"
              maxLength={100}
              icon="bi-envelope-plus"
              type="email"
            />

            <TextField
              label="Confirm New Email"
              name="confirm_email"
              value={securityForm.confirm_email}
              onChange={handleSecurityChange}
              placeholder="Confirm new email"
              maxLength={100}
              icon="bi-envelope-check"
              type="email"
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-xs text-slate-500">
              <i className="bi bi-info-circle mt-0.5 text-sm text-slate-400" />
              Enter a valid email address that you can access.
            </p>

            <button
              type="button"
              disabled={emailSaving || saving || passwordSaving}
              onClick={handleEmailChange}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {emailSaving ? (
                <>
                  <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Updating...
                </>
              ) : (
                <>
                  <i className="bi bi-envelope-check mr-1.5" />
                  Update Email
                </>
              )}
            </button>
          </div>

          <div className="my-5 border-t border-slate-100" />

          <SectionHeading
            icon="bi-key"
            title="Change Password"
            description="Update the password used to access your account."
          />

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Current Password
              </label>

              <PasswordInput
                name="current_password"
                value={securityForm.current_password}
                onChange={handleSecurityChange}
                placeholder="Current password"
                show={showCurrentPassword}
                onToggle={() =>
                  setShowCurrentPassword((previous) => !previous)
                }
                icon="bi-lock"
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                New Password
              </label>

              <PasswordInput
                name="new_password"
                value={securityForm.new_password}
                onChange={handleSecurityChange}
                placeholder="New password"
                show={showNewPassword}
                onToggle={() => setShowNewPassword((previous) => !previous)}
                icon="bi-lock-fill"
              />

              <p className="mt-1.5 text-xs text-slate-400">
                Minimum {PASSWORD_MIN_LENGTH} characters.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Confirm New Password
              </label>

              <PasswordInput
                name="confirm_password"
                value={securityForm.confirm_password}
                onChange={handleSecurityChange}
                placeholder="Confirm new password"
                show={showConfirmPassword}
                onToggle={() =>
                  setShowConfirmPassword((previous) => !previous)
                }
                icon="bi-shield-lock"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-xs text-slate-500">
              <i className="bi bi-shield-check mt-0.5 text-sm text-emerald-600" />
              Your password must contain at least {PASSWORD_MIN_LENGTH}{" "}
              characters and differ from your current password.
            </p>

            <button
              type="button"
              disabled={passwordSaving || saving || emailSaving}
              onClick={handlePasswordChange}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {passwordSaving ? (
                <>
                  <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Changing...
                </>
              ) : (
                <>
                  <i className="bi bi-key mr-1.5" />
                  Change Password
                </>
              )}
            </button>
          </div>
        </section>

        {/* SAVE FOOTER */}
        <div className="sticky bottom-4 z-10 rounded-2xl border border-slate-200/80 bg-white/95 px-6 py-4 shadow-lg backdrop-blur-md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <i className="bi bi-shield-check text-base text-emerald-600" />
              <span>Save your profile changes when finished.</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={saving || emailSaving || passwordSaving}
                onClick={handleReset}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                <i className="bi bi-arrow-counterclockwise mr-1.5" />
                Reset Changes
              </button>

              <button
                type="submit"
                disabled={saving || emailSaving || passwordSaving}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
              >
                {saving ? (
                  <>
                    <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg mr-1.5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}