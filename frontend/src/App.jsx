import "./App.css";
import { useState, useEffect, useRef } from "react";
import Login from "./Login";
import Account from "./Account";
import Teams from "./Teams";
import Tournaments from "./Tournaments";
import ResetPassword from "./ResetPassword";

function App() {
  const [showLogin, setShowLogin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showTeams, setShowTeams] = useState(false);
  const [showTournaments, setShowTournaments] = useState(false);

  const observer = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const name = localStorage.getItem("username");

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("reset-password")) return;

    const tokenFromURL = urlParams.get("token");
    const nameFromURL = urlParams.get("username");

    if (tokenFromURL && nameFromURL) {
      localStorage.setItem("token", tokenFromURL);
      localStorage.setItem("username", nameFromURL);
      window.history.replaceState(null, "", window.location.pathname);
      setIsLoggedIn(true);
      setUsername(nameFromURL);
    } else if (token && name) {
      setIsLoggedIn(true);
      setUsername(name);
    }

    observer.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      {
        threshold: 0.1,
      }
    );

    const elements = document.querySelectorAll(".scroll-animate");
    elements.forEach((el) => observer.current.observe(el));

    return () => {
      elements.forEach((el) => observer.current?.unobserve(el));
    };
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    window.location.reload();
  };

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("reset-password") || urlParams.get("token")) {
    return <ResetPassword />;
  }

  if (showLogin && !isLoggedIn) {
    return <Login />;
  }

  if (showAccount) {
    return <Account onBack={() => setShowAccount(false)} />;
  }

  if (showTeams) {
    return <Teams onBack={() => setShowTeams(false)} />;
  }

  if (showTournaments) {
    return <Tournaments onBack={() => setShowTournaments(false)} />;
  }

  return (
    <div className="landing">
      <header className="header">
        <div className="header-content">
          <div className="header-logo">
            <img
              src="/logo_transparent.png"
              alt="Calce Team"
              className="header-logo-img"
            />
          </div>
          <div className="header-title">CALCE TEAM</div>
          <nav className="header-nav">
            <button className="nav-icon">
              <img src="/search-icon.png" alt="Buscar" />
            </button>
            {isLoggedIn ? (
              <div className="user-menu">
                <button
                  className="user-button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <img src="/user-icon.png" alt="Usuario" />
                </button>
                {showUserMenu && (
                  <div className="user-dropdown">
                    <div className="user-info">
                      <span className="username-text">{username}</span>
                    </div>
                    <button
                      onClick={() => setShowAccount(true)}
                      className="account-btn"
                    >
                      Cuenta
                    </button>
                    <button onClick={handleLogout} className="logout-btn">
                      Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="nav-icon" onClick={() => setShowLogin(true)}>
                <img src="/user-icon.png" alt="Iniciar Sesión" />
              </button>
            )}
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="hero-video-bg">
          <video autoPlay muted loop className="background-video">
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>
        </div>
        {isLoggedIn && (
          <div className="welcome-message">
            <h1>Bienvenido, {username}</h1>
          </div>
        )}
        <div className="side-menu-trigger">
          <div className="menu-label">MENU</div>
          <div className="side-menu">
            <div
              className="menu-item"
              onClick={() =>
                isLoggedIn ? setShowAccount(true) : setShowLogin(true)
              }
            >
              <h3>Cuenta</h3>
              <p>Perfil y configuración</p>
            </div>
            <div
              className="menu-item"
              onClick={() =>
                isLoggedIn ? setShowTeams(true) : setShowLogin(true)
              }
            >
              <br />
              <h3>Equipo</h3>
              <p>Gestiona tu equipo</p>
            </div>
            <div
              className="menu-item"
              onClick={() => {
                if (isLoggedIn) {
                  setShowAccount(false);
                  setShowTeams(false);
                  setShowTournaments(true);
                } else {
                  setShowLogin(true);
                }
              }}
            >
              <br />
              <h3>Torneos</h3>
              <p>Competiciones activas</p>
            </div>
            <div className="menu-item">
              <br />
              <h3>Redes</h3>
              <p>Síguenos en redes</p>
            </div>
            <div className="menu-item">
              <br />
              <h3>Soporte</h3>
              <p>Ayuda y contacto</p>
            </div>
          </div>
        </div>
      </section>

      <section className="about">
        <div className="container">
          <h2 className="scroll-animate">Sobre Nosotros</h2>
          <p className="scroll-animate">
            <b>Calce Team</b> es un club de esports fundado en 2023 con la
            ambición de competir y crecer en el panorama competitivo.
          </p>
        </div>
      </section>

      <section className="games scroll-animate">
        <div className="container">
          <h2 className="scroll-animate">Nuestros Juegos</h2>
          <div className="games-showcase">
            <div className="game-item scroll-animate">
              <img src="/lol_logo.png" alt="League of Legends" />
              <h3>League of Legends</h3>
              <p>MOBA</p>
            </div>
            <div className="game-item scroll-animate">
              <img src="/valorant_logo.png" alt="Valorant" />
              <h3>Valorant</h3>
              <p>Tactical Shooter</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer scroll-animate">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo scroll-animate">
              <img
                src="/logo_transparent.png"
                alt="Calce Team"
                className="footer-logo-img"
              />
              <p>Club de Esports Profesional</p>
            </div>
          </div>
          <div className="footer-bottom scroll-animate">
            <p>&copy; 2025 Calce Team. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
