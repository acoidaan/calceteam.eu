import "./App.css";
import { useState, useEffect } from "react";
import Login from "./Login";
import Account from "./Account";
import Teams from "./Teams";
import Tournaments from "./Tournaments";
import ResetPassword from "./ResetPassword";
import Social from "./Social";
import Support from "./Support";

function App() {
  const [showLogin, setShowLogin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showTeams, setShowTeams] = useState(false);
  const [showTournaments, setShowTournaments] = useState(false);
  const [showSocial, setShowSocial] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  useEffect(() => {
    // Reiniciar animaciones cuando se muestra la landing
    if (
      !showAccount &&
      !showTeams &&
      !showTournaments &&
      !showLogin &&
      !showSocial &&
      !showSupport
    ) {
      // Quitar clases visible para reiniciar animaciones
      const animatedElements = document.querySelectorAll(".visible");
      animatedElements.forEach((el) => el.classList.remove("visible"));

      // Pequeño delay para que el DOM se actualice
      setTimeout(() => {
        initAppleScrollEffect();
      }, 100);
    }

    // Verificar si es la página de reset password
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("reset-password")) {
      return; // No hacer nada, dejar que ResetPassword maneje esto
    }

    const tokenFromURL = urlParams.get("token");
    const nameFromURL = urlParams.get("username");

    if (tokenFromURL && nameFromURL) {
      localStorage.setItem("token", tokenFromURL);
      localStorage.setItem("username", nameFromURL);
      window.history.replaceState(null, "", window.location.pathname);
      setIsLoggedIn(true);
      setUsername(nameFromURL);
    } else {
      const token = localStorage.getItem("token");
      const name = localStorage.getItem("username");
      if (token && name) {
        setIsLoggedIn(true);
        setUsername(name);
      }
    }
  }, [
    showAccount,
    showTeams,
    showTournaments,
    showLogin,
    showSocial,
    showSupport,
  ]); // Re-ejecutar cuando cambian las vistas

  // Función principal para inicializar el efecto de scroll tipo Apple
  const initAppleScrollEffect = () => {
    // Limpiar observer anterior si existe
    if (window.scrollObserver) {
      window.scrollObserver.disconnect();
    }

    // Crear el intersection observer para elementos animados
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "-50px",
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    }, observerOptions);

    // Guardar referencia global
    window.scrollObserver = observer;

    // Observar elementos específicos
    const animatedElements = document.querySelectorAll(
      ".about h2, .about p, .games h2, .game-item, .footer"
    );

    animatedElements.forEach((element) => {
      observer.observe(element);
    });

    // Efecto parallax sutil en scroll
    let ticking = false;
    const updateParallax = () => {
      const scrolled = window.pageYOffset;

      // Parallax para la sección hero
      const hero = document.querySelector(".hero-video-bg");
      if (hero) {
        hero.style.transform = `translateY(${scrolled * 0.5}px)`;
      }

      // Efecto de escala sutil para elementos
      const aboutSection = document.querySelector(".about");
      const gamesSection = document.querySelector(".games");

      if (aboutSection) {
        const aboutRect = aboutSection.getBoundingClientRect();
        const aboutVisible =
          aboutRect.top < window.innerHeight && aboutRect.bottom > 0;

        if (aboutVisible) {
          const progress = 1 - aboutRect.top / window.innerHeight;
          const scale = 0.95 + progress * 0.05;
          aboutSection.style.transform = `scale(${Math.min(scale, 1)})`;
        }
      }

      if (gamesSection) {
        const gamesRect = gamesSection.getBoundingClientRect();
        const gamesVisible =
          gamesRect.top < window.innerHeight && gamesRect.bottom > 0;

        if (gamesVisible) {
          const progress = 1 - gamesRect.top / window.innerHeight;
          const scale = 0.95 + progress * 0.05;
          gamesSection.style.transform = `scale(${Math.min(scale, 1)})`;
        }
      }

      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateParallax);
        ticking = true;
      }
    };

    window.scrollHandler = handleScroll;
    window.addEventListener("scroll", handleScroll);

    // Cleanup function
    return () => {
      if (window.scrollObserver) {
        window.scrollObserver.disconnect();
      }
      if (window.scrollHandler) {
        window.removeEventListener("scroll", window.scrollHandler);
      }
    };
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.reload();
  };

  // Verificar si estamos en la página de reset password
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

  if (showSocial) {
    return <Social onBack={() => setShowSocial(false)} />;
  }

  if (showSupport) {
    return <Support onBack={() => setShowSupport(false)} />;
  }

  return (
    <div className="landing">
      {/* Header */}
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

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-video-bg">
          <video autoPlay muted loop className="background-video">
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Welcome Message */}
        {isLoggedIn && (
          <div className="welcome-message">
            <h1>Bienvenido, {username}</h1>
          </div>
        )}

        {/* Side Menu */}
        <div className="side-menu-trigger">
          <div className="menu-label">MENU</div>
          <div className="side-menu">
            <div
              className="menu-item"
              onClick={() => {
                if (isLoggedIn) {
                  setShowAccount(true);
                } else {
                  setShowLogin(true);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <h3>Cuenta</h3>
              <p>Perfil y configuración</p>
            </div>
            <div
              className="menu-item"
              onClick={() => {
                if (isLoggedIn) {
                  setShowTeams(true);
                } else {
                  setShowLogin(true);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <br></br>
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
              style={{ cursor: "pointer" }}
            >
              <br />
              <h3>Torneos</h3>
              <p>Competiciones activas</p>
            </div>
            <div
              className="menu-item"
              onClick={() => {
                if (isLoggedIn) {
                  setShowSupport(true);
                } else {
                  setShowLogin(true);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <br />
              <h3>Soporte</h3>
              <p>Ayuda y contacto</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about parallax-wrapper">
        <div className="container">
          <h2>Sobre Nosotros</h2>
          <p>
            <b>Calce Team</b> es un club de esports fundado en 2023 con la
            ambición de competir y crecer en el panorama competitivo de{" "}
            <b>League of Legends</b> y <b>Valorant</b>.
          </p>
          <p>
            Nos impulsa la pasión por la competición y el objetivo de
            establecernos como un referente en los esports. Buscamos ganar
            reconocimiento construyendo una comunidad sólida mientras aspiramos
            a <b>profesionalizarnos en el futuro</b>.
          </p>
          <p>
            Nuestros valores son{" "}
            <b>lealtad, honor, compañerismo, dedicación al aprendizaje</b> y{" "}
            <b>respeto</b> hacia rivales y comunidad.
          </p>
          <p>
            Anteriormente competimos en la{" "}
            <b>División Abierta de la Liga Canaria de Esports</b>, donde
            demostramos nuestro potencial contra otros equipos emergentes. Con
            un equipo comprometido y visión de futuro, representamos la nueva
            generación de esports: jóvenes, ambiciosos y con{" "}
            <b>gran proyección</b>.
          </p>
        </div>
      </section>

      {/* Sponsors Section */}
      <section className="sponsors parallax-wrapper">
        <div className="container">
          <h2>Nuestros Sponsors</h2>
          <div className="sponsors-showcase">
            <div className="sponsor-item">
              <a
                rel="sponsored"
                href="https://razer.a9yw.net/c/6293807/1381399/10229"
                target="_blank"
                id="1381399"
                className="sponsor-link"
              >
                <img
                  src="//a.impactradius-go.com/display-ad/10229-1381399"
                  border="0"
                  alt="Razer Gaming Gear"
                  className="sponsor-image"
                />
              </a>
              <img
                height="0"
                width="0"
                src="https://imp.pxf.io/i/6293807/1381399/10229"
                style={{ position: "absolute", visibility: "hidden" }}
                border="0"
              />
              <p className="sponsor-description">
                Equipamiento gaming de alta calidad para nuestros equipos
                profesionales
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Games Section */}
      <section className="games parallax-wrapper">
        <div className="container">
          <h2>Nuestros Juegos</h2>
          <div className="games-showcase">
            <div className="game-item">
              <img src="/lol_logo.png" alt="League of Legends" />
              <h3>League of Legends</h3>
              <p>MOBA</p>
            </div>
            <div className="game-item">
              <img src="/valorant_logo.png" alt="Valorant" />
              <h3>Valorant</h3>
              <p>Tactical Shooter</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">
              <img
                src="/logo_transparent.png"
                alt="Calce Team"
                className="footer-logo-img"
              />
              <p>Club de Esports Profesional</p>
            </div>
            <div className="footer-social">
              <h3>Síguenos</h3>
              <div className="social-links">
                <a
                  href="https://instagram.com/calceliga"
                  target="_blank"
                  className="social-icon"
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
                  </svg>
                </a>
                <a
                  href="https://x.com/CalceTeam0"
                  target="_blank"
                  className="social-icon"
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="https://discord.gg/3GB9PuJ4G4"
                  target="_blank"
                  className="social-icon"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    x="0px"
                    y="0px"
                    width="100"
                    height="100"
                    viewBox="0 0 50 50"
                  >
                    <path d="M 18.90625 7 C 18.90625 7 12.539063 7.4375 8.375 10.78125 C 8.355469 10.789063 8.332031 10.800781 8.3125 10.8125 C 7.589844 11.480469 7.046875 12.515625 6.375 14 C 5.703125 15.484375 4.992188 17.394531 4.34375 19.53125 C 3.050781 23.808594 2 29.058594 2 34 C 1.996094 34.175781 2.039063 34.347656 2.125 34.5 C 3.585938 37.066406 6.273438 38.617188 8.78125 39.59375 C 11.289063 40.570313 13.605469 40.960938 14.78125 41 C 15.113281 41.011719 15.429688 40.859375 15.625 40.59375 L 18.0625 37.21875 C 20.027344 37.683594 22.332031 38 25 38 C 27.667969 38 29.972656 37.683594 31.9375 37.21875 L 34.375 40.59375 C 34.570313 40.859375 34.886719 41.011719 35.21875 41 C 36.394531 40.960938 38.710938 40.570313 41.21875 39.59375 C 43.726563 38.617188 46.414063 37.066406 47.875 34.5 C 47.960938 34.347656 48.003906 34.175781 48 34 C 48 29.058594 46.949219 23.808594 45.65625 19.53125 C 45.007813 17.394531 44.296875 15.484375 43.625 14 C 42.953125 12.515625 42.410156 11.480469 41.6875 10.8125 C 41.667969 10.800781 41.644531 10.789063 41.625 10.78125 C 37.460938 7.4375 31.09375 7 31.09375 7 C 31.019531 6.992188 30.949219 6.992188 30.875 7 C 30.527344 7.046875 30.234375 7.273438 30.09375 7.59375 C 30.09375 7.59375 29.753906 8.339844 29.53125 9.40625 C 27.582031 9.09375 25.941406 9 25 9 C 24.058594 9 22.417969 9.09375 20.46875 9.40625 C 20.246094 8.339844 19.90625 7.59375 19.90625 7.59375 C 19.734375 7.203125 19.332031 6.964844 18.90625 7 Z M 18.28125 9.15625 C 18.355469 9.359375 18.40625 9.550781 18.46875 9.78125 C 16.214844 10.304688 13.746094 11.160156 11.4375 12.59375 C 11.074219 12.746094 10.835938 13.097656 10.824219 13.492188 C 10.816406 13.882813 11.039063 14.246094 11.390625 14.417969 C 11.746094 14.585938 12.167969 14.535156 12.46875 14.28125 C 17.101563 11.410156 22.996094 11 25 11 C 27.003906 11 32.898438 11.410156 37.53125 14.28125 C 37.832031 14.535156 38.253906 14.585938 38.609375 14.417969 C 38.960938 14.246094 39.183594 13.882813 39.175781 13.492188 C 39.164063 13.097656 38.925781 12.746094 38.5625 12.59375 C 36.253906 11.160156 33.785156 10.304688 31.53125 9.78125 C 31.59375 9.550781 31.644531 9.359375 31.71875 9.15625 C 32.859375 9.296875 37.292969 9.894531 40.3125 12.28125 C 40.507813 12.460938 41.1875 13.460938 41.8125 14.84375 C 42.4375 16.226563 43.09375 18.027344 43.71875 20.09375 C 44.9375 24.125 45.921875 29.097656 45.96875 33.65625 C 44.832031 35.496094 42.699219 36.863281 40.5 37.71875 C 38.5 38.496094 36.632813 38.84375 35.65625 38.9375 L 33.96875 36.65625 C 34.828125 36.378906 35.601563 36.078125 36.28125 35.78125 C 38.804688 34.671875 40.15625 33.5 40.15625 33.5 C 40.570313 33.128906 40.605469 32.492188 40.234375 32.078125 C 39.863281 31.664063 39.226563 31.628906 38.8125 32 C 38.8125 32 37.765625 32.957031 35.46875 33.96875 C 34.625 34.339844 33.601563 34.707031 32.4375 35.03125 C 32.167969 35 31.898438 35.078125 31.6875 35.25 C 29.824219 35.703125 27.609375 36 25 36 C 22.371094 36 20.152344 35.675781 18.28125 35.21875 C 18.070313 35.078125 17.8125 35.019531 17.5625 35.0625 C 16.394531 34.738281 15.378906 34.339844 14.53125 33.96875 C 12.234375 32.957031 11.1875 32 11.1875 32 C 10.960938 31.789063 10.648438 31.699219 10.34375 31.75 C 9.957031 31.808594 9.636719 32.085938 9.53125 32.464844 C 9.421875 32.839844 9.546875 33.246094 9.84375 33.5 C 9.84375 33.5 11.195313 34.671875 13.71875 35.78125 C 14.398438 36.078125 15.171875 36.378906 16.03125 36.65625 L 14.34375 38.9375 C 13.367188 38.84375 11.5 38.496094 9.5 37.71875 C 7.300781 36.863281 5.167969 35.496094 4.03125 33.65625 C 4.078125 29.097656 5.0625 24.125 6.28125 20.09375 C 6.90625 18.027344 7.5625 16.226563 8.1875 14.84375 C 8.8125 13.460938 9.492188 12.460938 9.6875 12.28125 C 12.707031 9.894531 17.140625 9.296875 18.28125 9.15625 Z M 18.5 21 C 15.949219 21 14 23.316406 14 26 C 14 28.683594 15.949219 31 18.5 31 C 21.050781 31 23 28.683594 23 26 C 23 23.316406 21.050781 21 18.5 21 Z M 31.5 21 C 28.949219 21 27 23.316406 27 26 C 27 28.683594 28.949219 31 31.5 31 C 34.050781 31 36 28.683594 36 26 C 36 23.316406 34.050781 21 31.5 21 Z M 18.5 23 C 19.816406 23 21 24.265625 21 26 C 21 27.734375 19.816406 29 18.5 29 C 17.183594 29 16 27.734375 16 26 C 16 24.265625 17.183594 23 18.5 23 Z M 31.5 23 C 32.816406 23 34 24.265625 34 26 C 34 27.734375 32.816406 29 31.5 29 C 30.183594 29 29 27.734375 29 26 C 29 24.265625 30.183594 23 31.5 23 Z"></path>
                  </svg>
                </a>
                <a
                  href="https://www.tiktok.com/@calce_team_"
                  target="_blank"
                  className="social-icon"
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                  </svg>
                </a>
                <a
                  href="https://twitch.tv/calceteam_"
                  target="_blank"
                  className="social-icon"
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 Calce Team. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
