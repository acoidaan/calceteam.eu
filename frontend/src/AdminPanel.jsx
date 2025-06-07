import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { useModal } from "./useModal";

const AdminPanel = () => {
  const { modalConfig, showAlert } = useModal();
  const [tournaments, setTournaments] = useState([]);
  const [newTournament, setNewTournament] = useState({
    name: "",
    game: "lol",
    status: "abierto",
    date: "",
    description: "",
  });

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/tournaments", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setTournaments(data.tournaments || []);
  };

  const createTournament = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/tournaments/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newTournament),
    });
    const data = await res.json();
    showAlert(data.message);
    fetchTournaments();
  };

  return (
    <div className="admin-panel">
      <Modal {...modalConfig} />

      <h2>Panel de Torneos</h2>

      <div>
        <h3>Crear nuevo torneo</h3>
        <input
          placeholder="Nombre"
          value={newTournament.name}
          onChange={(e) =>
            setNewTournament({ ...newTournament, name: e.target.value })
          }
        />
        <select
          value={newTournament.game}
          onChange={(e) =>
            setNewTournament({ ...newTournament, game: e.target.value })
          }
        >
          <option value="lol">LoL</option>
          <option value="valorant">Valorant</option>
        </select>
        <input
          type="date"
          value={newTournament.date}
          onChange={(e) =>
            setNewTournament({ ...newTournament, date: e.target.value })
          }
        />
        <textarea
          placeholder="Descripción"
          value={newTournament.description}
          onChange={(e) =>
            setNewTournament({ ...newTournament, description: e.target.value })
          }
        />
        <button onClick={createTournament}>Crear Torneo</button>
      </div>

      <div>
        <h3>Torneos existentes</h3>
        {tournaments.length === 0 ? (
          <p>No hay torneos</p>
        ) : (
          tournaments.map((t) => (
            <div key={t.id}>
              <strong>{t.name}</strong> – {t.status} ({t.game}) –{" "}
              {new Date(t.date).toLocaleDateString()}
              <p>{t.description}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
