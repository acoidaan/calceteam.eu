import React, { useState, useEffect } from "react";
import "./ResetPassword.css";
import Modal from "./Modal";
import { useModal } from "./useModal";

const ResetPassword = () => {
  const { modalConfig, showSuccess, showError } = useModal();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  useEffect(() => {
    // Obtener token de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get("token");

    if (tokenFromUrl) {
      setToken(tokenFromUrl);
      verifyToken(tokenFromUrl);
    } else {
      setCheckingToken(false);
    }
  }, []);

  const verifyToken = async (resetToken) => {
    try {
      const response = await fetch(`/api/verify-reset-token/${resetToken}`);
      if (response.ok) {
        setIsValidToken(true);
      } else {
        showError("El enlace de recuperación es inválido o ha expirado");
      }
    } catch (error) {
      showError("Error al verificar el enlace");
    } finally {
      setCheckingToken(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      showError("Las contraseñas no coinciden");
      return;
    }

    if (newPassword.length < 6) {
      showError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        showSuccess("Contraseña actualizada correctamente");
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      } else {
        showError(data.message || "Error al actualizar la contraseña");
      }
    } catch (error) {
      showError("Error de conexión");
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingToken) {
    return (
      <div className="reset-password-container">
        <div className="loading-message">Verificando enlace...</div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="reset-password-container">
        <Modal {...modalConfig} />
        <div className="reset-password-card">
          <div className="error-message">
            <h2>Enlace inválido</h2>
            <p>Este enlace de recuperación es inválido o ha expirado.</p>
            <button
              className="home-btn"
              onClick={() => (window.location.href = "/")}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-container">
      <Modal {...modalConfig} />

      <div className="reset-password-card">
        <div className="logo-section">
          <img src="/logo_transparent.png" alt="Calce Team" className="logo" />
          <h2>CALCE TEAM</h2>
        </div>

        <div className="reset-form-section">
          <h3>Restablecer Contraseña</h3>
          <p>Ingresa tu nueva contraseña</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Nueva Contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="form-input"
                disabled={isLoading}
                required
              />
            </div>

            <div className="form-group">
              <label>Confirmar Contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="form-input"
                disabled={isLoading}
                required
              />
            </div>

            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? "Actualizando..." : "Actualizar Contraseña"}
            </button>
          </form>

          <div className="back-link">
            <a href="/">Volver al inicio</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
