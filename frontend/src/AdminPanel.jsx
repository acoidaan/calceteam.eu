import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { useModal } from "./useModal";
import "./AdminPanel.css";

// Funciones de utilidad para fechas
const formatDateToSpanish = (mysqlDate) => {
  if (!mysqlDate) return "";
  const date = new Date(mysqlDate);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatDateToMySQL = (spanishDate) => {
  if (!spanishDate) return null;
  const parts = spanishDate.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const formatDateForInput = (mysqlDate) => {
  if (!mysqlDate) return "";
  return mysqlDate.split("T")[0];
};

const AdminPanel = () => {
  const { modalConfig, showAlert, showSuccess, showError, showConfirm } =
    useModal();
  const [tournaments, setTournaments] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTournament, setEditingTournament] = useState(null);
  const [newTournament, setNewTournament] = useState({
    name: "",
    game: "lol",
    status: "abierto",
    date: "",
    description: "",
  });

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/tournaments", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setTournaments(data.tournaments || []);
  };

  const createTournament = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/tournaments/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newTournament),
    });
    const data = await res.json();
    if (res.ok) {
      showSuccess(data.message);
      setShowCreateForm(false);
      setNewTournament({
        name: "",
        game: "lol",
        status: "abierto",
        date: "",
        description: "",
      });
      fetchTournaments();
    } else {
      showError(data.message || "Error al crear torneo");
    }
  };

  const updateTournament = async () => {
    const token = localStorage.getItem("token");

    // Preparar solo los campos que han cambiado
    const tournamentToUpdate = {};
    const originalTournament = tournaments.find(
      (t) => t.id === editingTournament.id
    );

    // Comparar cada campo y solo incluir los que cambiaron
    if (editingTournament.name !== originalTournament.name) {
      tournamentToUpdate.name = editingTournament.name;
    }
    if (editingTournament.game !== originalTournament.game) {
      tournamentToUpdate.game = editingTournament.game;
    }
    if (editingTournament.status !== originalTournament.status) {
      tournamentToUpdate.status = editingTournament.status;
    }
    if (
      formatDateForInput(editingTournament.date) !==
      formatDateForInput(originalTournament.date)
    ) {
      tournamentToUpdate.date = editingTournament.date;
    }
    if (
      (editingTournament.description || "") !==
      (originalTournament.description || "")
    ) {
      tournamentToUpdate.description = editingTournament.description;
    }

    const res = await fetch(`/api/tournaments/update/${editingTournament.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(tournamentToUpdate),
    });

    const data = await res.json();
    if (res.ok) {
      showSuccess("Torneo actualizado correctamente");
      setEditingTournament(null);
      fetchTournaments();
    } else {
      showError(data.message || "Error al actualizar torneo");
    }
  };

  const deleteTournament = async (id) => {
    showConfirm(
      "¿Estás seguro de que quieres eliminar este torneo?",
      async () => {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/tournaments/delete/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          showSuccess("Torneo eliminado correctamente");
          fetchTournaments();
        } else {
          showError("Error al eliminar torneo");
        }
      },
      "Confirmar eliminación"
    );
  };

  return (
    <div className="admin-panel">
      <Modal {...modalConfig} />

      <div className="admin-header">
        <h2>Panel de Administración - Torneos</h2>
        <button
          className="create-tournament-btn"
          onClick={() => setShowCreateForm(true)}
        >
          + Crear Torneo
        </button>
      </div>

      {showCreateForm && (
        <div className="admin-form-container">
          <h3>Crear nuevo torneo</h3>
          <div className="admin-form">
            <input
              placeholder="Nombre del torneo"
              value={newTournament.name}
              onChange={(e) =>
                setNewTournament({ ...newTournament, name: e.target.value })
              }
            />
            <select
              value={newTournament.game}
              onChange={(e) =>
                setNewTournament({ ...newTournament, game: e.target.value })
              }
            >
              <option value="lol">League of Legends</option>
              <option value="valorant">Valorant</option>
            </select>
            <select
              value={newTournament.status}
              onChange={(e) =>
                setNewTournament({ ...newTournament, status: e.target.value })
              }
            >
              <option value="abierto">Abierto</option>
              <option value="cerrado">Cerrado</option>
            </select>
            <input
              type="date"
              value={newTournament.date}
              onChange={(e) =>
                setNewTournament({ ...newTournament, date: e.target.value })
              }
            />
            <textarea
              placeholder="Descripción del torneo"
              value={newTournament.description}
              onChange={(e) =>
                setNewTournament({
                  ...newTournament,
                  description: e.target.value,
                })
              }
              rows="3"
            />
            <div className="form-buttons">
              <button className="save-btn" onClick={createTournament}>
                Crear Torneo
              </button>
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewTournament({
                    name: "",
                    game: "lol",
                    status: "abierto",
                    date: "",
                    description: "",
                  });
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tournaments-admin-list">
        <h3>Torneos existentes</h3>
        {tournaments.length === 0 ? (
          <p className="no-tournaments">No hay torneos creados</p>
        ) : (
          <div className="tournaments-table">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Juego</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tournaments.map((t) => (
                  <tr key={t.id}>
                    {editingTournament?.id === t.id ? (
                      <>
                        <td>
                          <input
                            value={editingTournament.name}
                            onChange={(e) =>
                              setEditingTournament({
                                ...editingTournament,
                                name: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
                          <select
                            value={editingTournament.game}
                            onChange={(e) =>
                              setEditingTournament({
                                ...editingTournament,
                                game: e.target.value,
                              })
                            }
                          >
                            <option value="lol">LoL</option>
                            <option value="valorant">Valorant</option>
                          </select>
                        </td>
                        <td>
                          <select
                            value={editingTournament.status}
                            onChange={(e) =>
                              setEditingTournament({
                                ...editingTournament,
                                status: e.target.value,
                              })
                            }
                          >
                            <option value="abierto">Abierto</option>
                            <option value="cerrado">Cerrado</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="date"
                            value={formatDateForInput(editingTournament.date)}
                            onChange={(e) =>
                              setEditingTournament({
                                ...editingTournament,
                                date: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
                          <textarea
                            value={editingTournament.description || ""}
                            onChange={(e) =>
                              setEditingTournament({
                                ...editingTournament,
                                description: e.target.value,
                              })
                            }
                            rows="2"
                          />
                        </td>
                        <td>
                          <button
                            className="save-btn"
                            onClick={updateTournament}
                          >
                            Guardar
                          </button>
                          <button
                            className="cancel-btn"
                            onClick={() => setEditingTournament(null)}
                          >
                            Cancelar
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{t.name}</td>
                        <td>{t.game.toUpperCase()}</td>
                        <td>
                          <span className={`status-badge ${t.status}`}>
                            {t.status}
                          </span>
                        </td>
                        <td>{formatDateToSpanish(t.date)}</td>
                        <td>{t.description || "-"}</td>
                        <td>
                          <button
                            className="edit-btn"
                            onClick={() => setEditingTournament(t)}
                          >
                            Editar
                          </button>
                          <button
                            className="delete-btn"
                            onClick={() => deleteTournament(t.id)}
                          >
                            Eliminar
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
