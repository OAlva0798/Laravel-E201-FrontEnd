import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import Swal from "sweetalert2";
import {
  showErrorAlert,
  showSuccessAlert,
  showLoadingPopup,
  showDeleteConfirmDialog,
} from "../../assets/js/swalHelpers";
import { apiRequest, getErrorMessage } from "./employeeShared";

const ITEMS_PER_PAGE = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_FOLDER_PATH = "employees";
const ACCEPTED_TYPES = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];
const ACCEPT_ATTR = ACCEPTED_TYPES.map((t) => `.${t}`).join(",");

const E201_SECTIONS = [
  ["biodata", "Bio-Data", "bi-person-vcard"],
  ["appointment", "Appointment Paper", "bi-file-earmark-post"],
  ["qualifications", "Qualifications", "bi-award"],
  ["educational", "Educational Qualifications", "bi-mortarboard"],
  ["training", "Training & Seminars", "bi-journal-check"],
  ["evaluations", "Evaluations", "bi-clipboard-check"],
  ["seagoing", "Seagoing Experience", "bi-water"],
  ["teaching", "Teaching Experience", "bi-easel"],
  ["miscellaneous", "Miscellaneous", "bi-folder"],
].map(([id, title, icon]) => ({ id, title, type: title, icon }));

/* ---------- file helpers ---------- */
const getExt = (filename = "") => filename.split(".").pop()?.toLowerCase() || "";
const isImage = (n) => ["jpg", "jpeg", "png"].includes(getExt(n));
const isPdf = (n) => getExt(n) === "pdf";
const isWordDoc = (n) => ["doc", "docx"].includes(getExt(n));

const FILE_META = {
  pdf: { icon: "bi-file-earmark-pdf", tone: "text-rose-500 bg-rose-50" },
  doc: { icon: "bi-file-earmark-word", tone: "text-blue-500 bg-blue-50" },
  docx: { icon: "bi-file-earmark-word", tone: "text-blue-500 bg-blue-50" },
  jpg: { icon: "bi-file-earmark-image", tone: "text-emerald-500 bg-emerald-50" },
  jpeg: { icon: "bi-file-earmark-image", tone: "text-emerald-500 bg-emerald-50" },
  png: { icon: "bi-file-earmark-image", tone: "text-emerald-500 bg-emerald-50" },
};
const DEFAULT_META = { icon: "bi-file-earmark-text", tone: "text-slate-500 bg-slate-50" };

/** "emp123.resume.pdf" -> "resume.pdf" (hides the stored prefix). */
const formatFileName = (filename = "") => {
  const parts = filename.split(".");
  return parts.length > 2 ? parts.slice(1).join(".") : filename;
};

const rawName = (file) => file?.eed_file || file?.name || "";

const validateFile = (file) => {
  if (!ACCEPTED_TYPES.includes(getExt(file.name))) return false;
  return file.size <= MAX_FILE_SIZE;
};

/* ---------- card ---------- */
const E201Card = memo(function E201Card({
  section, searchQuery, loading,
  onUploadFiles, onDeleteFile, onViewFile, onEditFile, onDownloadFile,
}) {
  const fileInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const editingFileRef = useRef(null); // ref: no re-render needed
  const [currentPage, setCurrentPage] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return section.files;
    return section.files.filter((file) => (rawName(file) || "").toLowerCase().includes(q));
  }, [section.files, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / ITEMS_PER_PAGE));

  const visibleFiles = useMemo(
    () => filteredFiles.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredFiles, currentPage],
  );

  // Search changes -> back to page 1; file count shrinks -> clamp page
  useEffect(() => setCurrentPage(1), [searchQuery]);
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const validateAndUpload = (list) => {
    const files = Array.from(list || []);
    if (!files.length) return;

    const invalid = files.find((f) => !validateFile(f));
    if (invalid) {
      showErrorAlert(`${invalid.name}: Please choose a PDF, DOC, DOCX, JPG, JPEG, or PNG file under 10 MB.`);
      return;
    }
    onUploadFiles(section.type, files);
  };

  const handleReplace = (event) => {
    const file = event.target.files?.[0];
    const target = editingFileRef.current;
    event.target.value = "";
    if (!file || !target) return;

    if (!validateFile(file)) {
      showErrorAlert("Choose a supported file under 10 MB.");
      return;
    }
    editingFileRef.current = null;
    onEditFile(target, section.type, file);
  };

  const actionBtn = "rounded-lg p-1.5 text-slate-400 transition";

  return (
    <div
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!loading) validateAndUpload(e.dataTransfer.files);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-200 ${
        isDragging
          ? "border-blue-500 bg-blue-50/20 ring-4 ring-blue-100"
          : "border-slate-200/90 bg-white shadow-xs hover:border-slate-300 hover:shadow-md"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        onChange={(e) => {
          validateAndUpload(e.target.files);
          e.target.value = "";
        }}
        className="hidden"
      />
      <input ref={replaceInputRef} type="file" accept={ACCEPT_ATTR} onChange={handleReplace} className="hidden" />

      <div>
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-blue-600 shadow-2xs">
              <i className={`bi ${section.icon} text-sm`} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xs font-semibold text-slate-800">{section.title}</h3>
              <p className="text-[10px] font-medium text-slate-400">
                {section.files.length} document{section.files.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-2xs transition hover:bg-blue-700 active:scale-95 disabled:opacity-50"
          >
            <i className="bi bi-cloud-upload text-xs" />
            Upload
          </button>
        </div>

        <div className="min-h-[220px] space-y-1.5 p-3">
          {filteredFiles.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group/drop flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center transition hover:border-blue-400 hover:bg-slate-50/50"
            >
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition group-hover/drop:bg-blue-50 group-hover/drop:text-blue-600">
                <i className="bi bi-cloud-arrow-up text-lg" />
              </div>
              <p className="text-xs font-medium text-slate-600 group-hover/drop:text-blue-600">
                {searchQuery ? "No matching files" : "Click or drag files here"}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">PDF, DOCX, JPG, or PNG up to 10MB</p>
            </div>
          ) : (
            visibleFiles.map((file) => {
              const fileName = formatFileName(rawName(file) || "Document");
              const { icon, tone } = FILE_META[getExt(fileName)] || DEFAULT_META;

              return (
                <div
                  key={file.eed_id || file.id}
                  className="group/item flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/40 p-2 transition hover:border-slate-200 hover:bg-white hover:shadow-2xs"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/50 ${tone}`}>
                      <i className={`bi ${icon} text-sm`} />
                    </div>
                    <div className="min-w-0">
                      <p title={fileName} className="truncate text-xs font-medium text-slate-700 group-hover/item:text-slate-900">
                        {fileName}
                      </p>
                      <span className="text-[10px] text-slate-400">{file.size}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1 opacity-95 transition-opacity sm:opacity-0 sm:group-hover/item:opacity-100">
                    {!isWordDoc(fileName) && (
                      <button type="button" title="Preview File" onClick={() => onViewFile(file)}
                        className={`${actionBtn} hover:bg-blue-50 hover:text-blue-600`}>
                        <i className="bi bi-eye text-xs" />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Replace File"
                      onClick={() => {
                        editingFileRef.current = file;
                        replaceInputRef.current?.click();
                      }}
                      className={`${actionBtn} hover:bg-amber-50 hover:text-amber-600`}
                    >
                      <i className="bi bi-pencil text-xs" />
                    </button>
                    <button type="button" title="Download" onClick={() => onDownloadFile(file)}
                      className={`${actionBtn} hover:bg-emerald-50 hover:text-emerald-600`}>
                      <i className="bi bi-download text-xs" />
                    </button>
                    <button type="button" title="Delete File" onClick={() => onDeleteFile(file)}
                      className={`${actionBtn} hover:bg-rose-50 hover:text-rose-600`}>
                      <i className="bi bi-trash text-xs" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/30 px-4 py-2 text-[11px] text-slate-500">
          <span>
            Page <strong className="font-semibold text-slate-700">{currentPage}</strong> of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}
              className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
              title="Previous Page">
              <i className="bi bi-chevron-left" />
            </button>
            <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}
              className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
              title="Next Page">
              <i className="bi bi-chevron-right" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

/* ---------- main ---------- */
export default function E201TabContent({ employee, employeeIdNumber }) {
  const idNumber =
    employeeIdNumber || employee?.ee_id_number || employee?.employee?.ee_id_number;

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewRequestRef = useRef(0); // ignore stale preview responses

  const endpoint = idNumber ? `/employees/${encodeURIComponent(idNumber)}/documents` : null;

  // Group once per data change instead of storing derived state
  const sections = useMemo(() => {
    const groups = new Map(E201_SECTIONS.map((s) => [s.type, []]));

    documents.forEach((doc) => {
      const name = rawName(doc);
      groups.get(doc.eed_type)?.push({
        ...doc,
        name,
        path: name.includes("/") ? name : `${DEFAULT_FOLDER_PATH}/${idNumber}/e-201/${name}`,
        size: doc.size || doc.eed_size || "Unknown size",
      });
    });

    return E201_SECTIONS.map((s) => ({ ...s, files: groups.get(s.type) }));
  }, [documents, idNumber]);

  const totalFilesCount = documents.length;

  const loadDocuments = useCallback(async () => {
    if (!endpoint) {
      setDocuments([]);
      return;
    }
    const result = await apiRequest(endpoint);
    setDocuments(result.data || []);
  }, [endpoint]);

  // Initial load: inline "Syncing..." instead of a blocking popup
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    loadDocuments()
      .catch((e) => {
        if (!cancelled) showErrorAlert(getErrorMessage(e, "Unable to load E-201 documents."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadDocuments]);

  /** Runs a mutation: popup -> request -> reload -> success (success is no longer covered by the reload popup). */
  const mutate = useCallback(
    async ({ popup, url, options, successFallback, errorFallback }) => {
      if (!endpoint) {
        showErrorAlert("Employee ID number is required.");
        return;
      }

      showLoadingPopup(popup);
      setLoading(true);

      try {
        const result = await apiRequest(url, options);
        await loadDocuments();
        showSuccessAlert(result.message || successFallback);
      } catch (e) {
        showErrorAlert(getErrorMessage(e, errorFallback));
      } finally {
        setLoading(false);
      }
    },
    [endpoint, loadDocuments],
  );

  const handleUploadFiles = useCallback(
    (type, files) => {
      const body = new FormData();
      body.append("eed_type", type);
      files.forEach((file) => body.append("files[]", file));

      return mutate({
        popup: "Uploading documents...",
        url: endpoint,
        options: { method: "POST", body },
        successFallback: "Documents uploaded successfully.",
        errorFallback: "Unable to upload documents.",
      });
    },
    [endpoint, mutate],
  );

  const handleEditFile = useCallback(
    (file, type, replacement) => {
      const body = new FormData();
      body.append("eed_type", type);
      body.append("file", replacement);

      return mutate({
        popup: "Replacing document...",
        url: `${endpoint}/${file.eed_id}`,
        options: { method: "POST", body },
        successFallback: "Document replaced successfully.",
        errorFallback: "Unable to replace document.",
      });
    },
    [endpoint, mutate],
  );

  const handleDeleteFile = useCallback(
    async (file) => {
      if (!endpoint || !(await showDeleteConfirmDialog())) return;

      return mutate({
        popup: "Deleting document...",
        url: `${endpoint}/${file.eed_id}`,
        options: { method: "DELETE" },
        successFallback: "Document deleted successfully.",
        errorFallback: "Unable to delete document.",
      });
    },
    [endpoint, mutate],
  );

  /* ---------- preview (blob URL lifecycle handled by effect) ---------- */
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const closePreview = useCallback(() => {
    previewRequestRef.current += 1;
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewLoading(false);
  }, []);

  useEffect(() => {
    if (!previewFile) return;
    const onKey = (e) => e.key === "Escape" && closePreview();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewFile, closePreview]);

  const handleViewFile = useCallback(
    async (file) => {
      if (!endpoint) return;

      const requestId = ++previewRequestRef.current;
      setPreviewFile(file);
      setPreviewUrl(null);
      setPreviewLoading(true);

      try {
        const response = await apiRequest(`${endpoint}/${file.eed_id}/view`, {
          raw: true,
          headers: { Accept: "*/*" },
        });
        const blob = await response.blob();
        if (requestId !== previewRequestRef.current) return; // closed / replaced meanwhile
        setPreviewUrl(URL.createObjectURL(blob));
      } catch (e) {
        if (requestId !== previewRequestRef.current) return;
        showErrorAlert(getErrorMessage(e, "Unable to load document preview."));
        setPreviewFile(null);
      } finally {
        if (requestId === previewRequestRef.current) setPreviewLoading(false);
      }
    },
    [endpoint],
  );

  const handleDownloadFile = useCallback(
    async (file) => {
      if (!endpoint) return;

      showLoadingPopup("Preparing download...");

      try {
        const response = await apiRequest(`${endpoint}/${file.eed_id}/download`, {
          raw: true,
          headers: { Accept: "*/*" },
        });
        const objectUrl = URL.createObjectURL(await response.blob());

        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = rawName(file) || "download";
        document.body.appendChild(link);
        link.click();
        link.remove();

        Swal.close();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      } catch (e) {
        showErrorAlert(getErrorMessage(e, "Unable to download the document."));
      }
    },
    [endpoint],
  );

  if (!idNumber) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs font-medium text-amber-800">
        <i className="bi bi-exclamation-triangle text-base text-amber-600" />
        <span>Save or select an employee record before viewing or managing E-201 documents.</span>
      </div>
    );
  }

  const previewName = previewFile ? formatFileName(rawName(previewFile)) : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800">E-201 Personnel File</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
              {totalFilesCount} File{totalFilesCount === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Manage employee digital dossiers across key compliance sections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 placeholder-slate-400 outline-hidden transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <i className="bi bi-x-circle-fill text-xs" />
              </button>
            )}
          </div>

          {loading && (
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-blue-600">
              <i className="bi bi-arrow-repeat animate-spin text-sm" />
              Syncing...
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <E201Card
            key={section.id}
            section={section}
            searchQuery={searchQuery}
            loading={loading}
            onUploadFiles={handleUploadFiles}
            onDeleteFile={handleDeleteFile}
            onEditFile={handleEditFile}
            onViewFile={handleViewFile}
            onDownloadFile={handleDownloadFile}
          />
        ))}
      </div>

      {previewFile && (
        <div className="fixed inset-0 z-50 flex justify-center overflow-hidden bg-slate-900/40 backdrop-blur-xs">
          <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
                  <i className="bi bi-file-earmark-text text-lg" />
                </div>
                <div className="min-w-0">
                  <h3 title={previewName} className="truncate text-xs font-bold text-slate-800">
                    {previewName}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-400">{previewFile.eed_type}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleDownloadFile(previewFile)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-100">
                  <i className="bi bi-download" />
                  Download
                </button>
                <button type="button" onClick={closePreview} title="Close Preview"
                  className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700">
                  <i className="bi bi-x-lg text-sm" />
                </button>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-center overflow-hidden bg-slate-100 p-4">
              {previewLoading ? (
                <div className="flex flex-col items-center text-xs text-slate-500">
                  <i className="bi bi-arrow-repeat mb-2 animate-spin text-2xl text-blue-600" />
                  <span>Loading preview...</span>
                </div>
              ) : previewUrl ? (
                isImage(previewName) ? (
                  <img src={previewUrl} alt={previewName}
                    className="max-h-full max-w-full rounded-xl bg-white object-contain p-2 shadow-md" />
                ) : isPdf(previewName) ? (
                  <iframe src={previewUrl} title={previewName}
                    className="h-full w-full rounded-xl border border-slate-200 bg-white shadow-xs" />
                ) : (
                  <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
                    <i className="bi bi-file-earmark-lock mb-3 block text-5xl text-amber-500" />
                    <h4 className="mb-1 text-xs font-bold text-slate-800">Preview not available</h4>
                    <p className="mb-4 text-[11px] text-slate-400">
                      This file format cannot be rendered directly in the browser.
                    </p>
                    <button type="button" onClick={() => handleDownloadFile(previewFile)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700">
                      <i className="bi bi-download" />
                      Download File
                    </button>
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
