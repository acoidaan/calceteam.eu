const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const mysql = require("mysql2");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");
require("dotenv").config();

const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

const app = express();
const port = process.env.PORT || 8080;

// Middlewares
app.use(
  cors({
    origin: ["https://www.calceteam.eu", "https://calceteam.eu"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Conexión a MySQL
const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,

  // Pool configuration para Railway
  connectionLimit: 10,
  acquireTimeout: 60000,
  timeout: 60000,

  // Reconexión automática
  reconnect: true,
  idleTimeout: 300000,

  // Keep alive para evitar timeouts
  keepAliveInitialDelay: 0,
  enableKeepAlive: true,

  // Manejo de errores de conexión
  handleDisconnects: true,
});

// Manejar eventos del pool
db.on('connection', function (connection) {
  console.log('✅ Nueva conexión MySQL establecida como id ' + connection.threadId);
});

db.on('error', function(err) {
  console.error('❌ Error en pool MySQL:', err);
  if(err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('🔄 Conexión perdida, el pool se reconectará automáticamente');
  } else {
    throw err;
  }
});

// Test inicial de conexión
db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Error al conectar con MySQL:", err);
    process.exit(1);
  }
  console.log("✅ Pool MySQL conectado correctamente.");
  connection.release(); // Liberar la conexión de prueba
});

// Configuración de multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Solo se permiten imágenes"));
  },
});

// Middleware para verificar token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No autorizado" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido" });
  }
};

// Middleware para verificar admin
function isAdmin(req, res, next) {
  const query = "SELECT role FROM users WHERE id = ?";
  db.query(query, [req.userId], (err, results) => {
    if (err || results.length === 0) return res.sendStatus(403);
    if (results[0].role !== "admin") return res.sendStatus(403);
    next();
  });
}

// ==========================================
// FUNCIÓN SIMPLIFICADA PARA GENERAR PARTIDOS
// ==========================================
// ==========================================
// ALGORITMO DE CALENDARIO TIPO FÚTBOL
// ==========================================
function generateTournamentMatches(tournamentId, teams, startDate, callback) {
  console.log(`🎯 [DEBUG] Generando partidos para torneo ${tournamentId}`);
  console.log(
    `🎯 [DEBUG] Equipos recibidos:`,
    teams.map((t) => `${t.id}: ${t.name}`)
  );
  console.log(`🎯 [DEBUG] Fecha inicio: ${startDate}`);

  if (teams.length < 2) {
    console.log("⚠️ [DEBUG] Error: Se necesitan al menos 2 equipos");
    return callback(new Error("Se necesitan al menos 2 equipos"));
  }

  const createMatchesTable = `
    CREATE TABLE IF NOT EXISTS tournament_matches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tournament_id INT NOT NULL,
      team1_id INT NOT NULL,
      team2_id INT NOT NULL,
      match_date DATE,
      match_time TIME DEFAULT '20:00:00',
      match_format VARCHAR(10) DEFAULT 'BO3',
      jornada INT DEFAULT 1,
      score_team1 INT DEFAULT 0,
      score_team2 INT DEFAULT 0,
      status ENUM('pending', 'completed', 'live', 'cancelled') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.query(createMatchesTable, (err) => {
    if (err) {
      console.error("❌ [DEBUG] Error creando tabla tournament_matches:", err);
    } else {
      console.log("✅ [DEBUG] Tabla tournament_matches verificada/creada");
    }

    console.log("🔄 [DEBUG] Iniciando generación de calendario...");

    // Generar calendario tipo liga de fútbol
    const matches = generateFootballSchedule(teams, tournamentId, startDate);

    console.log(
      `✅ [DEBUG] Calendario generado con ${matches.length} partidos`
    );
    console.log(
      "📋 [DEBUG] Partidos generados:",
      matches.map(
        (m) =>
          `J${m.jornada}: Team${m.team1_id} vs Team${m.team2_id} (${m.match_date})`
      )
    );

    if (matches.length === 0) {
      console.log("⚠️ [DEBUG] No se generaron partidos, retornando 0");
      return callback(null, 0);
    }

    // Insertar partidos
    console.log("💾 [DEBUG] Iniciando inserción de partidos...");
    insertMatches(matches, (err, insertedCount) => {
      if (err) {
        console.error("❌ [DEBUG] Error en inserción:", err);
        return callback(err);
      }

      console.log(
        `✅ [DEBUG] ${insertedCount} partidos insertados exitosamente`
      );

      // Inicializar estadísticas
      console.log("📊 [DEBUG] Inicializando estadísticas...");
      initializeStats(tournamentId, teams, callback, insertedCount);
    });
  });
}

// Generar calendario estilo liga de fútbol con debug
function generateFootballSchedule(teams, tournamentId, startDate) {
  console.log("🏈 [DEBUG] === INICIO GENERACIÓN CALENDARIO ===");
  console.log(`🏈 [DEBUG] Input - ${teams.length} equipos, torneo ${tournamentId}`);
  
  const matches = [];
  const numTeams = teams.length;
  const defaultTime = "20:00:00";
  
  // Si hay número impar de equipos, agregar "descanso"
  let teamsArray = [...teams];
  if (numTeams % 2 !== 0) {
    console.log("🏈 [DEBUG] Número impar de equipos, añadiendo descanso");
    teamsArray.push({ id: null, name: "DESCANSO" });
  }
  
  const totalTeams = teamsArray.length;
  const totalJornadas = (totalTeams - 1) * 2; // Ida y vuelta
  
  console.log(`🏈 [DEBUG] Configuración:`);
  console.log(`🏈 [DEBUG] - Equipos originales: ${numTeams}`);
  console.log(`🏈 [DEBUG] - Equipos totales (con descanso): ${totalTeams}`);
  console.log(`🏈 [DEBUG] - Jornadas totales: ${totalJornadas}`);
  console.log(`🏈 [DEBUG] - Equipos array:`, teamsArray.map(t => `${t.id || 'NULL'}: ${t.name}`));

  // Generar ida
  console.log("🏈 [DEBUG] === GENERANDO IDA ===");
  for (let jornada = 1; jornada <= totalTeams - 1; jornada++) {
    console.log(`🏈 [DEBUG] Generando jornada ${jornada} (IDA)`);
    const jornadaMatches = generateJornadaMatches(teamsArray, jornada, false);
    console.log(`🏈 [DEBUG] Jornada ${jornada} generó ${jornadaMatches.length} partidos`);
    addMatchesToList(matches, jornadaMatches, tournamentId, startDate, jornada, defaultTime);
  }

  // Generar vuelta (invertir equipos)
  console.log("🏈 [DEBUG] === GENERANDO VUELTA ===");
  for (let jornada = 1; jornada <= totalTeams - 1; jornada++) {
    const jornadaVuelta = jornada + (totalTeams - 1);
    console.log(`🏈 [DEBUG] Generando jornada ${jornadaVuelta} (VUELTA de jornada ${jornada})`);
    const jornadaMatches = generateJornadaMatches(teamsArray, jornada, true);
    console.log(`🏈 [DEBUG] Jornada ${jornadaVuelta} generó ${jornadaMatches.length} partidos`);
    addMatchesToList(matches, jornadaMatches, tournamentId, startDate, jornadaVuelta, defaultTime);
  }

  const finalMatches = matches.filter(match => match.team1_id !== null && match.team2_id !== null);
  console.log(`🏈 [DEBUG] === RESULTADO FINAL ===`);
  console.log(`🏈 [DEBUG] Partidos antes de filtrar: ${matches.length}`);
  console.log(`🏈 [DEBUG] Partidos después de filtrar: ${finalMatches.length}`);
  
  return finalMatches;
}
// Generar partidos para una jornada específica con debug
function generateJornadaMatches(teams, jornada, isVuelta) {
  console.log(`⚽ [DEBUG] === GENERANDO JORNADA ${jornada} (${isVuelta ? 'VUELTA' : 'IDA'}) ===`);
  console.log(`⚽ [DEBUG] Teams input:`, teams.map(t => `${t.id || 'NULL'}: ${t.name}`));
  
  const matches = [];
  const totalTeams = teams.length;
  
  console.log(`⚽ [DEBUG] Total teams: ${totalTeams}`);
  
  // Algoritmo round-robin
  const homeTeams = [];
  const awayTeams = [];
  
  // Equipo fijo (posición 0) siempre en casa
  if (jornada % 2 === 1) {
    homeTeams.push(teams[0]);
    awayTeams.push(teams[jornada]);
    console.log(`⚽ [DEBUG] Equipo fijo: ${teams[0].name} vs ${teams[jornada].name}`);
  } else {
    homeTeams.push(teams[jornada]);
    awayTeams.push(teams[0]);
    console.log(`⚽ [DEBUG] Equipo fijo: ${teams[jornada].name} vs ${teams[0].name}`);
  }
  
  // Rotar el resto de equipos
  console.log(`⚽ [DEBUG] Rotando equipos restantes...`);
  for (let i = 1; i < totalTeams / 2; i++) {
    const homeIndex = (jornada + i - 1) % (totalTeams - 1) + 1;
    const awayIndex = (jornada - i - 1 + totalTeams - 1) % (totalTeams - 1) + 1;
    
    console.log(`⚽ [DEBUG] Rotación ${i}: homeIndex=${homeIndex}, awayIndex=${awayIndex}`);
    
    if (homeIndex < teams.length && awayIndex < teams.length) {
      homeTeams.push(teams[homeIndex]);
      awayTeams.push(teams[awayIndex]);
      console.log(`⚽ [DEBUG] Añadido: ${teams[homeIndex].name} vs ${teams[awayIndex].name}`);
    } else {
      console.log(`⚽ [DEBUG] ⚠️ Índices fuera de rango: homeIndex=${homeIndex}, awayIndex=${awayIndex}, teams.length=${teams.length}`);
    }
  }
  
  console.log(`⚽ [DEBUG] Equipos locales:`, homeTeams.map(t => t.name));
  console.log(`⚽ [DEBUG] Equipos visitantes:`, awayTeams.map(t => t.name));
  
  // Crear partidos
  for (let i = 0; i < homeTeams.length; i++) {
    let team1 = homeTeams[i];
    let team2 = awayTeams[i];
    
    console.log(`⚽ [DEBUG] Creando partido ${i + 1}: ${team1.name} vs ${team2.name} (antes de vuelta)`);
    
    // En vuelta, invertir local/visitante
    if (isVuelta) {
      [team1, team2] = [team2, team1];
      console.log(`⚽ [DEBUG] Partido ${i + 1} invertido (vuelta): ${team1.name} vs ${team2.name}`);
    }
    
    if (team1.id && team2.id) {
      matches.push({ team1, team2 });
      console.log(`⚽ [DEBUG] ✅ Partido válido añadido: ID${team1.id} vs ID${team2.id}`);
    } else {
      console.log(`⚽ [DEBUG] ❌ Partido con descanso omitido: ${team1.name} vs ${team2.name}`);
    }
  }
  
  console.log(`⚽ [DEBUG] Jornada ${jornada} completada. Partidos válidos: ${matches.length}`);
  return matches;
}

// Agregar partidos a la lista con fecha y jornada con debug
function addMatchesToList(matches, jornadaMatches, tournamentId, startDate, jornada, defaultTime) {
  console.log(`📅 [DEBUG] Añadiendo ${jornadaMatches.length} partidos a jornada ${jornada}`);
  
  const matchDate = new Date(startDate);
  matchDate.setDate(matchDate.getDate() + (jornada - 1) * 7); // Una semana entre jornadas
  
  console.log(`📅 [DEBUG] Fecha calculada para jornada ${jornada}: ${matchDate.toISOString().split('T')[0]}`);
  
  jornadaMatches.forEach((match, index) => {
    const matchObj = {
      tournament_id: tournamentId,
      team1_id: match.team1.id,
      team2_id: match.team2.id,
      match_date: matchDate.toISOString().split('T')[0],
      match_time: defaultTime,
      match_format: 'BO3',
      jornada: jornada,
      score_team1: 0,
      score_team2: 0,
      status: 'pending'
    };
    
    matches.push(matchObj);
    console.log(`📅 [DEBUG] Partido ${index + 1} añadido:`, matchObj);
  });
  
  console.log(`📅 [DEBUG] Total partidos en lista: ${matches.length}`);
}

// Insertar partidos con debug mejorado
function insertMatches(matches, callback) {
  console.log(`💾 [DEBUG] === INSERTANDO ${matches.length} PARTIDOS ===`);
  
  const insertQuery = `
    INSERT INTO tournament_matches 
    (tournament_id, team1_id, team2_id, match_date, match_time, match_format, jornada, score_team1, score_team2, status)
    VALUES ?
  `;

  const values = matches.map((m, index) => {
    const row = [
      m.tournament_id, m.team1_id, m.team2_id,
      m.match_date, m.match_time, m.match_format, m.jornada,
      m.score_team1, m.score_team2, m.status
    ];
    
    console.log(`💾 [DEBUG] Fila ${index + 1}:`, row);
    return row;
  });

  console.log(`💾 [DEBUG] Query SQL:`, insertQuery);
  console.log(`💾 [DEBUG] Total valores a insertar: ${values.length}`);

  db.query(insertQuery, [values], (err, result) => {
    if (err) {
      console.error("❌ [DEBUG] Error en query de inserción:", err);
      console.error("❌ [DEBUG] Query que falló:", insertQuery);
      console.error("❌ [DEBUG] Valores que causaron error:", values);
      return callback(err);
    }

    console.log(`✅ [DEBUG] Inserción exitosa. Resultado:`, result);
    console.log(`✅ [DEBUG] Filas afectadas: ${result.affectedRows}`);
    console.log(`✅ [DEBUG] ID de inserción: ${result.insertId}`);
    
    callback(null, matches.length);
  });
}

// ==========================================
// FUNCIÓN AUXILIAR PARA REGENERAR PARTIDOS
// ==========================================
function regenerateMatches(tournamentId, tournament, callback) {
  console.log(`🔄 Regenerando partidos para torneo ${tournamentId}`);

  // Eliminar partidos existentes
  const deleteMatchesQuery =
    "DELETE FROM tournament_matches WHERE tournament_id = ?";
  db.query(deleteMatchesQuery, [tournamentId], (err) => {
    if (err) {
      console.error("❌ Error eliminando partidos:", err);
      return callback(err);
    }

    // Obtener equipos inscritos
    const getTeamsQuery = `
      SELECT t.id, t.name 
      FROM teams t
      INNER JOIN tournaments_teams tt ON t.id = tt.team_id
      WHERE tt.tournament_id = ?
      ORDER BY t.name
    `;

    db.query(getTeamsQuery, [tournamentId], (err, teams) => {
      if (err) {
        console.error("❌ Error obteniendo equipos:", err);
        return callback(err);
      }

      if (teams.length < 2) {
        console.log("⚠️ Menos de 2 equipos, no se generan partidos");
        return callback(null, 0);
      }

      console.log(
        `📋 Equipos encontrados:`,
        teams.map((t) => t.name)
      );

      // Generar partidos
      generateTournamentMatches(tournamentId, teams, tournament.date, callback);
    });
  });
}

// ==========================================
// RUTAS DE AUTENTICACIÓN
// ==========================================

// Registro de usuario con verificación
app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: "Faltan campos" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const checkQuery = "SELECT * FROM users WHERE email = ?";

    db.query(checkQuery, [email], async (err, results) => {
      if (err)
        return res.status(500).json({ message: "Error al comprobar email" });
      if (results.length > 0)
        return res.status(400).json({ message: "Correo ya registrado" });

      const insertQuery = `
        INSERT INTO users (username, email, password, created_at, verified, role)
        VALUES (?, ?, ?, NOW(), ?, ?)
      `;

      db.query(
        insertQuery,
        [username, email, hashedPassword, 0, "user"],
        async (err) => {
          if (err)
            return res.status(500).json({ message: "Error al registrar" });

          const verificationToken = jwt.sign(
            { email },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
          );

          await resend.emails.send({
            from: "Calce Team <noreply@calceteam.eu>",
            to: email,
            subject: "Verifica tu cuenta - Calce Team",
            html: `<h3>¡Bienvenido a Calce Team!</h3>
                 <p>Haz clic <a href="http://www.calceteam.eu/api/verify/${verificationToken}">aquí</a> para verificar tu cuenta.</p>
                 <p>Este enlace caduca en 1 hora.</p>`,
          });

          res.status(200).json({
            message:
              "Registro exitoso. Revisa tu correo para verificar tu cuenta.",
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ message: "Error al registrar usuario" });
  }
});

// Verificación de cuenta
app.get("/api/verify/:token", (req, res) => {
  const { token } = req.params;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;
    const query = "UPDATE users SET verified = 1 WHERE email = ?";

    db.query(query, [email], (err, result) => {
      if (err) return res.status(500).send("Error al verificar cuenta.");
      if (result.affectedRows === 0)
        return res.status(400).send("Usuario no encontrado");

      res.send(
        `<h2>✅ Cuenta verificada correctamente</h2><p>Ya puedes iniciar sesión en <a href="/">Calce Team</a>.</p>`
      );
    });
  } catch (err) {
    return res.status(400).send("Token inválido o expirado.");
  }
});

// Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const query = "SELECT * FROM users WHERE email = ?";

  db.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Error interno" });
    if (results.length === 0)
      return res.status(401).json({ message: "Email no encontrado" });

    const user = results[0];
    if (user.verified === 0)
      return res
        .status(401)
        .json({ message: "Debes verificar tu cuenta primero." });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: "Contraseña incorrecta" });

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    res.status(200).json({
      token,
      username: user.username,
    });
  });
});

// RECUPERACIÓN DE CONTRASEÑA
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email requerido" });
  }

  try {
    const query = "SELECT * FROM users WHERE email = ?";
    db.query(query, [email], async (err, results) => {
      if (err) {
        return res.status(500).json({ message: "Error del servidor" });
      }

      if (results.length === 0) {
        return res.json({
          message:
            "Si el email existe, recibirás instrucciones para recuperar tu contraseña",
        });
      }

      const user = results[0];
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 3600000);

      const updateQuery =
        "UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?";
      db.query(
        updateQuery,
        [resetToken, resetTokenExpiry, user.id],
        async (err) => {
          if (err) {
            return res
              .status(500)
              .json({ message: "Error al generar token de recuperación" });
          }

          try {
            await resend.emails.send({
              from: "Calce Team <noreply@calceteam.eu>",
              to: email,
              subject: "Recuperar contraseña - Calce Team",
              html: `
              <h3>Recuperación de contraseña</h3>
              <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
              <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
              <a href="http://calceteam.eu:8080?reset-password=true&token=${resetToken}" style="display: inline-block; padding: 10px 20px; background-color: #2563EB; color: white; text-decoration: none; border-radius: 5px;">Restablecer Contraseña</a>
              <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
              <p>Este enlace expirará en 1 hora.</p>
            `,
            });

            res.json({
              message: "Se ha enviado un enlace de recuperación a tu email",
            });
          } catch (emailError) {
            console.error("Error enviando email:", emailError);
            res
              .status(500)
              .json({ message: "Error al enviar el email de recuperación" });
          }
        }
      );
    });
  } catch (error) {
    console.error("Error en forgot-password:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
});

app.get("/api/verify-reset-token/:token", (req, res) => {
  const { token } = req.params;

  const query =
    "SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()";
  db.query(query, [token], (err, results) => {
    if (err) {
      return res.status(500).json({ message: "Error del servidor" });
    }

    if (results.length === 0) {
      return res.status(400).json({ message: "Token inválido o expirado" });
    }

    res.json({ valid: true });
  });
});

app.post("/api/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res
      .status(400)
      .json({ message: "Token y nueva contraseña requeridos" });
  }

  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: "La contraseña debe tener al menos 6 caracteres" });
  }

  try {
    const query =
      "SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()";
    db.query(query, [token], async (err, results) => {
      if (err) {
        return res.status(500).json({ message: "Error del servidor" });
      }

      if (results.length === 0) {
        return res.status(400).json({ message: "Token inválido o expirado" });
      }

      const user = results[0];
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const updateQuery =
        "UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?";
      db.query(updateQuery, [hashedPassword, user.id], (err) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Error al actualizar contraseña" });
        }

        res.json({ message: "Contraseña actualizada correctamente" });
      });
    });
  } catch (error) {
    console.error("Error en reset-password:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
});

// ==========================================
// RUTAS DE PERFIL
// ==========================================

// Perfil
app.get("/api/user/profile", verifyToken, (req, res) => {
  const query = "SELECT username, email, profile_pic FROM users WHERE id = ?";
  db.query(query, [req.userId], (err, results) => {
    if (err) return res.status(500).json({ message: "Error del servidor" });
    if (!results[0])
      return res.status(404).json({ message: "Usuario no encontrado" });

    let profilePic = null;
    if (results[0].profile_pic) {
      profilePic = `data:image/jpeg;base64,${results[0].profile_pic.toString("base64")}`;
    }

    res.json({
      username: results[0].username,
      email: results[0].email,
      profilePic,
    });
  });
});

// Actualizar email o username
app.put("/api/user/update", verifyToken, (req, res) => {
  const { field, value, currentPassword } = req.body;
  const allowedFields = ["username", "email"];
  if (!allowedFields.includes(field)) {
    return res.status(400).json({ message: "Campo no permitido" });
  }

  const query = "SELECT * FROM users WHERE id = ?";
  db.query(query, [req.userId], async (err, results) => {
    if (err || results.length === 0)
      return res.status(500).json({ message: "Error al buscar usuario" });

    const user = results[0];
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match)
      return res.status(401).json({ message: "Contraseña incorrecta" });

    const updateQuery = `UPDATE users SET ${field} = ? WHERE id = ?`;
    db.query(updateQuery, [value, req.userId], (err) => {
      if (err) return res.status(500).json({ message: "Error al actualizar" });
      res.json({ message: "Actualizado correctamente" });
    });
  });
});

// Cambiar contraseña
app.put("/api/user/change-password", verifyToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const query = "SELECT * FROM users WHERE id = ?";
  db.query(query, [req.userId], async (err, results) => {
    if (err || results.length === 0)
      return res.status(500).json({ message: "Error al buscar usuario" });

    const user = results[0];
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match)
      return res.status(401).json({ message: "Contraseña actual incorrecta" });

    const hashed = await bcrypt.hash(newPassword, 10);
    const updateQuery = "UPDATE users SET password = ? WHERE id = ?";
    db.query(updateQuery, [hashed, req.userId], (err) => {
      if (err)
        return res.status(500).json({ message: "Error al cambiar contraseña" });
      res.json({ message: "Contraseña actualizada" });
    });
  });
});

// Subir avatar
app.post(
  "/api/user/upload-avatar",
  verifyToken,
  upload.single("profilePic"),
  (req, res) => {
    if (!req.file)
      return res.status(400).json({ message: "No se subió archivo" });
    const query = "UPDATE users SET profile_pic = ? WHERE id = ?";

    db.query(query, [req.file.buffer, req.userId], (err) => {
      if (err) return res.status(500).json({ message: "Error al actualizar" });
      const profilePic = `data:image/${req.file.mimetype.split("/")[1]};base64,${req.file.buffer.toString("base64")}`;
      res.json({ profilePic });
    });
  }
);

// ==========================================
// RUTAS DE EQUIPOS
// ==========================================

// Obtener mi equipo
app.get("/api/team/my-team", verifyToken, (req, res) => {
  const { game } = req.query;
  const query = `
    SELECT t.*, GROUP_CONCAT(
      JSON_OBJECT(
        'userId', p.user_id,
        'nickname', p.nickname,
        'role', p.role,
        'opgg', p.opgg_link
      )
    ) as players
    FROM teams t
    LEFT JOIN teams_players p ON t.id = p.team_id
    WHERE t.id IN (SELECT team_id FROM teams_players WHERE user_id = ?)
    AND t.game = ?
    GROUP BY t.id
  `;

  db.query(query, [req.userId, game], (err, results) => {
    if (err) return res.status(500).json({ message: "Error del servidor" });

    if (results.length === 0) {
      return res.json({ team: null });
    }

    const team = results[0];
    let teamData = {
      id: team.id,
      name: team.name,
      game: team.game,
      code: team.invite_code,
      createdBy: team.created_by,
      logo: team.logo
        ? `data:image/jpeg;base64,${team.logo.toString("base64")}`
        : null,
      players: [],
    };

    if (team.players) {
      try {
        teamData.players = JSON.parse(`[${team.players}]`);
      } catch (e) {
        teamData.players = [];
      }
    }

    res.json({ team: teamData });
  });
});

// Crear equipo
app.post(
  "/api/team/create",
  verifyToken,
  upload.single("teamLogo"),
  (req, res) => {
    const { teamName, game, playerRole, playerNickname, playerOpgg } = req.body;
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const teamLogo = req.file ? req.file.buffer : null;

    const createTeamQuery =
      "INSERT INTO teams (name, game, invite_code, logo, created_by, created_at) VALUES (?, ?, ?, ?, ?, NOW())";

    db.query(
      createTeamQuery,
      [teamName, game, inviteCode, teamLogo, req.userId],
      (err, result) => {
        if (err) {
          console.error("❌ Error en createTeamQuery:", err);
          return res.status(500).json({ message: "Error al crear equipo" });
        }

        const teamId = result.insertId;

        const addPlayerQuery =
          "INSERT INTO teams_players (team_id, user_id, nickname, role, opgg_link) VALUES (?, ?, ?, ?, ?)";

        db.query(
          addPlayerQuery,
          [teamId, req.userId, playerNickname, playerRole, playerOpgg],
          (err) => {
            if (err) {
              console.error("❌ Error al añadir jugador:", err);
              return res
                .status(500)
                .json({ message: "Error al añadir jugador" });
            }

            res.json({
              message: "Equipo creado exitosamente",
              teamId,
              inviteCode,
            });
          }
        );
      }
    );
  }
);

// ==========================================
// RUTAS DE TORNEOS
// ==========================================

app.get("/api/tournaments", (req, res) => {
  const { game } = req.query;
  let query = "SELECT * FROM tournaments";
  let params = [];

  if (game) {
    query += " WHERE game = ?";
    params.push(game);
  }

  query += " ORDER BY date DESC";

  db.query(query, params, (err, results) => {
    if (err)
      return res.status(500).json({ message: "Error al obtener torneos" });
    res.json({ tournaments: results });
  });
});

app.get("/api/user/is-admin", verifyToken, (req, res) => {
  const query = "SELECT role FROM users WHERE id = ?";
  db.query(query, [req.userId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(500).json({ isAdmin: false });
    }
    const role = results[0].role;
    res.json({ isAdmin: role === "admin" });
  });
});

// Crear torneo
app.post("/api/tournaments/create", verifyToken, isAdmin, (req, res) => {
  const { name, game, status, date, description } = req.body;
  const query = `
    INSERT INTO tournaments (name, game, status, date, description, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, NOW(), ?)`;

  db.query(
    query,
    [name, game, status || "abierto", date, description, req.userId],
    (err) => {
      if (err) {
        console.error("Error creando torneo:", err);
        return res.status(500).json({ message: "Error del servidor" });
      }
      res.json({ message: "Torneo creado exitosamente" });
    }
  );
});

// Actualizar torneo - CORREGIDO
app.put("/api/tournaments/update/:id", verifyToken, isAdmin, (req, res) => {
  const { id } = req.params;
  const { name, game, status, date, description } = req.body;

  // Convertir fecha ISO a formato MySQL
  let mysqlDate = date;
  if (date && date.includes('T')) {
    mysqlDate = date.split('T')[0]; // Solo tomar la parte de fecha
  }

  const query = `
    UPDATE tournaments 
    SET name = ?, game = ?, status = ?, date = ?, description = ?
    WHERE id = ?
  `;

  db.query(query, [name, game, status, mysqlDate, description, id], (err) => {
    if (err) {
      console.error("Error actualizando torneo:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }
    res.json({ message: "Torneo actualizado exitosamente" });
  });
});

// Eliminar torneo
app.delete("/api/tournaments/delete/:id", verifyToken, isAdmin, (req, res) => {
  const { id } = req.params;

  // Eliminar en orden: partidos, estadísticas, inscripciones, torneo
  const deleteMatches =
    "DELETE FROM tournament_matches WHERE tournament_id = ?";
  const deleteStats = "DELETE FROM tournament_stats WHERE tournament_id = ?";
  const deleteRegistrations =
    "DELETE FROM tournaments_teams WHERE tournament_id = ?";
  const deleteTournament = "DELETE FROM tournaments WHERE id = ?";

  db.query(deleteMatches, [id], (err) => {
    if (err)
      return res.status(500).json({ message: "Error eliminando partidos" });

    db.query(deleteStats, [id], (err) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Error eliminando estadísticas" });

      db.query(deleteRegistrations, [id], (err) => {
        if (err)
          return res
            .status(500)
            .json({ message: "Error eliminando inscripciones" });

        db.query(deleteTournament, [id], (err) => {
          if (err)
            return res.status(500).json({ message: "Error eliminando torneo" });
          res.json({ message: "Torneo eliminado exitosamente" });
        });
      });
    });
  });
});

// ==========================================
// REGISTRO EN TORNEO CON GENERACIÓN AUTOMÁTICA
// ==========================================
app.post("/api/tournament/register", verifyToken, (req, res) => {
  const { tournamentId, teamId } = req.body;

  if (!tournamentId || !teamId) {
    return res.status(400).json({ message: "Faltan datos requeridos" });
  }

  const checkMemberQuery =
    "SELECT * FROM teams_players WHERE team_id = ? AND user_id = ?";
  db.query(checkMemberQuery, [teamId, req.userId], (err, memberResults) => {
    if (err || memberResults.length === 0) {
      return res
        .status(403)
        .json({ message: "No eres miembro de este equipo" });
    }

    const checkTournamentQuery =
      "SELECT * FROM tournaments WHERE id = ? AND status = 'abierto'";
    db.query(checkTournamentQuery, [tournamentId], (err, tournamentResults) => {
      if (err || tournamentResults.length === 0) {
        return res.status(404).json({ message: "Torneo no disponible" });
      }

      const tournament = tournamentResults[0];

      const checkRegistrationQuery =
        "SELECT * FROM tournaments_teams WHERE tournament_id = ? AND team_id = ?";
      db.query(
        checkRegistrationQuery,
        [tournamentId, teamId],
        (err, regResults) => {
          if (err) {
            return res.status(500).json({ message: "Error del servidor" });
          }

          if (regResults.length > 0) {
            return res
              .status(400)
              .json({ message: "El equipo ya está inscrito en este torneo" });
          }

          // Inscribir el equipo
          const insertQuery =
            "INSERT INTO tournaments_teams (tournament_id, team_id, registration_date) VALUES (?, ?, NOW())";
          db.query(insertQuery, [tournamentId, teamId], (err) => {
            if (err) {
              console.error("Error inscribiendo equipo:", err);
              return res
                .status(500)
                .json({ message: "Error al inscribir equipo" });
            }

            console.log(
              `✅ Equipo ${teamId} inscrito en torneo ${tournamentId}`
            );

            // REGENERAR PARTIDOS AUTOMÁTICAMENTE
            regenerateMatches(
              tournamentId,
              tournament,
              (err, matchesCreated) => {
                if (err) {
                  console.error("❌ Error regenerando partidos:", err);
                  return res.json({
                    message:
                      "Equipo inscrito exitosamente, pero hubo un error generando el calendario",
                  });
                }

                const countTeamsQuery =
                  "SELECT COUNT(*) as count FROM tournaments_teams WHERE tournament_id = ?";
                db.query(
                  countTeamsQuery,
                  [tournamentId],
                  (err, countResults) => {
                    const teamCount =
                      countResults && countResults[0]
                        ? countResults[0].count
                        : 0;

                    res.json({
                      message: `Equipo inscrito exitosamente. Se generaron ${matchesCreated} partidos para ${teamCount} equipos.`,
                      matchesGenerated: matchesCreated,
                      totalTeams: teamCount,
                    });
                  }
                );
              }
            );
          });
        }
      );
    });
  });
});

// ==========================================
// OBTENER EQUIPOS DE UN TORNEO - CORREGIDO
// ==========================================
app.get("/api/tournament/:id/teams", (req, res) => {
  const { id } = req.params;

  console.log(`📋 Obteniendo equipos para torneo ${id}`);

  // Consulta simplificada sin JOIN con tournament_stats (por si no existe)
  const query = `
    SELECT 
      t.id,
      t.name,
      t.logo,
      tt.registration_date
    FROM teams t
    INNER JOIN tournaments_teams tt ON t.id = tt.team_id
    WHERE tt.tournament_id = ?
    ORDER BY t.name ASC
  `;

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error("❌ Error obteniendo equipos del torneo:", err);
      return res.status(500).json({ message: "Error del servidor", error: err.message });
    }

    console.log(`✅ Encontrados ${results.length} equipos`);

    const teams = results.map((team) => ({
      ...team,
      wins: 0,
      losses: 0,
      points: 0,
      games_played: 0,
      logo: team.logo
        ? `data:image/jpeg;base64,${team.logo.toString("base64")}`
        : null,
    }));

    res.json({ teams });
  });
});

// ==========================================
// OBTENER PARTIDOS DE UN TORNEO - CORREGIDO  
// ==========================================
app.get("/api/tournament/:id/matches", (req, res) => {
  const { id } = req.params;

  console.log(`🏆 Obteniendo partidos para torneo ${id}`);

  const query = `
    SELECT 
      m.*,
      t1.name as team1_name,
      t1.logo as team1_logo,
      t2.name as team2_name,
      t2.logo as team2_logo
    FROM tournament_matches m
    INNER JOIN teams t1 ON m.team1_id = t1.id
    INNER JOIN teams t2 ON m.team2_id = t2.id
    WHERE m.tournament_id = ?
    ORDER BY m.jornada ASC, m.match_date ASC, m.match_time ASC
  `;

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error("❌ Error obteniendo partidos:", err);
      return res.status(500).json({ message: "Error del servidor", error: err.message });
    }

    console.log(`✅ Encontrados ${results.length} partidos`);

    const matches = results.map(match => ({
      ...match,
      team1_logo: match.team1_logo ? `data:image/jpeg;base64,${match.team1_logo.toString('base64')}` : null,
      team2_logo: match.team2_logo ? `data:image/jpeg;base64,${match.team2_logo.toString('base64')}` : null,
    }));

    res.json({ matches });
  });
});

// ==========================================
// OBTENER ESTADÍSTICAS - CORREGIDO
// ==========================================
app.get("/api/tournament/:id/stats", (req, res) => {
  const { id } = req.params;

  console.log(`📊 Obteniendo estadísticas para torneo ${id}`);

  // Crear tabla tournament_stats si no existe
  const createStatsTable = `
    CREATE TABLE IF NOT EXISTS tournament_stats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tournament_id INT NOT NULL,
      team_id INT NOT NULL,
      wins INT DEFAULT 0,
      losses INT DEFAULT 0,
      points INT DEFAULT 0,
      games_played INT DEFAULT 0,
      UNIQUE KEY unique_tournament_team (tournament_id, team_id),
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )
  `;

  db.query(createStatsTable, (err) => {
    if (err) {
      console.error("❌ Error creando tabla tournament_stats:", err);
    }

    const query = `
      SELECT 
        COALESCE(ts.tournament_id, ?) as tournament_id,
        t.id as team_id,
        t.name as team_name,
        t.logo as team_logo,
        COALESCE(ts.wins, 0) as wins,
        COALESCE(ts.losses, 0) as losses,
        COALESCE(ts.points, 0) as points,
        COALESCE(ts.games_played, 0) as games_played
      FROM teams t
      INNER JOIN tournaments_teams tt ON t.id = tt.team_id
      LEFT JOIN tournament_stats ts ON t.id = ts.team_id AND ts.tournament_id = ?
      WHERE tt.tournament_id = ?
      ORDER BY COALESCE(ts.points, 0) DESC, COALESCE(ts.wins, 0) DESC
    `;

    db.query(query, [id, id, id], (err, results) => {
      if (err) {
        console.error("❌ Error obteniendo estadísticas:", err);
        return res.status(500).json({ message: "Error del servidor", error: err.message });
      }

      console.log(`✅ Estadísticas obtenidas para ${results.length} equipos`);

      const stats = results.map(stat => ({
        ...stat,
        team_logo: stat.team_logo ? `data:image/jpeg;base64,${stat.team_logo.toString('base64')}` : null
      }));

      res.json({ stats });
    });
  });
});

// ==========================================
// FUNCIÓN DE GENERACIÓN MEJORADA
// ==========================================


// Función auxiliar para inicializar estadísticas
function initializeStats(tournamentId, teams, callback, matchesCreated) {
  const createStatsTable = `
    CREATE TABLE IF NOT EXISTS tournament_stats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tournament_id INT NOT NULL,
      team_id INT NOT NULL,
      wins INT DEFAULT 0,
      losses INT DEFAULT 0,
      points INT DEFAULT 0,
      games_played INT DEFAULT 0,
      UNIQUE KEY unique_tournament_team (tournament_id, team_id)
    )
  `;

  db.query(createStatsTable, (err) => {
    if (err) {
      console.error("❌ Error creando tabla de estadísticas:", err);
    }

    const statsQuery = `
      INSERT INTO tournament_stats (tournament_id, team_id, wins, losses, points, games_played)
      VALUES ?
      ON DUPLICATE KEY UPDATE
      wins = 0, losses = 0, points = 0, games_played = 0
    `;

    const statsValues = teams.map(team => [tournamentId, team.id, 0, 0, 0, 0]);

    db.query(statsQuery, [statsValues], (err) => {
      if (err) {
        console.error("❌ Error inicializando estadísticas:", err);
        return callback(err);
      }
      console.log(`✅ Estadísticas inicializadas para ${teams.length} equipos`);
      callback(null, matchesCreated);
    });
  });
}

// ==========================================
// ADMIN: GESTIÓN DE PARTIDOS
// ==========================================

// Obtener todos los partidos para admin
app.get("/api/admin/matches", verifyToken, isAdmin, (req, res) => {
  const { tournamentId } = req.query;

  let query = `
    SELECT 
      m.*,
      t.name as tournament_name,
      t1.name as team1_name,
      t2.name as team2_name
    FROM tournament_matches m
    INNER JOIN tournaments t ON m.tournament_id = t.id
    INNER JOIN teams t1 ON m.team1_id = t1.id
    INNER JOIN teams t2 ON m.team2_id = t2.id
  `;

  let params = [];
  if (tournamentId) {
    query += " WHERE m.tournament_id = ?";
    params.push(tournamentId);
  }

  query += " ORDER BY m.tournament_id, m.jornada, m.match_date";

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("Error obteniendo partidos admin:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }
    res.json({ matches: results });
  });
});

// Editar partido (admin) - CORREGIDO
app.put("/api/admin/matches/:matchId", verifyToken, isAdmin, (req, res) => {
  const { matchId } = req.params;
  const {
    match_date,
    match_time,
    match_format,
    score_team1,
    score_team2,
    status,
  } = req.body;

  const fieldsToUpdate = [];
  const values = [];

  if (match_date) {
    // Convertir fecha ISO a formato MySQL
    const mysqlDate = match_date.includes('T') ? match_date.split('T')[0] : match_date;
    fieldsToUpdate.push("match_date = ?");
    values.push(mysqlDate);
  }

  if (match_time) {
    fieldsToUpdate.push("match_time = ?");
    values.push(match_time);
  }

  if (match_format) {
    fieldsToUpdate.push("match_format = ?");
    values.push(match_format);
  }

  if (score_team1 !== undefined) {
    fieldsToUpdate.push("score_team1 = ?");
    values.push(score_team1);
  }

  if (score_team2 !== undefined) {
    fieldsToUpdate.push("score_team2 = ?");
    values.push(score_team2);
  }

  if (status) {
    fieldsToUpdate.push("status = ?");
    values.push(status);
  }

  if (fieldsToUpdate.length === 0) {
    return res.status(400).json({ message: "No hay cambios para actualizar" });
  }

  values.push(matchId);
  const updateQuery = `UPDATE tournament_matches SET ${fieldsToUpdate.join(", ")} WHERE id = ?`;

  db.query(updateQuery, values, (err, result) => {
    if (err) {
      console.error("Error actualizando partido:", err);
      return res.status(500).json({ message: "Error al actualizar partido" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Partido no encontrado" });
    }

    res.json({ message: "Partido actualizado exitosamente" });
  });
});

// Regenerar partidos manualmente (admin)
app.post(
  "/api/admin/tournament/:id/regenerate-matches",
  verifyToken,
  isAdmin,
  (req, res) => {
    const { id } = req.params;

    console.log(`🔄 Admin regenerando partidos para torneo ${id}`);

    const getTournamentQuery = "SELECT * FROM tournaments WHERE id = ?";
    db.query(getTournamentQuery, [id], (err, tournaments) => {
      if (err || tournaments.length === 0) {
        return res.status(404).json({ message: "Torneo no encontrado" });
      }

      const tournament = tournaments[0];
      regenerateMatches(id, tournament, (err, matchesCreated) => {
        if (err) {
          console.error("Error regenerando partidos:", err);
          return res
            .status(500)
            .json({ message: "Error regenerando partidos" });
        }

        res.json({
          message: `Partidos regenerados exitosamente. Se crearon ${matchesCreated} partidos.`,
          matchesCreated,
        });
      });
    });
  }
);

// ==========================================
// ENDPOINT KEEP-ALIVE PARA RAILWAY
// ==========================================
app.get("/api/keep-alive", (req, res) => {
  // Hacer una query simple para mantener la BD activa
  db.query("SELECT 1 as ping", (err, result) => {
    if (err) {
      console.error("❌ Keep-alive DB error:", err);
      return res.status(500).json({ 
        status: "error", 
        message: "Database connection failed",
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({ 
      status: "alive", 
      timestamp: new Date().toISOString(),
      database: "connected",
      uptime: process.uptime()
    });
  });
});

// Health check más completo
app.get("/api/health", (req, res) => {
  const healthCheck = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development"
  };

  // Test de base de datos
  db.query("SELECT COUNT(*) as user_count FROM users", (err, result) => {
    if (err) {
      healthCheck.status = "ERROR";
      healthCheck.database = "disconnected";
      healthCheck.error = err.message;
      return res.status(500).json(healthCheck);
    }
    
    healthCheck.database = "connected";
    healthCheck.user_count = result[0]?.user_count || 0;
    res.json(healthCheck);
  });
});

// AÑADIR también estos endpoints en tu server.js

// ==========================================
// UNIRSE A UN EQUIPO
// ==========================================
app.post("/api/team/join", verifyToken, (req, res) => {
  const { code, game, playerRole, playerNickname, playerOpgg } = req.body;

  if (!code || !game || !playerRole || !playerNickname) {
    return res.status(400).json({ message: "Faltan campos requeridos" });
  }

  // Buscar equipo por código
  const findTeamQuery = "SELECT * FROM teams WHERE invite_code = ? AND game = ?";
  
  db.query(findTeamQuery, [code, game], (err, teamResults) => {
    if (err) {
      return res.status(500).json({ message: "Error del servidor" });
    }

    if (teamResults.length === 0) {
      return res.status(404).json({ message: "Código de equipo inválido" });
    }

    const team = teamResults[0];

    // Verificar que no esté ya en el equipo
    const checkMemberQuery = "SELECT * FROM teams_players WHERE team_id = ? AND user_id = ?";
    
    db.query(checkMemberQuery, [team.id, req.userId], (err, memberResults) => {
      if (err) {
        return res.status(500).json({ message: "Error del servidor" });
      }

      if (memberResults.length > 0) {
        return res.status(400).json({ message: "Ya eres miembro de este equipo" });
      }

      // Añadir al equipo
      const addPlayerQuery = `
        INSERT INTO teams_players (team_id, user_id, nickname, role, opgg_link)
        VALUES (?, ?, ?, ?, ?)
      `;

      db.query(addPlayerQuery, [team.id, req.userId, playerNickname, playerRole, playerOpgg], (err) => {
        if (err) {
          console.error("❌ Error añadiendo jugador al equipo:", err);
          return res.status(500).json({ message: "Error al unirse al equipo" });
        }

        console.log(`✅ Usuario ${req.userId} se unió al equipo ${team.id}`);
        res.json({ message: "Te has unido al equipo exitosamente" });
      });
    });
  });
});

// ==========================================
// SALIR DE UN EQUIPO
// ==========================================
app.post("/api/team/leave", verifyToken, (req, res) => {
  const { teamId } = req.body;

  if (!teamId) {
    return res.status(400).json({ message: "teamId requerido" });
  }

  const removePlayerQuery = "DELETE FROM teams_players WHERE team_id = ? AND user_id = ?";
  
  db.query(removePlayerQuery, [teamId, req.userId], (err, result) => {
    if (err) {
      console.error("❌ Error saliendo del equipo:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "No eres miembro de este equipo" });
    }

    console.log(`✅ Usuario ${req.userId} salió del equipo ${teamId}`);
    res.json({ message: "Has salido del equipo exitosamente" });
  });
});

// ==========================================
// ACTUALIZAR EQUIPO
// ==========================================
app.put("/api/team/update", verifyToken, upload.single("teamLogo"), (req, res) => {
  const { teamId, teamName } = req.body;
  const teamLogo = req.file ? req.file.buffer : null;

  if (!teamId || !teamName) {
    return res.status(400).json({ message: "teamId y teamName requeridos" });
  }

  // Verificar que es el creador del equipo
  const checkCreatorQuery = "SELECT * FROM teams WHERE id = ? AND created_by = ?";
  
  db.query(checkCreatorQuery, [teamId, req.userId], (err, teamResults) => {
    if (err) {
      return res.status(500).json({ message: "Error del servidor" });
    }

    if (teamResults.length === 0) {
      return res.status(403).json({ message: "Solo el creador puede editar el equipo" });
    }

    // Actualizar equipo
    let updateQuery = "UPDATE teams SET name = ?";
    let params = [teamName];

    if (teamLogo) {
      updateQuery += ", logo = ?";
      params.push(teamLogo);
    }

    updateQuery += " WHERE id = ?";
    params.push(teamId);

    db.query(updateQuery, params, (err) => {
      if (err) {
        console.error("❌ Error actualizando equipo:", err);
        return res.status(500).json({ message: "Error al actualizar equipo" });
      }

      console.log(`✅ Equipo ${teamId} actualizado`);
      res.json({ message: "Equipo actualizado exitosamente" });
    });
  });
});

// ==========================================
// ACTUALIZAR JUGADOR
// ==========================================
app.put("/api/team/update-player", verifyToken, (req, res) => {
  const { teamId, playerId, nickname, role, opgg } = req.body;

  if (!teamId || !playerId || !nickname || !role) {
    return res.status(400).json({ message: "Faltan campos requeridos" });
  }

  // Verificar que es el creador del equipo o el mismo jugador
  const checkPermissionQuery = `
    SELECT t.created_by, tp.user_id 
    FROM teams t
    INNER JOIN teams_players tp ON t.id = tp.team_id
    WHERE t.id = ? AND tp.user_id = ?
  `;

  db.query(checkPermissionQuery, [teamId, playerId], (err, results) => {
    if (err) {
      return res.status(500).json({ message: "Error del servidor" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Jugador no encontrado" });
    }

    const isCreator = results[0].created_by === req.userId;
    const isSamePlayer = results[0].user_id === req.userId;

    if (!isCreator && !isSamePlayer) {
      return res.status(403).json({ message: "No tienes permisos para editar este jugador" });
    }

    // Actualizar jugador
    const updateQuery = `
      UPDATE teams_players 
      SET nickname = ?, role = ?, opgg_link = ?
      WHERE team_id = ? AND user_id = ?
    `;

    db.query(updateQuery, [nickname, role, opgg, teamId, playerId], (err) => {
      if (err) {
        console.error("❌ Error actualizando jugador:", err);
        return res.status(500).json({ message: "Error al actualizar jugador" });
      }

      console.log(`✅ Jugador ${playerId} actualizado en equipo ${teamId}`);
      res.json({ message: "Jugador actualizado exitosamente" });
    });
  });
});

// ==========================================
// ELIMINAR JUGADOR
// ==========================================
app.delete("/api/team/remove-player", verifyToken, (req, res) => {
  const { teamId, playerId } = req.body;

  if (!teamId || !playerId) {
    return res.status(400).json({ message: "teamId y playerId requeridos" });
  }

  // Verificar que es el creador del equipo
  const checkCreatorQuery = "SELECT * FROM teams WHERE id = ? AND created_by = ?";
  
  db.query(checkCreatorQuery, [teamId, req.userId], (err, teamResults) => {
    if (err) {
      return res.status(500).json({ message: "Error del servidor" });
    }

    if (teamResults.length === 0) {
      return res.status(403).json({ message: "Solo el creador puede eliminar jugadores" });
    }

    // Eliminar jugador
    const removeQuery = "DELETE FROM teams_players WHERE team_id = ? AND user_id = ?";
    
    db.query(removeQuery, [teamId, playerId], (err, result) => {
      if (err) {
        console.error("❌ Error eliminando jugador:", err);
        return res.status(500).json({ message: "Error del servidor" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Jugador no encontrado" });
      }

      console.log(`✅ Jugador ${playerId} eliminado del equipo ${teamId}`);
      res.json({ message: "Jugador eliminado exitosamente" });
    });
  });
});

// ==========================================
// ELIMINAR EQUIPO
// ==========================================
app.delete("/api/team/delete", verifyToken, (req, res) => {
  const { teamId } = req.body;

  if (!teamId) {
    return res.status(400).json({ message: "teamId requerido" });
  }

  // Verificar que es el creador del equipo
  const checkCreatorQuery = "SELECT * FROM teams WHERE id = ? AND created_by = ?";
  
  db.query(checkCreatorQuery, [teamId, req.userId], (err, teamResults) => {
    if (err) {
      return res.status(500).json({ message: "Error del servidor" });
    }

    if (teamResults.length === 0) {
      return res.status(403).json({ message: "Solo el creador puede eliminar el equipo" });
    }

    // Eliminar en orden: jugadores, inscripciones, equipo
    const deletePlayersQuery = "DELETE FROM teams_players WHERE team_id = ?";
    const deleteRegistrationsQuery = "DELETE FROM tournaments_teams WHERE team_id = ?";
    const deleteTeamQuery = "DELETE FROM teams WHERE id = ?";

    db.query(deletePlayersQuery, [teamId], (err) => {
      if (err) {
        return res.status(500).json({ message: "Error eliminando jugadores" });
      }

      db.query(deleteRegistrationsQuery, [teamId], (err) => {
        if (err) {
          return res.status(500).json({ message: "Error eliminando inscripciones" });
        }

        db.query(deleteTeamQuery, [teamId], (err) => {
          if (err) {
            return res.status(500).json({ message: "Error eliminando equipo" });
          }

          console.log(`✅ Equipo ${teamId} eliminado completamente`);
          res.json({ message: "Equipo eliminado exitosamente" });
        });
      });
    });
  });
});

// ==========================================
// OBTENER TORNEOS DE UN EQUIPO
// ==========================================
app.get("/api/tournaments/my-tournaments", verifyToken, (req, res) => {
  const { teamId } = req.query;

  if (!teamId) {
    return res.status(400).json({ message: "teamId requerido" });
  }

  const query = `
    SELECT t.*, tt.registration_date
    FROM tournaments t
    INNER JOIN tournaments_teams tt ON t.id = tt.tournament_id
    WHERE tt.team_id = ?
    ORDER BY t.date DESC
  `;

  db.query(query, [teamId], (err, results) => {
    if (err) {
      console.error("❌ Error obteniendo torneos del equipo:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }

    console.log(`✅ Torneos encontrados para equipo ${teamId}:`, results.length);
    res.json({ tournaments: results });
  });
});

// ==========================================
// OBTENER PARTIDOS DE UN EQUIPO
// ==========================================
app.get("/api/matches/my-team-matches", verifyToken, (req, res) => {
  const { teamId } = req.query;

  if (!teamId) {
    return res.status(400).json({ message: "teamId requerido" });
  }

  const query = `
    SELECT 
      m.*,
      t.name as tournament_name,
      
      -- Datos equipo local
      t1.name as home_team_name,
      t1.logo as home_team_logo,
      
      -- Datos equipo visitante  
      t2.name as away_team_name,
      t2.logo as away_team_logo
      
    FROM tournament_matches m
    INNER JOIN tournaments t ON m.tournament_id = t.id
    INNER JOIN teams t1 ON m.team1_id = t1.id
    INNER JOIN teams t2 ON m.team2_id = t2.id
    WHERE m.team1_id = ? OR m.team2_id = ?
    ORDER BY m.jornada ASC, m.match_date ASC, m.match_time ASC
  `;

  db.query(query, [teamId, teamId], (err, results) => {
    if (err) {
      console.error("❌ Error obteniendo partidos del equipo:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }

    console.log(`✅ Partidos encontrados para equipo ${teamId}:`, results.length);

    // Convertir logos a base64
    const matches = results.map(match => ({
      ...match,
      home_team_logo: match.home_team_logo 
        ? `data:image/jpeg;base64,${match.home_team_logo.toString('base64')}` 
        : null,
      away_team_logo: match.away_team_logo 
        ? `data:image/jpeg;base64,${match.away_team_logo.toString('base64')}` 
        : null,
    }));

    res.json({ matches });
  });
});

// ==========================================
// SALIR DE UN TORNEO
// ==========================================
app.post("/api/tournament/leave", verifyToken, (req, res) => {
  const { tournamentId, teamId } = req.body;

  if (!tournamentId || !teamId) {
    return res.status(400).json({ message: "tournamentId y teamId requeridos" });
  }

  // Verificar que el usuario es miembro del equipo
  const checkMemberQuery = "SELECT * FROM teams_players WHERE team_id = ? AND user_id = ?";
  
  db.query(checkMemberQuery, [teamId, req.userId], (err, memberResults) => {
    if (err || memberResults.length === 0) {
      return res.status(403).json({ message: "No eres miembro de este equipo" });
    }

    // Eliminar de tournaments_teams
    const deleteQuery = "DELETE FROM tournaments_teams WHERE tournament_id = ? AND team_id = ?";
    
    db.query(deleteQuery, [tournamentId, teamId], (err, result) => {
      if (err) {
        console.error("❌ Error saliendo del torneo:", err);
        return res.status(500).json({ message: "Error del servidor" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "No estás inscrito en este torneo" });
      }

      console.log(`✅ Equipo ${teamId} salió del torneo ${tournamentId}`);

      // Regenerar partidos automáticamente
      const getTournamentQuery = "SELECT * FROM tournaments WHERE id = ?";
      db.query(getTournamentQuery, [tournamentId], (err, tournaments) => {
        if (err || tournaments.length === 0) {
          return res.json({ message: "Saliste del torneo exitosamente" });
        }

        const tournament = tournaments[0];
        regenerateMatches(tournamentId, tournament, (err, matchesCreated) => {
          if (err) {
            console.error("❌ Error regenerando partidos:", err);
            return res.json({ 
              message: "Saliste del torneo exitosamente, pero hubo un error regenerando el calendario" 
            });
          }

          res.json({ 
            message: `Saliste del torneo exitosamente. Se regeneraron ${matchesCreated} partidos.`,
            matchesRegenerated: matchesCreated
          });
        });
      });
    });
  });
});

// Ruta 404 para APIs
app.all("/api/*", (req, res) => {
  res.status(404).json({ message: "Ruta API no encontrada" });
});

// Middleware de errores
app.use((err, req, res, next) => {
  console.error("🔥 Error en middleware:", err.stack);
  res.status(500).json({ error: "Error interno del servidor" });
});

// Servir frontend
app.use(express.static(path.join(__dirname, "frontend", "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

app.listen(port, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${port}`);
});
