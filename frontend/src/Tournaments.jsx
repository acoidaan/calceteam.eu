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
  const [selectedJornada, setSelectedJornada] = useState(1);
  const [matches, setMatches] = useState({});

  useEffect(() => {
    fetchTournamentTeams();
  }, [tournament.id]);

  useEffect(() => {
    if (teams.length > 0) {
      generateMatches();
    }
  }, [teams]);

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

  // Generar partidos aleatorios con sistema ida y vuelta
  const generateMatches = () => {
    const allMatches = {};
    const teamsCopy = [...teams];
    const numTeams = teamsCopy.length;

    if (numTeams < 2) return;

    // Generar todas las combinaciones de partidos (ida y vuelta)
    const matchPairs = [];
    for (let i = 0; i < numTeams; i++) {
      for (let j = i + 1; j < numTeams; j++) {
        // Partido de ida
        matchPairs.push({
          home: teamsCopy[i],
          away: teamsCopy[j],
        });
        // Partido de vuelta
        matchPairs.push({
          home: teamsCopy[j],
          away: teamsCopy[i],
        });
      }
    }

    // Mezclar partidos aleatoriamente
    for (let i = matchPairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [matchPairs[i], matchPairs[j]] = [matchPairs[j], matchPairs[i]];
    }

    // Distribuir partidos en jornadas
    const matchesPerJornada = Math.ceil(numTeams / 2);
    let currentJornada = 1;
    let currentMatches = [];
    const usedTeams = new Set();

    for (const match of matchPairs) {
      if (!usedTeams.has(match.home.id) && !usedTeams.has(match.away.id)) {
        currentMatches.push(match);
        usedTeams.add(match.home.id);
        usedTeams.add(match.away.id);

        if (
          currentMatches.length === matchesPerJornada ||
          usedTeams.size === numTeams
        ) {
          allMatches[currentJornada] = [...currentMatches];
          currentJornada++;
          currentMatches = [];
          usedTeams.clear();
        }
      }
    }

    // Agregar partidos restantes
    let remainingMatches = matchPairs.filter(
      (match) => !Object.values(allMatches).flat().includes(match)
    );

    while (remainingMatches.length > 0) {
      const jornadaMatches = [];
      const usedInJornada = new Set();

      for (const match of remainingMatches) {
        if (
          !usedInJornada.has(match.home.id) &&
          !usedInJornada.has(match.away.id)
        ) {
          jornadaMatches.push(match);
          usedInJornada.add(match.home.id);
          usedInJornada.add(match.away.id);

          if (jornadaMatches.length === matchesPerJornada) break;
        }
      }

      if (jornadaMatches.length > 0) {
        allMatches[currentJornada] = jornadaMatches;
        currentJornada++;
        remainingMatches = remainingMatches.filter(
          (m) => !jornadaMatches.includes(m)
        );
      } else {
        break;
      }
    }

    setMatches(allMatches);
  };

  // Función para determinar la zona del equipo
  const getPositionClass = (position) => {
    if (position <= 5) return "title-zone";
    if (position <= 7) return "contender-zone";
    return "";
  };

  const totalJornadas = Object.keys(matches).length;

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

      <div className="tournament-content">
        {/* Clasificación a la izquierda */}
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
          <div className="jornadas-nav">
            {Array.from({ length: totalJornadas }, (_, i) => i + 1).map(
              (jornada) => (
                <button
                  key={jornada}
                  className={`jornada-btn ${selectedJornada === jornada ? "active" : ""}`}
                  onClick={() => setSelectedJornada(jornada)}
                >
                  Jornada {jornada}
                </button>
              )
            )}
          </div>

          <div className="jornada-matches">
            <h3>Jornada {selectedJornada}</h3>
            {matches[selectedJornada] && matches[selectedJornada].length > 0 ? (
              <div className="matches-list">
                {matches[selectedJornada].map((match, index) => (
                  <div key={index} className="match-card">
                    <div className="match-team home">
                      <span className="team-name">{match.home.name}</span>
                      <div className="team-logo">
                        {match.home.logo ? (
                          <img src={match.home.logo} alt={match.home.name} />
                        ) : (
                          <span className="default-logo">
                            {match.home.name.substring(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="match-vs">VS</div>
                    <div className="match-team away">
                      <div className="team-logo">
                        {match.away.logo ? (
                          <img src={match.away.logo} alt={match.away.name} />
                        ) : (
                          <span className="default-logo">
                            {match.away.name.substring(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="team-name">{match.away.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-matches">No hay partidos programados</div>
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
