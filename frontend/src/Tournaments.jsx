import { useEffect, useState } from "react";
import AdminPanel from "./AdminPanel";
import "./Tournaments.css";
import Modal from "./Modal";
import { useModal } from "./useModal";

// Funciones de utilidad para fechas
const formatDateToSpanish = (mysqlDate) => {
  if (!mysqlDate) return "";
  const date = new Date(mysqlDate);
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
};

const Tournaments = ({ onBack }) => {
  const { modalConfig, showError, showSuccess } = useModal();
  const [tournaments, setTournaments] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [userTeam, setUserTeam] = useState(null);

  // Logos de juegos - mantener rutas actuales
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
        src="CAMBIA AQUI - /public/game-logos/valorant.png"
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
          <div className="tournaments-header">
            <button onClick={onBack} className="back-button">
              ← Volver
            </button>
            <h1>Torneos Activos</h1>
          </div>

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
        </>
      )}
    </div>
  );
};

// Componente para mostrar detalles del torneo
const TournamentDetails = ({ tournament, onBack }) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTournamentTeams();
  }, [tournament.id]);

  const fetchTournamentTeams = async () => {
    try {
      const res = await fetch(`/api/tournament/${tournament.id}/teams`);
      const data = await res.json();
      setTeams(data.teams || []);
    } catch (err) {
      console.error("Error al cargar equipos del torneo:", err);
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

  return (
    <div className="tournament-details">
      <div className="tournament-details-header">
        <button onClick={onBack} className="back-button">
          ← Volver a Torneos
        </button>
        <h1>{tournament.name}</h1>
      </div>

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

      <div className="tournament-classification">
        <div className="classification-header">
          <h2>CLASIFICACIÓN</h2>
        </div>

        {loading ? (
          <div className="loading">Cargando clasificación...</div>
        ) : teams.length === 0 ? (
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
                {teams.map((team, index) => {
                  const position = index + 1;
                  const gamesPlayed = team.wins + team.losses;

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
                      <td className="stat-number">{gamesPlayed}</td>
                      <td className="stat-number wins">{team.wins}</td>
                      <td className="stat-number losses">{team.losses}</td>
                      <td className="stat-number points">{team.wins}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="zone-indicator">
              <div className="zone-item">
                <div className="zone-color title"></div>
                <span>Lucha por el título</span>
              </div>
              <div className="zone-item">
                <div className="zone-color contender"></div>
                <span>Peleando por unirse a la lucha</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Tournaments;
