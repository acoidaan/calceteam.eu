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
app.use(cors());
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

// Solicitar recuperación de contraseña
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email requerido" });
  }

  try {
    // Verificar si el usuario existe
    const query = "SELECT * FROM users WHERE email = ?";
    db.query(query, [email], async (err, results) => {
      if (err) {
        return res.status(500).json({ message: "Error del servidor" });
      }

      if (results.length === 0) {
        // Por seguridad, no revelamos si el email existe o no
        return res.json({
          message:
            "Si el email existe, recibirás instrucciones para recuperar tu contraseña",
        });
      }

      const user = results[0];

      // Generar token de recuperación
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hora

      // Guardar token en la base de datos
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

          // Enviar email
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

// Verificar token de recuperación
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

// Resetear contraseña
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
    // Verificar token
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

      // Actualizar contraseña y limpiar tokens
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

// RUTAS DE EQUIPOS

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

    console.log("👉 Datos recibidos:", {
      teamName,
      game,
      playerRole,
      playerNickname,
      playerOpgg,
      file: req.file ? "sí" : "no",
    });

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


// Unirse a equipo
app.post("/api/team/join", verifyToken, (req, res) => {
  const { code, game, playerRole, playerNickname, playerOpgg } = req.body;

  // Verificar que el equipo existe y es del juego correcto
  const findTeamQuery =
    "SELECT * FROM teams WHERE invite_code = ? AND game = ?";

  db.query(findTeamQuery, [code, game], (err, teams) => {
    if (err) return res.status(500).json({ message: "Error del servidor" });
    if (teams.length === 0)
      return res.status(404).json({ message: "Código de equipo inválido" });

    const team = teams[0];

    // Verificar que no esté ya en el equipo
    const checkQuery =
      "SELECT * FROM teams_players WHERE team_id = ? AND user_id = ?";
    db.query(checkQuery, [team.id, req.userId], (err, results) => {
      if (err) return res.status(500).json({ message: "Error del servidor" });
      if (results.length > 0)
        return res
          .status(400)
          .json({ message: "Ya eres miembro de este equipo" });

      // Verificar límites por rol
      const countRoleQuery =
        "SELECT COUNT(*) as count FROM teams_players WHERE team_id = ? AND role = ?";
      db.query(countRoleQuery, [team.id, playerRole], (err, results) => {
        if (err) return res.status(500).json({ message: "Error del servidor" });

        const count = results[0].count;

        let limit = 1;
        if (playerRole === "suplente") limit = 5;
        else if (playerRole === "staff") limit = 2;
        else if (
          !["top", "jungla", "medio", "adc", "support"].includes(playerRole)
        ) {
          return res.status(400).json({ message: "Rol inválido" });
        }

        if (count >= limit) {
          return res
            .status(400)
            .json({ message: `El rol ${playerRole} ya está completo` });
        }

        // Añadir al equipo
        const joinQuery =
          "INSERT INTO teams_players (team_id, user_id, nickname, role, opgg_link) VALUES (?, ?, ?, ?, ?)";
        db.query(
          joinQuery,
          [team.id, req.userId, playerNickname, playerRole, playerOpgg],
          (err) => {
            if (err)
              return res
                .status(500)
                .json({ message: "Error al unirse al equipo" });
            res.json({ message: "Te has unido al equipo exitosamente" });
          }
        );
      });
    });
  });
});

// Salir del equipo
app.post("/api/team/leave", verifyToken, (req, res) => {
  const { teamId } = req.body;

  const deleteQuery =
    "DELETE FROM teams_players WHERE team_id = ? AND user_id = ?";
  db.query(deleteQuery, [teamId, req.userId], (err, result) => {
    if (err)
      return res.status(500).json({ message: "Error al salir del equipo" });
    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ message: "No eres miembro de este equipo" });

    res.json({ message: "Has salido del equipo" });
  });
});

app.post("/api/tournaments", verifyToken, (req, res) => {
  const { name, game, date } = req.body;

  const query = "INSERT INTO tournaments (name, game, date) VALUES (?, ?, ?)";
  db.query(query, [name, game, date], (err, result) => {
    if (err) return res.status(500).json({ message: "Error al crear torneo" });
    res.status(201).json({ message: "Torneo creado correctamente" });
  });
});

app.get("/api/tournaments", (req, res) => {
  const { game } = req.query;
  let query = "SELECT * FROM tournaments";
  let params = [];

  if (game) {
    query += " WHERE game = ?";
    params.push(game);
  }

  db.query(query, params, (err, results) => {
    if (err)
      return res.status(500).json({ message: "Error al obtener torneos" });
    res.json({ tournaments: results });
  });
});

// Obtener eventos disponibles
app.get("/api/events/available", (req, res) => {
  const { game } = req.query;
  // Por ahora devolvemos datos de ejemplo
  res.json({ events: [] });
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


// Añadir estos endpoints en tu server.js después de los endpoints existentes de torneos:

// Obtener torneos en los que está inscrito un equipo
app.get("/api/tournaments/my-tournaments", verifyToken, (req, res) => {
  const { teamId } = req.query;
  
  if (!teamId) {
    return res.status(400).json({ message: "Team ID requerido" });
  }

  const query = `
    SELECT t.* FROM tournaments t
    INNER JOIN tournaments_teams tr ON t.id = tr.tournament_id
    WHERE tr.team_id = ?
    ORDER BY t.date DESC
  `;

  db.query(query, [teamId], (err, results) => {
    if (err) {
      console.error("Error obteniendo torneos:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }
    res.json({ tournaments: results });
  });
});

// Obtener torneos disponibles para un juego
app.get("/api/tournaments/available", verifyToken, (req, res) => {
  const { game } = req.query;
  
  let query = "SELECT * FROM tournaments WHERE status = 'abierto'";
  let params = [];

  if (game) {
    query += " AND game = ?";
    params.push(game);
  }

  query += " ORDER BY date ASC";

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("Error obteniendo torneos disponibles:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }
    res.json({ tournaments: results });
  });
});

// Inscribir equipo en torneo
app.post("/api/tournament/register", verifyToken, (req, res) => {
  const { tournamentId, teamId } = req.body;

  if (!tournamentId || !teamId) {
    return res.status(400).json({ message: "Faltan datos requeridos" });
  }

  // Verificar que el usuario es miembro del equipo
  const checkMemberQuery = "SELECT * FROM teams_players WHERE team_id = ? AND user_id = ?";
  db.query(checkMemberQuery, [teamId, req.userId], (err, memberResults) => {
    if (err || memberResults.length === 0) {
      return res.status(403).json({ message: "No eres miembro de este equipo" });
    }

    // Verificar que el torneo existe y está abierto
    const checkTournamentQuery = "SELECT * FROM tournaments WHERE id = ? AND status = 'abierto'";
    db.query(checkTournamentQuery, [tournamentId], (err, tournamentResults) => {
      if (err || tournamentResults.length === 0) {
        return res.status(404).json({ message: "Torneo no disponible" });
      }

      // Verificar que no están ya inscritos
      const checkRegistrationQuery = "SELECT * FROM tournaments_teams WHERE tournament_id = ? AND team_id = ?";
      db.query(checkRegistrationQuery, [tournamentId, teamId], (err, regResults) => {
        if (err) {
          return res.status(500).json({ message: "Error del servidor" });
        }
        
        if (regResults.length > 0) {
          return res.status(400).json({ message: "El equipo ya está inscrito en este torneo" });
        }

        // Inscribir al equipo
        const insertQuery = "INSERT INTO tournaments_teams (tournament_id, team_id, registration_date) VALUES (?, ?, NOW())";
        db.query(insertQuery, [tournamentId, teamId], (err) => {
          if (err) {
            console.error("Error inscribiendo equipo:", err);
            return res.status(500).json({ message: "Error al inscribir equipo" });
          }
          res.json({ message: "Equipo inscrito exitosamente" });
        });
      });
    });
  });
});

// Actualizar torneo (admin)
app.put("/api/tournaments/update/:id", verifyToken, isAdmin, (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Primero obtener los valores actuales
  const selectQuery = "SELECT * FROM tournaments WHERE id = ?";

  db.query(selectQuery, [id], (err, results) => {
    if (err) {
      console.error("Error obteniendo torneo:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Torneo no encontrado" });
    }

    const currentTournament = results[0];

    // Construir la query dinámicamente solo con los campos que vienen
    const fieldsToUpdate = [];
    const values = [];

    if (updates.name !== undefined && updates.name !== "") {
      fieldsToUpdate.push("name = ?");
      values.push(updates.name);
    }
    if (updates.game !== undefined && updates.game !== "") {
      fieldsToUpdate.push("game = ?");
      values.push(updates.game);
    }
    if (updates.status !== undefined && updates.status !== "") {
      fieldsToUpdate.push("status = ?");
      values.push(updates.status);
    }
    if (updates.date !== undefined) {
      fieldsToUpdate.push("date = ?");
      values.push(updates.date);
    }
    if (updates.description !== undefined) {
      fieldsToUpdate.push("description = ?");
      values.push(updates.description || null);
    }

    // Si no hay campos para actualizar, devolver éxito
    if (fieldsToUpdate.length === 0) {
      return res.json({ message: "No hay cambios para actualizar" });
    }

    // Añadir el ID al final de los valores
    values.push(id);

    const updateQuery = `UPDATE tournaments SET ${fieldsToUpdate.join(", ")} WHERE id = ?`;

    db.query(updateQuery, values, (err) => {
      if (err) {
        console.error("Error actualizando torneo:", err);
        return res.status(500).json({ message: "Error del servidor" });
      }
      res.json({ message: "Torneo actualizado correctamente" });
    });
  });
});

// Eliminar torneo (admin)
app.delete("/api/tournaments/delete/:id", verifyToken, isAdmin, (req, res) => {
  const { id } = req.params;

  // Primero eliminar las inscripciones
  const deleteRegistrationsQuery = "DELETE FROM tournaments_teams WHERE tournament_id = ?";
  db.query(deleteRegistrationsQuery, [id], (err) => {
    if (err) {
      console.error("Error eliminando inscripciones:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }

    // Luego eliminar el torneo
    const deleteTournamentQuery = "DELETE FROM tournaments WHERE id = ?";
    db.query(deleteTournamentQuery, [id], (err) => {
      if (err) {
        console.error("Error eliminando torneo:", err);
        return res.status(500).json({ message: "Error del servidor" });
      }
      res.json({ message: "Torneo eliminado correctamente" });
    });
  });
});


// Salir de un torneo
app.post("/api/tournament/leave", verifyToken, (req, res) => {
  const { tournamentId, teamId } = req.body;

  if (!tournamentId || !teamId) {
    return res.status(400).json({ message: "Faltan datos requeridos" });
  }

  // Verificar que el usuario es miembro del equipo
  const checkMemberQuery = "SELECT * FROM teams_players WHERE team_id = ? AND user_id = ?";
  db.query(checkMemberQuery, [teamId, req.userId], (err, memberResults) => {
    if (err || memberResults.length === 0) {
      return res.status(403).json({ message: "No eres miembro de este equipo" });
    }

    // Eliminar inscripción
    const deleteQuery = "DELETE FROM tournaments_teams WHERE tournament_id = ? AND team_id = ?";
    db.query(deleteQuery, [tournamentId, teamId], (err, result) => {
      if (err) {
        console.error("Error saliendo del torneo:", err);
        return res.status(500).json({ message: "Error del servidor" });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "No estás inscrito en este torneo" });
      }
      
      res.json({ message: "Has salido del torneo exitosamente" });
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

function isAdmin(req, res, next) {
  const query = "SELECT role FROM users WHERE id = ?";
  db.query(query, [req.userId], (err, results) => {
    if (err || results.length === 0) return res.sendStatus(403);
    if (results[0].role !== "admin") return res.sendStatus(403);
    next();
  });
}

// Servir frontend
app.use(express.static(path.join(__dirname, "frontend", "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

app.listen(port, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${port}`);
});
