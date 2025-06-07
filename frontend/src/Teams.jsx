import React, { useState, useEffect } from "react";
import "./Teams.css";
import Modal from "./Modal";
import { useModal } from "./useModal";

const Teams = ({ onBack }) => {
  const { modalConfig, showAlert, showSuccess, showError, showConfirm } =
    useModal();
  const [myTeam, setMyTeam] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [selectedGame, setSelectedGame] = useState("lol");
  const [myTournaments, setMyTournaments] = useState([]);
  const [availableTournaments, setAvailableTournaments] = useState([]);
  const [joinCode, setJoinCode] = useState("");

  // Form states
  const [teamName, setTeamName] = useState("");
  const [teamLogo, setTeamLogo] = useState(null);
  const [playerRole, setPlayerRole] = useState("top");
  const [playerNickname, setPlayerNickname] = useState("");
  const [playerOpgg, setPlayerOpgg] = useState("");

  const leaveTournament = async (tournamentId) => {
    showConfirm(
      "¿Estás seguro de que quieres salir de este torneo?",
      async () => {
        try {
          const token = localStorage.getItem("token");
          const response = await fetch("/api/tournament/leave", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ tournamentId, teamId: myTeam.id }),
          });

          if (response.ok) {
            showSuccess("Has salido del torneo");
            fetchTournaments();
          } else {
            const error = await response.json();
            showError(error.message || "Error al salir del torneo");
          }
        } catch (error) {
          showError("Error de conexión");
        }
      },
      "Confirmar salida"
    );
  };

  const registerToTournament = async (tournamentId) => {
    if (!myTeam) {
      showError("Necesitas tener un equipo para inscribirte");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/tournament/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tournamentId, teamId: myTeam.id }),
      });

      if (response.ok) {
        showSuccess("Equipo inscrito exitosamente en el torneo");
        fetchTournaments(); // Actualiza las listas
      } else {
        const error = await response.json();
        showError(error.message || "Error al inscribir el equipo");
      }
    } catch (error) {
      showError("Error de conexión");
    }
  };

  const formatOpggLink = (url) => {
    if (!url) return "";
    return url.startsWith("http://") || url.startsWith("https://")
      ? url
      : `https://${url}`;
  };

  useEffect(() => {
    fetchMyTeam();
  }, [selectedGame]);

  useEffect(() => {
    if (myTeam) {
      fetchTournaments();
    }
  }, [myTeam, selectedGame]);

  const fetchMyTeam = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/team/my-team?game=${selectedGame}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMyTeam(data.team);
      }
    } catch (error) {
      console.error("Error fetching team:", error);
    }
  };

  const fetchTournaments = async () => {
    try {
      const token = localStorage.getItem("token");

      // Obtener torneos en los que estoy inscrito
      if (myTeam) {
        const myResponse = await fetch(
          `/api/tournaments/my-tournaments?teamId=${myTeam.id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (myResponse.ok) {
          const myData = await myResponse.json();
          setMyTournaments(myData.tournaments || []);
        }
      } else {
        setMyTournaments([]);
      }

      // Obtener todos los torneos disponibles del juego
      const availableResponse = await fetch(
        `/api/tournaments/available?game=${selectedGame}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (availableResponse.ok) {
        const availableData = await availableResponse.json();
        // Filtrar los torneos donde ya estás inscrito y ordenar por estado
        const filteredTournaments = (availableData.tournaments || [])
          .filter(
            (tournament) => !myTournaments.some((t) => t.id === tournament.id)
          )
          .sort((a, b) => {
            // Primero los abiertos, luego los cerrados
            if (a.status === "abierto" && b.status === "cerrado") return -1;
            if (a.status === "cerrado" && b.status === "abierto") return 1;
            return 0;
          });
        setAvailableTournaments(filteredTournaments);
      }
    } catch (error) {
      console.error("Error fetching tournaments:", error);
    }
  };

  const isRoleAvailable = (role) => {
    if (!myTeam || !myTeam.players) return true;

    const roleCount = myTeam.players.filter((p) => p.role === role).length;

    if (["top", "jungla", "medio", "adc", "support"].includes(role)) {
      return roleCount < 1;
    } else if (role === "suplente") {
      return roleCount < 5;
    } else if (role === "staff") {
      return roleCount < 2;
    }

    return true;
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();

    if (!isRoleAvailable(playerRole)) {
      showError(`El rol ${playerRole} ya está ocupado en el equipo`);
      return;
    }
    const formData = new FormData();
    formData.append("teamName", teamName);
    formData.append("game", selectedGame);
    formData.append("playerRole", playerRole);
    formData.append("playerNickname", playerNickname);
    formData.append("playerOpgg", playerOpgg);
    if (teamLogo) formData.append("teamLogo", teamLogo);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/team/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        showSuccess("Equipo creado exitosamente");
        setShowCreateForm(false);
        fetchMyTeam();
      } else {
        const error = await response.json();
        showError(error.message || "Error al crear equipo");
      }
    } catch (error) {
      showError("Error de conexión");
    }
  };

  const handleJoinTeam = async () => {
    if (!isRoleAvailable(playerRole)) {
      showError(`El rol ${playerRole} ya está ocupado en el equipo`);
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/team/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: joinCode,
          game: selectedGame,
          playerRole,
          playerNickname,
          playerOpgg,
        }),
      });

      if (response.ok) {
        showSuccess("Te has unido al equipo exitosamente");
        setShowJoinForm(false);
        fetchMyTeam();
      } else {
        const error = await response.json();
        showError(error.message || "Error al unirse al equipo");
      }
    } catch (error) {
      showError("Error de conexión");
    }
  };

  const handleLeaveTeam = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/team/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ teamId: myTeam.id }),
      });

      if (response.ok) {
        showSuccess("Has salido del equipo");
        setMyTeam(null);
        setTimeout(() => {
          onBack();
        }, 1500);
      }
    } catch (error) {
      showError("Error al salir del equipo");
    }
  };

  const confirmLeaveTeam = () => {
    showConfirm(
      "¿Seguro que quieres salir del equipo?",
      handleLeaveTeam,
      "Confirmar"
    );
  };

  const roleIcons = {
    top: "🛡️",
    jungla: "🌲",
    medio: "🎯",
    adc: "🏹",
    support: "💝",
    staff: "🎓",
    suplente: "🪑",
  };

  const roleLabels = {
    top: "Top",
    jungla: "Jungla",
    medio: "Medio",
    adc: "ADC",
    support: "Support",
    staff: "Staff / Coach",
    suplente: "Suplente",
  };

  return (
    <div className="teams-container">
      <Modal {...modalConfig} />

      <div className="teams-header">
        <button onClick={onBack} className="back-button">
          ← Volver
        </button>
        <h1>Equipos</h1>
      </div>

      <div className="game-selector">
        <button
          className={`game-btn ${selectedGame === "lol" ? "active" : ""}`}
          onClick={() => setSelectedGame("lol")}
        >
          League of Legends
        </button>
        <button
          className={`game-btn ${selectedGame === "valorant" ? "active" : ""}`}
          onClick={() => setSelectedGame("valorant")}
        >
          Valorant
        </button>
      </div>

      {!myTeam && !showCreateForm && !showJoinForm && (
        <div className="team-actions">
          <button
            onClick={() => setShowCreateForm(true)}
            className="action-btn create-btn"
          >
            Crear Equipo
          </button>
          <button
            onClick={() => setShowJoinForm(true)}
            className="action-btn join-btn"
          >
            Unirse al Equipo
          </button>
        </div>
      )}

      {showCreateForm && (
        <div className="form-container">
          <h2>Crear Equipo</h2>
          <form onSubmit={handleCreateTeam}>
            <input
              type="text"
              placeholder="Nombre del equipo"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
            />
            <label>
              Logo del equipo:
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setTeamLogo(e.target.files[0])}
              />
            </label>
            <select
              value={playerRole}
              onChange={(e) => setPlayerRole(e.target.value)}
            >
              <option value="top">Top</option>
              <option value="jungla">Jungla</option>
              <option value="medio">Medio</option>
              <option value="adc">ADC</option>
              <option value="support">Support</option>
              <option value="staff">Staff</option>
              <option value="suplente">Suplente</option>
            </select>
            <input
              type="text"
              placeholder="Tu nickname"
              value={playerNickname}
              onChange={(e) => setPlayerNickname(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Link OP.GG"
              value={playerOpgg}
              onChange={(e) => setPlayerOpgg(e.target.value)}
            />
            <div className="form-buttons">
              <button type="submit" className="submit-btn">
                Crear
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="cancel-btn"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {showJoinForm && (
        <div className="form-container">
          <h2>Unirse a un Equipo</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleJoinTeam();
            }}
          >
            <input
              type="text"
              placeholder="Código del equipo"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              required
            />
            <select
              value={playerRole}
              onChange={(e) => setPlayerRole(e.target.value)}
            >
              <option value="top">Top</option>
              <option value="jungla">Jungla</option>
              <option value="medio">Medio</option>
              <option value="adc">ADC</option>
              <option value="support">Support</option>
              <option value="staff">Staff</option>
              <option value="suplente">Suplente</option>
            </select>
            <input
              type="text"
              placeholder="Tu nickname"
              value={playerNickname}
              onChange={(e) => setPlayerNickname(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Link OP.GG"
              value={playerOpgg}
              onChange={(e) => setPlayerOpgg(e.target.value)}
            />
            <div className="form-buttons">
              <button type="submit" className="submit-btn">
                Unirse
              </button>
              <button
                type="button"
                onClick={() => setShowJoinForm(false)}
                className="cancel-btn"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {myTeam && (
        <div className="team-display">
          <div className="team-column-left">
            <div className="team-header-section">
              <div className="team-logo-name">
                {myTeam.logo ? (
                  <img
                    src={myTeam.logo}
                    alt={myTeam.name}
                    className="team-logo"
                  />
                ) : (
                  <div className="team-logo-placeholder">
                    {myTeam.name.charAt(0)}
                  </div>
                )}
                <h2>{myTeam.name}</h2>
              </div>
              <div className="team-actions-small">
                <button onClick={confirmLeaveTeam} className="leave-btn">
                  Salir del Equipo
                </button>

                <div className="team-code">
                  Código: <span>{myTeam.code}</span>
                </div>
              </div>
            </div>

            <div className="players-section">
              <h3>Jugadores</h3>
              <div className="players-list">
                {myTeam.players.map((player, index) => (
                  <div key={index} className="player-card">
                    <div className="player-role">
                      <span className="role-icon">
                        {roleIcons[player.role]}
                      </span>
                      <span className="role-name">
                        {roleLabels[player.role]}
                      </span>
                    </div>
                    <div className="player-info">
                      <span className="player-name">{player.nickname}</span>
                      {player.opgg && (
                        <a
                          href={formatOpggLink(player.opgg)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opgg-link"
                        >
                          OP.GG
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="team-column-right">
            <div className="tournaments-section">
              <h3>Torneos en los que estás inscrito</h3>
              <div className="tournaments-grid">
                {myTournaments.length > 0 ? (
                  myTournaments.map((tournament) => (
                    <div key={tournament.id} className="tournament-card">
                      <h4 className="tournament-title">{tournament.name}</h4>
                      <p>Juego: {tournament.game.toUpperCase()}</p>
                      <p>
                        Fecha: {new Date(tournament.date).toLocaleDateString()}
                      </p>
                      <div className="tournament-status inscrito">Inscrito</div>
                      <button
                        className="leave-tournament-btn"
                        onClick={() => leaveTournament(tournament.id)}
                      >
                        Salir del Torneo
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="no-tournaments">
                    No estás inscrito en ningún torneo
                  </p>
                )}
              </div>
            </div>

            <div className="available-section">
              <h3>Otros torneos de {selectedGame.toUpperCase()}</h3>
              <div className="tournaments-grid">
                {availableTournaments.length > 0 ? (
                  availableTournaments.map((tournament) => {
                    return (
                      <div key={tournament.id} className="tournament-card">
                        <h4 className="tournament-title">{tournament.name}</h4>
                        <p>
                          Fecha:{" "}
                          {new Date(tournament.date).toLocaleDateString()}
                        </p>
                        {tournament.description && (
                          <p className="tournament-description">
                            {tournament.description}
                          </p>
                        )}
                        <button
                          className="register-btn"
                          onClick={() => registerToTournament(tournament.id)}
                          disabled={tournament.status === "cerrado"}
                        >
                          {tournament.status === "cerrado"
                            ? "Cerrado"
                            : "Inscribir Equipo"}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p className="no-tournaments">
                    No hay torneos disponibles actualmente
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Teams;
