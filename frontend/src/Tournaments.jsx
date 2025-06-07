// Tournaments.jsx
import { useEffect, useState } from "react";
import AdminPanel from "./AdminPanel";
import "./Tournaments.css";
import Modal from "./Modal";
import { useModal } from "./useModal";

// Funciones de utilidad para fechas
const formatDateToSpanish = (mysqlDate) => {
  if (!mysqlDate) return "";
  const date = new Date(mysqlDate);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const Tournaments = ({ onBack }) => {
  const { modalConfig, showError } = useModal();
  const [tournaments, setTournaments] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

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

  return (
    <div className="tournaments-container">
      <Modal {...modalConfig} />

      <button onClick={onBack} className="back-button">
        ← Volver
      </button>
      <h1>Torneos Activos</h1>

      <div className="tournaments-list">
        {tournaments.length === 0 ? (
          <p>No hay torneos activos</p>
        ) : (
          tournaments.map((t) => (
            <div key={t.id} className="tournament-card">
              <h3>{t.name}</h3>
              <p>Juego: {t.game.toUpperCase()}</p>
              <p>Fecha: {formatDateToSpanish(t.date)}</p>
              <p>
                Estado:{" "}
                <span className={`status-badge ${t.status}`}>{t.status}</span>
              </p>
              {t.description && (
                <p className="tournament-description">{t.description}</p>
              )}
            </div>
          ))
        )}
      </div>

      {isAdmin && (
        <>
          <hr style={{ margin: "40px 0", opacity: 0.3 }} />
          <AdminPanel />
        </>
      )}
    </div>
  );
};

export default Tournaments;
