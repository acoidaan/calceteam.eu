import { useState } from "react";
import axios from "axios";
import Modal from "./Modal";
import { useModal } from "./useModal";

function CreateTeamForm({ game, onClose, onTeamCreated }) {
  const { modalConfig, showError } = useModal();
  const [teamName, setTeamName] = useState("");
  const [logo, setLogo] = useState(null);
  const [nickname, setNickname] = useState("");
  const [position, setPosition] = useState("top");
  const [coach, setCoach] = useState("");
  const [substitute, setSubstitute] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("teamName", teamName);
    formData.append("game", game);
    formData.append("nickname", nickname);
    formData.append("position", position);
    formData.append("coach", coach);
    formData.append("substitute", substitute);
    if (logo) formData.append("logo", logo);

    try {
      const token = localStorage.getItem("token");
      await axios.post("/api/team/create", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });
      onTeamCreated();
      onClose();
    } catch (err) {
      showError("Error al crear el equipo.");
    }
  };

  return (
    <>
      <Modal {...modalConfig} />
      <form onSubmit={handleSubmit}>
        <h2>Crear Equipo ({game.toUpperCase()})</h2>
        <input
          type="text"
          placeholder="Nombre del equipo"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          required
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setLogo(e.target.files[0])}
        />
        <input
          type="text"
          placeholder="Tu nombre de juego (nombre#hashtag)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
        />
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          required
        >
          <option value="top">Top</option>
          <option value="jungla">Jungla</option>
          <option value="medio">Medio</option>
          <option value="adc">ADC</option>
          <option value="support">Support</option>
        </select>
        <input
          type="text"
          placeholder="Entrenador (opcional)"
          value={coach}
          onChange={(e) => setCoach(e.target.value)}
        />
        <input
          type="text"
          placeholder="Suplente (opcional)"
          value={substitute}
          onChange={(e) => setSubstitute(e.target.value)}
        />
        <button type="submit">Crear equipo</button>
        <button type="button" onClick={onClose}>
          Cancelar
        </button>
      </form>
    </>
  );
}

export default CreateTeamForm;
