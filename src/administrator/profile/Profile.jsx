
import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

import Swal from "sweetalert2";
import { API_BASE_URL } from "../../assets/js/appConfig";

import {
  showErrorAlert,
  showLoadingPopup,
  showSuccessAlert,
} from "../../assets/js/swalHelpers";

import LoadingState from "../../assets/function/LoadingState";
import SearchableSelect from "../../assets/function/SearchableSelect";

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

  if (/^(https?:|data:|blob:)/i.test(path)) return path;

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

const getCollection = (result, ...keys) => {
  const data = extractData(result, keys);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;

  return [];
};

const getReference = (record, ...keys) => {
  for (const key of keys) {
    const value = record?.[key];

    if (value != null && value !== "") return value;
  }

  return "";
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

// ==========================================================
// REUSABLE UI COMPONENTS
// ==========================================================

function SectionHeading({ icon, title, description }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <i className={`bi ${icon}`} />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-700">
          {title}
        </h4>

        {description && (
          <p className="text-xs text-slate-400">{description}</p>
        )}
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
          <span className="font-normal text-slate-400">
            Optional
          </span>
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
// DRAG-AND-DROP IMAGE FIELD
// ==========================================================
export function ImageField({
  label,
  description,
  value,
  file,
  remove,
  accept = "image/jpeg,image/png,image/gif,image/webp",
  onChange,
  onRemove,
  onRestore,
  icon = "bi-image",
}) {
  const [dragging, setDragging] = useState(false);
  const [dragError, setDragError] = useState("");

  const inputId = useId();

  const filePreview = useMemo(
    () => (file ? URL.createObjectURL(file) : ""),
    [file]
  );

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  const preview = filePreview || (!remove ? getFileUrl(value) : "");

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFile = useCallback(
    (selectedFile) => {
      setDragError("");

      if (!selectedFile) return;

      if (!ALLOWED_IMAGE_TYPES.includes(selectedFile.type)) {
        const message = "Please select a valid image (JPG, PNG or GIF).";
        setDragError(message);
        onChange(null, message);
        return;
      }

      if (selectedFile.size > MAX_FILE_SIZE) {
        const message = "The image must not exceed 5 MB.";
        setDragError(message);
        onChange(null, message);
        return;
      }

      onChange(selectedFile, "");
    },
    [onChange]
  );

  const handleInput = (event) => {
    handleFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(true);
    setDragError("");
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    if (!dragging) setDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setDragging(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) handleFile(droppedFile);
  };

  const handleActionRemove = () => {
    setDragError("");
    onRemove();
  };

  const handleActionRestore = () => {
    setDragError("");
    onRestore();
  };

  return (
    <div className="space-y-2">
      {/* Label and Description */}
      <div className="flex flex-col">
        <label htmlFor={inputId}
          className="text-sm font-semibold text-slate-800 flex items-center gap-2 cursor-pointer select-none">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600">
            <i className={`bi ${icon} text-base`} />
          </span>
          {label}
        </label>
        {description && (
          <p className="text-xs text-slate-500 mt-1 ml-9">{description}</p>
        )}
      </div>

      {/* Drop Zone Container */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group relative overflow-hidden rounded-2xl border-2 border-dashed p-3 transition-all duration-300 ${
          dragging
            ? "scale-[1.01] border-emerald-500 bg-emerald-50/80 shadow-lg ring-4 ring-emerald-500/10"
            : "border-slate-200 bg-slate-50/50 hover:border-emerald-400 hover:bg-emerald-50/20 shadow-sm"
        }`}
      >
        {/* Active Drag Overlay */}
        {dragging && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-emerald-50/95 backdrop-blur-sm rounded-xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner mb-3 animate-bounce">
              <i className="bi bi-cloud-arrow-down-fill text-3xl" />
            </div>
            <p className="text-sm font-bold text-emerald-800">Drop your image here</p>
            <p className="text-xs text-emerald-600 mt-0.5">Release to upload instantly</p>
          </div>
        )}

        {/* Preview / Empty State Area */}
        <div className="relative flex min-h-full w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-rose-200/80 bg-white p-0 shadow-inner">
          {preview ? (
            <div className="relative group/preview w-full h-full flex items-center justify-center p-2">
              <img
                src={preview}
                alt={`${label} preview`}
                className="max-h-[160px] w-auto max-w-full rounded-lg object-contain shadow-sm transition-transform duration-300 group-hover/preview:scale-[1.02]"
              />
              
              {/* Floating Action Overlay on Preview */}
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] opacity-0 group-hover/preview:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center gap-3">
                <label
                  htmlFor={inputId}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-slate-800 text-xs font-semibold shadow-md hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer"
                >
                  <i className="bi bi-arrow-repeat" /> Change
                </label>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 mb-3 group-hover:scale-105 transition-transform duration-300">
                <i className={`bi ${icon} text-3xl`} />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Drag and drop your image here
              </p>
              <p className="text-xs text-slate-400 mt-1">
                or click browse to choose a file
              </p>
            </div>
          )}
        </div>

        {/* File Metadata & Main Action Toolbar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
          {/* File Info Badge */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {file && (
              <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 ml-1">
                {file.name} ({formatFileSize(file.size)})
              </span>
            )}
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex items-center gap-2">
            {!preview && (
              <label
                htmlFor={inputId}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition-all"
              >
                <i className="bi bi-folder2-open text-sm" />
                Browse File
              </label>
            )}

            {preview && remove && (
              <button
                type="button"
                onClick={handleActionRestore}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <i className="bi bi-arrow-counterclockwise text-emerald-600" />
                Restore Original
              </button>
            )}

            {preview && !remove && (
              <button
                type="button"
                onClick={handleActionRemove}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
              >
                <i className="bi bi-trash" />
                Remove Image
              </button>
            )}
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          id={inputId}
          type="file"
          className="sr-only"
          accept={accept}
          onChange={handleInput}
        />

        {/* Error Alert */}
        {dragError && (
          <div
            role="alert"
            className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 border border-red-200"
          >
            <i className="bi bi-exclamation-circle-fill text-sm text-red-500 shrink-0" />
            <span>{dragError}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================================
// MAIN PROFILE COMPONENT
// ==========================================================

export default function Profile() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [securityForm, setSecurityForm] = useState(
    EMPTY_SECURITY_FORM,
  );

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

  const [loadingCenters, setLoadingCenters] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingPositions, setLoadingPositions] = useState(false);

  // ========================================================
  // FORM HANDLERS
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
  // FETCH ORGANIZATION DATA
  // ========================================================

  const fetchOrganizationData = useCallback(async () => {
    setLoadingCenters(true);
    setLoadingDepartments(true);
    setLoadingPositions(true);

    try {
      const results = await Promise.allSettled([
        apiFetch(`${API_BASE_URL}/centers/active-centers`),
        apiFetch(`${API_BASE_URL}/departments/active-departments`),
        apiFetch(`${API_BASE_URL}/positions/active-positions`),
      ]);

      const [centerResult, departmentResult, positionResult] =
        results;

      if (centerResult.status === "fulfilled") {
        setCenters(getCollection(centerResult.value, "centers"));
      } else {
        console.error("Center loading error:", centerResult.reason);
        setCenters([]);
      }

      if (departmentResult.status === "fulfilled") {
        setDepartments(
          getCollection(departmentResult.value, "departments"),
        );
      } else {
        console.error(
          "Department loading error:",
          departmentResult.reason,
        );
        setDepartments([]);
      }

      if (positionResult.status === "fulfilled") {
        setPositions(
          getCollection(positionResult.value, "positions"),
        );
      } else {
        console.error(
          "Position loading error:",
          positionResult.reason,
        );
        setPositions([]);
      }

      if (results.some((result) => result.status === "rejected")) {
        showErrorAlert(
          "Some organization options could not be loaded. Please refresh the page and try again.",
        );
      }
    } catch (error) {
      console.error("Organization loading error:", error);

      showErrorAlert(
        error.message || "Unable to load organization information.",
      );
    } finally {
      setLoadingCenters(false);
      setLoadingDepartments(false);
      setLoadingPositions(false);
    }
  }, []);

  // ========================================================
  // FETCH PROFILE
  // ========================================================

  const fetchProfile = useCallback(async () => {
    try {
      if (!getToken()) {
        throw new Error(
          "Your session has expired. Please log in again.",
        );
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
        throw new Error(
          "Unable to determine the authenticated user.",
        );
      }

      const detailsList = getCollection(
        detailsResult,
        "userDetails",
        "user_details",
      );

      const accountReference =
        currentUser.uacc_reference ||
        currentUser.reference ||
        "";

      const accountEmail =
        currentUser.uacc_email ||
        currentUser.email ||
        "";

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

        ud_center_reference: String(
          getReference(
            matchedDetails,
            "ud_center_reference",
            "center_reference",
            "mc_reference",
          ) ||
            matchedDetails.center?.mc_reference ||
            "",
        ),

        ud_department_reference: String(
          getReference(
            matchedDetails,
            "ud_department_reference",
            "department_reference",
            "md_reference",
          ) ||
            matchedDetails.department?.md_reference ||
            "",
        ),

        ud_position_reference: String(
          getReference(
            matchedDetails,
            "ud_position_reference",
            "position_reference",
            "mp_reference",
          ) ||
            matchedDetails.position?.mp_reference ||
            "",
        ),

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
  // FILTER DEPARTMENTS AND POSITIONS
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
        ) ||
        department.center?.mc_reference ||
        "";

      return (
        String(reference) === String(formData.ud_center_reference)
      );
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
        ) ||
        position.department?.md_reference ||
        "";

      return (
        String(reference) ===
        String(formData.ud_department_reference)
      );
    });
  }, [positions, formData.ud_department_reference]);

  // ========================================================
  // SEARCHABLE SELECT OPTIONS
  // ========================================================

  const centerOptions = useMemo(
    () =>
      centers
        .filter((center) => getReference(center, "mc_reference") !== "")
        .map((center) => ({
          label:
            center.mc_name || center.center_name || "Unnamed center",
          value: String(center.mc_reference),
        })),
    [centers],
  );

  const departmentOptions = useMemo(
    () =>
      filteredDepartments
        .filter(
          (department) =>
            getReference(department, "md_reference") !== "",
        )
        .map((department) => ({
          label:
            department.md_name ||
            department.department_name ||
            "Unnamed department",
          value: String(department.md_reference),
        })),
    [filteredDepartments],
  );

  const positionOptions = useMemo(
    () =>
      filteredPositions
        .filter(
          (position) => getReference(position, "mp_reference") !== "",
        )
        .map((position) => ({
          label:
            position.mp_name ||
            position.position_name ||
            "Unnamed position",
          value: String(position.mp_reference),
        })),
    [filteredPositions],
  );

  // ========================================================
  // ORGANIZATION SELECT HANDLERS
  // ========================================================

  const handleCenterChange = useCallback((value) => {
    setFormData((previous) => ({
      ...previous,
      ud_center_reference: value == null ? "" : String(value),
      ud_department_reference: "",
      ud_position_reference: "",
    }));
  }, []);

  const handleDepartmentChange = useCallback((value) => {
    setFormData((previous) => ({
      ...previous,
      ud_department_reference: value == null ? "" : String(value),
      ud_position_reference: "",
    }));
  }, []);

  const handlePositionChange = useCallback((value) => {
    setFormData((previous) => ({
      ...previous,
      ud_position_reference: value == null ? "" : String(value),
    }));
  }, []);

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

  const removeAvatar = useCallback(() => {
    setAvatarFile(null);

    setFormData((previous) => ({
      ...previous,
      ud_remove_avatar: "1",
    }));
  }, []);

  const restoreAvatar = useCallback(() => {
    setAvatarFile(null);

    setFormData((previous) => ({
      ...previous,
      ud_remove_avatar: "0",
    }));
  }, []);

  const removeEsign = useCallback(() => {
    setEsignFile(null);

    setFormData((previous) => ({
      ...previous,
      ud_remove_esign: "1",
    }));
  }, []);

  const restoreEsign = useCallback(() => {
    setEsignFile(null);

    setFormData((previous) => ({
      ...previous,
      ud_remove_esign: "0",
    }));
  }, []);

  // ========================================================
  // PROFILE VALIDATION
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

  // ========================================================
  // EMAIL VALIDATION
  // ========================================================

  const validateEmailChange = () => {
    const current = normalize(
      securityForm.current_email,
    ).toLowerCase();

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

  // ========================================================
  // PASSWORD VALIDATION
  // ========================================================

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

    if (saving || emailSaving || passwordSaving) return;

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
          updatedDetails.ud_center_reference ??
          formData.ud_center_reference,
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
    if (saving || emailSaving || passwordSaving) return;

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
          new_email_confirmation: normalize(
            securityForm.confirm_email,
          ),
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

      const updatedUser = {
        ...user,
        uacc_email: updatedEmail,
        ud_email: updatedEmail,
      };

      setUser(updatedUser);
      saveAuthUser(updatedUser);

      Swal.close();

      showSuccessAlert(
        result?.message ||
          "Your email address has been updated successfully.",
      );

      refreshPageAfterSuccess();
    } catch (error) {
      console.error("Email change error:", error);

      Swal.close();

      showErrorAlert(
        error.message || "Unable to update your email address.",
      );
    } finally {
      setEmailSaving(false);
    }
  };

  // ========================================================
  // CHANGE PASSWORD
  // ========================================================

  const handlePasswordChange = async () => {
    if (saving || emailSaving || passwordSaving) return;

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
  // RESET CHANGES
  // ========================================================

  const handleReset = async () => {
    if (saving || emailSaving || passwordSaving) return;

    setLoading(true);
    setAvatarFile(null);
    setEsignFile(null);

    try {
      await Promise.all([
        fetchProfile(),
        fetchOrganizationData(),
      ]);

      setSecurityForm((previous) => ({
        ...previous,
        new_email: "",
        confirm_email: "",
        current_password: "",
        new_password: "",
        confirm_password: "",
      }));

      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
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
        {/* PROFILE IMAGES */}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 md:col-span-5">
              <ImageField
                label="Profile Photo"
                description="Recommended: JPG, PNG or GIF | Max 5MB"
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

            <div className="rounded-xl border border-slate-100 bg-slate-50/50 md:col-span-7">
              <ImageField
                label="Signature Image"
                description="Upload a clear image of your signature. : JPG, PNG or GIF | Max 5MB"
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

          <div className="my-3 border-t border-slate-100" />

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

            {/* CENTER */}

            <div>
              <label
                htmlFor="ud_center_reference"
                className="mb-1.5 block text-xs font-semibold text-slate-700"
              >
                <i className="bi bi-building mr-2 text-slate-400" />
                Center <span className="text-red-500">*</span>
              </label>

              <SearchableSelect
                id="ud_center_reference"
                name="ud_center_reference"
                options={centerOptions}
                value={String(formData.ud_center_reference ?? "")}
                onChange={handleCenterChange}
                placeholder="Select a center..."
                searchPlaceholder="Search centers..."
                loading={loadingCenters}
                loadingText="Loading centers..."
                noOptionsText="No centers available"
                labelKey="label"
                valueKey="value"
                disabled={loadingCenters || saving}
                clearable={false}
                className="w-full text-xs"
              />
            </div>

            {/* DEPARTMENT */}

            <div>
              <label
                htmlFor="ud_department_reference"
                className="mb-1.5 block text-xs font-semibold text-slate-700"
              >
                <i className="bi bi-diagram-2 mr-2 text-slate-400" />
                Department <span className="text-red-500">*</span>
              </label>

              <SearchableSelect
                id="ud_department_reference"
                name="ud_department_reference"
                options={departmentOptions}
                value={String(formData.ud_department_reference ?? "")}
                onChange={handleDepartmentChange}
                placeholder={
                  !formData.ud_center_reference
                    ? "Select a center first"
                    : "Select a department..."
                }
                searchPlaceholder="Search departments..."
                loading={loadingDepartments}
                loadingText="Loading departments..."
                noOptionsText={
                  !formData.ud_center_reference
                    ? "Select a center first"
                    : "No departments found for this center"
                }
                labelKey="label"
                valueKey="value"
                disabled={
                  loadingDepartments ||
                  saving ||
                  !formData.ud_center_reference
                }
                clearable={false}
                className="w-full text-xs"
              />
            </div>

            {/* POSITION */}

            <div>
              <label
                htmlFor="ud_position_reference"
                className="mb-1.5 block text-xs font-semibold text-slate-700"
              >
                <i className="bi bi-briefcase mr-2 text-slate-400" />
                Position <span className="text-red-500">*</span>
              </label>

              <SearchableSelect
                id="ud_position_reference"
                name="ud_position_reference"
                options={positionOptions}
                value={String(formData.ud_position_reference ?? "")}
                onChange={handlePositionChange}
                placeholder={
                  !formData.ud_department_reference
                    ? "Select a department first"
                    : "Select a position..."
                }
                searchPlaceholder="Search positions..."
                loading={loadingPositions}
                loadingText="Loading positions..."
                noOptionsText={
                  !formData.ud_department_reference
                    ? "Select a department first"
                    : "No positions found for this department"
                }
                labelKey="label"
                valueKey="value"
                disabled={
                  loadingPositions ||
                  saving ||
                  !formData.ud_department_reference
                }
                clearable={false}
                className="w-full text-xs"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-xs text-slate-500">
              <i className="bi bi-info-circle mt-0.5 text-sm text-slate-400" />
              Save your profile changes when finished.
            </p>

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
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-emerald-600 bg-white px-6 py-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
              >
                {saving ? (
                  <>
                    <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
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
        </section>

        {/* CHANGE EMAIL AND PASSWORD */}

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
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-emerald-600 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {emailSaving ? (
                <>
                  <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
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
              <label
                htmlFor="current_password"
                className="mb-1.5 block text-xs font-semibold text-slate-700"
              >
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
              <label
                htmlFor="new_password"
                className="mb-1.5 block text-xs font-semibold text-slate-700"
              >
                New Password
              </label>

              <PasswordInput
                name="new_password"
                value={securityForm.new_password}
                onChange={handleSecurityChange}
                placeholder="New password"
                show={showNewPassword}
                onToggle={() =>
                  setShowNewPassword((previous) => !previous)
                }
                icon="bi-lock-fill"
              />

              <p className="mt-1.5 text-xs text-slate-400">
                Minimum {PASSWORD_MIN_LENGTH} characters.
              </p>
            </div>

            <div>
              <label
                htmlFor="confirm_password"
                className="mb-1.5 block text-xs font-semibold text-slate-700"
              >
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
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-emerald-600 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {passwordSaving ? (
                <>
                  <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
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
      </form>
    </div>
  );
}
