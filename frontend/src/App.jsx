import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [currentView, setCurrentView] = useState('landing')
  const [selectedGame, setSelectedGame] = useState('lol')

  const games = {
    lol: {
      name: 'League of Legends',
      image: 'https://images.contentstack.io/v3/assets/blt731acb42bb3d1659/blt0e1bb0a9b405e411/65c15a45fd5b15be2e86e34e/11_20_2023_LoL_Logo_Refresh_Secondary_Horiz_RGB.png'
    },
    valorant: {
      name: 'Valorant',
      image: 'https://seeklogo.com/images/V/valorant-logo-FAB2CA0E55-seeklogo.com.png'
    }
  }

  useEffect(() => {
    const savedUser = localStorage.getItem('calce_user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    
    const userData = {
      id: Date.now(),
      username: formData.get('username'),
      email: formData.get('email')
    }
    
    localStorage.setItem('calce_user', JSON.stringify(userData))
    setUser(userData)
    setCurrentView('dashboard')
  }

  const handleLogout = () => {
    localStorage.removeItem('calce_user')
    setUser(null)
    setCurrentView('landing')
  }

  if (currentView === 'landing' && !user) {
    return (
      <div className="landing">
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-bg"></div>
          <div className="hero-content">
            <div className="calce-logo">
              <div className="logo-triangle">
                <span className="logo-ca">CA</span>
              </div>
            </div>
            <h1>CALCE TEAM</h1>
            <p>Club de Esports Profesional</p>
            <div className="social-links">
              <span>Instagram: calceliga</span>
              <span>Twitter: CalceTeam0</span>
              <span>TikTok: @calce_team_</span>
            </div>
            <button 
              className="enter-btn"
              onClick={() => setCurrentView('login')}
            >
              Acceder al Portal
            </button>
          </div>
        </section>

        {/* About Section */}
        <section className="about">
          <div className="container">
            <h2>Sobre Nosotros</h2>
            <p>Somos un club de esports dedicado a la competición profesional en League of Legends y Valorant. Participamos en torneos nacionales e internacionales representando la excelencia en el gaming competitivo.</p>
            
            <div className="stats-grid">
              <div className="stat">
                <h3>5+</h3>
                <p>Torneos Ganados</p>
              </div>
              <div className="stat">
                <h3>15+</h3>
                <p>Jugadores Activos</p>
              </div>
              <div className="stat">
                <h3>2</h3>
                <p>Juegos Profesionales</p>
              </div>
            </div>
          </div>
        </section>

        {/* Games Section */}
        <section className="games">
          <div className="container">
            <h2>Nuestros Juegos</h2>
            <div className="games-showcase">
              <div className="game-item">
                <img src={games.lol.image} alt="League of Legends" />
                <h3>League of Legends</h3>
                <p>Equipo competitivo en la liga nacional</p>
              </div>
              <div className="game-item">
                <img src={games.valorant.image} alt="Valorant" />
                <h3>Valorant</h3>
                <p>División táctica de shooters</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  if (currentView === 'login') {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-card">
            <div className="calce-logo-small">
              <div className="logo-triangle-small">
                <span className="logo-ca-small">CA</span>
              </div>
            </div>
            <h1>Portal Calce Team</h1>
            <form onSubmit={handleLogin} className="login-form">
              <input 
                type="text" 
                name="username" 
                placeholder="Nombre de usuario" 
                required 
              />
              <input 
                type="email" 
                name="email" 
                placeholder="Email" 
                required 
              />
              <button type="submit">Entrar</button>
            </form>
            <button 
              className="back-btn"
              onClick={() => setCurrentView('landing')}
            >
              ← Volver
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Dashboard y torneos para usuarios logueados
  return (
    <div className="app">
      <header className="header">
        <div className="container">
          <div className="header-logo">
            <div className="logo-triangle-header">
              <span className="logo-ca-header">CA</span>
            </div>
            <span>Calce Team</span>
          </div>
          <nav className="nav">
            <button 
              className={currentView === 'dashboard' ? 'nav-btn active' : 'nav-btn'}
              onClick={() => setCurrentView('dashboard')}
            >
              Dashboard
            </button>
            <button 
              className={currentView === 'tournaments' ? 'nav-btn active' : 'nav-btn'}
              onClick={() => setCurrentView('tournaments')}
            >
              Torneos
            </button>
            <button 
              className={currentView === 'team' ? 'nav-btn active' : 'nav-btn'}
              onClick={() => setCurrentView('team')}
            >
              Mi Equipo
            </button>
            <button className="nav-btn logout" onClick={handleLogout}>
              Salir
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        <div className="container">
          
          {currentView === 'dashboard' && (
            <section className="dashboard">
              <h2>Bienvenido, {user?.username}</h2>
              <div className="dashboard-grid">
                <div className="dash-card">
                  <h3>Mi Equipo</h3>
                  <p>Calce Team LoL</p>
                  <button onClick={() => setCurrentView('team')}>Ver Equipo</button>
                </div>
                <div className="dash-card">
                  <h3>Próximos Torneos</h3>
                  <p>3 disponibles</p>
                  <button onClick={() => setCurrentView('tournaments')}>Ver Torneos</button>
                </div>
                <div className="dash-card">
                  <h3>Mis Resultados</h3>
                  <p>5 partidas</p>
                  <button>Ver Historial</button>
                </div>
              </div>
            </section>
          )}

          {currentView === 'tournaments' && (
            <section className="tournaments">
              <h2>Torneos Disponibles</h2>
              
              <div className="game-selector">
                <h3>Seleccionar Juego:</h3>
                <div className="games-grid">
                  {Object.entries(games).map(([gameKey, game]) => (
                    <div 
                      key={gameKey}
                      className={`game-card ${selectedGame === gameKey ? 'selected' : ''}`}
                      onClick={() => setSelectedGame(gameKey)}
                    >
                      <img src={game.image} alt={game.name} />
                      <h4>{game.name}</h4>
                    </div>
                  ))}
                </div>
              </div>

              <div className="tournaments-list">
                <h3>Torneos de {games[selectedGame].name}</h3>
                <div className="tournament-cards">
                  <div className="tournament-card">
                    <h4>Copa de Invierno 2025</h4>
                    <p><strong>Fecha:</strong> 15 Febrero - 1 Marzo</p>
                    <p><strong>Equipos:</strong> 0/16</p>
                    <p><strong>Premio:</strong> €500</p>
                    <button className="join-btn">Inscribirse</button>
                  </div>
                  <div className="tournament-card">
                    <h4>Liga Regional</h4>
                    <p><strong>Fecha:</strong> 1 Marzo - 30 Abril</p>
                    <p><strong>Equipos:</strong> 2/32</p>
                    <p><strong>Premio:</strong> €1000</p>
                    <button className="join-btn">Inscribirse</button>
                  </div>
                  <div className="tournament-card">
                    <h4>Championship Series</h4>
                    <p><strong>Fecha:</strong> 15 Mayo - 30 Junio</p>
                    <p><strong>Equipos:</strong> 1/64</p>
                    <p><strong>Premio:</strong> €2500</p>
                    <button className="join-btn">Inscribirse</button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {currentView === 'team' && (
            <section className="team-section">
              <h2>Calce Team - Roster</h2>
              <div className="team-view">
                <div className="team-info">
                  <div className="players-section">
                    <h3>Jugadores Principales</h3>
                    <div className="players-list">
                      <div className="player-card captain">
                        <span className="crown">👑</span>
                        <span>{user.username} (Capitán)</span>
                      </div>
                      <div className="player-card">CalceADC</div>
                      <div className="player-card">CalceMid</div>
                      <div className="player-card">CalceJungle</div>
                      <div className="player-card">CalceSupport</div>
                    </div>
                  </div>
                  <div className="subs-section">
                    <h3>Suplentes</h3>
                    <div className="players-list">
                      <div className="player-card">CalceSub1</div>
                      <div className="player-card">CalceSub2</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  )
}

export default App