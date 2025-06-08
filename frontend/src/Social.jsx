import "./App.css";

function Social({ onBack }) {
  return (
    <div className="account-container">
      <header className="account-header">
        <button onClick={onBack} className="back-button">
          ← Volver
        </button>
        <h1>Redes Sociales</h1>
      </header>

      <div className="social-content">
        <p className="social-intro">
          ¡Síguenos en nuestras redes para mantenerte al día y disfrutar de
          contenido exclusivo!
        </p>

        <div className="social-grid">
          <a
            href="https://instagram.com/calceliga"
            className="social-card"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="/socials/instagram.png" alt="Instagram" />
            <span>@calceliga</span>
          </a>

          <a
            href="https://x.com/CalceTeam0"
            className="social-card"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="/socials/twitter.png" alt="Twitter (X)" />
            <span>@CalceTeam0</span>
          </a>

          <a
            href="https://discord.gg/3GB9PuJ4G4"
            className="social-card"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="/socials/discord.png" alt="Discord" />
            <span>Discord Oficial</span>
          </a>

          <a
            href="https://www.tiktok.com/@calce_team_"
            className="social-card"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="/socials/tiktok.png" alt="TikTok" />
            <span>@calce_team_</span>
          </a>

          <a
            href="https://twitch.tv/calceteam_"
            className="social-card"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="/socials/twitch.png" alt="Twitch" />
            <span>@calceteam_</span>
          </a>
        </div>
      </div>

      <style jsx>{`
        .social-content {
          padding: 2rem;
          max-width: 1000px;
          margin: 0 auto;
        }

        .social-intro {
          text-align: center;
          font-size: 1.2rem;
          color: #444;
          margin-bottom: 2rem;
        }

        .social-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 2rem;
        }

        .social-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-decoration: none;
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          transition: transform 0.2s;
        }

        .social-card:hover {
          transform: translateY(-5px);
        }

        .social-card img {
          width: 48px;
          height: 48px;
          margin-bottom: 1rem;
        }

        .social-card span {
          font-size: 1rem;
          color: #111;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

export default Social;
