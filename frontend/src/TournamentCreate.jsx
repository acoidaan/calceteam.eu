import React, { useState } from "react";
import "./TournamentCreate.css";
import Modal from "./Modal";
import { useModal } from "./useModal";

const TournamentCreate = ({ onBack }) => {
  const { modalConfig, showSuccess, showError } = useModal();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [game, setGame] = useState("lol");
  const [status, setStatus] = useState("abierto");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/tournament/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, date, game, status }),
      });
      if (response.ok) {
        showSuccess("Torneo creado con éxito");
        setTimeout(() => {
          onBack();
        }, 1500);
      } else {
        const err = await response.json();
        showError(err.message || "Error al crear torneo");
      }
    } catch (error) {
      showError("Error de conexión");
    }
  };

  return (
    <div className="tournament-create-container">
      <Modal {...modalConfig} />

      <button onClick={onBack} className="back-button">
        ← Volver
      </button>
      <h2>Crear Torneo</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nombre del torneo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <select value={game} onChange={(e) => setGame(e.target.value)}>
          <option value="lol">League of Legends</option>
          <option value="valorant">Valorant</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="abierto">Abierto</option>
          <option value="cerrado">Cerrado</option>
        </select>
        <button type="submit" className="submit-btn">
          Crear Torneo
        </button>
      </form>
    </div>
  );
};

export default TournamentCreate;
