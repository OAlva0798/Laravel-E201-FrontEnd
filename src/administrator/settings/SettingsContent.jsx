import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Swal from "sweetalert2";
import "../../assets/js/quill.css";
import LoadingState, {
  EmptyState,
} from "../../assets/function/LoadingState";
import SearchableSelect from "../../assets/function/SearchableSelect";

import {
  showLoadingPopup,
  showSuccessAlert,
  showErrorAlert,
} from "../../assets/js/swalHelpers";

import { API_BASE_URL } from "../../assets/js/appConfig";

// ==========================================================
// CONSTANTS
// ==========================================================

const FILE_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];

const VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
];

const UNSAFE_FILENAME_CHARS = /[\\/:*?"<>|$!&;`(){}\[\]'^~#%,+=@]+/g;

const SUPPORTED_TYPES = [
  "text",
  "password",
  "email",
  "number",
  "url",
  "tel",
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
  "select",
  "textarea",
  "quill",
  "checkbox",
  "switch",
  "color",
  "range",
  "image",
  "video",
];

// ==========================================================
// TABS
// ==========================================================

const TABS = [
  {
    key: "site",
    prefix: "site_",
    label: "Site Info",
    icon: "globe2",
    description:
      "Configure your website identity and contact information.",
  },
  {
    key: "login",
    prefix: "login_",
    label: "Login",
    icon: "box-arrow-in-right",
    description:
      "Configure login, CAPTCHA, registration, OTP, and account protection.",
  },
  {
    key: "maintenance",
    prefix: "maintenance_",
    label: "Maintenance",
    icon: "tools",
    description:
      "Configure system maintenance settings and maintenance schedules.",
  },
];

const TAB_MAP = Object.fromEntries(
  TABS.map((tab) => [tab.key, tab]),
);

// ==========================================================
// SELECT OPTIONS
// ==========================================================

const ON_OFF = ["On", "Off"];

const HOURLY_TIMES = Array.from({ length: 24 }, (_, hour) =>
  `${String(hour).padStart(2, "0")}:00`,
);

const SELECT_OPTIONS = {
  maintenance_timezone: [
    "Asia/Manila",
    "Asia/Tokyo",
    "Asia/Singapore",
    "Asia/Hong_Kong",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
  ],

  maintenance_date_format: [
    "F d, Y",
    "Y-m-d",
    "m/d/Y",
    "d/m/Y",
    "M d, Y",
    "d M Y",
  ],

  maintenance_time_format: [
    "h:i A",
    "H:i",
    "H:i:s",
    "h:i:s A",
  ],

  maintenance_start_time: HOURLY_TIMES,
  maintenance_end_time: HOURLY_TIMES,

  login_enable_recaptcha: ON_OFF,
  login_enable_registration: ON_OFF,
  login_enable_forgot_password: ON_OFF,
  login_enable_otp: ON_OFF,
  login_remember_me: ON_OFF,
  maintenance_mode: ON_OFF,
};

// ==========================================================
// HELPERS
// ==========================================================

const isFile = (value) =>
  typeof File !== "undefined" && value instanceof File;

const formatFieldName = (name = "") =>
  String(name)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getFileUrl = (value) => {
  if (!value || typeof value !== "string") {
    return "";
  }

  if (/^(https?:|blob:|data:)/i.test(value)) {
    return value;
  }

  return `${FILE_BASE_URL}/${value.replace(/^\/+/, "")}`;
};

const formatFileSize = (bytes = 0) => {
  if (!bytes) {
    return "0 KB";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const sanitizeFileName = (name = "") => {
  const lastDot = name.lastIndexOf(".");
  const hasExtension = lastDot > 0 && lastDot < name.length - 1;

  const base = hasExtension ? name.slice(0, lastDot) : name;
  const extension = hasExtension ? name.slice(lastDot + 1) : "";

  const cleanBase = base
    .replace(UNSAFE_FILENAME_CHARS, "_")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[_.\s]+|[_.\s]+$/g, "");

  const cleanExtension = extension
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

  const safeBase = cleanBase || "file";

  return cleanExtension
    ? `${safeBase}.${cleanExtension}`
    : safeBase;
};

const sanitizeFile = (file) => {
  if (!isFile(file)) {
    return file;
  }

  const safeName = sanitizeFileName(file.name);

  if (safeName === file.name) {
    return file;
  }

  return new File([file], safeName, {
    type: file.type,
    lastModified: file.lastModified,
  });
};

const normalizeSetting = (item = {}) => ({
  ...item,
  ss_id: item.ss_id ?? null,
  ss_field: item.ss_field ?? "",
  ss_type: String(item.ss_type ?? "text").toLowerCase(),
  ss_value: item.ss_value ?? "",
  ss_remove: Boolean(item.ss_remove),

  ss_options: Array.isArray(item.ss_options)
    ? item.ss_options
    : Array.isArray(item.options)
      ? item.options
      : null,

  ss_min: item.ss_min ?? item.min ?? 0,
  ss_max: item.ss_max ?? item.max ?? 100,
  ss_step: item.ss_step ?? item.step ?? 1,
});

// ==========================================================
// SEARCHABLE SELECT OPTIONS
// ==========================================================

const getSelectOptions = (item) => {
  const sourceOptions = Array.isArray(item?.ss_options)
    ? item.ss_options
    : Array.isArray(item?.options)
      ? item.options
      : SELECT_OPTIONS[item?.ss_field] || ON_OFF;

  return sourceOptions.map((option) => {
    // Simple string or number options.
    if (typeof option !== "object" || option === null) {
      return {
        label: String(option),
        value: String(option),
      };
    }

    // API-provided options.
    const value =
      option.value ??
      option.id ??
      option.key ??
      option.label ??
      option.name ??
      "";

    const label =
      option.label ??
      option.name ??
      option.title ??
      option.value ??
      option.id ??
      value;

    return {
      ...option,
      label: String(label),
      value: String(value),
    };
  });
};

const getTabSettings = (settings, tabKey) => {
  const prefix = TAB_MAP[tabKey]?.prefix;

  if (!prefix) {
    return [];
  }

  return settings.filter((item) =>
    String(item.ss_field).startsWith(prefix),
  );
};

const getApiError = async (response) => {
  try {
    const result = await response.json();

    console.error("System Settings API Error:", result);

    if (result?.errors) {
      return Object.values(result.errors).flat().join(" ");
    }

    return (
      result?.error ||
      result?.message ||
      `Request failed with status ${response.status}.`
    );
  } catch {
    return `Request failed with status ${response.status}.`;
  }
};

const getInputValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
};

const isEnabledValue = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  String(value).toLowerCase() === "true" ||
  String(value).toLowerCase() === "yes" ||
  String(value).toLowerCase() === "on";

// ==========================================================
// ICON
// ==========================================================

const Icon = ({ name, className = "" }) => (
  <i
    className={`bi bi-${name}${className ? ` ${className}` : ""}`}
    aria-hidden="true"
  />
);


// ==========================================================
// SETTINGS TABS
// ==========================================================

const SettingsTabs = ({ activeTab, onChange, settings }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="overflow-x-auto">
      <div className="flex min-w-max border-b border-slate-200">
        {TABS.map((tab) => {
          const count = getTabSettings(settings, tab.key).length;
          const active = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`relative inline-flex min-w-[130px] items-center justify-center gap-2 px-5 py-4 text-xs font-semibold transition ${
                active
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <Icon name={tab.icon} className="text-sm" />

              <span>{tab.label}</span>

              <span
                className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                  active
                    ? "bg-blue-100 text-blue-600"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {count}
              </span>

              {active && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

// ==========================================================
// SECTION
// ==========================================================

const Section = ({
  icon,
  title,
  description,
  count,
  children,
}) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon name={icon} className="text-base" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-800">
              {title}
            </h2>

            {count > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                {count}
              </span>
            )}
          </div>

          {description && (
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>

    {children}
  </section>
);

// ==========================================================
// FIELD STYLES
// ==========================================================

const FIELD_CLASS =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/10";

// ==========================================================
// SETTING HEADER
// ==========================================================

const SettingHeader = ({ item }) => (
  <div className="mb-2.5 flex items-start justify-between gap-3">
    <div className="min-w-0">
      <label
        htmlFor={`setting-${item.ss_id}`}
        className="block truncate text-xs font-bold text-slate-700"
      >
        {formatFieldName(item.ss_field)}
      </label>
    </div>

    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[8px] font-semibold uppercase tracking-wide text-slate-400">
      {item.ss_type}
    </span>
  </div>
);

// ==========================================================
// STANDARD INPUT
// ==========================================================

const StandardInput = ({ item, onChange }) => {
  const { ss_id, ss_type, ss_value } = item;
  const label = formatFieldName(item.ss_field);

  return (
    <div className="relative">
      <input
        id={`setting-${ss_id}`}
        type={ss_type}
        value={getInputValue(ss_value)}
        onChange={(event) => onChange(ss_id, event.target.value)}
        placeholder={`Enter ${label.toLowerCase()}...`}
        autoComplete={ss_type === "password" ? "new-password" : "off"}
        className={FIELD_CLASS}
      />

      {ss_type === "password" && (
        <Icon
          name="key"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-300"
        />
      )}
    </div>
  );
};

// ==========================================================
// SEARCHABLE SELECT
// ==========================================================

const SelectInput = ({ item, onChange }) => {
  const options = useMemo(() => getSelectOptions(item), [
    item.ss_options,
    item.options,
    item.ss_field,
  ]);

  return (
    <SearchableSelect
      id={`setting-${item.ss_id}`}
      name={item.ss_field}
      options={options}
      value={getInputValue(item.ss_value)}
      onChange={(value) => onChange(item.ss_id, value)}
      placeholder={`Select ${formatFieldName(
        item.ss_field,
      ).toLowerCase()}...`}
      searchPlaceholder="Search options..."
      noOptionsText="No options found"
      loading={false}
      disabled={false}
      clearable
      labelKey="label"
      valueKey="value"
      className="w-full text-xs"
    />
  );
};

// ==========================================================
// TEXTAREA
// ==========================================================

const TextareaInput = ({ item, onChange }) => (
  <textarea
    id={`setting-${item.ss_id}`}
    value={getInputValue(item.ss_value)}
    onChange={(event) => onChange(item.ss_id, event.target.value)}
    rows={5}
    placeholder={`Enter ${formatFieldName(
      item.ss_field,
    ).toLowerCase()}...`}
    className={`${FIELD_CLASS} resize-y`}
  />
);

// ==========================================================
// QUILL HTML NORMALIZATION
// ==========================================================

function normalizeQuillHtml(value) {
  if (!value) {
    return "";
  }

  const html = String(value).trim();

  if (
    html === "<p><br></p>" ||
    html === "<div><br></div>" ||
    html === "<p></p>"
  ) {
    return "";
  }

  return html;
}

// ==========================================================
// QUILL TOOLBAR ACCESSIBILITY
// ==========================================================

function setupQuillToolbarLabels(container) {
  if (!container) {
    return;
  }

  const labels = {
    ".ql-bold": "Bold",
    ".ql-italic": "Italic",
    ".ql-underline": "Underline",
    ".ql-strike": "Strikethrough",
    ".ql-color": "Text color",
    ".ql-background": "Highlight color",
    ".ql-header": "Heading",
    ".ql-size": "Text size",
    ".ql-list[value='ordered']": "Numbered list",
    ".ql-list[value='bullet']": "Bullet list",
    ".ql-indent[value='-1']": "Decrease indent",
    ".ql-indent[value='+1']": "Increase indent",
    ".ql-align": "Text alignment",
    ".ql-blockquote": "Block quote",
    ".ql-code-block": "Code block",
    ".ql-link": "Insert link",
    ".ql-clean": "Remove formatting",
  };

  Object.entries(labels).forEach(([selector, label]) => {
    container.querySelectorAll(selector).forEach((element) => {
      element.setAttribute("aria-label", label);
      element.setAttribute("title", label);
    });
  });
}

// ==========================================================
// QUILL RICH TEXT EDITOR
// ==========================================================

const QuillInput = ({ item, onChange }) => {
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const itemRef = useRef(item);
  const lastHtmlRef = useRef("");

  useEffect(() => {
    onChangeRef.current = onChange;
    itemRef.current = item;
  }, [onChange, item]);

  useEffect(() => {
    if (!editorRef.current || quillRef.current) {
      return undefined;
    }

    let cancelled = false;
    let quillInstance = null;
    let handleTextChange = null;
    let handleFocus = null;
    let handleBlur = null;

    const initializeQuill = async () => {
      try {
        const { default: Quill } = await import("quill");

        if (cancelled || !editorRef.current || quillRef.current) {
          return;
        }

        quillInstance = new Quill(editorRef.current, {
          theme: "snow",

          placeholder: `Enter ${formatFieldName(
            itemRef.current.ss_field,
          ).toLowerCase()}...`,

          modules: {
            toolbar: {
              container: [
                ["bold", "italic", "underline", "strike"],
                [{ color: [] }, { background: [] }],
                [{ header: [1, 2, 3, 4, 5, 6, false] }],
                [{ size: ["small", false, "large", "huge"] }],
                [{ list: "ordered" }, { list: "bullet" }],
                [{ indent: "-1" }, { indent: "+1" }],
                [{ align: [] }],
                ["blockquote", "code-block"],
                ["link"],
                ["clean"],
              ],
            },

            history: {
              delay: 1000,
              maxStack: 100,
              userOnly: true,
            },

            clipboard: {
              matchVisual: false,
            },
          },
        });

        quillRef.current = quillInstance;

        const initialValue = getInputValue(
          itemRef.current.ss_value,
        );

        if (initialValue) {
          quillInstance.clipboard.dangerouslyPasteHTML(
            initialValue,
            "silent",
          );
        }

        lastHtmlRef.current = normalizeQuillHtml(
          quillInstance.root.innerHTML,
        );

        handleTextChange = (delta, oldDelta, source) => {
          if (source !== "user") {
            return;
          }

          const html = normalizeQuillHtml(
            quillInstance.root.innerHTML,
          );

          if (html === lastHtmlRef.current) {
            return;
          }

          lastHtmlRef.current = html;

          onChangeRef.current?.(
            itemRef.current.ss_id,
            html,
          );
        };

        quillInstance.on("text-change", handleTextChange);

        setupQuillToolbarLabels(editorRef.current);

        handleFocus = () => {
          editorRef.current?.classList.add("is-focused");
        };

        handleBlur = () => {
          editorRef.current?.classList.remove("is-focused");
        };

        quillInstance.root.addEventListener(
          "focus",
          handleFocus,
        );

        quillInstance.root.addEventListener(
          "blur",
          handleBlur,
        );
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to initialize Quill:", error);
          showErrorAlert("Unable to initialize the rich text editor.");
        }
      }
    };

    initializeQuill();

    return () => {
      cancelled = true;

      if (quillInstance) {
        if (handleTextChange) {
          quillInstance.off("text-change", handleTextChange);
        }

        if (handleFocus) {
          quillInstance.root.removeEventListener(
            "focus",
            handleFocus,
          );
        }

        if (handleBlur) {
          quillInstance.root.removeEventListener(
            "blur",
            handleBlur,
          );
        }

        quillInstance.disable();

        if (quillRef.current === quillInstance) {
          quillRef.current = null;
        }
      }
    };
  }, []);

  useEffect(() => {
    const quill = quillRef.current;

    if (!quill) {
      return;
    }

    const externalValue = normalizeQuillHtml(
      getInputValue(item.ss_value),
    );

    const currentHtml = normalizeQuillHtml(
      quill.root.innerHTML,
    );

    if (
      externalValue === currentHtml ||
      externalValue === lastHtmlRef.current
    ) {
      return;
    }

    const selection = quill.getSelection();

    quill.clipboard.dangerouslyPasteHTML(
      externalValue || "",
      "silent",
    );

    lastHtmlRef.current = normalizeQuillHtml(
      quill.root.innerHTML,
    );

    if (selection) {
      const maxIndex = Math.max(0, quill.getLength() - 1);

      quill.setSelection(
        Math.min(selection.index, maxIndex),
        selection.length,
        "silent",
      );
    }
  }, [item.ss_value]);

  return (
    <div className="quill-wrapper overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
      <div
        ref={editorRef}
        className="quill-editor min-h-[260px] text-sm text-slate-700"
      />
    </div>
  );
};

// ==========================================================
// CHECKBOX
// ==========================================================

const CheckboxInput = ({ item, onChange }) => {
  const checked = isEnabledValue(item.ss_value);

  return (
    <label
      htmlFor={`setting-${item.ss_id}`}
      className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
    >
      <input
        id={`setting-${item.ss_id}`}
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(item.ss_id, event.target.checked)
        }
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />

      <span className="text-xs font-medium text-slate-700">
        Enable {formatFieldName(item.ss_field)}
      </span>
    </label>
  );
};

// ==========================================================
// SWITCH
// ==========================================================

const SwitchInput = ({ item, onChange }) => {
  const enabled = isEnabledValue(item.ss_value);

  return (
    <label
      htmlFor={`setting-${item.ss_id}`}
      className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-700">
          {enabled ? "Enabled" : "Disabled"}
        </p>
      </div>

      <span className="relative shrink-0">
        <input
          id={`setting-${item.ss_id}`}
          type="checkbox"
          checked={enabled}
          onChange={(event) =>
            onChange(item.ss_id, event.target.checked)
          }
          className="peer sr-only"
        />

        <span
          className={`block h-4 w-9 rounded-full transition ${
            enabled ? "bg-emerald-600" : "bg-rose-300"
          }`}
        />

        <span
          className={`pointer-events-none absolute left-1 top-1 h-2 w-2 rounded-full bg-white shadow-sm transition ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </label>
  );
};

// ==========================================================
// COLOR
// ==========================================================

const ColorInput = ({ item, onChange }) => (
  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
    <input
      id={`setting-${item.ss_id}`}
      type="color"
      value={
        /^#[0-9a-fA-F]{6}$/.test(
          getInputValue(item.ss_value),
        )
          ? item.ss_value
          : "#000000"
      }
      onChange={(event) =>
        onChange(item.ss_id, event.target.value)
      }
      className="h-10 w-14 cursor-pointer rounded border-0 bg-transparent p-0"
    />

    <input
      type="text"
      value={getInputValue(item.ss_value)}
      onChange={(event) =>
        onChange(item.ss_id, event.target.value)
      }
      placeholder="#000000"
      className={`${FIELD_CLASS} font-mono`}
    />
  </div>
);

// ==========================================================
// RANGE
// ==========================================================

const RangeInput = ({ item, onChange }) => {
  const value =
    item.ss_value === "" ? item.ss_min : item.ss_value;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] text-slate-400">
          {item.ss_min}
        </span>

        <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600">
          {value}
        </span>

        <span className="text-[10px] text-slate-400">
          {item.ss_max}
        </span>
      </div>

      <input
        id={`setting-${item.ss_id}`}
        type="range"
        min={item.ss_min}
        max={item.ss_max}
        step={item.ss_step}
        value={value}
        onChange={(event) =>
          onChange(item.ss_id, event.target.value)
        }
        className="w-full cursor-pointer"
      />
    </div>
  );
};

// ==========================================================
// TEXT SETTING
// ==========================================================

const TextSetting = ({ item, onChange }) => {
  const type = SUPPORTED_TYPES.includes(item.ss_type)
    ? item.ss_type
    : "text";

  const renderInput = () => {
    switch (type) {
      case "select":
        return (
          <SelectInput
            item={item}
            onChange={onChange}
          />
        );

      case "textarea":
        return (
          <TextareaInput
            item={item}
            onChange={onChange}
          />
        );

      case "quill":
        return (
          <QuillInput
            item={item}
            onChange={onChange}
          />
        );

      case "checkbox":
        return (
          <CheckboxInput
            item={item}
            onChange={onChange}
          />
        );

      case "switch":
        return (
          <SwitchInput
            item={item}
            onChange={onChange}
          />
        );

      case "color":
        return (
          <ColorInput
            item={item}
            onChange={onChange}
          />
        );

      case "range":
        return (
          <RangeInput
            item={item}
            onChange={onChange}
          />
        );

      default:
        return (
          <StandardInput
            item={{
              ...item,
              ss_type: type,
            }}
            onChange={onChange}
          />
        );
    }
  };

  return (
    <div
      className={`rounded-xl px-2 pb-4 transition hover:border-slate-300 ${
        type === "quill"
          ? "md:col-span-2 xl:col-span-3"
          : ""
      }`}
    >
      <SettingHeader item={item} />
      {renderInput()}
    </div>
  );
};

// ==========================================================
// MEDIA PREVIEW
// ==========================================================

const MediaPreview = ({ value, type }) => {
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!value) {
      setPreview("");
      return undefined;
    }

    if (isFile(value)) {
      const url = URL.createObjectURL(value);

      setPreview(url);

      return () => URL.revokeObjectURL(url);
    }

    setPreview(getFileUrl(value));

    return undefined;
  }, [value]);

  if (!preview) {
    return (
      <div className="flex h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-300 shadow-sm">
          <Icon
            name={type === "video" ? "camera-video" : "image"}
            className="text-xl"
          />
        </div>

        <span className="mt-3 text-xs font-medium text-slate-400">
          No {type} uploaded
        </span>

        <span className="mt-1 text-[10px] text-slate-300">
          Click Browse or drop a file here
        </span>
      </div>
    );
  }

  if (type === "video") {
    return (
      <video
        className="h-52 w-full rounded-xl border border-slate-200 bg-slate-950 object-contain"
        src={preview}
        controls
        preload="metadata"
      />
    );
  }

  return (
    <div className="flex h-52 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <img
        src={preview}
        alt="System setting preview"
        className="h-full w-full rounded-xl object-contain p-1.5"
      />
    </div>
  );
};

// ==========================================================
// DROP ZONE
// ==========================================================

const DropZone = ({ item, onFileChange, onClear }) => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const {
    ss_field,
    ss_type,
    ss_value,
    ss_remove,
  } = item;

  const isImage = ss_type === "image";
  const hasFile = isFile(ss_value);
  const hasExistingFile = Boolean(
    !hasFile && getFileUrl(ss_value),
  );

  const label = formatFieldName(ss_field);
  const acceptedTypes = isImage ? IMAGE_TYPES : VIDEO_TYPES;

  const handleBrowse = () => {
    inputRef.current?.click();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      onFileChange(item, file);
    }
  };

  const handleClear = (event) => {
    event?.preventDefault();
    event?.stopPropagation();

    onClear(item);
  };

  const handleInputChange = (event) => {
    const file = event.target.files?.[0];

    if (file) {
      onFileChange(item, file);
    }

    event.target.value = "";
  };

  const hasContent =
    !ss_remove && (hasFile || hasExistingFile);

  return (
    <div className="group relative flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-md">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-xs font-bold tracking-tight text-slate-800">
            {label}
          </h3>

          <p className="mt-0.5 text-[10px] font-medium text-slate-400">
            {isImage
              ? "PNG, JPG, GIF, WEBP • Max 10MB"
              : "MP4, WEBM, OGG, MOV • Max 50MB"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {hasFile && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              New file
            </span>
          )}

          {ss_remove && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-100 bg-rose-50 px-2.5 py-0.5 text-[10px] font-semibold text-rose-600">
              <Icon name="trash3" className="text-[10px]" />
              Will be removed
            </span>
          )}
        </div>
      </div>

      <div
        onClick={handleBrowse}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            handleBrowse();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();

          if (
            event.currentTarget.contains(event.relatedTarget)
          ) {
            return;
          }

          setIsDragging(false);
        }}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label={
          hasContent
            ? `Replace ${label}`
            : `Upload ${label}`
        }
        className={`relative min-h-[180px] w-full cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
          isDragging
            ? "scale-[1.01] border-indigo-500 bg-indigo-50/60 ring-4 ring-indigo-500/10"
            : ss_remove
              ? "border-rose-200 bg-rose-50/40 hover:border-rose-300"
              : hasContent
                ? "border-slate-200/60 bg-slate-900/5 hover:border-indigo-300"
                : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-slate-100/80"
        }`}
      >
        <MediaPreview
          value={ss_remove ? "" : ss_value}
          type={ss_type}
        />

        {hasContent && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-900/40 p-3 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 hover:opacity-100">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
              <Icon
                name="arrow-repeat"
                className="text-xs text-indigo-600"
              />
              Replace File
            </span>
          </div>
        )}

        {(hasContent || ss_remove) && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={`Remove ${label || "file"}`}
            title="Remove file"
            className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-rose-600 bg-white/90 text-rose-600 shadow-sm backdrop-blur-md transition-all duration-200 hover:scale-110 hover:bg-rose-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 active:scale-95"
          >
            <Icon name="trash3" className="text-sm" />
          </button>
        )}

        {ss_remove && !isDragging && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-50/90 p-4 text-center backdrop-blur-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-100 bg-white text-rose-500 shadow-sm">
              <Icon name="trash3" className="text-lg" />
            </div>

            <p className="mt-2.5 text-xs font-bold text-rose-700">
              Marked for removal
            </p>

            <p className="mt-1 text-[10px] font-medium text-rose-500">
              Click to choose a new file
            </p>
          </div>
        )}

        {isDragging && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-xl bg-indigo-600/95 text-white backdrop-blur-md">
            <div className="flex h-12 w-12 animate-bounce items-center justify-center rounded-2xl bg-white/20">
              <Icon
                name="cloud-arrow-up"
                className="text-2xl text-white"
              />
            </div>

            <p className="mt-2.5 text-xs font-bold tracking-wide">
              Drop file here
            </p>

            <p className="mt-0.5 text-[10px] font-medium text-indigo-100">
              {hasContent
                ? "Release to replace"
                : "Release to upload"}
            </p>
          </div>
        )}
      </div>

      {hasFile && !ss_remove && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
            <Icon
              name="file-earmark-check"
              className="text-sm"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-bold text-slate-700">
              {ss_value.name}
            </p>

            <p className="text-[9px] font-medium text-slate-400">
              {formatFileSize(ss_value.size)}
            </p>
          </div>

          <span className="shrink-0 rounded-md bg-emerald-100/80 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-emerald-700">
            Ready
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        hidden
        accept={acceptedTypes.join(",")}
        onChange={handleInputChange}
      />
    </div>
  );
};

// ==========================================================
// SAVE FOOTER
// ==========================================================

const SaveFooter = ({
  count,
  isSaving,
  isLoading,
  isFetching,
  isDirty,
  onDiscard,
}) => {
  const disabled = isSaving || isLoading || isFetching;

  return (
    <div className="sticky bottom-4 z-20 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isDirty
                ? "bg-amber-50 text-amber-600"
                : "bg-blue-50 text-blue-600"
            }`}
          >
            <Icon
              name={
                isDirty
                  ? "exclamation-circle"
                  : "check-circle"
              }
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-700">
              {isDirty
                ? "You have unsaved changes"
                : "All changes are saved"}
            </p>

            <p className="mt-0.5 text-[10px] text-slate-400">
              {isDirty
                ? `Review your changes before saving. ${count} ${
                    count === 1 ? "setting" : "settings"
                  } in this section.`
                : `${count} ${
                    count === 1 ? "setting" : "settings"
                  } in this section.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              type="button"
              onClick={onDiscard}
              disabled={disabled}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-500 bg-white px-4 py-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="arrow-counterclockwise" />
              Discard
            </button>
          )}

          <button
            type="submit"
            disabled={disabled || !isDirty}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500 px-4 py-2.5 text-xs font-semibold text-blue-500 transition hover:bg-blue-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Icon
                  name="arrow-repeat"
                  className="animate-spin"
                />
                Saving...
              </>
            ) : (
              <>
                <Icon name="check2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================================
// MAIN COMPONENT
// ==========================================================

export default function SettingsContent({
  currentItem = null,
  onSubmit = null,
  isLoading = false,
}) {
  const [settings, setSettings] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState("site");

  // ========================================================
  // LOAD SETTINGS
  // ========================================================

  const loadSettings = useCallback(async () => {
    try {
      setIsFetching(true);

      let data;

      if (Array.isArray(currentItem)) {
        data = currentItem;
      } else if (Array.isArray(currentItem?.data)) {
        data = currentItem.data;
      } else if (
        currentItem?.ss_id ||
        currentItem?.ss_field
      ) {
        data = [currentItem];
      } else {
        const token =
          localStorage.getItem("access_token") ||
          sessionStorage.getItem("access_token") ||
          "";

        const response = await fetch(
          `${API_BASE_URL}/system-settings`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              ...(token
                ? {
                    Authorization: `Bearer ${token}`,
                  }
                : {}),
            },
          },
        );

        if (!response.ok) {
          throw new Error(await getApiError(response));
        }

        const result = await response.json();

        data =
          result?.data ??
          result?.settings ??
          result?.system_settings ??
          result;
      }

      const normalized = Array.isArray(data)
        ? data.map(normalizeSetting)
        : [];

      setSettings(normalized);
      setIsDirty(false);

      const firstAvailableTab = TABS.find((tab) =>
        normalized.some((item) =>
          String(item.ss_field).startsWith(tab.prefix),
        ),
      );

      if (firstAvailableTab) {
        setActiveTab(firstAvailableTab.key);
      }
    } catch (error) {
      console.error("System settings load error:", error);

      showErrorAlert(
        error?.message || "Unable to load system settings.",
      );
    } finally {
      setIsFetching(false);
    }
  }, [currentItem]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ========================================================
  // ACTIVE TAB
  // ========================================================

  const activeTabConfig = TAB_MAP[activeTab] || TABS[0];

  const activeTabSettings = useMemo(
    () => getTabSettings(settings, activeTabConfig.key),
    [settings, activeTabConfig.key],
  );

  const imageSettings = useMemo(
    () =>
      activeTabSettings.filter(
        (item) => item.ss_type === "image",
      ),
    [activeTabSettings],
  );

  const videoSettings = useMemo(
    () =>
      activeTabSettings.filter(
        (item) => item.ss_type === "video",
      ),
    [activeTabSettings],
  );

  const normalSettings = useMemo(
    () =>
      activeTabSettings.filter(
        (item) =>
          !["image", "video"].includes(item.ss_type),
      ),
    [activeTabSettings],
  );

  // ========================================================
  // UPDATE VALUE
  // ========================================================

  const updateValue = useCallback((id, value) => {
    setSettings((previous) =>
      previous.map((item) =>
        item.ss_id === id
          ? {
              ...item,
              ss_value: value,
              ss_remove: false,
            }
          : item,
      ),
    );

    setIsDirty(true);
  }, []);

  // ========================================================
  // FILE CHANGE
  // ========================================================

  const handleFileChange = useCallback((item, file) => {
    if (!file) {
      return;
    }

    const label = formatFieldName(item.ss_field);
    const isImage = item.ss_type === "image";

    const allowedTypes = isImage
      ? IMAGE_TYPES
      : VIDEO_TYPES;

    const maxSize = isImage
      ? MAX_IMAGE_SIZE
      : MAX_VIDEO_SIZE;

    const fileDescription = isImage
      ? "PNG, JPG, GIF, or WEBP image"
      : "MP4, WEBM, OGG, or MOV video";

    const maxSizeLabel = isImage ? "10MB" : "50MB";

    if (!allowedTypes.includes(file.type)) {
      showErrorAlert(
        `${label}: Please upload a ${fileDescription}.`,
      );
      return;
    }

    if (file.size > maxSize) {
      showErrorAlert(
        `${label}: That file is too large. The limit is ${maxSizeLabel}.`,
      );
      return;
    }

    const safeFile = sanitizeFile(file);

    setSettings((previous) =>
      previous.map((record) =>
        record.ss_id === item.ss_id
          ? {
              ...record,
              ss_value: safeFile,
              ss_remove: false,
            }
          : record,
      ),
    );

    setIsDirty(true);
  }, []);

  // ========================================================
  // CLEAR FILE
  // ========================================================

  const clearValue = useCallback((item) => {
    const label = formatFieldName(
      item.ss_field,
    ).toLowerCase();

    Swal.fire({
      icon: "warning",
      title: "Remove this file?",
      text: isFile(item.ss_value)
        ? `This will discard the ${label} you just selected.`
        : `This will remove the current ${label} once you save your changes.`,
      showCancelButton: true,
      confirmButtonText: "Yes, remove it",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#be123c",
      reverseButtons: true,
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      setSettings((previous) =>
        previous.map((record) => {
          if (record.ss_id !== item.ss_id) {
            return record;
          }

          if (isFile(record.ss_value)) {
            return {
              ...record,
              ss_value: "",
              ss_remove: false,
            };
          }

          if (
            record.ss_type === "image" ||
            record.ss_type === "video"
          ) {
            return {
              ...record,
              ss_value: "",
              ss_remove: true,
            };
          }

          return {
            ...record,
            ss_value: "",
            ss_remove: false,
          };
        }),
      );

      setIsDirty(true);
    });
  }, []);

  // ========================================================
  // DISCARD CHANGES
  // ========================================================

  const discardChanges = useCallback(() => {
    Swal.fire({
      icon: "warning",
      title: "Discard unsaved changes?",
      text: "Everything you've changed since your last save will be lost.",
      showCancelButton: true,
      confirmButtonText: "Yes, discard",
      cancelButtonText: "Keep editing",
      confirmButtonColor: "#be123c",
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        loadSettings();
      }
    });
  }, [loadSettings]);

  // ========================================================
  // BUILD FORM DATA
  // ========================================================

  const buildFormData = useCallback((records) => {
    const formData = new FormData();

    records.forEach((item, index) => {
      formData.append(
        `ss_id[${index}]`,
        item.ss_id ?? "",
      );

      formData.append(
        `ss_field[${index}]`,
        item.ss_field ?? "",
      );

      formData.append(
        `ss_type[${index}]`,
        item.ss_type ?? "text",
      );

      formData.append(
        `ss_remove[${index}]`,
        item.ss_remove ? "1" : "0",
      );

      if (isFile(item.ss_value)) {
        const safeFile = sanitizeFile(item.ss_value);

        formData.append(
          `ss_value[${index}]`,
          safeFile,
          safeFile.name,
        );

        return;
      }

      let value = item.ss_value ?? "";

      if (
        item.ss_type === "checkbox" ||
        item.ss_type === "switch"
      ) {
        value = isEnabledValue(value) ? "1" : "0";
      }

      formData.append(
        `ss_value[${index}]`,
        item.ss_remove ? "" : String(value),
      );
    });

    return formData;
  }, []);

  // ========================================================
  // SAVE SETTINGS
  // ========================================================

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault();

      if (!settings.length || isSaving || !isDirty) {
        return;
      }

      setIsSaving(true);
      showLoadingPopup("Saving system settings...");

      try {
        const token =
          localStorage.getItem("access_token") ||
          sessionStorage.getItem("access_token") ||
          "";

        const response = await fetch(
          `${API_BASE_URL}/system-settings`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              ...(token
                ? {
                    Authorization: `Bearer ${token}`,
                  }
                : {}),
            },
            body: buildFormData(settings),
          },
        );

        if (!response.ok) {
          throw new Error(await getApiError(response));
        }

        const result = await response.json();

        if (result?.success === false) {
          throw new Error(
            result?.error ||
              result?.message ||
              "Failed to save system settings.",
          );
        }

        if (Array.isArray(result?.data)) {
          setSettings(result.data.map(normalizeSetting));
        } else {
          await loadSettings();
        }

        setIsDirty(false);

        if (typeof onSubmit === "function") {
          onSubmit(result);
        }

        Swal.close();

        await showSuccessAlert(
          "System settings saved successfully.",
        );

        window.location.reload();
      } catch (error) {
        console.error("System settings save error:", error);

        Swal.close();

        showErrorAlert(
          error?.message ||
            "Unable to save system settings. Please try again.",
        );
      } finally {
        setIsSaving(false);
      }
    },
    [
      settings,
      isSaving,
      isDirty,
      buildFormData,
      loadSettings,
      onSubmit,
    ],
  );

  // ========================================================
  // LOADING
  // ========================================================

  if (isFetching && !settings.length) {
    return <LoadingState />;
  }

  // ========================================================
  // EMPTY
  // ========================================================

  if (!isFetching && !settings.length) {
    return <EmptyState onReload={loadSettings} />;
  }

  // ========================================================
  // RENDER
  // ========================================================

  return (
    <form
      id="system-settings-form"
      onSubmit={handleSubmit}
      className="min-h-full space-y-5"
    >
      {/* TABS */}

      <SettingsTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        settings={settings}
      />

      {/* IMAGES */}

      {imageSettings.length > 0 && (
        <Section
          icon="images"
          title="Images"
          description="Manage images used by this section."
          count={imageSettings.length}
        >
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {imageSettings.map((item) => (
              <DropZone
                key={item.ss_id ?? item.ss_field}
                item={item}
                onFileChange={handleFileChange}
                onClear={clearValue}
              />
            ))}
          </div>
        </Section>
      )}

      {/* VIDEOS */}

      {videoSettings.length > 0 && (
        <Section
          icon="camera-video"
          title="Videos"
          description="Manage videos used by this section."
          count={videoSettings.length}
        >
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {videoSettings.map((item) => (
              <DropZone
                key={item.ss_id ?? item.ss_field}
                item={item}
                onFileChange={handleFileChange}
                onClear={clearValue}
              />
            ))}
          </div>
        </Section>
      )}

      {/* CONFIGURATION */}

      {normalSettings.length > 0 && (
        <Section
          icon="sliders"
          title="Configuration"
          description="Configure the available options for this section."
          count={normalSettings.length}
        >
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {normalSettings.map((item) => (
              <TextSetting
                key={item.ss_id ?? item.ss_field}
                item={item}
                onChange={updateValue}
              />
            ))}
          </div>
        </Section>
      )}

      {/* SAVE */}

      <SaveFooter
        count={activeTabSettings.length}
        isSaving={isSaving}
        isLoading={isLoading}
        isFetching={isFetching}
        isDirty={isDirty}
        onDiscard={discardChanges}
      />
    </form>
  );
}