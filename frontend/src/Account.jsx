import React, { useState, useEffect } from "react";
import "./Account.css";
import Modal from "./Modal";
import { useModal } from "./useModal";

const Account = ({ onBack }) => {
  const { modalConfig, showAlert, showSuccess, showError } = useModal();
  const [userData, setUserData] = useState({
    username: localStorage.getItem("username") || "",
    email: "",
    profilePic: null,
  });
  const [editMode, setEditMode] = useState({
    username: false,
    email: false,
  });
  const [newValues, setNewValues] = useState({
    username: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    currentPasswordForEdit: "",
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/user/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUserData({
          username: data.username,
          email: data.email,
          profilePic: data.profilePic,
        });
      }
    } catch (error) {
      console.error("Error cargando perfil:", error);
    }
  };

  const handleUpdate = async (field) => {
    if (!newValues.currentPasswordForEdit) {
      showAlert("Por favor ingresa tu contraseña actual");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/user/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          field,
          value: newValues[field],
          currentPassword: newValues.currentPasswordForEdit,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (field === "username") {
          localStorage.setItem("username", newValues.username);
        }
        setUserData((prev) => ({ ...prev, [field]: newValues[field] }));
        setEditMode((prev) => ({ ...prev, [field]: false }));
        setNewValues((prev) => ({ ...prev, currentPasswordForEdit: "" }));
        showSuccess("Actualizado correctamente");
      } else {
        const error = await response.json();
        showError(error.message || "Error al actualizar");
      }
    } catch (error) {
      showError("Error de conexión");
    }
  };

  const handleProfilePicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showError("La imagen no puede superar 5MB");
      return;
    }

    const formData = new FormData();
    formData.append("profilePic", file);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/user/upload-avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setUserData((prev) => ({ ...prev, profilePic: data.profilePic }));
        showSuccess("Foto actualizada");
      }
    } catch (error) {
      showError("Error al subir la imagen");
    }
  };

  const handlePasswordChange = async () => {
    if (!newValues.currentPassword || !newValues.newPassword) {
      showAlert("Completa todos los campos");
      return;
    }

    if (newValues.newPassword.length < 6) {
      showAlert("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/user/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: newValues.currentPassword,
          newPassword: newValues.newPassword,
        }),
      });

      if (response.ok) {
        showSuccess("Contraseña actualizada");
        setNewValues((prev) => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
        }));
      } else {
        showError("Contraseña actual incorrecta");
      }
    } catch (error) {
      showError("Error al cambiar contraseña");
    }
  };

  return (
    <div className="account-container">
      <Modal {...modalConfig} />

      <div className="account-header">
        <button onClick={onBack} className="back-button">
          ← Volver
        </button>
        <h1>Mi Cuenta</h1>
      </div>

      <div className="account-content">
        <div className="profile-section">
          <div className="profile-pic-container">
            {userData.profilePic ? (
              <img
                src={userData.profilePic}
                alt="Perfil"
                className="profile-pic"
              />
            ) : (
              <div className="profile-pic-placeholder">
                {userData.username ? userData.username[0].toUpperCase() : "?"}
              </div>
            )}
            <label htmlFor="profile-upload" className="upload-label">
              Cambiar foto
            </label>
            <input
              id="profile-upload"
              type="file"
              accept="image/*"
              onChange={handleProfilePicUpload}
              hidden
            />
          </div>
        </div>

        <div className="info-section">
          <div className="info-item">
            <label>Nombre de usuario</label>
            {editMode.username ? (
              <div className="edit-group">
                <input
                  type="text"
                  value={newValues.username}
                  onChange={(e) =>
                    setNewValues((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                  placeholder="Nuevo nombre"
                  autoComplete="off"
                />
                <input
                  type="password"
                  value={newValues.currentPasswordForEdit}
                  onChange={(e) =>
                    setNewValues((prev) => ({
                      ...prev,
                      currentPasswordForEdit: e.target.value,
                    }))
                  }
                  placeholder="Contraseña actual"
                  autoComplete="new-password"
                />
                <div className="button-group">
                  <button
                    onClick={() => handleUpdate("username")}
                    className="save-btn"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => {
                      setEditMode((prev) => ({ ...prev, username: false }));
                      setNewValues((prev) => ({
                        ...prev,
                        currentPasswordForEdit: "",
                      }));
                    }}
                    className="cancel-btn"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="display-group">
                <span>{userData.username}</span>
                <button
                  onClick={() => {
                    setEditMode((prev) => ({ ...prev, username: true }));
                    setNewValues((prev) => ({
                      ...prev,
                      username: userData.username,
                    }));
                  }}
                  className="edit-btn"
                >
                  Editar
                </button>
              </div>
            )}
          </div>

          <div className="info-item">
            <label>Correo electrónico</label>
            {editMode.email ? (
              <div className="edit-group">
                <input
                  type="email"
                  value={newValues.email}
                  onChange={(e) =>
                    setNewValues((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="Nuevo correo"
                  autoComplete="off"
                />
                <input
                  type="password"
                  value={newValues.currentPasswordForEdit}
                  onChange={(e) =>
                    setNewValues((prev) => ({
                      ...prev,
                      currentPasswordForEdit: e.target.value,
                    }))
                  }
                  placeholder="Contraseña actual"
                  autoComplete="new-password"
                />
                <div className="button-group">
                  <button
                    onClick={() => handleUpdate("email")}
                    className="save-btn"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => {
                      setEditMode((prev) => ({ ...prev, email: false }));
                      setNewValues((prev) => ({
                        ...prev,
                        currentPasswordForEdit: "",
                      }));
                    }}
                    className="cancel-btn"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="display-group">
                <span>{userData.email}</span>
                <button
                  onClick={() => {
                    setEditMode((prev) => ({ ...prev, email: true }));
                    setNewValues((prev) => ({
                      ...prev,
                      email: userData.email,
                    }));
                  }}
                  className="edit-btn"
                >
                  Editar
                </button>
              </div>
            )}
          </div>

          <div className="info-item">
            <label>Cambiar contraseña</label>
            <div className="password-group">
              <input
                type="password"
                value={newValues.currentPassword}
                onChange={(e) =>
                  setNewValues((prev) => ({
                    ...prev,
                    currentPassword: e.target.value,
                  }))
                }
                placeholder="Contraseña actual"
                autoComplete="new-password"
                name="current-password-change"
              />
              <input
                type="password"
                value={newValues.newPassword}
                onChange={(e) =>
                  setNewValues((prev) => ({
                    ...prev,
                    newPassword: e.target.value,
                  }))
                }
                placeholder="Nueva contraseña"
                autoComplete="new-password"
                name="new-password-change"
              />
              <button onClick={handlePasswordChange} className="save-btn">
                Actualizar contraseña
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;
