import Swal from "sweetalert2";

// ==========================================================
// LOADING POPUP
// ==========================================================

export const showLoadingPopup = (title = "Processing...") => {
  Swal.fire({
    title,
    text: "Please wait a moment",
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    showCloseButton: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
};

// ==========================================================
// SUCCESS ALERT
// ==========================================================

export const showSuccessAlert = (text = "Operation successful.", timer = 1500) => {
  Swal.fire({
    icon: "success",
    title: "Success!",
    text,
    timer,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    showCloseButton: false,
  });
};

// ==========================================================
// ERROR ALERT
// ==========================================================

export const showErrorAlert = (message = "Something went wrong.") => {
  Swal.fire({
    icon: "error",
    title: "Oops!",
    text: message,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showCloseButton: false,
  });
};

// ==========================================================
// DELETE CONFIRMATION
// ==========================================================

export const showDeleteConfirmDialog = async () => {
  const result = await Swal.fire({
    title: "Are you sure?",
    text: "This will be marked as deleted!",
    icon: "warning",
    showCancelButton: true,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showCloseButton: false,
    confirmButtonColor: "#e11d48",
    cancelButtonColor: "#0f172a",
    confirmButtonText: "Yes, delete it!",
    cancelButtonText: "Cancel",
    reverseButtons: true,
  });

  return result.isConfirmed;
};

// ==========================================================
// STATUS CONFIRMATION
// ==========================================================

export const showStatusConfirmDialog = async (nextStatus) => {
  const result = await Swal.fire({
    title: "Are you sure?",
    text: `Do you want to change the status to ${nextStatus}?`,
    icon: "warning",
    showCancelButton: true,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showCloseButton: false,
    confirmButtonColor: "#e11d48",
    cancelButtonColor: "#0f172a",
    confirmButtonText: "Yes, change it!",
    cancelButtonText: "Cancel",
    reverseButtons: true,
  });

  return result.isConfirmed;
};