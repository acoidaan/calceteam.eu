import React, { useState } from "react";
import "./Login.css";
import Modal from "./Modal";
import { useModal } from "./useModal";
import ForgotPasswordModal from "./ForgotPasswordModal";

const Login = ({ onBack }) => {
  const { modalConfig, showAlert, showSuccess, showError } = useModal();
  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    if (!formData.email || !formData.password) {
      showAlert("Por favor completa todos los campos");
      return;
    }

    if (!isLogin) {
      if (!formData.username) {
        showAlert("Por favor ingresa un nombre de usuario");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        showAlert("Las contraseñas no coinciden");
        return;
      }
    }

    try {
      const baseURL = window.location.origin;
      const endpoint = isLogin
        ? `${baseURL}/api/login`
        : `${baseURL}/api/register`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        if (isLogin) {
          localStorage.setItem("accessToken", data.accessToken);
          localStorage.setItem("refreshToken", data.refreshToken);
          localStorage.setItem("username", data.username);
          showSuccess("Inicio de sesión exitoso");
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          showSuccess("Registro exitoso, ahora puedes iniciar sesión");
          setTimeout(() => {
            setIsLogin(true);
          }, 1500);
        }
      } else {
        showError(data.error || "Error en la petición.");
      }
    } catch (error) {
      showError("Error de conexión. Por favor intenta más tarde.");
      console.error(error);
    }
  };

  return (
    <div className="login-container">
      <Modal {...modalConfig} />
      <div className="login-bg"></div>

      <div className="login-card-wrapper">
        <div className="login-logo-section">
          <img
            src="/logo_transparent.png"
            alt="Calce Team"
            className="login-logo"
          />
          <h2 className="login-title">CALCE TEAM</h2>
        </div>

        <div className="login-card">
          <div className={`toggle-buttons ${!isLogin ? "register" : ""}`}>
            <button
              onClick={() => setIsLogin(true)}
              className={`toggle-btn ${isLogin ? "active" : ""}`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`toggle-btn ${!isLogin ? "active" : ""}`}
            >
              Registrarse
            </button>
          </div>

          <div className="form-fields">
            {!isLogin && (
              <div className="form-group">
                <label className="form-label">Nombre de Usuario</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Tu nombre de jugador"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="form-input"
                placeholder="tu@email.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="form-input"
                placeholder="••••••••"
              />
            </div>

            {!isLogin && (
              <div className="form-group">
                <label className="form-label">Confirmar Contraseña</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="••••••••"
                />
              </div>
            )}

            <button onClick={handleSubmit} className="submit-btn">
              {isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
            </button>
          </div>

          {isLogin && (
            <div className="forgot-password">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setShowForgotPassword(true);
                }}
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>
          )}

          <div className="back-link">
            <button className="back-btn" onClick={onBack}>
              ← Volver al inicio
            </button>
          </div>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        showSuccess={showSuccess}
        showError={showError}
      />
    </div>
  );
};

export default Login;