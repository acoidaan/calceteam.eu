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
  const { modalConfig, showError } = useModal();
  const [tournaments, setTournaments] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Logos de juegos - CAMBIA AQUI las rutas
  const gameLogos = {
    lol: (
      <img
        src="lol_logo.svg"
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
  }, []);

  const fetchTournaments = async () => {
    try {
      const res = await fetch("/api/tournaments");
      const data = await res.json();
      setTournaments(data.tournaments || []);
    } catch (err) {
      showError("Error al cargar torneos");
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

  const handleViewMore = (tournament) => {
    // TODO: Implementar vista detallada del torneo
    console.log("Ver más del torneo:", tournament);
  };

  return (
    <div className="tournaments-container">
      <Modal {...modalConfig} />

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
              <div className={`tournament-status-badge ${tournament.status}`}>
                {tournament.status === "abierto" ? "Abierto" : "Cerrado"}
              </div>

              <div className="tournament-header">
                <div className="tournament-info">
                  <div className="tournament-date">
                    {formatDateToSpanish(tournament.date)}
                  </div>
                  <div className="tournament-game">{tournament.game}</div>
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
                  onClick={() => handleViewMore(tournament)}
                >
                  Ver Más
                </button>
                <button className="tournament-btn tournament-btn-secondary">
                  Información
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
  );
};

export default Tournaments;
