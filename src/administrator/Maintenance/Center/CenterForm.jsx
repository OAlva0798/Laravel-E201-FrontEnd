import React, { useEffect, useState, useCallback } from "react";
import Modal from "../../../assets/function/Modal";

const formFields = [
  {
    name: "mc_name",
    label: "Center Name",
    type: "input",
    inputType: "text",
    placeholder: "e.g. Alpha Maintenance Hub",
    required: true,
    className: "col-span-12",
  },
  {
    name: "mc_head_uaccid",
    label: "Head User ID",
    type: "input",
    inputType: "text",
    placeholder: "e.g. 101",
    required: true,
    className: "col-span-12",
  },
  {
    name: "mc_head_position",
    label: "Head Position",
    type: "input",
    inputType: "text",
    placeholder: "e.g. Supervisor",
    required: true,
    className: "col-span-12",
  },
];

export default function CenterForm({ 
  isOpen, 
  onClose,
  title,
  currentItem, 
  formData, 
  setFormData, 
  onSubmit, 
  modalSize 
}) {
  const [previews, setPreviews] = useState({});
  const [errorAlert, setErrorAlert] = useState(null);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const showErrorAlert = (message) => {
    setErrorAlert(message);
    setTimeout(() => setErrorAlert(null), 4000);
  };

  const handleFileChange = useCallback((fieldName, file) => {
    if (file === null) {
      setFormData(prev => ({ ...prev, [fieldName]: null }));
      setPreviews(prev => ({ ...prev, [fieldName]: null }));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviews(prev => ({ ...prev, [fieldName]: objectUrl }));
    setFormData(prev => ({ ...prev, [fieldName]: file }));
  }, [setFormData]);

  const getImageSrc = (currentFieldValue, previewUrl) => {
    if (previewUrl) return previewUrl;
    if (typeof currentFieldValue === "string" && currentFieldValue.startsWith("http")) {
      return currentFieldValue;
    }
    return null;
  };

  useEffect(() => {
    if (!isOpen) return;
    const initialData = formFields.reduce((acc, field) => {
      acc[field.name] = currentItem?.[field.name] || "";
      return acc;
    }, {});
    setFormData(initialData);
    setPreviews({});
    setErrorAlert(null);
  }, [isOpen, currentItem, setFormData]);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={currentItem ? `Edit ${title}` : `Add ${title}`} 
      modalSize={modalSize}
    >
      <form 
        id="onSubmit-form" 
        onSubmit={onSubmit} 
        encType="multipart/form-data" 
        className="flex flex-col h-full max-h-[75vh]"
      >
        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          {errorAlert && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-600 rounded-xl">
              {errorAlert}
            </div>
          )}

          <div className="grid grid-cols-12 gap-4">
            {formFields.map((field) => (
              <div key={field.name} className={field.className}>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>

                {/* Standard Inputs */}
                {field.type === "input" && (
                  <input
                    type={field.inputType}
                    name={field.name}
                    value={formData[field.name] || ""}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 transition-all"
                  />
                )}

                {/* Searchable Select Components */}
                {field.type === "select" && (() => {
                  const Component = field.component;
                  if (!Component) return null;
                  return (
                    <Component 
                      {...field.props}
                      value={formData[field.name] || ""}
                      onChange={(value) => handleChange(field.name, value)}
                      className="w-full text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 transition-all" 
                    />
                  );
                })()}

                {/* File Inputs */}
                {field.type === "file" && (() => {
                  const validateAndProcessFile = (file) => {
                    const accept = field.accept || "";
                    let isValid = true;

                    if (accept.includes("image") && !file.type.startsWith("image/")) {
                      isValid = false;
                    }

                    if (!isValid) {
                      showErrorAlert("Invalid File Format");
                      return;
                    }

                    handleFileChange(field.name, file);
                  };

                  const currentFieldValue = currentItem?.[field.name];
                  const previewUrl = previews[field.name];
                  const imgSrc = getImageSrc(currentFieldValue, previewUrl);
                  const acceptsImage = field.accept?.includes("image");

                  return (
                    <div 
                      className="flex flex-col items-center p-5 border border-slate-200/80 rounded-3xl bg-slate-50/55 backdrop-blur-sm relative transition-all hover:border-slate-300 w-full max-w-sm mx-auto"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          validateAndProcessFile(e.dataTransfer.files[0]);
                        }
                      }}
                    >
                      <input
                        type="file"
                        id={`file-input-${field.name}`}
                        accept={field.accept}
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            validateAndProcessFile(e.target.files[0]);
                          }
                        }}
                      />

                      {!imgSrc && !formData[field.name] ? (
                        <label 
                          htmlFor={`file-input-${field.name}`}
                          className="w-full aspect-video mb-4 bg-white rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-400 overflow-hidden shadow-sm flex flex-col items-center justify-center relative cursor-pointer group transition-all p-4 text-center"
                        >
                          <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <span className="text-xs font-medium text-slate-700 block">Drag & drop or <span className="text-blue-600 underline">browse</span></span>
                          <span className="text-[10px] text-slate-400 mt-1 block">Accepts: {field.accept}</span>
                        </label>
                      ) : acceptsImage && imgSrc ? (
                        <label 
                          htmlFor={`file-input-${field.name}`}
                          className="w-40 h-40 mb-4 bg-white rounded-2xl border border-slate-200 hover:border-blue-400 overflow-hidden shadow-sm flex items-center justify-center relative cursor-pointer group transition-all"
                        >
                          <img 
                            src={imgSrc} 
                            alt="Preview" 
                            className="w-full h-full object-cover" 
                          />
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-2 text-center">
                            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-xs font-medium">Change image</span>
                          </div>
                        </label>
                      ) : null}

                      <div className="flex items-center gap-2 w-full">
                        <label 
                          htmlFor={`file-input-${field.name}`}
                          className="flex-1 h-9 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-2xs hover:shadow-xs transition-all text-xs font-medium"
                        >
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          {imgSrc || formData[field.name] ? 'Replace File' : 'Browse Files'}
                        </label>

                        {(imgSrc || formData[field.name]) && (
                          <button
                            type="button"
                            onClick={() => handleFileChange(field.name, null)}
                            className="h-9 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center cursor-pointer transition-all text-xs font-medium border border-rose-100"
                            title="Remove File"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      </form>

      {/* Buttons outside the form, tied to the form via form="onSubmit-form" */}
      <div className="flex justify-end gap-2 pt-2 mt-2 border-t border-slate-100 bg-white">
        <button 
          type="button" 
          onClick={onClose} 
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-rose-600 border border-rose-300 rounded-xl hover:bg-rose-50 transition cursor-pointer shadow-xs"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Cancel
        </button>
        <button 
          type="submit" 
          form="onSubmit-form"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-blue-600 border border-blue-300 rounded-xl hover:bg-blue-50 transition cursor-pointer shadow-xs"
        >
          {currentItem ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          )}
          {currentItem ? 'Update' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}