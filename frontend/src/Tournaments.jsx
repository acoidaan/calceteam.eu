// Tournaments.jsx
import { useEffect, useState } from "react";
import AdminPanel from "./AdminPanel";
import "./Tournaments.css";

const Tournaments = ({ onBack }) => {
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
      alert("Error al cargar torneos");
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
              <p>Juego: {t.game}</p>
              <p>Fecha: {new Date(t.date).toLocaleDateString()}</p>
              <p>Estado: {t.status}</p>
              {t.description && <p>{t.description}</p>}
            </div>
          ))
        )}
      </div>

      {isAdmin && (
        <>
          <hr />
          <AdminPanel />
        </>
      )}
    </div>
  );
};

export default Tournaments;
