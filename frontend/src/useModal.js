import { useState } from "react";

export const useModal = () => {
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Aceptar",
    cancelText: "Cancelar",
    showCancel: false,
    onConfirm: () => {},
    onCancel: () => {},
  });

  const showModal = (config) => {
    setModalConfig({
      isOpen: true,
      title: config.title || "",
      message: config.message || "",
      confirmText: config.confirmText || "Aceptar",
      cancelText: config.cancelText || "Cancelar",
      showCancel: config.showCancel || false,
      onConfirm: config.onConfirm || (() => closeModal()),
      onCancel: config.onCancel || (() => closeModal()),
    });
  };

  const closeModal = () => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  // Métodos de conveniencia
  const showAlert = (message, title = "") => {
    showModal({
      title,
      message,
      showCancel: false,
      onConfirm: closeModal,
    });
  };

  const showSuccess = (message, title = "Éxito") => {
    showModal({
      title,
      message,
      showCancel: false,
      onConfirm: closeModal,
    });
  };

  const showError = (message, title = "Error") => {
    showModal({
      title,
      message,
      showCancel: false,
      onConfirm: closeModal,
    });
  };

  const showConfirm = (message, onConfirm, title = "Confirmar") => {
    showModal({
      title,
      message,
      showCancel: true,
      confirmText: "Sí",
      cancelText: "No",
      onConfirm: () => {
        onConfirm();
        closeModal();
      },
      onCancel: closeModal,
    });
  };

  return {
    modalConfig,
    showModal,
    showAlert,
    showSuccess,
    showError,
    showConfirm,
    closeModal,
  };
};
