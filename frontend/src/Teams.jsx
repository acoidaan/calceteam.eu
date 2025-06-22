import React, { useState, useEffect } from "react";
import "./Teams.css";
import Modal from "./Modal";
import { useModal } from "./useModal";
import Header from "./Header";

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
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [selectedJornada, setSelectedJornada] = useState(1);
  const [totalJornadas, setTotalJornadas] = useState(0);
  const [matchesByJornada, setMatchesByJornada] = useState({});

  // Form states
  const [teamName, setTeamName] = useState("");
  const [teamLogo, setTeamLogo] = useState(null);
  const [playerRole, setPlayerRole] = useState("top");
  const [playerNickname, setPlayerNickname] = useState("");
  const [playerOpgg, setPlayerOpgg] = useState("");

  // Logos de juegos
  const gameLogos = {
    lol: (
      <img
        src="/lol_logo.svg"
        alt="League of Legends"
        className="tournament-game-logo"
      />
    ),
    valorant: (
      <img
        src="/valorant_logo.png"
        alt="Valorant"
        className="tournament-game-logo"
      />
    ),
  };

  const leaveTournament = async (tournamentId) => {
    showConfirm(
      "¿Estás seguro de que quieres salir de este torneo?",
      async () => {
        try {
          const token = localStorage.getItem("accessToken");
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
            // ✅ ARREGLO: Refrescar todo inmediatamente
            await Promise.all([
              fetchTournaments(),
              fetchUpcomingMatches(),
              fetchMyTeam(), // Refrescar el equipo también
            ]);
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
      fetchUpcomingMatches();
    }
  }, [myTeam, selectedGame]);

  const fetchMyTeam = async () => {
    try {
      const token = localStorage.getItem("accessToken");
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
      const token = localStorage.getItem("accessToken");

      if (!myTeam) {
        setMyTournaments([]);
        setAvailableTournaments([]);
        return;
      }

      const myResponse = await fetch(
        `/api/tournaments/my-tournaments?teamId=${myTeam.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      let myTournamentsData = [];

      if (myResponse.ok) {
        const myData = await myResponse.json();
        myTournamentsData = myData.tournaments || [];
        setMyTournaments(myTournamentsData);
      }
    } catch (error) {
      console.error("Error fetching tournaments:", error);
      setMyTournaments([]);
    }
  };

  // Obtener partidos reales de la base de datos
  const fetchUpcomingMatches = async () => {
    if (!myTeam) return;

    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `/api/matches/my-team-matches?teamId=${myTeam.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const matches = data.matches || [];

        console.log("🏆 [DEBUG] Partidos recibidos:", matches);

        // ✅ MEJORADO: Organizar partidos por TORNEO y luego por jornada
        const organizedByTournament = {};
        let maxJornada = 0;

        matches.forEach((match) => {
          const tournamentId = match.tournament_id;
          const jornada = match.jornada;

          // Crear estructura por torneo
          if (!organizedByTournament[tournamentId]) {
            organizedByTournament[tournamentId] = {
              name: match.tournament_name,
              matches: {},
              maxJornada: 0,
            };
          }

          // Organizar por jornada dentro del torneo
          if (!organizedByTournament[tournamentId].matches[jornada]) {
            organizedByTournament[tournamentId].matches[jornada] = [];
          }

          organizedByTournament[tournamentId].matches[jornada].push(match);
          organizedByTournament[tournamentId].maxJornada = Math.max(
            organizedByTournament[tournamentId].maxJornada,
            jornada
          );
          maxJornada = Math.max(maxJornada, jornada);
        });

        console.log("🏆 [DEBUG] Organizado por torneo:", organizedByTournament);

        // ✅ NUEVO: Combinar todas las jornadas de todos los torneos
        const combinedMatches = {};
        for (let jornada = 1; jornada <= maxJornada; jornada++) {
          combinedMatches[jornada] = [];

          Object.values(organizedByTournament).forEach((tournament) => {
            if (tournament.matches[jornada]) {
              // Añadir identificador de torneo a cada partido
              const matchesWithTournament = tournament.matches[jornada].map(
                (match) => ({
                  ...match,
                  tournament_display_name: tournament.name,
                })
              );
              combinedMatches[jornada].push(...matchesWithTournament);
            }
          });
        }

        console.log("🏆 [DEBUG] Jornadas combinadas:", combinedMatches);

        setMatchesByJornada(combinedMatches);
        setTotalJornadas(maxJornada);
        setUpcomingMatches(combinedMatches[selectedJornada] || []);

        // ✅ NUEVO: Guardar info de torneos para mostrar
        setTournamentInfo(organizedByTournament);
      }
    } catch (error) {
      console.error("Error fetching matches:", error);
    }
  };

  // ✅ NUEVO: Estado para información de torneos
  const [tournamentInfo, setTournamentInfo] = useState({});

  useEffect(() => {
    if (matchesByJornada[selectedJornada]) {
      setUpcomingMatches(matchesByJornada[selectedJornada]);
    } else {
      setUpcomingMatches([]);
    }
  }, [selectedJornada, matchesByJornada]);

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
      const token = localStorage.getItem("accessToken");
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
      const token = localStorage.getItem("accessToken");
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
      const token = localStorage.getItem("accessToken");
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
      const token = localStorage.getItem("accessToken");
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
      const token = localStorage.getItem("accessToken");
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
      const token = localStorage.getItem("accessToken");
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

  const handleRegister = async (tournament) => {
    if (!userTeam) {
      showError("Necesitas tener un equipo para inscribirte");
      return;
    }

    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/tournament/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tournamentId: tournament.id,
          teamId: userTeam.id,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showSuccess(data.message);
        // ✅ ARREGLO: Actualizar partidos después de inscribirse
        setTimeout(async () => {
          await Promise.all([fetchTournaments(), fetchUpcomingMatches()]);
        }, 1000); // Pequeño delay para que la BD se actualice
      } else {
        showError(data.message);
      }
    } catch (err) {
      showError("Error al inscribirse en el torneo");
    }
  };

  const handleRemovePlayer = async (playerId) => {
    try {
      const token = localStorage.getItem("accessToken");
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

  // Iconos de roles
  const roleIcons = {
    top: (
      <img
        src="/Top_icon.svg"
        alt="Top"
        style={{ width: "24px", height: "24px" }}
      />
    ),
    jungla: (
      <img
        src="/Jungle_icon.svg"
        alt="Jungle"
        style={{ width: "24px", height: "24px" }}
      />
    ),
    medio: (
      <img
        src="/Middle_icon.svg"
        alt="Mid"
        style={{ width: "24px", height: "24px" }}
      />
    ),
    adc: (
      <img
        src="/Bottom_icon.svg"
        alt="ADC"
        style={{ width: "24px", height: "24px" }}
      />
    ),
    support: (
      <img
        src="/Support_icon.svg"
        alt="Support"
        style={{ width: "24px", height: "24px" }}
      />
    ),
    staff: (
      <img
        src="/role-icons/staff.png"
        alt="Staff"
        style={{ width: "24px", height: "24px" }}
      />
    ),
    suplente: (
      <img
        src="/role-icons/sub.png"
        alt="Suplente"
        style={{ width: "24px", height: "24px" }}
      />
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

  const formatDateToSpanish = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
  };

  const formatTime = (time) => {
    return time.substring(0, 5);
  };

  return (
    <div className="teams-container">
      {/* Video de fondo */}
      <video className="background-video" autoPlay muted loop>
        <source src="/background_wave.mp4" type="video/mp4" />
      </video>
      <div className="video-overlay"></div>

      <Modal {...modalConfig} />

      <Header
        onBack={onBack}
        titleImage="/equipos-title.png"
      />

      <div className="teams-content">
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
                Imagen del equipo:
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
                Nueva imagen del equipo (opcional):
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
                    const token = localStorage.getItem("accessToken");
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
              {/* Sección de próximos partidos */}
              <div className="upcoming-matches-section">
                <h3>Próximos partidos</h3>

                {totalJornadas > 0 ? (
                  <>
                    <div className="jornadas-nav">
                      <button
                        className="jornada-btn"
                        onClick={() =>
                          setSelectedJornada((prev) => Math.max(prev - 1, 1))
                        }
                        disabled={selectedJornada === 1}
                      >
                        ← Anterior
                      </button>
                      <span className="jornada-title">
                        Jornada {selectedJornada}
                      </span>
                      <button
                        className="jornada-btn"
                        onClick={() =>
                          setSelectedJornada((prev) =>
                            Math.min(prev + 1, totalJornadas)
                          )
                        }
                        disabled={selectedJornada === totalJornadas}
                      >
                        Siguiente →
                      </button>
                    </div>

                    {upcomingMatches.length > 0 ? (
                      <div className="matches-list">
                        {upcomingMatches.map((match, index) => {
                          const isHome = match.home_team_id === myTeam.id;
                          const homeTeam = {
                            id: match.home_team_id,
                            name: match.home_team_name,
                            logo: match.home_team_logo,
                          };
                          const awayTeam = {
                            id: match.away_team_id,
                            name: match.away_team_name,
                            logo: match.away_team_logo,
                          };

                          return (
                            <div key={index} className="match-card">
                              <div className="match-tournament-info">
                                <span className="match-tournament-name">
                                  {match.tournament_name}
                                </span>
                                <span className="match-date">
                                  {formatDateToSpanish(match.match_date)}
                                </span>
                              </div>
                              <div className="match-content">
                                <div className="match-time">
                                  {formatTime(match.match_time)}
                                </div>
                                <div className="match-team home">
                                  <span className="team-name">
                                    {homeTeam.name}
                                  </span>
                                  <div className="team-logo">
                                    {homeTeam.logo ? (
                                      <img
                                        src={homeTeam.logo}
                                        alt={homeTeam.name}
                                      />
                                    ) : (
                                      <span className="default-logo">
                                        {homeTeam.name
                                          .substring(0, 2)
                                          .toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="match-vs">VS</div>
                                <div className="match-team away">
                                  <div className="team-logo">
                                    {awayTeam.logo ? (
                                      <img
                                        src={awayTeam.logo}
                                        alt={awayTeam.name}
                                      />
                                    ) : (
                                      <span className="default-logo">
                                        {awayTeam.name
                                          .substring(0, 2)
                                          .toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                  <span className="team-name">
                                    {awayTeam.name}
                                  </span>
                                </div>
                                <div className="match-format">
                                  {match.format}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="no-matches">
                        No hay partidos programados para esta jornada
                      </p>
                    )}
                  </>
                ) : (
                  <p className="no-matches">
                    Inscríbete en torneos para ver tus próximos partidos
                  </p>
                )}
              </div>

              {/* Torneos inscritos */}
              <div className="tournaments-section">
                <h3>Torneos en los que estás inscrito</h3>
                <div className="tournaments-grid">
                  {myTournaments.length > 0 ? (
                    myTournaments.map((tournament) => (
                      <div key={tournament.id} className="tournament-card">
                        <div className="tournament-status-badge inscrito">
                          Inscrito
                        </div>

                        <div className="tournament-header">
                          <div className="tournament-info">
                            <div className="tournament-date">
                              {new Date(tournament.date).toLocaleDateString(
                                "es-ES",
                                {
                                  day: "numeric",
                                  month: "short",
                                }
                              )}
                            </div>
                            <div className="tournament-region">Online</div>
                            <h4 className="tournament-title">
                              {tournament.name}
                            </h4>
                          </div>
                          {gameLogos[tournament.game] || gameLogos.lol}
                        </div>

                        <div className="tournament-actions">
                          <button
                            className="tournament-btn tournament-btn-leave"
                            onClick={() => leaveTournament(tournament.id)}
                          >
                            Salir
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="no-tournaments">
                      No estás inscrito en ningún torneo
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const renderMatchCard = (match, index) => {
  const isHome = match.home_team_id === myTeam.id;
  const homeTeam = {
    id: match.home_team_id,
    name: match.home_team_name,
    logo: match.home_team_logo,
  };
  const awayTeam = {
    id: match.away_team_id,
    name: match.away_team_name,
    logo: match.away_team_logo,
  };

  return (
    <div key={`${match.tournament_id}-${match.id}`} className="match-card">
      <div className="match-tournament-info">
        <span className="match-tournament-name">
          {match.tournament_display_name || match.tournament_name}
        </span>
        <span className="match-date">
          {formatDateToSpanish(match.match_date)}
        </span>
      </div>
      <div className="match-content">
        <div className="match-time">{formatTime(match.match_time)}</div>
        <div className="match-team home">
          <span className="team-name">{homeTeam.name}</span>
          <div className="team-logo">
            {homeTeam.logo ? (
              <img src={homeTeam.logo} alt={homeTeam.name} />
            ) : (
              <span className="default-logo">
                {homeTeam.name.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>
        </div>
        <div className="match-vs">VS</div>
        <div className="match-team away">
          <div className="team-logo">
            {awayTeam.logo ? (
              <img src={awayTeam.logo} alt={awayTeam.name} />
            ) : (
              <span className="default-logo">
                {awayTeam.name.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <span className="team-name">{awayTeam.name}</span>
        </div>
        <div className="match-format">{match.format}</div>
      </div>
    </div>
  );
};

export default Teams;
