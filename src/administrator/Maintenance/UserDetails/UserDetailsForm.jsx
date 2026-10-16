import React, { useState, useEffect, useMemo, useCallback } from "react";

import Modal from "../../../assets/function/Modal";
import SearchableSelect from "../../../assets/function/SearchableSelect";
import { API_BASE_URL } from "../../../assets/js/appConfig";

// ==========================================================
// FORM SECTIONS CONFIGURATION
// ==========================================================
const SECTIONS = [
  {
    id: "identity",
    title: "Personal Information",
    description: "Basic details used across the system.",
    fields: [
      // ==================================================
      // AVATAR
      // ==================================================
      {
        name: "ud_avatar",
        label: "Avatar Image",
        type: "file",
        accept: "image/jpeg,image/png,image/gif,image/webp",
        defaultValue: "",
        required: false,
        className: "col-span-12 sm:col-span-4",
      },

      // ==================================================
      // E-SIGNATURE
      // ==================================================
      {
        name: "ud_esign",
        label: "E-Signature",
        type: "file",
        accept: "image/jpeg,image/png,image/gif,image/webp",
        defaultValue: "",
        required: false,
        className: "col-span-12 sm:col-span-8",
      },

      // ==================================================
      // FIRST NAME
      // ==================================================
      {
        name: "ud_firstname",
        label: "First Name",
        type: "input",
        inputType: "text",
        defaultValue: "",
        required: true,
        placeholder: "e.g. Oliver",
        className: "col-span-12 sm:col-span-4",
      },

      // ==================================================
      // MIDDLE NAME
      // ==================================================
      {
        name: "ud_middlename",
        label: "Middle Name",
        type: "input",
        inputType: "text",
        defaultValue: "",
        required: false,
        placeholder: "Optional",
        className: "col-span-12 sm:col-span-4",
      },

      // ==================================================
      // LAST NAME
      // ==================================================
      {
        name: "ud_lastname",
        label: "Last Name",
        type: "input",
        inputType: "text",
        defaultValue: "",
        required: true,
        placeholder: "e.g. Alva",
        className: "col-span-12 sm:col-span-4",
      },

      // ==================================================
      // EMAIL
      // ==================================================
      {
        name: "ud_email",
        label: "Email Address",
        type: "input",
        inputType: "email",
        defaultValue: "",
        required: true,
        placeholder: "user@example.com",
        helpText: "Used for login and notifications.",
        className: "col-span-12 sm:col-span-4",
      },

      // ==================================================
      // CENTER HEAD
      // ==================================================
      {
        name: "ud_center_head",
        label: "Center Head",
        type: "toggle",
        helpText: "Center heads get oversight of their whole center.",
        defaultValue: "No",
        className: "col-span-12 sm:col-span-4",
      },

      // ==================================================
      // APPROVER
      // ==================================================
      {
        name: "ud_is_approver",
        label: "Is Approver",
        type: "toggle",
        helpText: "Approvers can sign off on requests in their scope.",
        defaultValue: "No",
        className: "col-span-12 sm:col-span-4",
      },
      // ==================================================
      // CENTER
      // ==================================================
      {
        name: "ud_center_reference",
        label: "Center",
        type: "select",
        component: SearchableSelect,
        labelKey: "mc_name",
        valueKey: "mc_reference",
        placeholder: "Select a center...",
        searchPlaceholder: "Search center...",
        loadingText: "Loading centers...",
        noOptionsText: "No centers found",
        defaultValue: "",
        required: true,
        className: "col-span-12 sm:col-span-4",
      },

      // ==================================================
      // DEPARTMENT
      // ==================================================
      {
        name: "ud_department_reference",
        label: "Department",
        type: "select",
        component: SearchableSelect,
        labelKey: "md_name",
        valueKey: "md_reference",
        placeholder: "Select a department...",
        searchPlaceholder: "Search department...",
        loadingText: "Loading departments...",
        noOptionsText: "No departments found",
        defaultValue: "",
        required: true,
        className: "col-span-12 sm:col-span-4",
      },

      // ==================================================
      // POSITION
      // ==================================================
      {
        name: "ud_position_reference",
        label: "Position",
        type: "select",
        component: SearchableSelect,
        labelKey: "mp_name",
        valueKey: "mp_reference",
        placeholder: "Select a position...",
        searchPlaceholder: "Search position...",
        loadingText: "Loading positions...",
        noOptionsText: "No positions found",
        defaultValue: "",
        required: true,
        className: "col-span-12 sm:col-span-4",
      },
    ],
  },
];

const FORM_FIELDS = SECTIONS.flatMap((section) => section.fields);

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ==========================================================
// HELPERS
// ==========================================================
const normalize = (value) => (value == null ? "" : String(value).trim());

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) {
    return "";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ==========================================================
// INITIAL FORM DATA
// ==========================================================
const getInitialFormData = (item = {}) => ({
  ud_uniqid: item?.ud_uniqid ?? "",

  ...FORM_FIELDS.reduce((data, field) => {
    data[field.name] = item?.[field.name] ?? field.defaultValue ?? "";

    return data;
  }, {}),

  ud_status: item?.ud_status ?? "Active",

  // ------------------------------------------------------
  // File removal flags
  // ------------------------------------------------------
  ud_remove_avatar: "0",
  ud_remove_esign: "0",
});

// ==========================================================
// FIELD VALIDATION
// ==========================================================
const validateField = (field, value) => {
  const isEmpty = value == null || value === "";

  if (field.required && isEmpty) {
    return `${field.label} is required.`;
  }

  if (
    field.name === "ud_email" &&
    !isEmpty &&
    !EMAIL_REGEX.test(String(value))
  ) {
    return "Enter a valid email address.";
  }

  return "";
};

// ==========================================================
// COMPONENT
// ==========================================================
export default function UserDetailsForm({
  isOpen,
  onClose,
  title,
  currentItem,
  formData,
  setFormData,
  onSubmit,
  isLoading,
  modalSize,
}) {
  const [previews, setPreviews] = useState({});

  const [errorAlert, setErrorAlert] = useState(null);

  const [fieldErrors, setFieldErrors] = useState({});

  const [touched, setTouched] = useState({});

  const [centers, setCenters] = useState([]);

  const [departments, setDepartments] = useState([]);

  const [positions, setPositions] = useState([]);

  const [loadingCenters, setLoadingCenters] = useState(false);

  const [loadingDepartments, setLoadingDepartments] = useState(false);

  const [loadingPositions, setLoadingPositions] = useState(false);

  // ======================================================
  // FORM ERROR
  // ======================================================
  const showFormError = useCallback((message) => {
    setErrorAlert(message);

    setTimeout(() => {
      setErrorAlert(null);
    }, 5000);
  }, []);

  // ======================================================
  // FETCH HELPER
  // ======================================================
  const fetchData = useCallback(
    async (endpoint, setData, setLoading) => {
      try {
        setLoading(true);

        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
          headers: {
            Accept: "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch data from ${endpoint}`);
        }

        const result = await res.json();

        const data = Array.isArray(result)
          ? result
          : Array.isArray(result?.data)
            ? result.data
            : [];

        setData(data);
      } catch (err) {
        console.error(`Fetch Error (${endpoint}):`, err);

        showFormError(err.message || "Failed to fetch data. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [showFormError],
  );

  // ======================================================
  // LOAD DROPDOWN DATA
  // ======================================================
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    fetchData("/centers/active-centers", setCenters, setLoadingCenters);

    fetchData(
      "/departments/active-departments",
      setDepartments,
      setLoadingDepartments,
    );

    fetchData("/positions/active-positions", setPositions, setLoadingPositions);
  }, [isOpen, fetchData]);

  // ======================================================
  // INITIALIZE FORM
  // ======================================================
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormData(getInitialFormData(currentItem));

    setPreviews({});
    setErrorAlert(null);
    setFieldErrors({});
    setTouched({});
  }, [isOpen, currentItem, setFormData]);

  // ======================================================
  // CLEANUP OBJECT URLS
  // ======================================================
  useEffect(() => {
    return () => {
      Object.values(previews).forEach((url) => {
        if (url && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [previews]);

  // ======================================================
  // FILTER DEPARTMENTS BY CENTER
  // ======================================================
  const filteredDepartments = useMemo(() => {
    const centerRef = normalize(formData?.ud_center_reference);

    if (!centerRef) {
      return [];
    }

    return departments.filter(
      (department) => normalize(department?.md_center_reference) === centerRef,
    );
  }, [departments, formData?.ud_center_reference]);

  // ======================================================
  // FILTER POSITIONS BY DEPARTMENT
  // ======================================================
  const filteredPositions = useMemo(() => {
    const departmentRef = normalize(formData?.ud_department_reference);

    if (!departmentRef) {
      return [];
    }

    return positions.filter(
      (position) =>
        normalize(position?.mp_department_reference) === departmentRef,
    );
  }, [positions, formData?.ud_department_reference]);

  // ======================================================
  // REQUIRED FIELDS
  // ======================================================
  const requiredFields = useMemo(
    () => FORM_FIELDS.filter((field) => field.required),
    [],
  );

  // ======================================================
  // COMPLETED COUNT
  // ======================================================
  const completedCount = useMemo(
    () =>
      requiredFields.filter((field) => normalize(formData?.[field.name]))
        .length,
    [requiredFields, formData],
  );

  // ======================================================
  // FIELD CHANGE
  // ======================================================
  const handleChange = useCallback(
    (field, value) => {
      setFormData((prev) => {
        const next = {
          ...prev,
          [field]: value,
        };

        // ------------------------------------------------
        // Changing center resets department and position
        // ------------------------------------------------
        if (field === "ud_center_reference") {
          next.ud_department_reference = "";

          next.ud_position_reference = "";
        }

        // ------------------------------------------------
        // Changing department resets position
        // ------------------------------------------------
        else if (field === "ud_department_reference") {
          next.ud_position_reference = "";
        }

        return next;
      });
    },
    [setFormData],
  );

  // ======================================================
  // FIELD BLUR
  // ======================================================
  const handleBlur = useCallback((field, value) => {
    setTouched((prev) => ({
      ...prev,
      [field.name]: true,
    }));

    setFieldErrors((prev) => ({
      ...prev,
      [field.name]: validateField(field, value),
    }));
  }, []);

  // ======================================================
  // FILE CHANGE
  // ======================================================
  const handleFileChange = useCallback(
    (fieldName, file) => {
      // --------------------------------------------------
      // REMOVE FILE
      // --------------------------------------------------
      if (!file) {
        setFormData((prev) => ({
          ...prev,
          [fieldName]: null,

          ...(fieldName === "ud_avatar"
            ? {
                ud_remove_avatar: "1",
              }
            : {}),

          ...(fieldName === "ud_esign"
            ? {
                ud_remove_esign: "1",
              }
            : {}),
        }));

        setPreviews((prev) => {
          if (prev[fieldName] && prev[fieldName].startsWith("blob:")) {
            URL.revokeObjectURL(prev[fieldName]);
          }

          return {
            ...prev,
            [fieldName]: null,
          };
        });

        return;
      }

      // --------------------------------------------------
      // NEW FILE
      // --------------------------------------------------
      const objectUrl = URL.createObjectURL(file);

      setPreviews((prev) => {
        if (prev[fieldName] && prev[fieldName].startsWith("blob:")) {
          URL.revokeObjectURL(prev[fieldName]);
        }

        return {
          ...prev,
          [fieldName]: objectUrl,
        };
      });

      setFormData((prev) => ({
        ...prev,
        [fieldName]: file,

        ...(fieldName === "ud_avatar"
          ? {
              ud_remove_avatar: "0",
            }
          : {}),

        ...(fieldName === "ud_esign"
          ? {
              ud_remove_esign: "0",
            }
          : {}),
      }));
    },
    [setFormData],
  );

  // ======================================================
  // FILE SOURCE RESOLVER
  // ======================================================
  const getFileSrc = useCallback((currentFieldValue, previewUrl) => {
    // --------------------------------------------------
    // Newly selected image
    // --------------------------------------------------
    if (previewUrl) {
      return previewUrl;
    }

    // --------------------------------------------------
    // Nothing
    // --------------------------------------------------
    if (!currentFieldValue) {
      return null;
    }

    // --------------------------------------------------
    // File object
    // --------------------------------------------------
    if (typeof File !== "undefined" && currentFieldValue instanceof File) {
      return URL.createObjectURL(currentFieldValue);
    }

    // --------------------------------------------------
    // String path
    // --------------------------------------------------
    if (typeof currentFieldValue !== "string") {
      return null;
    }

    let value = currentFieldValue.trim();

    if (!value) {
      return null;
    }

    // --------------------------------------------------
    // Complete URL
    // --------------------------------------------------
    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    // --------------------------------------------------
    // Data URL
    // --------------------------------------------------
    if (/^data:image\//i.test(value)) {
      return value;
    }

    // --------------------------------------------------
    // Normalize Windows paths
    // --------------------------------------------------
    value = value.replace(/\\/g, "/");

    // --------------------------------------------------
    // Remove leading slash
    // --------------------------------------------------
    value = value.replace(/^\/+/, "");

    // --------------------------------------------------
    // Application URL
    //
    // API:
    // http://127.0.0.1:8000/api
    //
    // APP:
    // http://127.0.0.1:8000
    // --------------------------------------------------
    const appUrl = API_BASE_URL.replace(/\/api\/?$/i, "").replace(/\/+$/, "");

    return `${appUrl}/${value}`;
  }, []);

  // ======================================================
  // SUBMIT
  // ======================================================
  const handleSubmit = (e) => {
    e.preventDefault();

    const nextErrors = {};

    FORM_FIELDS.forEach((field) => {
      const error = validateField(field, formData?.[field.name]);

      if (error) {
        nextErrors[field.name] = error;
      }
    });

    setFieldErrors(nextErrors);

    setTouched(
      FORM_FIELDS.reduce(
        (acc, field) => ({
          ...acc,
          [field.name]: true,
        }),
        {},
      ),
    );

    const firstInvalid = Object.keys(nextErrors)[0];

    if (firstInvalid) {
      showFormError("Please fix the highlighted fields before saving.");

      const element = document.getElementById(`field-${firstInvalid}`);

      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        element.focus?.();
      }

      return;
    }

    // ==================================================
    // BUILD FORM DATA
    // ==================================================
    const payload = new FormData();

    Object.entries(formData || {}).forEach(([key, value]) => {
      // ------------------------------------------------
      // Existing image paths are not uploaded again.
      // ------------------------------------------------
      if (
        (key === "ud_avatar" || key === "ud_esign") &&
        !(typeof File !== "undefined" && value instanceof File)
      ) {
        return;
      }

      // ------------------------------------------------
      // Null values are skipped.
      // ------------------------------------------------
      if (value == null) {
        return;
      }

      // ------------------------------------------------
      // Append
      // ------------------------------------------------
      payload.append(key, value);
    });

    onSubmit(payload);
  };

  // ======================================================
  // RENDER
  // ======================================================
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={currentItem ? `Edit ${title}` : `Add ${title}`}
      modalSize={modalSize}
    >
      {/* ==================================================
                ERROR ALERT
            ================================================== */}
      {errorAlert && (
        <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          <i className="bi bi-exclamation-circle mt-0.5 shrink-0"></i>

          <span className="flex-1">{errorAlert}</span>

          <button
            type="button"
            onClick={() => setErrorAlert(null)}
            className="text-rose-400 hover:text-rose-600 cursor-pointer"
            aria-label="Dismiss"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      )}

      {/* ==================================================
                FORM SUMMARY
            ================================================== */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-slate-400">
          <span className="text-red-500">*</span> Required fields
        </p>

        <p className="text-[11px] font-medium text-slate-500">
          {completedCount}/{requiredFields.length} required fields complete
        </p>
      </div>

      {/* ==================================================
                FORM
            ================================================== */}
      <form
        id="onSubmit-form"
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="flex flex-col h-full"
      >
        <div className="overflow-y-auto space-y-6 pr-1 flex-1">
          {SECTIONS.map((section) => (
            <div key={section.id}>
              {/* ==================================================
                                    SECTION HEADING
                                ================================================== */}
              <div className="mb-2.5">
                <h4 className="text-xs font-semibold text-slate-800">
                  {section.title}
                </h4>

                {section.description && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {section.description}
                  </p>
                )}
              </div>

              {/* ==================================================
                                    SECTION FIELDS
                                ================================================== */}
              <div className="grid grid-cols-12 gap-4">
                {section.fields.map((field) => (
                  <FieldWrapper
                    key={field.name}
                    field={field}
                    className={field.className}
                    error={touched[field.name] ? fieldErrors[field.name] : ""}
                  >
                    {/* ==================================================
                                                    FILE
                                                ================================================== */}
                    {field.type === "file" &&
                      (field.name === "ud_esign" ? (
                        <ESignatureDropzone
                          field={field}
                          formData={formData}
                          currentItem={currentItem}
                          previews={previews}
                          getFileSrc={getFileSrc}
                          handleFileChange={handleFileChange}
                          showErrorAlert={showFormError}
                        />
                      ) : (
                        <FileDropzone
                          field={field}
                          formData={formData}
                          currentItem={currentItem}
                          previews={previews}
                          getFileSrc={getFileSrc}
                          handleFileChange={handleFileChange}
                          showErrorAlert={showFormError}
                        />
                      ))}

                    {/* ==================================================
                                                    INPUT
                                                ================================================== */}
                    {field.type === "input" && (
                      <input
                        id={`field-${field.name}`}
                        type={field.inputType}
                        name={field.name}
                        value={formData?.[field.name] || ""}
                        onChange={(e) =>
                          handleChange(field.name, e.target.value)
                        }
                        onBlur={(e) => handleBlur(field, e.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                        aria-invalid={Boolean(
                          touched[field.name] && fieldErrors[field.name],
                        )}
                        className={`w-full text-xs px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-2 bg-slate-50/50 transition-all ${
                          touched[field.name] && fieldErrors[field.name]
                            ? "border-rose-300 focus:ring-rose-500/20 focus:border-rose-500"
                            : "border-slate-200 focus:ring-blue-500/20 focus:border-blue-500"
                        }`}
                      />
                    )}

                    {/* ==================================================
                                                    TOGGLE
                                                ================================================== */}
                    {field.type === "toggle" && (
                      <ToggleField
                        id={`field-${field.name}`}
                        checked={
                          (formData?.[field.name] || field.defaultValue) ===
                          "Yes"
                        }
                        onChange={(checked) =>
                          handleChange(field.name, checked ? "Yes" : "No")
                        }
                      />
                    )}

                    {/* ==================================================
                    SELECT
                    ================================================== */}
                    {field.type === "select" &&
                      (() => {
                        const isCenter = field.name === "ud_center_reference";

                        const isDepartment =
                          field.name === "ud_department_reference";

                        const isPosition =
                          field.name === "ud_position_reference";

                        let options = field.options || [];

                        let loading = false;

                        let disabled = false;

                        let placeholder = field.placeholder;

                        let noOptionsText = field.noOptionsText;

                        if (isCenter) {
                          options = centers;

                          loading = loadingCenters;
                        } else if (isDepartment) {
                          options = filteredDepartments;

                          loading = loadingDepartments;

                          disabled = !formData?.ud_center_reference;

                          placeholder = formData?.ud_center_reference
                            ? "Select a department..."
                            : "Select a center first";

                          noOptionsText = formData?.ud_center_reference
                            ? "No departments found for this center"
                            : "Select a center first";
                        } else if (isPosition) {
                          options = filteredPositions;

                          loading = loadingPositions;

                          disabled = !formData?.ud_department_reference;

                          placeholder = formData?.ud_department_reference
                            ? "Select a position..."
                            : "Select a department first";

                          noOptionsText = formData?.ud_department_reference
                            ? "No positions found for this department"
                            : "Select a department first";
                        }

                        const Component = field.component;

                        return (
                          <Component
                            {...field}
                            id={`field-${field.name}`}
                            options={options}
                            loading={loading}
                            disabled={disabled}
                            placeholder={placeholder}
                            noOptionsText={noOptionsText}
                            value={formData?.[field.name] || ""}
                            onChange={(value) => {
                              handleChange(field.name, value);

                              setTouched((prev) => ({
                                ...prev,
                                [field.name]: true,
                              }));

                              setFieldErrors((prev) => ({
                                ...prev,
                                [field.name]: validateField(field, value),
                              }));
                            }}
                            className="w-full text-xs"
                          />
                        );
                      })()}
                  </FieldWrapper>
                ))}
              </div>
            </div>
          ))}
        </div>
      </form>

      {/* ==================================================
                BUTTONS
            ================================================== */}
      <div className="flex justify-end gap-2 pt-2 mt-2 border-t border-slate-100 bg-white">
        {/* CANCEL */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-rose-600 border border-rose-300 rounded-xl hover:bg-rose-50 transition cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className="bi bi-x-circle"></i>
          Cancel
        </button>

        {/* SAVE / UPDATE */}
        <button
          type="submit"
          form="onSubmit-form"
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-blue-600 border border-blue-300 rounded-xl hover:bg-blue-50 transition cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed min-w-[92px] justify-center"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin size-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />

                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
                />
              </svg>

              {currentItem ? "Updating..." : "Saving..."}
            </>
          ) : (
            <>
              {currentItem ? (
                <i className="bi bi-pencil-square"></i>
              ) : (
                <i className="bi bi-plus-lg"></i>
              )}

              {currentItem ? "Update" : "Save"}
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}

// ==========================================================
// FIELD WRAPPER
// ==========================================================
function FieldWrapper({ field, className, error, children }) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-1">
        <label
          htmlFor={`field-${field.name}`}
          className="block text-xs font-medium text-slate-700"
        >
          {field.label}{" "}
          {field.required && <span className="text-red-500">*</span>}
        </label>
      </div>

      {children}

      {error ? (
        <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1">
          <i className="bi bi-exclamation-circle"></i>
          {error}
        </p>
      ) : field.helpText ? (
        <p className="mt-1 text-[11px] text-slate-400">{field.helpText}</p>
      ) : null}
    </div>
  );
}

// ==========================================================
// TOGGLE FIELD
// ==========================================================
function ToggleField({ id, checked, onChange }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
        checked
          ? "bg-blue-50 border-blue-300"
          : "bg-slate-50/50 border-slate-200"
      }`}
    >
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-blue-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block size-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4.5" : "translate-x-1"
          }`}
        />
      </span>

      <span
        className={`text-xs font-medium ${
          checked ? "text-blue-700" : "text-slate-500"
        }`}
      >
        {checked ? "Yes" : "No"}
      </span>
    </button>
  );
}

// ==========================================================
// AVATAR FILE DROPZONE
// ==========================================================
function FileDropzone({
  field,
  formData,
  currentItem,
  previews,
  getFileSrc,
  handleFileChange,
  showErrorAlert,
}) {
  // ------------------------------------------------------
  // Prefer formData, then currentItem
  // ------------------------------------------------------
  const currentFieldValue =
    formData?.[field.name] || currentItem?.[field.name] || "";

  const previewUrl = previews[field.name];

  const fileSrc = getFileSrc(currentFieldValue, previewUrl);

  // ------------------------------------------------------
  // Validate
  // ------------------------------------------------------
  const validateFile = (file) => {
    if (!file) {
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      showErrorAlert(
        "That file type isn't supported. Please upload a JPG, PNG, GIF, or WEBP.",
      );

      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showErrorAlert(
        `That image is too large (${formatFileSize(
          file.size,
        )}). Please keep it under 5MB.`,
      );

      return;
    }

    handleFileChange(field.name, file);
  };

  // ------------------------------------------------------
  // File name
  // ------------------------------------------------------
  const fileName =
    typeof File !== "undefined" && formData?.[field.name] instanceof File
      ? formData[field.name].name
      : typeof currentFieldValue === "string"
        ? currentFieldValue.split("/").pop()
        : "";

  // ------------------------------------------------------
  // File size
  // ------------------------------------------------------
  const fileSize =
    typeof File !== "undefined" && formData?.[field.name] instanceof File
      ? formatFileSize(formData[field.name].size)
      : "";

  return (
    <div className="flex flex-col items-center gap-3">
      {/* ==================================================
                AVATAR PREVIEW
            ================================================== */}
      <label
        htmlFor={`file-input-${field.name}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();

          validateFile(e.dataTransfer.files?.[0]);
        }}
        className={`w-28 h-28 shrink-0 bg-white rounded-2xl border-2 border-dashed ${
          fileSrc
            ? "border-solid border-slate-200"
            : "border-slate-300 hover:border-blue-400"
        } overflow-hidden shadow-sm hover:shadow-md flex flex-col items-center justify-center relative cursor-pointer group transition-all text-center`}
      >
        {fileSrc ? (
          <>
            <img
              src={fileSrc}
              alt="Avatar Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error("Avatar image failed to load:", fileSrc);

                e.currentTarget.style.display = "none";
              }}
            />

            <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-2">
              <i className="bi bi-upload text-lg mb-1"></i>

              <span className="text-[10px] font-medium leading-tight">
                Click or drop to replace
              </span>
            </div>
          </>
        ) : (
          <>
            <i className="bi bi-image text-xl text-slate-400 group-hover:text-blue-500 mb-1"></i>

            <span className="text-[10px] font-medium text-blue-600 px-2">
              Upload photo
            </span>
          </>
        )}
      </label>

      {/* ==================================================
                BUTTON
            ================================================== */}
      <div className="flex flex-col items-center text-center">
        <label
          htmlFor={`file-input-${field.name}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
        >
          <i className="bi bi-upload"></i>

          {fileSrc ? "Replace image" : "Choose image"}
        </label>

        <p className="text-[10px] text-slate-400 mt-1.5">
          JPG, PNG, GIF or WEBP · up to 5MB
        </p>

        {fileName && (
          <div className="flex items-center justify-center gap-2 mt-2 text-[11px]">
            <span
              className="text-slate-500 truncate max-w-[160px]"
              title={fileName}
            >
              {fileName}
            </span>

            {fileSize && <span className="text-slate-300">·</span>}

            {fileSize && <span className="text-slate-400">{fileSize}</span>}

            <button
              type="button"
              onClick={() => handleFileChange(field.name, null)}
              className="text-rose-600 hover:text-rose-700 font-medium cursor-pointer ml-1"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* ==================================================
                INPUT
            ================================================== */}
      <input
        type="file"
        id={`file-input-${field.name}`}
        name={field.name}
        accept={field.accept}
        className="hidden"
        onChange={(e) => {
          validateFile(e.target.files?.[0]);

          e.target.value = "";
        }}
      />
    </div>
  );
}

// ==========================================================
// E-SIGNATURE DROPZONE
// ==========================================================
function ESignatureDropzone({
  field,
  formData,
  currentItem,
  previews,
  getFileSrc,
  handleFileChange,
  showErrorAlert,
}) {
  // ------------------------------------------------------
  // Prefer formData, then currentItem
  // ------------------------------------------------------
  const currentFieldValue =
    formData?.[field.name] || currentItem?.[field.name] || "";

  const previewUrl = previews[field.name];

  const fileSrc = getFileSrc(currentFieldValue, previewUrl);

  // ------------------------------------------------------
  // Validate
  // ------------------------------------------------------
  const validateFile = (file) => {
    if (!file) {
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      showErrorAlert(
        "That file type isn't supported. Please upload a JPG, PNG, GIF, or WEBP.",
      );

      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showErrorAlert(
        `That signature image is too large (${formatFileSize(
          file.size,
        )}). Please keep it under 5MB.`,
      );

      return;
    }

    handleFileChange(field.name, file);
  };

  // ------------------------------------------------------
  // File name
  // ------------------------------------------------------
  const fileName =
    typeof File !== "undefined" && formData?.[field.name] instanceof File
      ? formData[field.name].name
      : typeof currentFieldValue === "string"
        ? currentFieldValue.split("/").pop()
        : "";

  // ------------------------------------------------------
  // File size
  // ------------------------------------------------------
  const fileSize =
    typeof File !== "undefined" && formData?.[field.name] instanceof File
      ? formatFileSize(formData[field.name].size)
      : "";

  return (
    <div className="flex flex-col gap-2">
      {/* ==================================================
                SIGNATURE PREVIEW
            ================================================== */}
      <label
        htmlFor={`file-input-${field.name}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();

          validateFile(e.dataTransfer.files?.[0]);
        }}
        className={`w-full max-w-xl h-32 bg-slate-50 rounded-xl border-2 border-dashed ${
          fileSrc
            ? "border-solid border-slate-200 bg-white"
            : "border-slate-300 hover:border-blue-400"
        } overflow-hidden shadow-sm hover:shadow-md flex items-center justify-center relative cursor-pointer group transition-all`}
      >
        {fileSrc ? (
          <>
            <img
              src={fileSrc}
              alt="E-Signature Preview"
              className="max-w-full max-h-full object-contain p-4"
              onError={(e) => {
                console.error("E-signature image failed to load:", fileSrc);

                e.currentTarget.style.display = "none";
              }}
            />

            <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
              <i className="bi bi-upload text-lg mb-1"></i>

              <span className="text-[10px] font-medium">
                Click or drop to replace
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <i className="bi bi-pen text-xl text-slate-400 group-hover:text-blue-500 mb-1"></i>

            <span className="text-[11px] font-medium text-blue-600">
              Upload e-signature
            </span>

            <span className="text-[10px] text-slate-400 mt-1">
              Click or drag & drop signature image
            </span>
          </div>
        )}
      </label>

      {/* ==================================================
                BUTTON
            ================================================== */}
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={`file-input-${field.name}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
        >
          <i className="bi bi-upload"></i>

          {fileSrc ? "Replace signature" : "Choose signature"}
        </label>

        <span className="text-[10px] text-slate-400">
          JPG, PNG, GIF or WEBP · up to 5MB
        </span>
      </div>

      {/* ==================================================
                FILE INFORMATION
            ================================================== */}
      {fileName && (
        <div className="flex items-center gap-2 text-[11px]">
          <i className="bi bi-file-earmark-image text-slate-400"></i>

          <span
            className="text-slate-500 truncate max-w-[220px]"
            title={fileName}
          >
            {fileName}
          </span>

          {fileSize && (
            <>
              <span className="text-slate-300">·</span>

              <span className="text-slate-400">{fileSize}</span>
            </>
          )}

          <button
            type="button"
            onClick={() => handleFileChange(field.name, null)}
            className="text-rose-600 hover:text-rose-700 font-medium cursor-pointer ml-1"
          >
            Remove
          </button>
        </div>
      )}

      {/* ==================================================
                FILE INPUT
            ================================================== */}
      <input
        type="file"
        id={`file-input-${field.name}`}
        name={field.name}
        accept={field.accept}
        className="hidden"
        onChange={(e) => {
          validateFile(e.target.files?.[0]);

          e.target.value = "";
        }}
      />
    </div>
  );
}
