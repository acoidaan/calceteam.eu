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
const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
});

db.connect((err) => {
  if (err) {
    console.error("❌ Error al conectar con MySQL:", err);
    process.exit(1);
  }
  console.log("✅ Conectado a MySQL.");
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
function generateTournamentMatches(tournamentId, teams, startDate, callback) {
  console.log(
    `🎯 Generando partidos para torneo ${tournamentId} con ${teams.length} equipos`
  );

  if (teams.length < 2) {
    return callback(new Error("Se necesitan al menos 2 equipos"));
  }

  const matches = [];
  const defaultTime = "20:00:00";
  let currentDate = new Date(startDate);
  let jornada = 1;

  // Función simple de todos contra todos
  function createRoundRobinMatches() {
    // Ida
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          tournament_id: tournamentId,
          team1_id: teams[i].id,
          team2_id: teams[j].id,
          match_date: new Date(currentDate).toISOString().split("T")[0],
          match_time: defaultTime,
          match_format: "BO3",
          jornada: jornada,
          score_team1: 0,
          score_team2: 0,
          status: "pending",
        });
      }
    }

    // Vuelta (cambiar orden de equipos)
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          tournament_id: tournamentId,
          team1_id: teams[j].id, // Invertido para vuelta
          team2_id: teams[i].id,
          match_date: new Date(currentDate).toISOString().split("T")[0],
          match_time: defaultTime,
          match_format: "BO3",
          jornada: jornada + 1,
          score_team1: 0,
          score_team2: 0,
          status: "pending",
        });
      }
    }
  }

  // Generar todos los partidos
  createRoundRobinMatches();

  // Distribuir en jornadas de manera simple
  const partidosPorJornada = Math.max(1, Math.floor(teams.length / 2));
  matches.forEach((match, index) => {
    const jornadaCalculada = Math.floor(index / partidosPorJornada) + 1;
    match.jornada = jornadaCalculada;

    // Calcular fecha para cada jornada (1 semana de diferencia)
    const fechaJornada = new Date(currentDate);
    fechaJornada.setDate(fechaJornada.getDate() + (jornadaCalculada - 1) * 7);
    match.match_date = fechaJornada.toISOString().split("T")[0];
  });

  console.log(
    `✅ Generados ${matches.length} partidos distribuidos en jornadas`
  );

  if (matches.length === 0) {
    return callback(null, 0);
  }

  // Insertar partidos
  const insertQuery = `
    INSERT INTO tournament_matches 
    (tournament_id, team1_id, team2_id, match_date, match_time, match_format, jornada, score_team1, score_team2, status)
    VALUES ?
  `;

  const values = matches.map((m) => [
    m.tournament_id,
    m.team1_id,
    m.team2_id,
    m.match_date,
    m.match_time,
    m.match_format,
    m.jornada,
    m.score_team1,
    m.score_team2,
    m.status,
  ]);

  db.query(insertQuery, [values], (err, result) => {
    if (err) {
      console.error("❌ Error insertando partidos:", err);
      return callback(err);
    }

    console.log(`✅ Insertados ${matches.length} partidos`);

    // Crear estadísticas iniciales
    const statsQuery = `
      INSERT INTO tournament_stats (tournament_id, team_id, wins, losses, points, games_played)
      VALUES ?
      ON DUPLICATE KEY UPDATE
      wins = 0, losses = 0, points = 0, games_played = 0
    `;

    const statsValues = teams.map((team) => [
      tournamentId,
      team.id,
      0,
      0,
      0,
      0,
    ]);

    db.query(statsQuery, [statsValues], (err) => {
      if (err) {
        console.error("❌ Error creando estadísticas:", err);
        return callback(err);
      }
      console.log(`✅ Estadísticas inicializadas para ${teams.length} equipos`);
      callback(null, matches.length);
    });
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

// Actualizar torneo
app.put("/api/tournaments/update/:id", verifyToken, isAdmin, (req, res) => {
  const { id } = req.params;
  const { name, game, status, date, description } = req.body;

  const query = `
    UPDATE tournaments 
    SET name = ?, game = ?, status = ?, date = ?, description = ?
    WHERE id = ?
  `;

  db.query(query, [name, game, status, date, description, id], (err) => {
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
// OBTENER DATOS DEL TORNEO
// ==========================================

// Obtener equipos de un torneo
app.get("/api/tournament/:id/teams", (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT 
      t.id,
      t.name,
      t.logo,
      COALESCE(ts.wins, 0) as wins,
      COALESCE(ts.losses, 0) as losses,
      COALESCE(ts.points, 0) as points,
      COALESCE(ts.games_played, 0) as games_played,
      tt.registration_date
    FROM teams t
    INNER JOIN tournaments_teams tt ON t.id = tt.team_id
    LEFT JOIN tournament_stats ts ON t.id = ts.team_id AND ts.tournament_id = ?
    WHERE tt.tournament_id = ?
    ORDER BY ts.points DESC, ts.wins DESC, ts.losses ASC, t.name ASC
  `;

  db.query(query, [id, id], (err, results) => {
    if (err) {
      console.error("Error obteniendo equipos del torneo:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }

    const teams = results.map((team) => ({
      ...team,
      logo: team.logo
        ? `data:image/jpeg;base64,${team.logo.toString("base64")}`
        : null,
    }));

    res.json({ teams });
  });
});

// Obtener partidos de un torneo
app.get("/api/tournament/:id/matches", (req, res) => {
  const { id } = req.params;

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
      console.error("Error obteniendo partidos:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }

    const matches = results.map((match) => ({
      ...match,
      team1_logo: match.team1_logo
        ? `data:image/jpeg;base64,${match.team1_logo.toString("base64")}`
        : null,
      team2_logo: match.team2_logo
        ? `data:image/jpeg;base64,${match.team2_logo.toString("base64")}`
        : null,
    }));

    console.log(`✅ Devolviendo ${matches.length} partidos para torneo ${id}`);
    res.json({ matches });
  });
});

// Obtener estadísticas de un torneo
app.get("/api/tournament/:id/stats", (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT 
      ts.*,
      t.name as team_name,
      t.logo as team_logo
    FROM tournament_stats ts
    INNER JOIN teams t ON ts.team_id = t.id
    WHERE ts.tournament_id = ?
    ORDER BY ts.points DESC, ts.wins DESC, (ts.wins - ts.losses) DESC
  `;

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error("Error obteniendo estadísticas:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }

    const stats = results.map((stat) => ({
      ...stat,
      team_logo: stat.team_logo
        ? `data:image/jpeg;base64,${stat.team_logo.toString("base64")}`
        : null,
    }));

    res.json({ stats });
  });
});

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

// Editar partido (admin)
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
    fieldsToUpdate.push("match_date = ?");
    values.push(match_date);
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
