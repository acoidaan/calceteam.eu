import React, { useState } from "react";
import "./ForgotPasswordModal.css";

const ForgotPasswordModal = ({ isOpen, onClose, showSuccess, showError }) => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      showError("Por favor ingresa tu email");
      return;
    }

    setIsLoading(true);

    try {
      const baseURL = window.location.origin;
      const response = await fetch(`${baseURL}/api/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        showSuccess("Se ha enviado un enlace de recuperación a tu email");
        setEmail("");
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        showError(data.message || "Error al procesar la solicitud");
      }
    } catch (error) {
      showError("Error de conexión. Por favor intenta más tarde.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="forgot-password-overlay">
      <div className="forgot-password-modal">
        <div className="modal-header">
          <h2>Recuperar Contraseña</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <p>
            Ingresa tu email y te enviaremos un enlace para restablecer tu
            contraseña.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="form-input"
                disabled={isLoading}
                required
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn" disabled={isLoading}>
                {isLoading ? "Enviando..." : "Enviar enlace"}
              </button>
              <button
                type="button"
                className="cancel-btn"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
