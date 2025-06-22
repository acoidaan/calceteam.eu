import { useState } from "react";
import "./App.css";

function Support({ onBack }) {
  const [formData, setFormData] = useState({
    subject: "",
    category: "general",
    priority: "normal",
    message: "",
    email: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const categories = [
    { value: "general", label: "Consulta General" },
    { value: "account", label: "Problemas de Cuenta" },
    { value: "team", label: "Problemas con Equipo" },
    { value: "tournament", label: "Torneos" },
    { value: "technical", label: "Problemas Técnicos" },
    { value: "other", label: "Otro" },
  ];

  const priorities = [
    { value: "low", label: "Baja" },
    { value: "normal", label: "Normal" },
    { value: "high", label: "Alta" },
  ];

  const faqs = [
    {
      question: "¿Cómo puedo cambiar mi nombre de usuario?",
      answer:
        "Ve a tu perfil en la sección 'Cuenta' y haz clic en el botón de editar junto a tu nombre.",
    },
    {
      question: "¿Cómo me uno a un equipo?",
      answer:
        "Necesitas un código de invitación del equipo. Ve a la sección 'Equipo' e introduce el código.",
    },
    {
      question: "¿Puedo estar en varios equipos a la vez?",
      answer:
        "Sí, puedes estar en un equipo de League of Legends y uno de Valorant simultáneamente.",
    },
    {
      question: "¿Cómo me inscribo en un torneo?",
      answer:
        "Tu equipo debe estar completo. Luego ve a 'Torneos' y selecciona el torneo deseado.",
    },
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    const token = localStorage.getItem("accessToken");

    try {
      const response = await fetch(
        "https://www.calceteam.eu/api/support/ticket",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus({
          type: "success",
          message: `Ticket #${data.ticketNumber} enviado correctamente. Te responderemos pronto.`,
        });
        setFormData({
          subject: "",
          category: "general",
          priority: "normal",
          message: "",
          email: "",
        });
      } else {
        throw new Error(data.message || "Error al enviar ticket");
      }
    } catch (error) {
      console.error("Error:", error);
      setSubmitStatus({
        type: "error",
        message:
          error.message ||
          "Error al enviar el ticket. Por favor, intenta de nuevo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="account-container">
      <header className="account-header">
        <button onClick={onBack} className="back-button">
          ← Volver
        </button>
        <h1>Centro de Soporte</h1>
      </header>

      <div className="support-content">
        <div className="support-intro">
          <h2>¿Necesitas ayuda?</h2>
          <p>
            Estamos aquí para ayudarte. Revisa las preguntas frecuentes o
            envíanos un ticket.
          </p>
        </div>

        <div className="support-sections">
          {/* FAQs Section */}
          <div className="faqs-section">
            <h3>Preguntas Frecuentes</h3>
            <div className="faq-list">
              {faqs.map((faq, index) => (
                <details key={index} className="faq-item">
                  <summary className="faq-question">{faq.question}</summary>
                  <p className="faq-answer">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>

          {/* Ticket Form Section */}
          <div className="ticket-section">
            <h3>Enviar un Ticket</h3>
            <form onSubmit={handleSubmit} className="ticket-form">
              {!localStorage.getItem("accessToken") && (
                <div className="form-group">
                  <label>Email de contacto *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    placeholder="tu@email.com"
                  />
                </div>
              )}

              <div className="form-group">
                <label>Asunto *</label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  required
                  placeholder="Describe brevemente tu problema"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Categoría *</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                  >
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Prioridad *</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    required
                  >
                    {priorities.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Mensaje *</label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  required
                  rows="6"
                  placeholder="Describe tu problema en detalle..."
                />
              </div>

              {submitStatus && (
                <div className={`submit-status ${submitStatus.type}`}>
                  {submitStatus.message}
                </div>
              )}

              <button
                type="submit"
                className="submit-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Enviando..." : "Enviar Ticket"}
              </button>
            </form>
          </div>
        </div>

        <div className="contact-info">
          <h3>Otras formas de contacto</h3>
          <div className="contact-methods">
            <div className="contact-method">
              <span className="contact-icon">💬</span>
              <div>
                <h4>Discord</h4>
                <p>Únete a nuestro servidor para ayuda en tiempo real</p>
                <a
                  href="https://discord.gg/3GB9PuJ4G4"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  discord.gg/3GB9PuJ4G4
                </a>
              </div>
            </div>
            <div className="contact-method">
              <span className="contact-icon">📧</span>
              <div>
                <h4>Email directo</h4>
                <p>Para consultas más formales</p>
                <a href="mailto:calceteam@proton.me">calceteam@proton.me</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .support-content {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .support-intro {
          text-align: center;
          margin-bottom: 3rem;
        }

        .support-intro h2 {
          font-size: 2rem;
          color: var(--calce-blue);
          margin-bottom: 1rem;
        }

        .support-intro p {
          color: #666;
          font-size: 1.1rem;
        }

        .support-sections {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3rem;
          margin-bottom: 3rem;
        }

        /* FAQs */
        .faqs-section {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .faqs-section h3 {
          color: var(--calce-blue);
          margin-bottom: 1.5rem;
        }

        .faq-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .faq-item {
          background: var(--calce-gray-light);
          border-radius: 8px;
          padding: 1rem;
          cursor: pointer;
        }

        .faq-question {
          font-weight: 600;
          color: #333;
          list-style: none;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .faq-question::after {
          content: "▼";
          font-size: 0.8rem;
          transition: transform 0.3s;
        }

        details[open] .faq-question::after {
          transform: rotate(180deg);
        }

        .faq-answer {
          margin-top: 1rem;
          color: #666;
          line-height: 1.6;
        }

        /* Ticket Form */
        .ticket-section {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .ticket-section h3 {
          color: var(--calce-blue);
          margin-bottom: 1.5rem;
        }

        .ticket-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-weight: 600;
          color: #333;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 1rem;
          transition: border-color 0.3s;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: var(--calce-blue);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .submit-button {
          background: var(--calce-blue);
          color: white;
          padding: 1rem 2rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.3s;
        }

        .submit-button:hover:not(:disabled) {
          background: var(--calce-blue-light);
        }

        .submit-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .submit-status {
          padding: 1rem;
          border-radius: 6px;
          font-weight: 500;
        }

        .submit-status.success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .submit-status.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        /* Contact Info */
        .contact-info {
          background: var(--calce-gray-light);
          padding: 2rem;
          border-radius: 12px;
        }

        .contact-info h3 {
          color: var(--calce-blue);
          margin-bottom: 1.5rem;
        }

        .contact-methods {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }

        .contact-method {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .contact-icon {
          font-size: 2rem;
        }

        .contact-method h4 {
          margin-bottom: 0.5rem;
          color: #333;
        }

        .contact-method p {
          color: #666;
          margin-bottom: 0.5rem;
        }

        .contact-method a {
          color: var(--calce-blue);
          text-decoration: none;
        }

        .contact-method a:hover {
          text-decoration: underline;
        }

        @media (max-width: 768px) {
          .support-sections {
            grid-template-columns: 1fr;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .contact-methods {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default Support;
