import React, { useState, useMemo } from "react";
import { 
  showLoadingPopup, 
  showSuccessAlert, 
  showErrorAlert, 
  showDeleteConfirmDialog,
  showStatusConfirmDialog,
} from "../../../assets/js/swalHelpers";
import DataTable from "../../../assets/function/DataTable";

export default function CrudManager({
  apiEndpoint,
  primaryKey = "id",
  statusKey = "status",
  title,
  emptyForm = {},
  columns = [],
  FormComponent,
  items = [],
  loading = false,
  onFetchItems,
  modalSize,
}) {
  const [activeTab, setActiveTab] = useState("Active");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenModal = (item = null) => {
    setCurrentItem(item);
    setFormData(item ? { ...item } : { ...emptyForm, [statusKey]: activeTab });
    setIsModalOpen(true);
  };

  const handleSave = async (formDataOrEvent, customId = null) => {
    const isFormData = formDataOrEvent instanceof FormData;

    if (!isFormData && formDataOrEvent && typeof formDataOrEvent.preventDefault === 'function') {
      formDataOrEvent.preventDefault();
    }

    try {
      setIsSaving(true);
      showLoadingPopup(currentItem ? "Updating record..." : "Creating new record...");
      
      const identifier = customId || (currentItem ? currentItem[primaryKey] : null);
      const url = identifier ? `${apiEndpoint}/${identifier}` : apiEndpoint;
      
      const options = {
        // ALWAYS use POST for FormData requests containing files in Laravel to prevent stream dropping,
        // _method='PUT' inside the FormData handles the rest.
        method: isFormData ? 'POST' : (currentItem ? 'PUT' : 'POST'),
      };

      if (isFormData) {
        if (!formDataOrEvent.has('_method') && currentItem) {
          formDataOrEvent.append('_method', 'PUT');
        }
        options.body = formDataOrEvent;
        // Do NOT set Content-Type header manually when using FormData!
      } else {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(formData);
      }

      const res = await fetch(url, options);
      
      if (!res.ok) {
        const errorRes = await res.json().catch(() => ({}));
        
        // Log validation errors nicely to console if Laravel returns 422
        if (res.status === 422 && errorRes.errors) {
          console.error("Validation Errors:", errorRes.errors);
          const firstKey = Object.keys(errorRes.errors)[0];
          throw new Error(errorRes.errors[firstKey][0]);
        }

        throw new Error(errorRes.message || (currentItem ? "Failed to update." : "Failed to create."));
      }

      await res.json();
      if (onFetchItems) onFetchItems();

      showSuccessAlert(currentItem ? `${title} updated successfully.` : `New ${title} added successfully.`);
      setIsModalOpen(false);
    } catch (err) {
      showErrorAlert(err.message || 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (await showDeleteConfirmDialog()) {
      try {
        showLoadingPopup("Removing record...");
        const res = await fetch(`${apiEndpoint}/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error("Failed to delete record.");
        
        if (onFetchItems) onFetchItems(); // Re-fetch from parent

        showSuccessAlert('Record removed successfully.');
      } catch (err) {
        showErrorAlert(err.message || 'Could not delete.');
      }
    }
  };

  const toggleStatus = async (id) => {
    const target = items.find(i => i[primaryKey] === id);
    if (!target) return;

    const currentStatus = target[statusKey] || "Active";
    const nextStatus = currentStatus === "Active" ? "Inactive" : "Active";
    
    if (await showStatusConfirmDialog(nextStatus)) {
      try {
        showLoadingPopup("Updating status...");
        const res = await fetch(`${apiEndpoint}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...target, [statusKey]: nextStatus }),
        });
        if (!res.ok) throw new Error("Failed to update status.");

        if (onFetchItems) onFetchItems(); // Re-fetch from parent

        showSuccessAlert(`Status switched to ${nextStatus}.`, 1200);
      } catch (err) {
        showErrorAlert(err.message || 'Status update failed.');
      }
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      const itemStatus = i[statusKey] || "Active";
      return itemStatus === activeTab;
    });
  }, [items, activeTab, statusKey]);

  return (
    <div className="sm:items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-4">
      {/* Top Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex gap-1.5 bg-slate-100/80 p-1 rounded-xl self-start">
          {["Active", "Inactive"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === tab 
                  ? tab === "Active" ? "bg-emerald-600 text-white shadow-sm scale-105" : "bg-rose-600 text-white shadow-sm scale-105" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >{tab}</button>
          ))}
        </div>

        <button onClick={() => handleOpenModal()}
          className="px-3.5 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl hover:bg-blue-100 transition cursor-pointer text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-3.5">
            <path fill-rule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
          </svg>

          <span>Add {title}</span>
        </button>
      </div>

      {/* DataTable */}
      <DataTable
        data={filteredItems}
        columns={columns(handleOpenModal, handleDelete, toggleStatus)}
        isLoading={loading}
        searchPlaceholder="Search in table..."
        emptyMessage="No records found"
      />

      {/* Dynamic Form Modal */}
      {FormComponent && (
        <FormComponent
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={title}
          currentItem={currentItem}
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSave}
          isLoading={isSaving}
          modalSize={modalSize}
        />
      )}
    </div>
  );
}