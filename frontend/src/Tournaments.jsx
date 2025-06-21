import { useEffect, useState } from "react";
import AdminPanel from "./AdminPanel";
import "./Tournaments.css";
import Modal from "./Modal";
import { useModal } from "./useModal";
import Header from "./Header";

// Funciones de utilidad para fechas
const formatDateToSpanish = (mysqlDate) => {
  if (!mysqlDate) return "";
  const date = new Date(mysqlDate);
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
};

const formatDateTime = (date, time) => {
  console.log("formatDateTime input:", { date, time }); // Debug

  if (!date || !time) return "TBD";

  try {
    // Convertir date a string si es un objeto Date
    let dateStr = date;
    if (date instanceof Date) {
      dateStr = date.toISOString().split("T")[0];
    } else if (typeof date === "string" && date.includes("T")) {
      // Si viene como ISO string, extraer solo la fecha
      dateStr = date.split("T")[0];
    }

    console.log("dateStr procesado:", dateStr); // Debug

    // Verificar formato YYYY-MM-DD
    if (
      !dateStr ||
      typeof dateStr !== "string" ||
      !dateStr.match(/^\d{4}-\d{2}-\d{2}$/)
    ) {
      console.warn("Formato de fecha inválido:", dateStr);
      return "Fecha inválida";
    }

    // Parsear fecha manualmente
    const [year, month, day] = dateStr.split("-");

    // Verificar que time tenga el formato correcto
    if (!time || typeof time !== "string" || !time.includes(":")) {
      console.warn("Formato de hora inválido:", time);
      return "Hora inválida";
    }

    const [hour, minute] = time.split(":");

    // Crear objeto Date
    const dateObj = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute) || 0
    );

    // Verificar que la fecha sea válida
    if (isNaN(dateObj.getTime())) {
      console.warn("Fecha inválida creada:", {
        year,
        month,
        day,
        hour,
        minute,
      });
      return "Fecha inválida";
    }

    console.log("Fecha creada exitosamente:", dateObj); // Debug

    return dateObj.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    console.error("Error en formatDateTime:", error);
    return "Error de fecha";
  }
};

const Tournaments = ({ onBack }) => {
  const { modalConfig, showError, showSuccess } = useModal();
  const [tournaments, setTournaments] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [userTeam, setUserTeam] = useState(null);

  // Logos de juegos - sin filtro, normales
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

  useEffect(() => {
    fetchTournaments();
    checkAdmin();
    fetchUserTeam();
  }, []);

  const fetchTournaments = async () => {
    try {
      const res = await fetch("/api/tournaments");
      const data = await res.json();

      // Ordenar torneos: primero abiertos, luego cerrados
      const sortedTournaments = (data.tournaments || []).sort((a, b) => {
        if (a.status === "abierto" && b.status === "cerrado") return -1;
        if (a.status === "cerrado" && b.status === "abierto") return 1;
        return 0;
      });

      setTournaments(sortedTournaments);
    } catch (err) {
      showError("Error al cargar torneos");
    }
  };

  const fetchUserTeam = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/team/my-team?game=lol", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUserTeam(data.team);
    } catch (err) {
      console.log("No se pudo obtener equipo del usuario");
    }
  };

  const checkAdmin = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/user/is-admin", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setIsAdmin(data.isAdmin);
  };

  const handleRegister = async (tournament) => {
    if (!userTeam) {
      showError("Necesitas tener un equipo para inscribirte");
      return;
    }

    try {
      const token = localStorage.getItem("token");
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
        // Actualizar torneos para reflejar el cambio
        fetchTournaments();
      } else {
        showError(data.message);
      }
    } catch (err) {
      showError("Error al inscribirse en el torneo");
    }
  };

  const handleViewMore = (tournament) => {
    setSelectedTournament(tournament);
  };

  return (
    <div className="tournaments-container">
      <Modal {...modalConfig} />

      {selectedTournament ? (
        <TournamentDetails
          tournament={selectedTournament}
          onBack={() => setSelectedTournament(null)}
        />
      ) : (
        <>
          <Header
            onBack={onBack}
            titleImage="/torneos-title.png"
            logoImage="/team-logo.png"
          />

          <div className="tournaments-content">
            <div className="tournaments-grid">
              {tournaments.length === 0 ? (
                <div className="no-tournaments">No hay torneos activos</div>
              ) : (
                tournaments.map((tournament) => (
                  <div key={tournament.id} className="tournament-card">
                    <div
                      className={`tournament-status-badge ${tournament.status}`}
                    >
                      {tournament.status === "abierto" ? "Abierto" : "Cerrado"}
                    </div>

                    <div className="tournament-header">
                      <div className="tournament-info">
                        <div className="tournament-date">
                          {formatDateToSpanish(tournament.date)}
                        </div>
                        <div className="tournament-game">Online</div>
                        <h3 className="tournament-title">{tournament.name}</h3>
                      </div>
                      {gameLogos[tournament.game] || gameLogos.lol}
                    </div>

                    {tournament.description && (
                      <div className="tournament-description">
                        {tournament.description}
                      </div>
                    )}

                    <div className="tournament-actions">
                      <button
                        className="tournament-btn tournament-btn-primary"
                        onClick={() => handleRegister(tournament)}
                        disabled={tournament.status === "cerrado"}
                      >
                        {tournament.status === "cerrado"
                          ? "Cerrado"
                          : "Inscribirte"}
                      </button>
                      <button
                        className="tournament-btn tournament-btn-secondary"
                        onClick={() => handleViewMore(tournament)}
                      >
                        Ver Más
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {isAdmin && (
              <div className="admin-section">
                <AdminPanel />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Componente para mostrar detalles del torneo
// En Tournaments.jsx, actualiza el componente TournamentDetails con esto:

const TournamentDetails = ({ tournament, onBack }) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJornada, setSelectedJornada] = useState(1);
  const [matches, setMatches] = useState({});
  const [totalJornadas, setTotalJornadas] = useState(0);
  const [stats, setStats] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [updatingStats, setUpdatingStats] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Verificar si es admin
  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/user/is-admin", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setIsAdmin(data.isAdmin);
    } catch (error) {
      console.error("Error verificando admin:", error);
    }
  };

  const showMessage = (message, type = 'success') => {
    setActionMessage({ message, type });
    setTimeout(() => setActionMessage(null), 5000);
  };

  // Regenerar partidos
  const handleRegenerateMatches = async () => {
    if (!window.confirm("¿Estás seguro de que quieres regenerar todos los partidos? Esto eliminará el calendario actual.")) {
      return;
    }

    setRegenerating(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/admin/tournament/${tournament.id}/regenerate-matches`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        showMessage(`Partidos regenerados exitosamente. ${data.matchesCreated} partidos creados.`, 'success');
        // Recargar datos
        await fetchTournamentData();
      } else {
        showMessage(data.message || 'Error regenerando partidos', 'error');
      }
    } catch (error) {
      console.error("Error regenerando partidos:", error);
      showMessage('Error de conexión al regenerar partidos', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  // Actualizar estadísticas
  const handleUpdateStats = async () => {
    setUpdatingStats(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/admin/tournament/${tournament.id}/update-stats`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        showMessage(`Estadísticas actualizadas para ${data.teamsUpdated} equipos.`, 'success');
        // Recargar estadísticas
        await fetchTournamentData();
      } else {
        showMessage(data.message || 'Error actualizando estadísticas', 'error');
      }
    } catch (error) {
      console.error("Error actualizando estadísticas:", error);
      showMessage('Error de conexión al actualizar estadísticas', 'error');
    } finally {
      setUpdatingStats(false);
    }
  };

  useEffect(() => {
    fetchTournamentData();
  }, [tournament.id]);

  const fetchTournamentData = async () => {
    try {
      setLoading(true);

      // Obtener equipos y estadísticas
      const [teamsRes, matchesRes, statsRes] = await Promise.all([
        fetch(`/api/tournament/${tournament.id}/teams`),
        fetch(`/api/tournament/${tournament.id}/matches`),
        fetch(`/api/tournament/${tournament.id}/stats`),
      ]);

      const teamsData = await teamsRes.json();
      const matchesData = await matchesRes.json();
      const statsData = await statsRes.json();

      console.log("Datos de partidos recibidos:", matchesData);

      setTeams(teamsData.teams || []);
      setStats(statsData.stats || []);

      // Organizar partidos por jornada
      const matchesByJornada = {};
      let maxJornada = 0;

      (matchesData.matches || []).forEach((match) => {
        const jornada = match.jornada || 1;
        if (!matchesByJornada[jornada]) {
          matchesByJornada[jornada] = [];
        }

        // Mapear los datos del partido para asegurar compatibilidad
        const mappedMatch = {
          id: match.id,
          jornada: jornada,
          match_date: match.match_date,
          match_time: match.match_time,
          match_format: match.match_format || match.format || "BO3",
          status: match.status || "pending",
          score_team1: match.score_team1 || match.home_score || 0,
          score_team2: match.score_team2 || match.away_score || 0,
          // Datos del equipo 1 (local)
          team1_id: match.team1_id || match.home_team?.id,
          team1_name: match.team1_name || match.home_team?.name || "Equipo 1",
          team1_logo: match.team1_logo || match.home_team?.logo,
          // Datos del equipo 2 (visitante)
          team2_id: match.team2_id || match.away_team?.id,
          team2_name: match.team2_name || match.away_team?.name || "Equipo 2",
          team2_logo: match.team2_logo || match.away_team?.logo,
        };

        matchesByJornada[jornada].push(mappedMatch);
        maxJornada = Math.max(maxJornada, jornada);
      });

      console.log("Partidos organizados por jornada:", matchesByJornada);

      setMatches(matchesByJornada);
      setTotalJornadas(maxJornada);
    } catch (err) {
      console.error("Error al cargar datos del torneo:", err);
      showMessage('Error cargando datos del torneo', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Función para determinar la zona del equipo
  const getPositionClass = (position) => {
    if (position <= 5) return "title-zone";
    if (position <= 7) return "contender-zone";
    return "";
  };

  // Función para obtener el estado del partido en español
  const getMatchStatus = (status) => {
    switch (status) {
      case "pending":
        return "Programado";
      case "completed":
        return "Finalizado";
      case "live":
        return "En Vivo";
      case "cancelled":
        return "Cancelado";
      default:
        return "Programado";
    }
  };

  // Función para obtener la clase CSS del estado
  const getMatchStatusClass = (status) => {
    switch (status) {
      case "pending":
        return "scheduled";
      case "completed":
        return "finished";
      case "live":
        return "live";
      case "cancelled":
        return "cancelled";
      default:
        return "scheduled";
    }
  };

  // Combinar equipos con estadísticas y ordenar por puntos
  const teamsWithStats = teams
    .map((team) => {
      const teamStats = stats.find((stat) => stat.team_id === team.id) || {
        wins: 0,
        losses: 0,
        points: 0,
        games_played: 0,
      };
      return { ...team, ...teamStats };
    })
    .sort((a, b) => {
      // Ordenar por puntos (descendente), luego por diferencia de partidos ganados
      if (b.points !== a.points) return b.points - a.points;
      return b.wins - b.losses - (a.wins - a.losses);
    });

  return (
    <div className="tournament-details">
      <Header
        onBack={onBack}
        titleImage="/torneo-detail-title.png"
        logoImage="/team-logo.png"
      />

      {/* Loading Overlay */}
      {(regenerating || updatingStats) && (
        <div className="loading-overlay">
          <div style={{ textAlign: 'center' }}>
            <div className="loading-spinner"></div>
            <div className="loading-text">
              {regenerating ? 'Regenerando partidos...' : 'Actualizando estadísticas...'}
            </div>
          </div>
        </div>
      )}

      {/* Action Message */}
      {actionMessage && (
        <div className={`action-message ${actionMessage.type}`}>
          {actionMessage.message}
        </div>
      )}

      <div className="tournament-info-section">
        <div className="tournament-meta">
          <span className="tournament-date-detail">
            {formatDateToSpanish(tournament.date)}
          </span>
          <span className={`tournament-status-detail ${tournament.status}`}>
            {tournament.status === "abierto" ? "Abierto" : "Cerrado"}
          </span>
        </div>
        {tournament.description && (
          <p className="tournament-description-detail">
            {tournament.description}
          </p>
        )}
      </div>

      {/* Admin Controls */}
      {isAdmin && (
        <div className="tournament-details-admin">
          <h4>Controles de Administrador</h4>
          <div className="admin-controls-detail">
            <button
              className="regenerate-matches-btn"
              onClick={handleRegenerateMatches}
              disabled={regenerating || updatingStats}
            >
              {regenerating ? 'Regenerando...' : 'Regenerar Partidos'}
            </button>
            <button
              className="update-stats-btn"
              onClick={handleUpdateStats}
              disabled={regenerating || updatingStats}
            >
              {updatingStats ? 'Actualizando...' : 'Actualizar Estadísticas'}
            </button>
          </div>
        </div>
      )}

      <div className="tournament-content">
        {/* Clasificación a la izquierda */}
        <div className="tournament-classification">
          <div className="classification-header">
            <h2>CLASIFICACIÓN</h2>
          </div>

          {loading ? (
            <div className="loading">Cargando clasificación...</div>
          ) : teamsWithStats.length === 0 ? (
            <div className="no-teams">
              No hay equipos inscritos en este torneo
            </div>
          ) : (
            <>
              <table className="classification-table">
                <thead>
                  <tr className="table-header">
                    <th>#</th>
                    <th>EQUIPO</th>
                    <th>PJ</th>
                    <th>G</th>
                    <th>P</th>
                    <th>PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {teamsWithStats.map((team, index) => {
                    const position = index + 1;

                    return (
                      <tr
                        key={team.id}
                        className={`table-row ${getPositionClass(position)}`}
                      >
                        <td>
                          <span
                            className={`pos-number ${getPositionClass(position)}`}
                          >
                            {position}
                          </span>
                        </td>
                        <td>
                          <div className="team-info">
                            <div className="team-logo">
                              {team.logo ? (
                                <img src={team.logo} alt={team.name} />
                              ) : (
                                <span className="default-logo">
                                  {team.name.substring(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <span className="team-name">{team.name}</span>
                          </div>
                        </td>
                        <td className="stat-number">
                          {team.games_played || 0}
                        </td>
                        <td className="stat-number wins">{team.wins || 0}</td>
                        <td className="stat-number losses">
                          {team.losses || 0}
                        </td>
                        <td className="stat-number points">
                          {team.points || 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="zone-indicator">
                <div className="zone-item">
                  <div className="zone-color title"></div>
                  <span>Clasificados a Playoffs</span>
                </div>
                <div className="zone-item">
                  <div className="zone-color contender"></div>
                  <span>Peleando por clasificar</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Jornadas a la derecha */}
        <div className="tournament-jornadas">
          {totalJornadas > 0 && (
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
                Jornada {selectedJornada} de {totalJornadas}
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
          )}

          <div className="jornada-matches">
            <h3>
              {totalJornadas > 0 ? `Jornada ${selectedJornada}` : "Partidos"}
            </h3>
            {matches[selectedJornada] && matches[selectedJornada].length > 0 ? (
              <div className="matches-list">
                {matches[selectedJornada].map((match) => (
                  <div key={match.id} className="match-card">
                    <div className="match-info-section">
                      <div className="match-datetime">
                        {formatDateTime(match.match_date, match.match_time)}
                      </div>
                      <div
                        className={`match-status ${getMatchStatusClass(match.status)}`}
                      >
                        {getMatchStatus(match.status)}
                      </div>
                    </div>

                    <div className="match-content">
                      <div className="match-team home">
                        <span className="team-name">{match.team1_name}</span>
                        <div className="team-logo">
                          {match.team1_logo ? (
                            <img
                              src={match.team1_logo}
                              alt={match.team1_name}
                            />
                          ) : (
                            <span className="default-logo">
                              {match.team1_name.substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="match-score">
                        <span className="score">{match.score_team1}</span>
                        <span className="score-separator">-</span>
                        <span className="score">{match.score_team2}</span>
                      </div>

                      <div className="match-team away">
                        <div className="team-logo">
                          {match.team2_logo ? (
                            <img
                              src={match.team2_logo}
                              alt={match.team2_name}
                            />
                          ) : (
                            <span className="default-logo">
                              {match.team2_name.substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="team-name">{match.team2_name}</span>
                      </div>

                      <div className="match-format">{match.match_format}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-matches">
                {totalJornadas === 0
                  ? "No hay partidos programados aún"
                  : "No hay partidos en esta jornada"}
              </div>
            )}
          </div>

          {/* Placeholder para el bracket */}
          <div className="bracket-preview">
            <h3>Bracket de Playoffs</h3>
            <div className="bracket-placeholder">
              <p>El bracket se generará al finalizar la fase regular</p>
              <div className="bracket-info">
                <p>• Top 6 equipos clasifican a playoffs</p>
                <p>• 1° y 2° avanzan directamente a semifinales</p>
                <p>• 3° vs 6° y 4° vs 5° en cuartos de final</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tournaments;
