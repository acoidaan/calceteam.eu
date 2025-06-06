// Teams.jsx
import React, { useState, useEffect } from "react";
import CreateTeamForm from "./CreateTeamForm";

const Teams = () => {
  const [teams, setTeams] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/team/user", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) setTeams(data);
      else console.error(data.message);
    } catch (err) {
      console.error("Error al obtener equipos:", err);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [showForm]); // Se recarga cuando se crea un nuevo equipo

  const groupedByGame = teams.reduce((acc, team) => {
    acc[team.game] = team;
    return acc;
  }, {});

  return (
    <div className="teams-container">
      <h1>Mis Equipos</h1>
      <div className="teams-list">
        {Object.entries(groupedByGame).map(([game, team]) => (
          <div key={game} className="team-card">
            <h2>{game === "lol" ? "League of Legends" : "Valorant"}</h2>
            <p>
              <strong>Nombre:</strong> {team.name}
            </p>
            <p>
              <strong>Tu posición:</strong> {team.position}
            </p>
            <p>
              <strong>Entrenador:</strong> {team.staff || "Ninguno"}
            </p>
            <p>
              <strong>Suplente:</strong> {team.substitute || "Ninguno"}
            </p>
          </div>
        ))}
      </div>
      <button onClick={() => setShowForm(true)} className="create-team-btn">
        + Crear equipo
      </button>
      {showForm && <CreateTeamForm onClose={() => setShowForm(false)} />}
    </div>
  );
};

export default Teams;
