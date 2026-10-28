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
  pdf: { icon: "bi-file-earmark-pdf", tone: "text-rose-500 bg-rose-50 border-rose-100" },
  doc: { icon: "bi-file-earmark-word", tone: "text-blue-500 bg-blue-50 border-blue-100" },
  docx: { icon: "bi-file-earmark-word", tone: "text-blue-500 bg-blue-50 border-blue-100" },
  jpg: { icon: "bi-file-earmark-image", tone: "text-emerald-500 bg-emerald-50 border-emerald-100" },
  jpeg: { icon: "bi-file-earmark-image", tone: "text-emerald-500 bg-emerald-50 border-emerald-100" },
  png: { icon: "bi-file-earmark-image", tone: "text-emerald-500 bg-emerald-50 border-emerald-100" },
};
const DEFAULT_META = { icon: "bi-file-earmark-text", tone: "text-slate-500 bg-slate-50 border-slate-100" };

const formatFileName = (filename = "") => filename;
const rawName = (file) => file?.eed_file || file?.name || "";

const validateFile = (file) => {
  if (!ACCEPTED_TYPES.includes(getExt(file.name))) return false;
  return file.size <= MAX_FILE_SIZE;
};

/* ---------- card ---------- */
const E201Card = memo(function E201Card({
  section, searchQuery, loading, className = "",
  onUploadFiles, onDeleteFile, onViewFile, onEditFile, onDownloadFile,
}) {
  const fileInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const editingFileRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  // Filter and sort missing files first (file_exists === false)
  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = section.files;
    if (q) {
      list = list.filter((file) => (rawName(file) || "").toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const aMissing = a.file_exists === false ? 0 : 1;
      const bMissing = b.file_exists === false ? 0 : 1;
      return aMissing - bMissing;
    });
  }, [section.files, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / ITEMS_PER_PAGE));

  const visibleFiles = useMemo(
    () => filteredFiles.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredFiles, currentPage],
  );

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

  const actionBtn = "inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-medium text-slate-600 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 active:scale-95";

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
      className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border transition-all duration-200 ${
        isDragging
          ? "border-blue-500 bg-blue-50/40 ring-4 ring-blue-100 shadow-sm scale-[1.01]"
          : "border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 hover:shadow-xs"
      } ${className}`}
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
        {/* Card Header - Compact */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-blue-600 shadow-2xs">
              <i className={`bi ${section.icon} text-xs`} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xs font-bold text-slate-800">{section.title}</h3>
              <p className="text-[10px] font-medium text-slate-400">
                {section.files.length} doc{section.files.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-2xs transition hover:bg-blue-700 active:scale-95 disabled:opacity-50"
          >
            <i className="bi bi-cloud-upload text-[10px]" />
            Upload
          </button>
        </div>

        {/* Card Content / Files List - Compact */}
        <div className="min-h-[140px] space-y-1.5 p-2">
          {loading && section.files.length === 0 ? (
            <div className="space-y-1.5 py-2">
              {[1, 2].map((n) => (
                <div key={n} className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/50 p-2 animate-pulse">
                  <div className="h-7 w-7 rounded-md bg-slate-200" />
                  <div className="flex-1 space-y-1">
                    <div className="h-2.5 w-3/4 rounded bg-slate-200" />
                    <div className="h-2 w-1/4 rounded bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredFiles.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group/drop flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50/20"
            >
              <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition group-hover/drop:bg-blue-100 group-hover/drop:text-blue-600 shadow-2xs">
                <i className="bi bi-cloud-arrow-up text-sm" />
              </div>
              <p className="text-[11px] font-semibold text-slate-700 group-hover/drop:text-blue-600">
                {searchQuery ? "No matching docs" : "Click or drop files"}
              </p>
              <p className="text-[9px] text-slate-400">PDF, DOCX, JPG, PNG up to 10MB</p>
            </div>
          ) : (
            visibleFiles.map((file) => {
              const fileName = formatFileName(rawName(file) || "Document");
              const { icon, tone } = FILE_META[getExt(fileName)] || DEFAULT_META;

              return (
                <div
                  key={file.eed_id || file.id}
                  className="group/item relative flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-2 pr-28 transition hover:border-slate-200 hover:bg-white hover:shadow-2xs"
                >
                  <div className="flex min-w-0 items-center gap-2 w-full">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${tone}`}>
                      <i className={`bi ${icon} text-xs`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-all text-[11px] font-semibold text-slate-700 leading-snug group-hover/item:text-slate-900">
                        {fileName}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <span className="text-[9px] font-medium text-slate-400">{file.size}</span>
                        <span className="rounded bg-slate-200/60 px-1 py-0.2 text-[8px] font-bold uppercase text-slate-600">
                          {getExt(fileName) || "FILE"}
                        </span>
                        {file.file_exists === true ? (
                          <span className="inline-flex items-center gap-0.5 rounded border border-emerald-100 bg-emerald-50 px-1 py-0.2 text-[8px] font-bold text-emerald-700" title="File exists">
                            <i className="bi bi-check-circle" /> Exists
                          </span>
                        ) : file.file_exists === false ? (
                          <span className="inline-flex items-center gap-0.5 rounded border border-rose-200 bg-rose-50 px-1 py-0.2 text-[8px] font-bold text-rose-700 animate-pulse" title="Missing file">
                            <i className="bi bi-exclamation-triangle" /> Missing
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 rounded border border-amber-100 bg-amber-50 px-1 py-0.2 text-[8px] font-bold text-amber-700" title="Not verified">
                            <i className="bi bi-question-circle" /> Unverified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover/item:opacity-100 bg-white/95 backdrop-blur-xs p-0.5 rounded shadow-2xs">
                    {!isWordDoc(fileName) && (
                      <button
                        type="button"
                        disabled={file.file_exists === false}
                        onClick={() => onViewFile(file)}
                        className={`${actionBtn} hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40`}
                        title="Preview"
                      >
                        <i className="bi bi-eye text-[10px]" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        editingFileRef.current = file;
                        replaceInputRef.current?.click();
                      }}
                      className={`${actionBtn} hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600`}
                      title="Replace"
                    >
                      <i className="bi bi-pencil text-[10px]" />
                    </button>
                    <button
                      type="button"
                      disabled={file.file_exists === false}
                      onClick={() => onDownloadFile(file)}
                      className={`${actionBtn} hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-40`}
                      title="Download"
                    >
                      <i className="bi bi-download text-[10px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteFile(file)}
                      className={`${actionBtn} hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600`}
                      title="Delete"
                    >
                      <i className="bi bi-trash text-[10px] text-rose-500" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/40 px-3 py-1.5 text-[10px] text-slate-500">
          <span>Page <strong className="font-semibold text-slate-700">{currentPage}</strong>/{totalPages}</span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}
              className="rounded border border-slate-200 bg-white p-1 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40" title="Prev">
              <i className="bi bi-chevron-left text-[10px]" />
            </button>
            <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}
              className="rounded border border-slate-200 bg-white p-1 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40" title="Next">
              <i className="bi bi-chevron-right text-[10px]" />
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
  const previewRequestRef = useRef(0);

  const endpoint = idNumber ? `/employees/${encodeURIComponent(idNumber)}/documents` : null;

  // Sort sections: Sections containing missing files bubble to the top
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

    const mapped = E201_SECTIONS.map((s) => {
      const files = groups.get(s.type) || [];
      const hasMissing = files.some((f) => f.file_exists === false);
      return { ...s, files, hasMissing };
    });

    return mapped.sort((a, b) => (b.hasMissing ? 1 : 0) - (a.hasMissing ? 1 : 0));
  }, [documents, idNumber]);

  const totalFilesCount = documents.length;
  const existingFilesCount = documents.filter((doc) => doc.file_exists === true).length;
  const missingFilesCount = documents.filter((doc) => doc.file_exists === false).length;
  const unverifiedFilesCount = documents.filter((doc) => typeof doc.file_exists !== "boolean").length;

  const loadDocuments = useCallback(async () => {
    if (!endpoint) {
      setDocuments([]);
      return;
    }
    const result = await apiRequest(endpoint);
    setDocuments(result.data || []);
  }, [endpoint]);

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
        if (requestId !== previewRequestRef.current) return;
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
      <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs font-medium text-amber-800">
        <i className="bi bi-exclamation-triangle text-sm text-amber-600" />
        <span>Save or select an employee record before viewing or managing E-201 documents.</span>
      </div>
    );
  }

  const previewName = previewFile ? formatFileName(rawName(previewFile)) : "";

  return (
    <div className="space-y-3 pb-8">
      {/* Sticky Header and Controls - Compact */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 lg:px-8 py-2.5 backdrop-blur-md shadow-2xs">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xs font-bold text-slate-800">E-201 Personnel File</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                {totalFilesCount} Total
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                <i className="bi bi-check-circle" /> {existingFilesCount} Exist
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${
                missingFilesCount > 0 ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-600"
              }`}>
                <i className="bi bi-exclamation-triangle" /> {missingFilesCount} Missing
              </span>
              {unverifiedFilesCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
                  <i className="bi bi-question-circle" /> {unverifiedFilesCount} Unverified
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-56">
              <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-[11px] text-slate-700 placeholder-slate-400 outline-hidden transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <i className="bi bi-x-circle-fill text-[11px]" />
                </button>
              )}
            </div>

            {loading && (
              <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-blue-600">
                <i className="bi bi-arrow-repeat animate-spin text-xs" /> Sync...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sections Grid - Compact */}
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 pt-1">
        {sections.map((section, idx) => {
          const isLastOdd = idx === sections.length - 1 && sections.length % 2 !== 0;
          return (
            <E201Card
              key={section.id}
              section={section}
              searchQuery={searchQuery}
              loading={loading}
              className={isLastOdd ? "lg:col-span-2 lg:max-w-xl lg:mx-auto w-full" : ""}
              onUploadFiles={handleUploadFiles}
              onDeleteFile={handleDeleteFile}
              onEditFile={handleEditFile}
              onViewFile={handleViewFile}
              onDownloadFile={handleDownloadFile}
            />
          );
        })}
      </div>

      {/* Spacious Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
                  <i className="bi bi-file-earmark-text text-sm" />
                </div>
                <div className="min-w-0">
                  <h3 title={previewName} className="break-all text-xs font-bold text-slate-800">
                    {previewName}
                  </h3>
                  <p className="text-[10px] font-medium text-slate-400">{previewFile.eed_type}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleDownloadFile(previewFile)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-100">
                  <i className="bi bi-download" /> Download
                </button>
                <button type="button" onClick={closePreview} title="Close"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700">
                  <i className="bi bi-x-lg text-xs" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex flex-1 items-center justify-center overflow-hidden bg-slate-100 p-4">
              {previewLoading ? (
                <div className="flex flex-col items-center text-xs text-slate-500 space-y-2">
                  <i className="bi bi-arrow-repeat animate-spin text-2xl text-blue-600" />
                  <span>Loading document preview...</span>
                </div>
              ) : previewUrl ? (
                isImage(previewName) ? (
                  <img src={previewUrl} alt={previewName}
                    className="max-h-full rounded-lg bg-white object-contain p-2 shadow-sm" />
                ) : isPdf(previewName) ? (
                  <iframe src={previewUrl} title={previewName}
                    className="h-full w-full rounded-lg border border-slate-200 bg-white shadow-2xs" />
                ) : (
                  <div className="max-w-xs rounded-xl border border-slate-200 bg-white p-6 text-center shadow-2xs">
                    <i className="bi bi-file-earmark-lock mb-2 block text-4xl text-amber-500" />
                    <h4 className="mb-1 text-xs font-bold text-slate-800">Preview not available</h4>
                    <p className="mb-3 text-[10px] text-slate-400">
                      Word documents cannot be previewed directly in browser. Please download to view.
                    </p>
                    <button type="button" onClick={() => handleDownloadFile(previewFile)}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 shadow-2xs">
                      <i className="bi bi-download" /> Download File
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