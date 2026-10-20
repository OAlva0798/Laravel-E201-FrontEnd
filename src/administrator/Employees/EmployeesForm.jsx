
import React, { useState, useEffect, useMemo, useCallback } from "react";

import Modal from "../../assets/function/Modal";
import SearchableSelect from "../../assets/function/SearchableSelect";
import { API_BASE_URL } from "../../assets/js/appConfig";

const SECTIONS = [
  {
    id: "personal",
    title: "Personal Information",
    description: "Basic employee information.",
    fields: [
      {
        name: "ee_profile",
        label: "Profile Image",
        type: "file",
        accept: "image/jpeg,image/png,image/gif,image/webp",
        className: "col-span-12 sm:col-span-4",
      },
      {
        name: "ee_firstname",
        label: "First Name",
        type: "text",
        required: true,
        placeholder: "Enter first name",
        className: "col-span-12 sm:col-span-4",
      },
      {
        name: "ee_middlename",
        label: "Middle Name",
        type: "text",
        placeholder: "Optional",
        className: "col-span-12 sm:col-span-4",
      },
      {
        name: "ee_lastname",
        label: "Last Name",
        type: "text",
        required: true,
        placeholder: "Enter last name",
        className: "col-span-12 sm:col-span-4",
      },
      {
        name: "ee_gender",
        label: "Gender",
        type: "select-basic",
        options: ["Male", "Female", "Other"],
        className: "col-span-12 sm:col-span-4",
      },
      {
        name: "ee_birth_date",
        label: "Birth Date",
        type: "date",
        className: "col-span-12 sm:col-span-4",
      },
      {
        name: "ee_civil_status",
        label: "Civil Status",
        type: "select-basic",
        options: ["Single", "Married", "Widowed", "Separated", "Divorced"],
        className: "col-span-12 sm:col-span-4",
      },
    ],
  },
  {
    id: "contact",
    title: "Contact Information",
    description: "Employee contact details.",
    fields: [
      {
        name: "ee_email",
        label: "Email Address",
        type: "email",
        placeholder: "employee@example.com",
        className: "col-span-12 sm:col-span-6",
      },
      {
        name: "ee_mobile_number",
        label: "Mobile Number",
        type: "text",
        placeholder: "09XXXXXXXXX",
        className: "col-span-12 sm:col-span-3",
      },
      {
        name: "ee_telephone",
        label: "Telephone Number",
        type: "text",
        placeholder: "Telephone number",
        className: "col-span-12 sm:col-span-3",
      },
    ],
  },
  {
    id: "government",
    title: "Government Information",
    description: "Government identification and blood type.",
    fields: [
      {
        name: "ee_sss",
        label: "SSS Number",
        type: "text",
        className: "col-span-12 sm:col-span-4",
      },
      {
        name: "ee_tinid",
        label: "TIN Number",
        type: "text",
        className: "col-span-12 sm:col-span-4",
      },
      {
        name: "ee_bloodtype",
        label: "Blood Type",
        type: "select-basic",
        options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
        className: "col-span-12 sm:col-span-4",
      },
    ],
  },
  {
    id: "emergency",
    title: "Emergency Contact",
    description: "Person to contact in an emergency.",
    fields: [
      {
        name: "ee_ecname",
        label: "Contact Person",
        type: "text",
        className: "col-span-12 sm:col-span-4",
      },
      {
        name: "ee_eccontact",
        label: "Contact Number",
        type: "text",
        className: "col-span-12 sm:col-span-4",
      },
      {
        name: "ee_ecaddress",
        label: "Contact Address",
        type: "text",
        className: "col-span-12 sm:col-span-4",
      },
    ],
  },
  {
    id: "employment",
    title: "Employment Information",
    description: "Company assignment and employment dates.",
    fields: [
      {
        name: "ee_company_reference",
        label: "Company Reference",
        type: "text",
        placeholder: "Company reference",
        className: "col-span-12 sm:col-span-6",
      },
      {
        name: "ee_center_reference",
        label: "Center",
        type: "select",
        endpoint: "/centers/active-centers",
        labelKey: "mc_name",
        valueKey: "mc_reference",
        placeholder: "Select center",
        className: "col-span-12 sm:col-span-6",
      },
      {
        name: "ee_department_reference",
        label: "Department",
        type: "select",
        endpoint: "/departments/active-departments",
        labelKey: "md_name",
        valueKey: "md_reference",
        placeholder: "Select department",
        className: "col-span-12 sm:col-span-6",
      },
      {
        name: "ee_job_family",
        label: "Job Family",
        type: "text",
        placeholder: "Job family",
        className: "col-span-12 sm:col-span-6",
      },
      {
        name: "ee_position_level_reference",
        label: "Position Level Reference",
        type: "text",
        placeholder: "Position level reference",
        className: "col-span-12 sm:col-span-6",
      },
      {
        name: "ee_position_reference",
        label: "Position",
        type: "select",
        endpoint: "/positions/active-positions",
        labelKey: "mp_name",
        valueKey: "mp_reference",
        placeholder: "Select position",
        className: "col-span-12 sm:col-span-6",
      },
      {
        name: "ee_employment_status",
        label: "Employment Type/Status",
        type: "text",
        placeholder: "e.g. Permanent, Contractual",
        className: "col-span-12 sm:col-span-6",
      },
      {
        name: "ee_date_hired_nykfil",
        label: "NYK-FIL Hire Date",
        type: "date",
        className: "col-span-12 sm:col-span-6",
      },
      {
        name: "ee_date_hired_tdg",
        label: "TDG Hire Date",
        type: "date",
        className: "col-span-12 sm:col-span-6",
      },
      {
        name: "ee_date_contractual_start",
        label: "Contract Start Date",
        type: "date",
        className: "col-span-12 sm:col-span-6",
      },
      {
        name: "ee_date_contractual_end",
        label: "Contract End Date",
        type: "date",
        className: "col-span-12 sm:col-span-6",
      },
    ],
  },
  {
    id: "identification",
    title: "Employee Identification",
    description: "Employee number and record status.",
    fields: [
      {
        name: "ee_id_number",
        label: "Employee ID Number",
        type: "text",
        required: true,
        placeholder: "e.g. EMP-00001",
        className: "col-span-12 sm:col-span-6",
      },
      {
        name: "ee_id_biometrics",
        label: "Biometrics Reference",
        type: "text",
        placeholder: "Biometrics reference",
        className: "col-span-12 sm:col-span-6",
      },
      {
        name: "ee_status",
        label: "Record Status",
        type: "select-basic",
        options: ["Active", "Inactive", "Archived"],
        className: "col-span-12 sm:col-span-6",
      },
    ],
  },
];

const FORM_FIELDS = SECTIONS.flatMap((section) => section.fields);
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM = {
  ee_reference: "",
  ee_profile: "",
  ee_firstname: "",
  ee_middlename: "",
  ee_lastname: "",
  ee_gender: "",
  ee_birth_date: "",
  ee_civil_status: "",
  ee_email: "",
  ee_mobile_number: "",
  ee_telephone: "",
  ee_sss: "",
  ee_tinid: "",
  ee_bloodtype: "",
  ee_ecname: "",
  ee_eccontact: "",
  ee_ecaddress: "",
  ee_company_reference: "",
  ee_center_reference: "",
  ee_department_reference: "",
  ee_job_family: "",
  ee_position_level_reference: "",
  ee_position_reference: "",
  ee_employment_status: "",
  ee_date_hired_nykfil: "",
  ee_date_hired_tdg: "",
  ee_date_contractual_start: "",
  ee_date_contractual_end: "",
  ee_id_number: "",
  ee_id_biometrics: "",
  ee_status: "Active",
};

const normalize = (value) =>
  value == null ? "" : String(value).trim();

function getInitialFormData(item = {}) {
  return {
    ...EMPTY_FORM,
    ...item,
    ee_reference: item.ee_reference ?? "",
    ee_profile: item.ee_profile ?? "",
    ee_status: item.ee_status ?? "Active",
  };
}

function validateField(field, value, formData) {
  const empty = value == null || value === "";

  if (field.required && empty) {
    return `${field.label} is required.`;
  }

  if (field.name === "ee_email" && !empty &&
      !EMAIL_REGEX.test(String(value))) {
    return "Enter a valid email address.";
  }

  if (
    field.name === "ee_date_contractual_end" &&
    value &&
    formData.ee_date_contractual_start &&
    value < formData.ee_date_contractual_start
  ) {
    return "Contract end date cannot be before the start date.";
  }

  return "";
}

function getFileUrl(value) {
  if (!value || typeof value !== "string") return "";

  const path = value.trim();
  if (!path) return "";

  if (/^(https?:\/\/|data:image\/|blob:)/i.test(path)) {
    return path;
  }

  const base = API_BASE_URL.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
  return `${base}/${path.replace(/\\/g, "/").replace(/^\/+/, "")}`;
}

export default function EmployeesForm({
  isOpen,
  onClose,
  title = "Employee",
  currentItem,
  formData,
  setFormData,
  onSubmit,
  isLoading = false,
  modalSize = "4xl",
}) {
  const [dropdowns, setDropdowns] = useState({});
  const [loadingDropdowns, setLoadingDropdowns] = useState({});
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [alert, setAlert] = useState("");
  const [profilePreview, setProfilePreview] = useState("");

  const showError = useCallback((message) => {
    setAlert(message);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    setFormData(getInitialFormData(currentItem));
    setErrors({});
    setTouched({});
    setAlert("");
    setProfilePreview("");
  }, [isOpen, currentItem, setFormData]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const endpoints = [
      ...new Set(
        FORM_FIELDS
          .filter((field) => field.type === "select" && field.endpoint)
          .map((field) => field.endpoint)
      ),
    ];

    async function loadDropdowns() {
      const token =
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token") ||
        "";

      await Promise.all(
        endpoints.map(async (endpoint) => {
          setLoadingDropdowns((prev) => ({ ...prev, [endpoint]: true }));

          try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
              headers: {
                Accept: "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            });

            if (!response.ok) {
              throw new Error(`Failed to load options from ${endpoint}.`);
            }

            const result = await response.json();
            const data = Array.isArray(result)
              ? result
              : Array.isArray(result?.data)
                ? result.data
                : [];

            if (!cancelled) {
              setDropdowns((prev) => ({ ...prev, [endpoint]: data }));
            }
          } catch (error) {
            if (!cancelled) {
              console.error(error);
              showError(error.message || "Failed to load dropdown options.");
            }
          } finally {
            if (!cancelled) {
              setLoadingDropdowns((prev) => ({
                ...prev,
                [endpoint]: false,
              }));
            }
          }
        })
      );
    }

    loadDropdowns();

    return () => {
      cancelled = true;
    };
  }, [isOpen, showError]);

  const requiredFields = useMemo(
    () => FORM_FIELDS.filter((field) => field.required),
    []
  );

  const completedCount = requiredFields.filter(
    (field) => normalize(formData?.[field.name])
  ).length;

  const handleChange = useCallback(
    (name, value) => {
      setFormData((prev) => ({ ...prev, [name]: value }));

      setTouched((prev) => ({ ...prev, [name]: true }));
    },
    [setFormData]
  );

  const handleFileChange = (file) => {
    if (!file) {
      setFormData((prev) => ({ ...prev, ee_profile: "" }));
      setProfilePreview("");
      return;
    }

    if (!IMAGE_TYPES.includes(file.type)) {
      showError("Please upload a JPG, PNG, GIF, or WEBP image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showError("The profile image must be 5 MB or smaller.");
      return;
    }

    setFormData((prev) => ({ ...prev, ee_profile: file }));

    setProfilePreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  useEffect(() => {
    return () => {
      if (profilePreview.startsWith("blob:")) {
        URL.revokeObjectURL(profilePreview);
      }
    };
  }, [profilePreview]);

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextErrors = {};

    FORM_FIELDS.forEach((field) => {
      const error = validateField(field, formData?.[field.name], formData || {});
      if (error) nextErrors[field.name] = error;
    });

    setErrors(nextErrors);
    setTouched(
      Object.fromEntries(FORM_FIELDS.map((field) => [field.name, true]))
    );

    if (Object.keys(nextErrors).length) {
      setAlert("Please fix the highlighted fields before saving.");
      return;
    }

    const payload = new FormData();

    Object.entries(formData || {}).forEach(([key, value]) => {
      if (value == null || value === "") return;

      if (key === "ee_profile" && !(value instanceof File)) {
        return;
      }

      payload.append(key, value);
    });

    onSubmit(payload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${currentItem ? "Edit" : "Add"} ${title}`}
      modalSize={modalSize}
    >
      {alert && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700"
        >
          <span>{alert}</span>
          <button type="button" onClick={() => setAlert("")} aria-label="Dismiss error">
            <i className="bi bi-x-lg" />
          </button>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between text-xs">
        <span className="text-slate-500">
          <span className="text-rose-500">*</span> Required fields
        </span>
        <span className="font-medium text-slate-600">
          {completedCount}/{requiredFields.length} required fields complete
        </span>
      </div>

      <form
        id="employee-form"
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="flex max-h-[70vh] flex-col"
      >
        <div className="flex-1 space-y-6 overflow-y-auto pr-1">
          {SECTIONS.map((section) => (
            <section key={section.id}>
              <div className="mb-3 border-b border-slate-100 pb-2">
                <h3 className="text-sm font-semibold text-slate-800">
                  {section.title}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  {section.description}
                </p>
              </div>

              <div className="grid grid-cols-12 gap-4">
                {section.fields.map((field) => {
                  const value = formData?.[field.name] ?? "";
                  const error = touched[field.name] ? errors[field.name] : "";
                  const id = `field-${field.name}`;

                  let input;

                  if (field.type === "file") {
                    const preview =
                      profilePreview ||
                      (typeof value === "string" ? getFileUrl(value) : "");

                    input = (
                      <div className="flex items-center gap-4">
                        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          {preview ? (
                            <img
                              src={preview}
                              alt="Employee profile"
                              className="size-full object-cover"
                            />
                          ) : (
                            <i className="bi bi-person text-3xl text-slate-300" />
                          )}
                        </div>

                        <div>
                          <input
                            id={id}
                            type="file"
                            accept={field.accept}
                            onChange={(e) => handleFileChange(e.target.files?.[0])}
                            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-2 file:text-xs file:font-medium hover:file:bg-slate-50"
                          />
                          <p className="mt-1 text-[11px] text-slate-400">
                            JPG, PNG, GIF or WEBP · maximum 5 MB
                          </p>
                          {value && (
                            <button
                              type="button"
                              onClick={() => handleFileChange(null)}
                              className="mt-2 text-xs font-medium text-rose-600 hover:text-rose-700"
                            >
                              Remove image
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  } else if (field.type === "select") {
                    const options = dropdowns[field.endpoint] || [];
                    const Component = SearchableSelect;

                    input = (
                      <Component
                        id={id}
                        options={options}
                        labelKey={field.labelKey}
                        valueKey={field.valueKey}
                        value={value}
                        onChange={(nextValue) => {
                          handleChange(field.name, nextValue);
                          setErrors((prev) => ({
                            ...prev,
                            [field.name]: validateField(
                              field,
                              nextValue,
                              formData || {}
                            ),
                          }));
                        }}
                        loading={Boolean(loadingDropdowns[field.endpoint])}
                        disabled={Boolean(loadingDropdowns[field.endpoint])}
                        placeholder={field.placeholder}
                        searchPlaceholder={`Search ${field.label.toLowerCase()}...`}
                        noOptionsText={`No ${field.label.toLowerCase()} options found`}
                        className="w-full"
                      />
                    );
                  } else if (field.type === "select-basic") {
                    input = (
                      <select
                        id={id}
                        name={field.name}
                        value={value}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">Select {field.label.toLowerCase()}</option>
                        {field.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    );
                  } else {
                    input = (
                      <input
                        id={id}
                        name={field.name}
                        type={field.type}
                        value={value}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                        onBlur={() => {
                          setTouched((prev) => ({
                            ...prev,
                            [field.name]: true,
                          }));
                          setErrors((prev) => ({
                            ...prev,
                            [field.name]: validateField(field, value, formData || {}),
                          }));
                        }}
                        placeholder={field.placeholder || ""}
                        required={field.required}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                    );
                  }

                  return (
                    <div key={field.name} className={field.className}>
                      <label
                        htmlFor={id}
                        className="mb-1.5 block text-xs font-medium text-slate-700"
                      >
                        {field.label}
                        {field.required && (
                          <span className="ml-1 text-rose-500">*</span>
                        )}
                      </label>

                      {input}

                      {error && (
                        <p className="mt-1 text-[11px] text-rose-600">
                          <i className="bi bi-exclamation-circle mr-1" />
                          {error}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </form>

      <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 bg-white pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <i className="bi bi-x-circle" />
          Cancel
        </button>

        <button
          type="submit"
          form="employee-form"
          disabled={isLoading}
          className="inline-flex min-w-24 items-center justify-center gap-2 rounded-xl border border-blue-300 px-4 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <i className="bi bi-arrow-repeat animate-spin" />
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
    </Modal>
  );
}
