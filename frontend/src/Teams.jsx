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
  const [showEditTeam, setShowEditTeam] = useState(false);
  const [showEditPlayer, setShowEditPlayer] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [isTeamCreator, setIsTeamCreator] = useState(false);

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
            setTimeout(() => {
              fetchTournaments();
            }, 500);
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
        setTimeout(() => {
          fetchTournaments();
        }, 500);
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

        if (data.team) {
          const tokenPayload = JSON.parse(atob(token.split(".")[1]));
          const currentUserId = tokenPayload.id;
          setIsTeamCreator(data.team.createdBy === currentUserId);
        }
      }
    } catch (error) {
      console.error("Error fetching team:", error);
    }
  };

  const fetchTournaments = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!myTeam) {
        setMyTournaments([]);
        setAvailableTournaments([]);
        return;
      }

      const [myResponse, availableResponse] = await Promise.all([
        fetch(`/api/tournaments/my-tournaments?teamId=${myTeam.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/tournaments/available?game=${selectedGame}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      let myTournamentsData = [];
      let availableTournamentsData = [];

      if (myResponse.ok) {
        const myData = await myResponse.json();
        myTournamentsData = myData.tournaments || [];
        setMyTournaments(myTournamentsData);
      }

      if (availableResponse.ok) {
        const availableData = await availableResponse.json();
        const filteredTournaments = (availableData.tournaments || [])
          .filter(
            (tournament) =>
              !myTournamentsData.some((myT) => myT.id === tournament.id)
          )
          .sort((a, b) => {
            if (a.status === "abierto" && b.status === "cerrado") return -1;
            if (a.status === "cerrado" && b.status === "abierto") return 1;
            return 0;
          });

        setAvailableTournaments(filteredTournaments);
      }
    } catch (error) {
      console.error("Error fetching tournaments:", error);
      setMyTournaments([]);
      setAvailableTournaments([]);
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

  const handleDeleteTeam = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/team/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ teamId: myTeam.id }),
      });

      if (response.ok) {
        showSuccess("Equipo eliminado exitosamente");
        setMyTeam(null);
        setTimeout(() => {
          onBack();
        }, 1500);
      } else {
        const error = await response.json();
        showError(error.message || "Error al eliminar equipo");
      }
    } catch (error) {
      showError("Error de conexión");
    }
  };

  const confirmDeleteTeam = () => {
    showConfirm(
      "¿Estás seguro de que quieres ELIMINAR el equipo? Esta acción no se puede deshacer.",
      handleDeleteTeam,
      "Eliminar Equipo"
    );
  };

  const handleEditTeam = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("teamId", myTeam.id);
    formData.append("teamName", teamName);
    if (teamLogo) formData.append("teamLogo", teamLogo);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/team/update", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        showSuccess("Equipo actualizado exitosamente");
        setShowEditTeam(false);
        setTeamName("");
        setTeamLogo(null);
        fetchMyTeam();
      } else {
        const error = await response.json();
        showError(error.message || "Error al actualizar equipo");
      }
    } catch (error) {
      showError("Error de conexión");
    }
  };

  const handleEditPlayer = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/team/update-player", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teamId: myTeam.id,
          playerId: currentPlayer.userId,
          nickname: playerNickname,
          role: playerRole,
          opgg: playerOpgg,
        }),
      });

      if (response.ok) {
        showSuccess("Jugador actualizado exitosamente");
        setShowEditPlayer(false);
        setCurrentPlayer(null);
        setPlayerNickname("");
        setPlayerRole("top");
        setPlayerOpgg("");
        fetchMyTeam();
      } else {
        const error = await response.json();
        showError(error.message || "Error al actualizar jugador");
      }
    } catch (error) {
      showError("Error de conexión");
    }
  };

  const handleRemovePlayer = async (playerId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/team/remove-player", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teamId: myTeam.id,
          playerId: playerId,
        }),
      });

      if (response.ok) {
        showSuccess("Jugador eliminado del equipo");
        fetchMyTeam();
      } else {
        const error = await response.json();
        showError(error.message || "Error al eliminar jugador");
      }
    } catch (error) {
      showError("Error de conexión");
    }
  };

  const confirmRemovePlayer = (player) => {
    showConfirm(
      `¿Seguro que quieres eliminar a ${player.nickname} del equipo?`,
      () => handleRemovePlayer(player.userId),
      "Eliminar"
    );
  };

  const openEditTeam = () => {
    setTeamName(myTeam.name);
    setTeamLogo(null);
    setShowEditTeam(true);
  };

  const openEditPlayer = (player) => {
    setCurrentPlayer(player);
    setPlayerNickname(player.nickname);
    setPlayerRole(player.role);
    setPlayerOpgg(player.opgg || "");
    setShowEditPlayer(true);
  };

  // SVG Icons para roles - aquí puedes reemplazarlos con tus SVGs específicos
  const roleIcons = {
    top: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z" />
      </svg>
    ),
    jungla: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11A3,3 0 0,1 22,14A3,3 0 0,1 19,17C17.21,17 15.72,15.96 15.18,14.5H8.82C8.28,15.96 6.79,17 5,17A3,3 0 0,1 2,14A3,3 0 0,1 5,11A3,3 0 0,1 8,14V15H16V14A3,3 0 0,1 19,11Z" />
      </svg>
    ),
    medio: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z" />
      </svg>
    ),
    adc: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M6,2A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H10A2,2 0 0,0 12,20V16L16,20L20,16V4A2,2 0 0,0 18,2H6M6,4H18V14.5L16,16.5L12,12.5V4H10V12H6V4Z" />
      </svg>
    ),
    support: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5 2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z" />
      </svg>
    ),
    staff: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12,3L1,9L12,15L21,10.09V17H23V9M5,13.18V17.18L12,21L19,17.18V13.18L12,17L5,13.18Z" />
      </svg>
    ),
    suplente: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M20,18V20H4V18L6,16V10C6,7.87 7.36,6.1 9.5,5.35C9.5,5.25 9.5,5.13 9.5,5A2.5,2.5 0 0,1 12,2.5A2.5,2.5 0 0,1 14.5,5C14.5,5.13 14.5,5.25 14.5,5.35C16.64,6.1 18,7.87 18,10V16L20,18Z" />
      </svg>
    ),
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
      {/* Video de fondo */}
      <video className="background-video" autoPlay muted loop>
        <source src="/background_wave.mp4" type="video/mp4" />
      </video>
      <div className="video-overlay"></div>

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

      {showEditTeam && (
        <div className="form-container">
          <h2>Editar Equipo</h2>
          <form onSubmit={handleEditTeam}>
            <input
              type="text"
              placeholder="Nombre del equipo"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
            />
            <label>
              Nuevo logo del equipo (opcional):
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setTeamLogo(e.target.files[0])}
              />
            </label>
            <div className="form-buttons">
              <button type="submit" className="submit-btn">
                Actualizar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEditTeam(false);
                  setTeamName("");
                  setTeamLogo(null);
                }}
                className="cancel-btn"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {showEditPlayer && currentPlayer && (
        <div className="form-container">
          <h2>Editar Jugador: {currentPlayer.nickname}</h2>
          <form onSubmit={handleEditPlayer}>
            <input
              type="text"
              placeholder="Nickname"
              value={playerNickname}
              onChange={(e) => setPlayerNickname(e.target.value)}
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
              placeholder="Link OP.GG"
              value={playerOpgg}
              onChange={(e) => setPlayerOpgg(e.target.value)}
            />
            <div className="form-buttons">
              <button type="submit" className="submit-btn">
                Actualizar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEditPlayer(false);
                  setCurrentPlayer(null);
                  setPlayerNickname("");
                  setPlayerRole("top");
                  setPlayerOpgg("");
                }}
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
              <div className="team-main-info">
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
                  {isTeamCreator && (
                    <>
                      <button onClick={openEditTeam} className="edit-btn">
                        Editar Equipo
                      </button>
                      <button
                        onClick={confirmDeleteTeam}
                        className="delete-btn"
                      >
                        Eliminar Equipo
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="team-code">
                Código: <span>{myTeam.code}</span>
              </div>
            </div>

            <div className="players-section">
              <h3>Jugadores</h3>
              <div className="players-list">
                {myTeam.players.map((player, index) => {
                  const token = localStorage.getItem("token");
                  const tokenPayload = JSON.parse(atob(token.split(".")[1]));
                  const currentUserId = tokenPayload.id;

                  const isCurrentUser = player.userId === currentUserId;
                  const canEdit = isTeamCreator || isCurrentUser;
                  const canRemove = isTeamCreator && !isCurrentUser;

                  return (
                    <div key={index} className="player-card">
                      <div className="player-role">
                        <div className="role-icon">
                          {roleIcons[player.role]}
                        </div>
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
                      <div className="player-actions">
                        {canEdit && (
                          <button
                            onClick={() => openEditPlayer(player)}
                            className="edit-player-btn"
                            title="Editar jugador"
                          >
                            ✏️
                          </button>
                        )}
                        {canRemove && (
                          <button
                            onClick={() => confirmRemovePlayer(player)}
                            className="remove-player-btn"
                            title="Eliminar jugador"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
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
