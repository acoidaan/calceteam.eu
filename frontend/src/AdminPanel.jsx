import { useState, useEffect } from "react";
import { useModal } from "./useModal";
import Modal from "./Modal";

const AdminPanel = () => {
  const { modalConfig, showError, showSuccess } = useModal();
  const [activeTab, setActiveTab] = useState("tournaments");
  const [tournaments, setTournaments] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [loading, setLoading] = useState(false);

  // Estados para formularios
  const [tournamentForm, setTournamentForm] = useState({
    name: "",
    game: "lol",
    status: "abierto",
    date: "",
    description: "",
  });

  const [editingTournament, setEditingTournament] = useState(null);
  const [editingMatch, setEditingMatch] = useState(null);

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (activeTab === "matches") {
      fetchMatches();
    }
  }, [activeTab, selectedTournament]);

  const fetchTournaments = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/tournaments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTournaments(data.tournaments || []);
    } catch (err) {
      showError("Error al cargar torneos");
    }
  };

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("accessToken");
      const url = selectedTournament
        ? `/api/admin/matches?tournamentId=${selectedTournament}`
        : "/api/admin/matches";

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMatches(data.matches || []);
    } catch (err) {
      showError("Error al cargar partidos");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTournament = async (e) => {
    e.preventDefault();

    if (!tournamentForm.name || !tournamentForm.date) {
      showError("Nombre y fecha son requeridos");
      return;
    }

    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/tournaments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(tournamentForm),
      });

      const data = await res.json();

      if (res.ok) {
        showSuccess(data.message);
        setTournamentForm({
          name: "",
          game: "lol",
          status: "abierto",
          date: "",
          description: "",
        });
        fetchTournaments();
      } else {
        showError(data.message);
      }
    } catch (err) {
      showError("Error al crear torneo");
    }
  };

  const handleUpdateTournament = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(
        `/api/tournaments/update/${editingTournament.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(editingTournament),
        }
      );

      const data = await res.json();

      if (res.ok) {
        showSuccess(data.message);
        setEditingTournament(null);
        fetchTournaments();
      } else {
        showError(data.message);
      }
    } catch (err) {
      showError("Error al actualizar torneo");
    }
  };

  const handleDeleteTournament = async (tournamentId) => {
    if (
      !confirm(
        "¿Estás seguro de eliminar este torneo? Se eliminarán todos los partidos y estadísticas asociadas."
      )
    ) {
      return;
    }

    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`/api/tournaments/delete/${tournamentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (res.ok) {
        showSuccess(data.message);
        fetchTournaments();
      } else {
        showError(data.message);
      }
    } catch (err) {
      showError("Error al eliminar torneo");
    }
  };

  const handleUpdateMatch = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`/api/admin/matches/${editingMatch.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          match_date: editingMatch.match_date,
          match_time: editingMatch.match_time,
          match_format: editingMatch.match_format,
          score_team1: editingMatch.score_team1,
          score_team2: editingMatch.score_team2,
          status: editingMatch.status,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showSuccess(data.message);
        setEditingMatch(null);
        fetchMatches();
      } else {
        showError(data.message);
      }
    } catch (err) {
      showError("Error al actualizar partido");
    }
  };

  const handleRegenerateMatches = async (tournamentId) => {
    if (
      !confirm(
        "¿Regenerar todos los partidos? Se eliminarán los partidos existentes y se crearán nuevos."
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("accessToken");
      const res = await fetch(
        `/api/admin/tournament/${tournamentId}/regenerate-matches`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      if (res.ok) {
        showSuccess(data.message);
        fetchMatches();
      } else {
        showError(data.message);
      }
    } catch (err) {
      showError("Error al regenerar partidos");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("es-ES");
  };

  const formatDateTime = (date, time) => {
    if (!date || !time) return "TBD";
    const dateObj = new Date(`${date}T${time}`);
    return dateObj.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      style={{
        background: "#1a1a1a",
        padding: "2rem",
        borderRadius: "15px",
        color: "white",
      }}
    >
      <Modal {...modalConfig} />

      <h2 style={{ color: "#00aaff", marginBottom: "2rem" }}>
        Panel de Administración
      </h2>

      {/* Pestañas */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        <button
          onClick={() => setActiveTab("tournaments")}
          style={{
            padding: "0.75rem 1.5rem",
            background: activeTab === "tournaments" ? "#00aaff" : "#333",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          Gestión de Torneos
        </button>
        <button
          onClick={() => setActiveTab("matches")}
          style={{
            padding: "0.75rem 1.5rem",
            background: activeTab === "matches" ? "#00aaff" : "#333",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          Gestión de Partidos
        </button>
      </div>

      {/* GESTIÓN DE TORNEOS */}
      {activeTab === "tournaments" && (
        <>
          {/* Formulario crear torneo */}
          <div
            style={{
              background: "#2a2a2a",
              padding: "2rem",
              borderRadius: "10px",
              marginBottom: "2rem",
            }}
          >
            <h3 style={{ color: "#00aaff", marginBottom: "1.5rem" }}>
              {editingTournament ? "Editar Torneo" : "Crear Nuevo Torneo"}
            </h3>

            <form
              onSubmit={
                editingTournament
                  ? handleUpdateTournament
                  : handleCreateTournament
              }
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <input
                  type="text"
                  placeholder="Nombre del torneo"
                  value={
                    editingTournament
                      ? editingTournament.name
                      : tournamentForm.name
                  }
                  onChange={(e) =>
                    editingTournament
                      ? setEditingTournament({
                          ...editingTournament,
                          name: e.target.value,
                        })
                      : setTournamentForm({
                          ...tournamentForm,
                          name: e.target.value,
                        })
                  }
                  style={{
                    padding: "0.75rem",
                    background: "#1a1a1a",
                    border: "1px solid #444",
                    borderRadius: "8px",
                    color: "white",
                  }}
                  required
                />

                <select
                  value={
                    editingTournament
                      ? editingTournament.game
                      : tournamentForm.game
                  }
                  onChange={(e) =>
                    editingTournament
                      ? setEditingTournament({
                          ...editingTournament,
                          game: e.target.value,
                        })
                      : setTournamentForm({
                          ...tournamentForm,
                          game: e.target.value,
                        })
                  }
                  style={{
                    padding: "0.75rem",
                    background: "#1a1a1a",
                    border: "1px solid #444",
                    borderRadius: "8px",
                    color: "white",
                  }}
                >
                  <option value="lol">League of Legends</option>
                  <option value="valorant">Valorant</option>
                </select>

                <select
                  value={
                    editingTournament
                      ? editingTournament.status
                      : tournamentForm.status
                  }
                  onChange={(e) =>
                    editingTournament
                      ? setEditingTournament({
                          ...editingTournament,
                          status: e.target.value,
                        })
                      : setTournamentForm({
                          ...tournamentForm,
                          status: e.target.value,
                        })
                  }
                  style={{
                    padding: "0.75rem",
                    background: "#1a1a1a",
                    border: "1px solid #444",
                    borderRadius: "8px",
                    color: "white",
                  }}
                >
                  <option value="abierto">Abierto</option>
                  <option value="cerrado">Cerrado</option>
                </select>

                <input
                  type="date"
                  value={
                    editingTournament
                      ? editingTournament.date?.split("T")[0]
                      : tournamentForm.date
                  }
                  onChange={(e) =>
                    editingTournament
                      ? setEditingTournament({
                          ...editingTournament,
                          date: e.target.value,
                        })
                      : setTournamentForm({
                          ...tournamentForm,
                          date: e.target.value,
                        })
                  }
                  style={{
                    padding: "0.75rem",
                    background: "#1a1a1a",
                    border: "1px solid #444",
                    borderRadius: "8px",
                    color: "white",
                  }}
                  required
                />
              </div>

              <textarea
                placeholder="Descripción del torneo (opcional)"
                value={
                  editingTournament
                    ? editingTournament.description || ""
                    : tournamentForm.description
                }
                onChange={(e) =>
                  editingTournament
                    ? setEditingTournament({
                        ...editingTournament,
                        description: e.target.value,
                      })
                    : setTournamentForm({
                        ...tournamentForm,
                        description: e.target.value,
                      })
                }
                rows="3"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  background: "#1a1a1a",
                  border: "1px solid #444",
                  borderRadius: "8px",
                  color: "white",
                  marginBottom: "1rem",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />

              <div style={{ display: "flex", gap: "1rem" }}>
                <button
                  type="submit"
                  style={{
                    padding: "0.75rem 2rem",
                    background: "#00aaff",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  {editingTournament ? "Actualizar Torneo" : "Crear Torneo"}
                </button>

                {editingTournament && (
                  <button
                    type="button"
                    onClick={() => setEditingTournament(null)}
                    style={{
                      padding: "0.75rem 2rem",
                      background: "#666",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: "600",
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Lista de torneos */}
          <div
            style={{
              background: "#2a2a2a",
              padding: "2rem",
              borderRadius: "10px",
            }}
          >
            <h3 style={{ color: "#00aaff", marginBottom: "1.5rem" }}>
              Torneos Existentes
            </h3>

            {tournaments.length === 0 ? (
              <p
                style={{ color: "#888", textAlign: "center", padding: "2rem" }}
              >
                No hay torneos creados
              </p>
            ) : (
              <div style={{ display: "grid", gap: "1rem" }}>
                {tournaments.map((tournament) => (
                  <div
                    key={tournament.id}
                    style={{
                      background: "#1a1a1a",
                      padding: "1.5rem",
                      borderRadius: "8px",
                      border: "1px solid #444",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <h4 style={{ color: "white", margin: "0 0 0.5rem 0" }}>
                          {tournament.name}
                        </h4>
                        <div
                          style={{
                            display: "flex",
                            gap: "1rem",
                            fontSize: "0.9rem",
                            color: "#ccc",
                          }}
                        >
                          <span>🎮 {tournament.game.toUpperCase()}</span>
                          <span>📅 {formatDate(tournament.date)}</span>
                          <span
                            style={{
                              background:
                                tournament.status === "abierto"
                                  ? "#10b981"
                                  : "#ef4444",
                              color: "white",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "4px",
                              fontSize: "0.8rem",
                              fontWeight: "600",
                            }}
                          >
                            {tournament.status.toUpperCase()}
                          </span>
                        </div>
                        {tournament.description && (
                          <p
                            style={{
                              color: "#aaa",
                              margin: "0.5rem 0 0 0",
                              fontSize: "0.9rem",
                            }}
                          >
                            {tournament.description}
                          </p>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          onClick={() => setEditingTournament(tournament)}
                          style={{
                            padding: "0.5rem 1rem",
                            background: "#0066cc",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                          }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleRegenerateMatches(tournament.id)}
                          style={{
                            padding: "0.5rem 1rem",
                            background: "#f59e0b",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                          }}
                        >
                          Regenerar Partidos
                        </button>
                        <button
                          onClick={() => handleDeleteTournament(tournament.id)}
                          style={{
                            padding: "0.5rem 1rem",
                            background: "#dc2626",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* GESTIÓN DE PARTIDOS */}
      {activeTab === "matches" && (
        <>
          {/* Filtros */}
          <div
            style={{
              background: "#2a2a2a",
              padding: "1.5rem",
              borderRadius: "10px",
              marginBottom: "2rem",
            }}
          >
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <label style={{ color: "#ccc" }}>Filtrar por torneo:</label>
              <select
                value={selectedTournament}
                onChange={(e) => setSelectedTournament(e.target.value)}
                style={{
                  padding: "0.5rem",
                  background: "#1a1a1a",
                  border: "1px solid #444",
                  borderRadius: "6px",
                  color: "white",
                  minWidth: "200px",
                }}
              >
                <option value="">Todos los torneos</option>
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </option>
                ))}
              </select>
              <button
                onClick={fetchMatches}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#00aaff",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Actualizar
              </button>
            </div>
          </div>

          {/* Lista de partidos */}
          <div
            style={{
              background: "#2a2a2a",
              padding: "2rem",
              borderRadius: "10px",
            }}
          >
            <h3 style={{ color: "#00aaff", marginBottom: "1.5rem" }}>
              Gestión de Partidos
              {loading && (
                <span style={{ color: "#f59e0b", marginLeft: "1rem" }}>
                  Cargando...
                </span>
              )}
            </h3>

            {matches.length === 0 ? (
              <p
                style={{ color: "#888", textAlign: "center", padding: "2rem" }}
              >
                No hay partidos{" "}
                {selectedTournament ? "para este torneo" : "creados"}
              </p>
            ) : (
              <div style={{ display: "grid", gap: "1rem" }}>
                {matches.map((match) => (
                  <div
                    key={match.id}
                    style={{
                      background: "#1a1a1a",
                      padding: "1.5rem",
                      borderRadius: "8px",
                      border: "1px solid #444",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "1rem",
                            marginBottom: "0.5rem",
                          }}
                        >
                          <h4 style={{ color: "white", margin: 0 }}>
                            {match.tournament_name}
                          </h4>
                          <span
                            style={{
                              background: "#333",
                              color: "#ccc",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "4px",
                              fontSize: "0.8rem",
                            }}
                          >
                            Jornada {match.jornada}
                          </span>
                          <span
                            style={{
                              background:
                                match.status === "pending"
                                  ? "#f59e0b"
                                  : match.status === "completed"
                                    ? "#10b981"
                                    : "#6b7280",
                              color: "white",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "4px",
                              fontSize: "0.8rem",
                            }}
                          >
                            {match.status}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "2rem",
                            fontSize: "1.1rem",
                          }}
                        >
                          <span style={{ color: "white", fontWeight: "600" }}>
                            {match.team1_name}
                          </span>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            <span
                              style={{
                                background: "#333",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "4px",
                              }}
                            >
                              {match.score_team1}
                            </span>
                            <span style={{ color: "#666" }}>-</span>
                            <span
                              style={{
                                background: "#333",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "4px",
                              }}
                            >
                              {match.score_team2}
                            </span>
                          </div>
                          <span style={{ color: "white", fontWeight: "600" }}>
                            {match.team2_name}
                          </span>
                        </div>

                        <div
                          style={{
                            marginTop: "0.5rem",
                            fontSize: "0.9rem",
                            color: "#ccc",
                          }}
                        >
                          📅{" "}
                          {formatDateTime(match.match_date, match.match_time)} •{" "}
                          {match.match_format}
                        </div>
                      </div>

                      <button
                        onClick={() => setEditingMatch(match)}
                        style={{
                          padding: "0.5rem 1rem",
                          background: "#0066cc",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "0.9rem",
                        }}
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal editar partido */}
          {editingMatch && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                background: "rgba(0, 0, 0, 0.8)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  background: "#1a1a1a",
                  padding: "2rem",
                  borderRadius: "15px",
                  border: "1px solid #444",
                  maxWidth: "500px",
                  width: "90%",
                  color: "white",
                }}
              >
                <h3 style={{ color: "#00aaff", marginBottom: "1.5rem" }}>
                  Editar Partido
                </h3>

                <form onSubmit={handleUpdateMatch}>
                  <div style={{ marginBottom: "1rem" }}>
                    <p style={{ color: "#ccc", margin: "0 0 1rem 0" }}>
                      {editingMatch.team1_name} vs {editingMatch.team2_name}
                    </p>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "1rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          color: "#ccc",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Fecha
                      </label>
                      <input
                        type="date"
                        value={editingMatch.match_date?.split("T")[0] || ""}
                        onChange={(e) =>
                          setEditingMatch({
                            ...editingMatch,
                            match_date: e.target.value,
                          })
                        }
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          background: "#2a2a2a",
                          border: "1px solid #444",
                          borderRadius: "6px",
                          color: "white",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          color: "#ccc",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Hora
                      </label>
                      <input
                        type="time"
                        value={editingMatch.match_time || ""}
                        onChange={(e) =>
                          setEditingMatch({
                            ...editingMatch,
                            match_time: e.target.value,
                          })
                        }
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          background: "#2a2a2a",
                          border: "1px solid #444",
                          borderRadius: "6px",
                          color: "white",
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "1rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          color: "#ccc",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Formato
                      </label>
                      <select
                        value={editingMatch.match_format || "BO3"}
                        onChange={(e) =>
                          setEditingMatch({
                            ...editingMatch,
                            match_format: e.target.value,
                          })
                        }
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          background: "#2a2a2a",
                          border: "1px solid #444",
                          borderRadius: "6px",
                          color: "white",
                        }}
                      >
                        <option value="BO1">BO1</option>
                        <option value="BO3">BO3</option>
                        <option value="BO5">BO5</option>
                      </select>
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          color: "#ccc",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Score {editingMatch.team1_name}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingMatch.score_team1 || 0}
                        onChange={(e) =>
                          setEditingMatch({
                            ...editingMatch,
                            score_team1: parseInt(e.target.value) || 0,
                          })
                        }
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          background: "#2a2a2a",
                          border: "1px solid #444",
                          borderRadius: "6px",
                          color: "white",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          color: "#ccc",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Score {editingMatch.team2_name}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingMatch.score_team2 || 0}
                        onChange={(e) =>
                          setEditingMatch({
                            ...editingMatch,
                            score_team2: parseInt(e.target.value) || 0,
                          })
                        }
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          background: "#2a2a2a",
                          border: "1px solid #444",
                          borderRadius: "6px",
                          color: "white",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: "1.5rem" }}>
                    <label
                      style={{
                        display: "block",
                        color: "#ccc",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Estado
                    </label>
                    <select
                      value={editingMatch.status || "pending"}
                      onChange={(e) =>
                        setEditingMatch({
                          ...editingMatch,
                          status: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        background: "#2a2a2a",
                        border: "1px solid #444",
                        borderRadius: "6px",
                        color: "white",
                      }}
                    >
                      <option value="pending">Pendiente</option>
                      <option value="completed">Completado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", gap: "1rem" }}>
                    <button
                      type="submit"
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        background: "#00aaff",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "600",
                      }}
                    >
                      Guardar Cambios
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMatch(null)}
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        background: "#666",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "600",
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminPanel;
