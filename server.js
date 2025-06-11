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
    methods: ["GET", "POST"],
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

// Unirse a equipo
app.post("/api/team/join", verifyToken, (req, res) => {
  const { code, game, playerRole, playerNickname, playerOpgg } = req.body;

  const findTeamQuery =
    "SELECT * FROM teams WHERE invite_code = ? AND game = ?";

  db.query(findTeamQuery, [code, game], (err, teams) => {
    if (err) return res.status(500).json({ message: "Error del servidor" });
    if (teams.length === 0)
      return res.status(404).json({ message: "Código de equipo inválido" });

    const team = teams[0];

    const checkQuery =
      "SELECT * FROM teams_players WHERE team_id = ? AND user_id = ?";
    db.query(checkQuery, [team.id, req.userId], (err, results) => {
      if (err) return res.status(500).json({ message: "Error del servidor" });
      if (results.length > 0)
        return res
          .status(400)
          .json({ message: "Ya eres miembro de este equipo" });

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

// Actualizar información del equipo
app.put(
  "/api/team/update",
  verifyToken,
  upload.single("teamLogo"),
  (req, res) => {
    const { teamId, teamName } = req.body;

    if (!teamId) {
      return res.status(400).json({ message: "ID del equipo requerido" });
    }

    const checkCreatorQuery =
      "SELECT * FROM teams WHERE id = ? AND created_by = ?";
    db.query(checkCreatorQuery, [teamId, req.userId], (err, results) => {
      if (err) return res.status(500).json({ message: "Error del servidor" });
      if (results.length === 0) {
        return res
          .status(403)
          .json({ message: "Solo el creador del equipo puede editarlo" });
      }

      const fieldsToUpdate = [];
      const values = [];

      if (teamName && teamName.trim()) {
        fieldsToUpdate.push("name = ?");
        values.push(teamName.trim());
      }

      if (req.file) {
        fieldsToUpdate.push("logo = ?");
        values.push(req.file.buffer);
      }

      if (fieldsToUpdate.length === 0) {
        return res
          .status(400)
          .json({ message: "No hay cambios para actualizar" });
      }

      values.push(teamId);
      const updateQuery = `UPDATE teams SET ${fieldsToUpdate.join(", ")} WHERE id = ?`;

      db.query(updateQuery, values, (err) => {
        if (err) {
          console.error("Error actualizando equipo:", err);
          return res
            .status(500)
            .json({ message: "Error al actualizar equipo" });
        }
        res.json({ message: "Equipo actualizado exitosamente" });
      });
    });
  }
);

// Actualizar información de jugador en el equipo
app.put("/api/team/update-player", verifyToken, (req, res) => {
  const { teamId, playerId, nickname, role, opgg } = req.body;

  if (!teamId || !playerId) {
    return res.status(400).json({ message: "Faltan datos requeridos" });
  }

  const checkPermissionQuery = `
    SELECT t.created_by, tp.user_id 
    FROM teams t 
    INNER JOIN teams_players tp ON t.id = tp.team_id 
    WHERE t.id = ? AND tp.user_id = ?
  `;

  db.query(checkPermissionQuery, [teamId, playerId], (err, results) => {
    if (err) return res.status(500).json({ message: "Error del servidor" });
    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "Jugador no encontrado en el equipo" });
    }

    const playerData = results[0];
    const isCreator = playerData.created_by === req.userId;
    const isOwnProfile = playerId === req.userId;

    if (!isCreator && !isOwnProfile) {
      return res
        .status(403)
        .json({ message: "No tienes permisos para editar este jugador" });
    }

    if (role) {
      const checkRoleQuery = `
        SELECT COUNT(*) as count 
        FROM teams_players 
        WHERE team_id = ? AND role = ? AND user_id != ?
      `;

      db.query(checkRoleQuery, [teamId, role, playerId], (err, roleResults) => {
        if (err) return res.status(500).json({ message: "Error del servidor" });

        const count = roleResults[0].count;
        let limit = 1;
        if (role === "suplente") limit = 5;
        else if (role === "staff") limit = 2;

        if (count >= limit) {
          return res
            .status(400)
            .json({ message: `El rol ${role} ya está completo` });
        }

        updatePlayerInfo();
      });
    } else {
      updatePlayerInfo();
    }

    function updatePlayerInfo() {
      const fieldsToUpdate = [];
      const values = [];

      if (nickname && nickname.trim()) {
        fieldsToUpdate.push("nickname = ?");
        values.push(nickname.trim());
      }

      if (role) {
        fieldsToUpdate.push("role = ?");
        values.push(role);
      }

      if (opgg !== undefined) {
        fieldsToUpdate.push("opgg_link = ?");
        values.push(opgg || null);
      }

      if (fieldsToUpdate.length === 0) {
        return res
          .status(400)
          .json({ message: "No hay cambios para actualizar" });
      }

      values.push(teamId, playerId);
      const updateQuery = `UPDATE teams_players SET ${fieldsToUpdate.join(", ")} WHERE team_id = ? AND user_id = ?`;

      db.query(updateQuery, values, (err) => {
        if (err) {
          console.error("Error actualizando jugador:", err);
          return res
            .status(500)
            .json({ message: "Error al actualizar jugador" });
        }
        res.json({ message: "Información del jugador actualizada" });
      });
    }
  });
});

// Eliminar jugador del equipo
app.delete("/api/team/remove-player", verifyToken, (req, res) => {
  const { teamId, playerId } = req.body;

  if (!teamId || !playerId) {
    return res.status(400).json({ message: "Faltan datos requeridos" });
  }

  const checkCreatorQuery = "SELECT created_by FROM teams WHERE id = ?";
  db.query(checkCreatorQuery, [teamId], (err, results) => {
    if (err) return res.status(500).json({ message: "Error del servidor" });
    if (results.length === 0) {
      return res.status(404).json({ message: "Equipo no encontrado" });
    }

    const creatorId = results[0].created_by;
    if (creatorId !== req.userId) {
      return res
        .status(403)
        .json({ message: "Solo el creador puede eliminar jugadores" });
    }

    if (playerId === req.userId) {
      return res
        .status(400)
        .json({ message: "No puedes eliminarte a ti mismo del equipo" });
    }

    const deleteQuery =
      "DELETE FROM teams_players WHERE team_id = ? AND user_id = ?";
    db.query(deleteQuery, [teamId, playerId], (err, result) => {
      if (err) {
        console.error("Error eliminando jugador:", err);
        return res.status(500).json({ message: "Error al eliminar jugador" });
      }

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ message: "Jugador no encontrado en el equipo" });
      }

      res.json({ message: "Jugador eliminado del equipo" });
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

// Eliminar equipo completo
app.delete("/api/team/delete", verifyToken, (req, res) => {
  const { teamId } = req.body;

  if (!teamId) {
    return res.status(400).json({ message: "ID del equipo requerido" });
  }

  const checkCreatorQuery = "SELECT created_by FROM teams WHERE id = ?";
  db.query(checkCreatorQuery, [teamId], (err, results) => {
    if (err) return res.status(500).json({ message: "Error del servidor" });
    if (results.length === 0) {
      return res.status(404).json({ message: "Equipo no encontrado" });
    }

    if (results[0].created_by !== req.userId) {
      return res
        .status(403)
        .json({ message: "Solo el creador puede eliminar el equipo" });
    }

    const deleteTournamentRegistrationsQuery =
      "DELETE FROM tournaments_teams WHERE team_id = ?";
    db.query(deleteTournamentRegistrationsQuery, [teamId], (err) => {
      if (err) console.error("Error eliminando inscripciones:", err);

      const deletePlayersQuery = "DELETE FROM teams_players WHERE team_id = ?";
      db.query(deletePlayersQuery, [teamId], (err) => {
        if (err) {
          console.error("Error eliminando jugadores:", err);
          return res.status(500).json({ message: "Error al eliminar equipo" });
        }

        const deleteTeamQuery = "DELETE FROM teams WHERE id = ?";
        db.query(deleteTeamQuery, [teamId], (err) => {
          if (err) {
            console.error("Error eliminando equipo:", err);
            return res
              .status(500)
              .json({ message: "Error al eliminar equipo" });
          }

          res.json({ message: "Equipo eliminado exitosamente" });
        });
      });
    });
  });
});

// RUTAS DE TORNEOS

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

app.get("/api/events/available", (req, res) => {
  const { game } = req.query;
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

          const insertQuery =
            "INSERT INTO tournaments_teams (tournament_id, team_id, registration_date) VALUES (?, ?, NOW())";
          db.query(insertQuery, [tournamentId, teamId], (err) => {
            if (err) {
              console.error("Error inscribiendo equipo:", err);
              return res
                .status(500)
                .json({ message: "Error al inscribir equipo" });
            }
            res.json({ message: "Equipo inscrito exitosamente" });
          });
        }
      );
    });
  });
});

// Actualizar torneo
app.put("/api/tournaments/update/:id", verifyToken, isAdmin, (req, res) => {
  const { id } = req.params;
  const updates = req.body;

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
      const dateOnly = updates.date.split("T")[0];
      fieldsToUpdate.push("date = ?");
      values.push(dateOnly);
    }
    if (updates.description !== undefined) {
      fieldsToUpdate.push("description = ?");
      values.push(updates.description || null);
    }

    if (fieldsToUpdate.length === 0) {
      return res.json({ message: "No hay cambios para actualizar" });
    }

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

// Eliminar torneo
app.delete("/api/tournaments/delete/:id", verifyToken, isAdmin, (req, res) => {
  const { id } = req.params;

  const deleteRegistrationsQuery =
    "DELETE FROM tournaments_teams WHERE tournament_id = ?";
  db.query(deleteRegistrationsQuery, [id], (err) => {
    if (err) {
      console.error("Error eliminando inscripciones:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }

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

  const checkMemberQuery =
    "SELECT * FROM teams_players WHERE team_id = ? AND user_id = ?";
  db.query(checkMemberQuery, [teamId, req.userId], (err, memberResults) => {
    if (err || memberResults.length === 0) {
      return res
        .status(403)
        .json({ message: "No eres miembro de este equipo" });
    }

    const deleteQuery =
      "DELETE FROM tournaments_teams WHERE tournament_id = ? AND team_id = ?";
    db.query(deleteQuery, [tournamentId, teamId], (err, result) => {
      if (err) {
        console.error("Error saliendo del torneo:", err);
        return res.status(500).json({ message: "Error del servidor" });
      }

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ message: "No estás inscrito en este torneo" });
      }

      res.json({ message: "Has salido del torneo exitosamente" });
    });
  });
});

// ===========================================
// NUEVAS RUTAS PARA SISTEMA DE PARTIDOS
// ===========================================

// Obtener partidos de mi equipo
app.get("/api/matches/my-team-matches", verifyToken, (req, res) => {
  const { teamId } = req.query;

  if (!teamId) {
    return res.status(400).json({ message: "Team ID requerido" });
  }

  const query = `
    SELECT 
      m.*,
      t.name as tournament_name,
      t.game as tournament_game,
      home.name as home_team_name,
      home.logo as home_team_logo,
      away.name as away_team_name,
      away.logo as away_team_logo
    FROM tournament_matches m
    INNER JOIN tournaments t ON m.tournament_id = t.id
    INNER JOIN teams home ON m.home_team_id = home.id
    INNER JOIN teams away ON m.away_team_id = away.id
    WHERE (m.home_team_id = ? OR m.away_team_id = ?)
    ORDER BY m.match_date ASC, m.match_time ASC
  `;

  db.query(query, [teamId, teamId], (err, results) => {
    if (err) {
      console.error("Error obteniendo partidos:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }

    const matches = results.map((match) => ({
      ...match,
      home_team_logo: match.home_team_logo
        ? `data:image/jpeg;base64,${match.home_team_logo.toString("base64")}`
        : null,
      away_team_logo: match.away_team_logo
        ? `data:image/jpeg;base64,${match.away_team_logo.toString("base64")}`
        : null,
    }));

    res.json({ matches });
  });
});

// Obtener partidos por torneo y jornada
app.get(
  "/api/matches/tournament/:tournamentId/jornada/:jornada",
  (req, res) => {
    const { tournamentId, jornada } = req.params;

    const query = `
    SELECT 
      m.*,
      home.name as home_team_name,
      home.logo as home_team_logo,
      away.name as away_team_name,
      away.logo as away_team_logo
    FROM tournament_matches m
    INNER JOIN teams home ON m.home_team_id = home.id
    INNER JOIN teams away ON m.away_team_id = away.id
    WHERE m.tournament_id = ? AND m.jornada = ?
    ORDER BY m.match_date ASC, m.match_time ASC
  `;

    db.query(query, [tournamentId, jornada], (err, results) => {
      if (err) {
        console.error("Error obteniendo partidos:", err);
        return res.status(500).json({ message: "Error del servidor" });
      }

      const matches = results.map((match) => ({
        ...match,
        home_team_logo: match.home_team_logo
          ? `data:image/jpeg;base64,${match.home_team_logo.toString("base64")}`
          : null,
        away_team_logo: match.away_team_logo
          ? `data:image/jpeg;base64,${match.away_team_logo.toString("base64")}`
          : null,
      }));

      res.json({ matches });
    });
  }
);

// Crear partidos de torneo (admin)
app.post("/api/matches/create", verifyToken, isAdmin, (req, res) => {
  const {
    tournamentId,
    homeTeamId,
    awayTeamId,
    matchDate,
    matchTime,
    format,
    jornada,
  } = req.body;

  if (
    !tournamentId ||
    !homeTeamId ||
    !awayTeamId ||
    !matchDate ||
    !matchTime ||
    !jornada
  ) {
    return res.status(400).json({ message: "Faltan datos requeridos" });
  }

  const query = `
    INSERT INTO tournament_matches 
    (tournament_id, home_team_id, away_team_id, match_date, match_time, format, jornada)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [
      tournamentId,
      homeTeamId,
      awayTeamId,
      matchDate,
      matchTime,
      format || "BO3",
      jornada,
    ],
    (err, result) => {
      if (err) {
        console.error("Error creando partido:", err);
        return res.status(500).json({ message: "Error al crear partido" });
      }
      res.json({
        message: "Partido creado exitosamente",
        matchId: result.insertId,
      });
    }
  );
});

// Actualizar resultado de partido (admin)
app.put(
  "/api/matches/update-score/:matchId",
  verifyToken,
  isAdmin,
  (req, res) => {
    const { matchId } = req.params;
    const { homeScore, awayScore, status } = req.body;

    const query = `
    UPDATE tournament_matches 
    SET home_score = ?, away_score = ?, status = ?
    WHERE id = ?
  `;

    db.query(
      query,
      [homeScore, awayScore, status || "finished", matchId],
      (err) => {
        if (err) {
          console.error("Error actualizando partido:", err);
          return res
            .status(500)
            .json({ message: "Error al actualizar partido" });
        }
        res.json({ message: "Partido actualizado exitosamente" });
      }
    );
  }
);

// Generar calendario automático para un torneo (admin)
app.post(
  "/api/matches/generate-calendar",
  verifyToken,
  isAdmin,
  async (req, res) => {
    const { tournamentId, startDate, matchesPerDay, format } = req.body;

    if (!tournamentId || !startDate) {
      return res
        .status(400)
        .json({ message: "Torneo y fecha de inicio requeridos" });
    }

    try {
      // Obtener equipos del torneo
      const teamsQuery = `
      SELECT t.id, t.name 
      FROM teams t
      INNER JOIN tournaments_teams tt ON t.id = tt.team_id
      WHERE tt.tournament_id = ?
    `;

      db.query(teamsQuery, [tournamentId], async (err, teams) => {
        if (err) {
          console.error("Error obteniendo equipos:", err);
          return res.status(500).json({ message: "Error al obtener equipos" });
        }

        if (teams.length < 2) {
          return res
            .status(400)
            .json({ message: "Se necesitan al menos 2 equipos" });
        }

        // Generar partidos round-robin (todos contra todos, ida y vuelta)
        const matches = [];
        let jornada = 1;
        let currentDate = new Date(startDate);
        const matchesPerDayNum = matchesPerDay || 4;
        const matchFormat = format || "BO3";

        // Ida
        for (let i = 0; i < teams.length; i++) {
          for (let j = i + 1; j < teams.length; j++) {
            matches.push({
              tournament_id: tournamentId,
              home_team_id: teams[i].id,
              away_team_id: teams[j].id,
              jornada: jornada,
              format: matchFormat,
            });
          }
        }

        // Vuelta
        jornada = Math.ceil(matches.length / matchesPerDayNum) + 1;
        for (let i = 0; i < teams.length; i++) {
          for (let j = i + 1; j < teams.length; j++) {
            matches.push({
              tournament_id: tournamentId,
              home_team_id: teams[j].id,
              away_team_id: teams[i].id,
              jornada: jornada,
              format: matchFormat,
            });
          }
        }

        // Asignar fechas y horas
        const matchTimes = ["16:00:00", "17:30:00", "19:00:00", "20:30:00"];
        let timeIndex = 0;
        let matchesInDay = 0;

        matches.forEach((match, index) => {
          match.match_date = new Date(currentDate).toISOString().split("T")[0];
          match.match_time = matchTimes[timeIndex];

          timeIndex = (timeIndex + 1) % matchTimes.length;
          matchesInDay++;

          if (matchesInDay >= matchesPerDayNum) {
            currentDate.setDate(currentDate.getDate() + 1);
            timeIndex = 0;
            matchesInDay = 0;
          }

          // Actualizar jornada
          match.jornada = Math.floor(index / (teams.length - 1)) + 1;
        });

        // Insertar partidos en la base de datos
        const insertQuery = `
        INSERT INTO tournament_matches 
        (tournament_id, home_team_id, away_team_id, match_date, match_time, format, jornada)
        VALUES ?
      `;

        const values = matches.map((m) => [
          m.tournament_id,
          m.home_team_id,
          m.away_team_id,
          m.match_date,
          m.match_time,
          m.format,
          m.jornada,
        ]);

        db.query(insertQuery, [values], (err) => {
          if (err) {
            console.error("Error insertando partidos:", err);
            return res
              .status(500)
              .json({ message: "Error al crear calendario" });
          }

          res.json({
            message: "Calendario generado exitosamente",
            matchesCreated: matches.length,
          });
        });
      });
    } catch (error) {
      console.error("Error generando calendario:", error);
      res.status(500).json({ message: "Error del servidor" });
    }
  }
);

// Obtener equipos inscritos en un torneo específico
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

// SISTEMA DE TICKETS DE SOPORTE
app.post("/api/support/ticket", async (req, res) => {
  const { subject, category, priority, message, email } = req.body;

  if (!subject || !category || !priority || !message) {
    return res.status(400).json({ message: "Faltan campos requeridos" });
  }

  let userEmail = email;
  let username = "Usuario no registrado";

  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userQuery = "SELECT email, username FROM users WHERE id = ?";
      const userResult = await new Promise((resolve, reject) => {
        db.query(userQuery, [decoded.id], (err, results) => {
          if (err) reject(err);
          else resolve(results[0]);
        });
      });
      if (userResult) {
        userEmail = userResult.email;
        username = userResult.username;
      }
    } catch (error) {
      console.log("Token inválido, continuando sin autenticación");
    }
  }

  if (!userEmail) {
    return res.status(400).json({ message: "Email requerido" });
  }

  const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;

  const categoryLabels = {
    general: "Consulta General",
    account: "Problemas de Cuenta",
    team: "Problemas con Equipo",
    tournament: "Torneos",
    technical: "Problemas Técnicos",
    other: "Otro",
  };

  const priorityLabels = {
    low: "Baja",
    normal: "Normal",
    high: "Alta",
  };

  try {
    await resend.emails.send({
      from: "Calce Team Support <support@calceteam.eu>",
      to: "calceteam@proton.me",
      replyTo: userEmail,
      subject: `[${priorityLabels[priority] || priority}] Ticket #${ticketNumber}: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1E3A8A;">Nuevo Ticket de Soporte</h2>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
            <p><strong>Ticket:</strong> #${ticketNumber}</p>
            <p><strong>Usuario:</strong> ${username}</p>
            <p><strong>Email:</strong> ${userEmail}</p>
            <p><strong>Categoría:</strong> ${categoryLabels[category] || category}</p>
            <p><strong>Prioridad:</strong> ${priorityLabels[priority] || priority}</p>
            <p><strong>Asunto:</strong> ${subject}</p>
          </div>
          <hr style="margin: 20px 0;">
          <h3>Mensaje:</h3>
          <div style="background: #ffffff; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
            <p>${message.replace(/\n/g, "<br>")}</p>
          </div>
        </div>
      `,
    });

    await resend.emails.send({
      from: "Calce Team Support <support@calceteam.eu>",
      to: userEmail,
      subject: `Ticket de Soporte #${ticketNumber} - ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h3 style="color: #1E3A8A;">Hemos recibido tu solicitud de soporte</h3>
          <p>Tu ticket <strong>#${ticketNumber}</strong> ha sido recibido correctamente.</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Asunto:</strong> ${subject}</p>
            <p><strong>Prioridad:</strong> ${priorityLabels[priority] || priority}</p>
          </div>
          <p>Te responderemos lo antes posible a este email.</p>
          <br>
          <p>Saludos,<br>Equipo de Soporte de Calce Team</p>
        </div>
      `,
    });

    res.json({
      message: "Ticket enviado exitosamente",
      ticketNumber,
    });
  } catch (error) {
    console.error("Error enviando ticket:", error);
    res
      .status(500)
      .json({
        message:
          "Error al enviar el ticket. Por favor, verifica tu conexión e intenta de nuevo.",
      });
  }
});

app.get("/api/support/my-tickets", verifyToken, (req, res) => {
  res.json({
    tickets: [],
    message: "Los tickets se gestionan por email",
  });
});

// ==========================================
// NUEVOS ENDPOINTS PARA SISTEMA DE PARTIDOS
// ==========================================

// Función para generar partidos automáticamente
function generateTournamentMatches(tournamentId, teams, startDate, callback) {
  if (teams.length < 4) {
    return callback(new Error("Se necesitan al menos 4 equipos"));
  }

  const matches = [];
  let jornada = 1;
  let currentDate = new Date(startDate);
  const matchTimes = ["16:00:00", "17:30:00", "19:00:00", "20:30:00"];
  let timeIndex = 0;
  let matchesInDay = 0;
  const maxMatchesPerDay = 4;

  // Generar todos vs todos (ida y vuelta)
  // Fase ida
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({
        tournament_id: tournamentId,
        home_team_id: teams[i].id,
        away_team_id: teams[j].id,
        match_date: new Date(currentDate).toISOString().split('T')[0],
        match_time: matchTimes[timeIndex],
        format: 'BO3',
        jornada: jornada,
        home_score: 0,
        away_score: 0,
        status: 'scheduled'
      });

      timeIndex = (timeIndex + 1) % matchTimes.length;
      matchesInDay++;

      if (matchesInDay >= maxMatchesPerDay) {
        currentDate.setDate(currentDate.getDate() + 7); // Siguiente semana
        timeIndex = 0;
        matchesInDay = 0;
        jornada++;
      }
    }
  }

  // Fase vuelta (después de una semana de descanso)
  currentDate.setDate(currentDate.getDate() + 7);
  jornada++;

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({
        tournament_id: tournamentId,
        home_team_id: teams[j].id, // Invertido para la vuelta
        away_team_id: teams[i].id,
        match_date: new Date(currentDate).toISOString().split('T')[0],
        match_time: matchTimes[timeIndex],
        format: 'BO3',
        jornada: jornada,
        home_score: 0,
        away_score: 0,
        status: 'scheduled'
      });

      timeIndex = (timeIndex + 1) % matchTimes.length;
      matchesInDay++;

      if (matchesInDay >= maxMatchesPerDay) {
        currentDate.setDate(currentDate.getDate() + 7);
        timeIndex = 0;
        matchesInDay = 0;
        jornada++;
      }
    }
  }

  // Insertar partidos en la base de datos
  if (matches.length === 0) {
    return callback(null, 0);
  }

  const insertQuery = `
    INSERT INTO tournament_matches 
    (tournament_id, home_team_id, away_team_id, match_date, match_time, format, jornada, home_score, away_score, status)
    VALUES ?
  `;

  const values = matches.map(m => [
    m.tournament_id, m.home_team_id, m.away_team_id, 
    m.match_date, m.match_time, m.format, m.jornada, 
    m.home_score, m.away_score, m.status
  ]);

  db.query(insertQuery, [values], (err, result) => {
    if (err) {
      console.error("Error insertando partidos:", err);
      return callback(err);
    }

    // Crear estadísticas iniciales para todos los equipos
    const statsQuery = `
      INSERT IGNORE INTO tournament_stats (tournament_id, team_id, wins, losses, points, games_played)
      VALUES ?
    `;

    const statsValues = teams.map(team => [tournamentId, team.id, 0, 0, 0, 0]);

    db.query(statsQuery, [statsValues], (err) => {
      if (err) {
        console.error("Error creando estadísticas:", err);
        return callback(err);
      }
      callback(null, matches.length);
    });
  });
}

// MODIFICAR EL ENDPOINT DE REGISTRO EXISTENTE
// Reemplaza tu endpoint actual de registro por este:
app.post("/api/tournament/register", verifyToken, (req, res) => {
  const { tournamentId, teamId } = req.body;

  if (!tournamentId || !teamId) {
    return res.status(400).json({ message: "Faltan datos requeridos" });
  }

  const checkMemberQuery = "SELECT * FROM teams_players WHERE team_id = ? AND user_id = ?";
  db.query(checkMemberQuery, [teamId, req.userId], (err, memberResults) => {
    if (err || memberResults.length === 0) {
      return res.status(403).json({ message: "No eres miembro de este equipo" });
    }

    const checkTournamentQuery = "SELECT * FROM tournaments WHERE id = ? AND status = 'abierto'";
    db.query(checkTournamentQuery, [tournamentId], (err, tournamentResults) => {
      if (err || tournamentResults.length === 0) {
        return res.status(404).json({ message: "Torneo no disponible" });
      }

      const tournament = tournamentResults[0];

      const checkRegistrationQuery = "SELECT * FROM tournaments_teams WHERE tournament_id = ? AND team_id = ?";
      db.query(checkRegistrationQuery, [tournamentId, teamId], (err, regResults) => {
        if (err) {
          return res.status(500).json({ message: "Error del servidor" });
        }

        if (regResults.length > 0) {
          return res.status(400).json({ message: "El equipo ya está inscrito en este torneo" });
        }

        // Inscribir el equipo
        const insertQuery = "INSERT INTO tournaments_teams (tournament_id, team_id, registration_date) VALUES (?, ?, NOW())";
        db.query(insertQuery, [tournamentId, teamId], (err) => {
          if (err) {
            console.error("Error inscribiendo equipo:", err);
            return res.status(500).json({ message: "Error al inscribir equipo" });
          }

          // Verificar si hay suficientes equipos para generar partidos
          const countTeamsQuery = "SELECT COUNT(*) as count FROM tournaments_teams WHERE tournament_id = ?";
          db.query(countTeamsQuery, [tournamentId], (err, countResults) => {
            if (err) {
              console.log("Error contando equipos, pero inscripción exitosa");
              return res.json({ message: "Equipo inscrito exitosamente" });
            }

            const teamCount = countResults[0].count;

            // Si hay 4 o más equipos, generar partidos automáticamente
            if (teamCount >= 4) {
              // Verificar si ya existen partidos
              const checkMatchesQuery = "SELECT COUNT(*) as count FROM tournament_matches WHERE tournament_id = ?";
              db.query(checkMatchesQuery, [tournamentId], (err, matchResults) => {
                if (err || matchResults[0].count > 0) {
                  // Ya hay partidos o error, no generar
                  return res.json({ message: "Equipo inscrito exitosamente" });
                }

                // Obtener todos los equipos inscritos
                const getTeamsQuery = `
                  SELECT t.id, t.name 
                  FROM teams t
                  INNER JOIN tournaments_teams tt ON t.id = tt.team_id
                  WHERE tt.tournament_id = ?
                `;

                db.query(getTeamsQuery, [tournamentId], (err, teams) => {
                  if (err) {
                    console.log("Error obteniendo equipos");
                    return res.json({ message: "Equipo inscrito exitosamente" });
                  }

                  // Generar partidos automáticamente
                  generateTournamentMatches(tournamentId, teams, tournament.date, (err, matchesCreated) => {
                    if (err) {
                      console.error("Error generando partidos:", err);
                      return res.json({ 
                        message: "Equipo inscrito exitosamente, pero hubo un error generando el calendario" 
                      });
                    }

                    res.json({ 
                      message: `Equipo inscrito exitosamente. Se generaron ${matchesCreated} partidos automáticamente.`,
                      matchesGenerated: matchesCreated
                    });
                  });
                });
              });
            } else {
              res.json({ 
                message: `Equipo inscrito exitosamente. Se necesitan ${4 - teamCount} equipos más para generar el calendario.` 
              });
            }
          });
        });
      });
    });
  });
});

// Obtener partidos de un torneo
app.get("/api/tournament/:id/matches", (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT 
      m.*,
      home.name as home_team_name,
      home.logo as home_team_logo,
      away.name as away_team_name,
      away.logo as away_team_logo
    FROM tournament_matches m
    INNER JOIN teams home ON m.home_team_id = home.id
    INNER JOIN teams away ON m.away_team_id = away.id
    WHERE m.tournament_id = ?
    ORDER BY m.jornada ASC, m.match_date ASC, m.match_time ASC
  `;

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error("Error obteniendo partidos:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }

    const matches = results.map(match => ({
      ...match,
      home_team: {
        id: match.home_team_id,
        name: match.home_team_name,
        logo: match.home_team_logo ? `data:image/jpeg;base64,${match.home_team_logo.toString('base64')}` : null
      },
      away_team: {
        id: match.away_team_id,
        name: match.away_team_name,
        logo: match.away_team_logo ? `data:image/jpeg;base64,${match.away_team_logo.toString('base64')}` : null
      }
    }));

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

    const stats = results.map(stat => ({
      ...stat,
      team_logo: stat.team_logo ? `data:image/jpeg;base64,${stat.team_logo.toString('base64')}` : null
    }));

    res.json({ stats });
  });
});

// Editar partido (admin)
app.put("/api/tournament/match/:matchId", verifyToken, isAdmin, (req, res) => {
  const { matchId } = req.params;
  const { match_date, match_time, format, home_score, away_score, status } = req.body;

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

  if (format) {
    fieldsToUpdate.push("format = ?");
    values.push(format);
  }

  if (home_score !== undefined) {
    fieldsToUpdate.push("home_score = ?");
    values.push(home_score);
  }

  if (away_score !== undefined) {
    fieldsToUpdate.push("away_score = ?");
    values.push(away_score);
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

    // Si se actualizó el resultado, actualizar estadísticas
    if (home_score !== undefined && away_score !== undefined && status === 'finished') {
      updateTournamentStats(matchId, (err) => {
        if (err) {
          console.error("Error actualizando estadísticas:", err);
        }
      });
    }

    res.json({ message: "Partido actualizado exitosamente" });
  });
});

// Función para actualizar estadísticas después de un partido
function updateTournamentStats(matchId, callback) {
  const getMatchQuery = `
    SELECT tournament_id, home_team_id, away_team_id, home_score, away_score 
    FROM tournament_matches 
    WHERE id = ? AND status = 'finished'
  `;

  db.query(getMatchQuery, [matchId], (err, matches) => {
    if (err || matches.length === 0) {
      return callback(err || new Error("Partido no encontrado"));
    }

    const match = matches[0];
    const { tournament_id, home_team_id, away_team_id, home_score, away_score } = match;

    let homeWins = 0, homeLosses = 0, awayWins = 0, awayLosses = 0;
    let homePoints = 0, awayPoints = 0;

    if (home_score > away_score) {
      homeWins = 1;
      awayLosses = 1;
      homePoints = 3; // 3 puntos por victoria
    } else if (away_score > home_score) {
      awayWins = 1;
      homeLosses = 1;
      awayPoints = 3;
    } else {
      // Empate (si aplica)
      homePoints = 1;
      awayPoints = 1;
    }

    // Actualizar estadísticas del equipo local
    const updateHomeQuery = `
      UPDATE tournament_stats 
      SET wins = wins + ?, losses = losses + ?, points = points + ?, games_played = games_played + 1
      WHERE tournament_id = ? AND team_id = ?
    `;

    db.query(updateHomeQuery, [homeWins, homeLosses, homePoints, tournament_id, home_team_id], (err) => {
      if (err) return callback(err);

      // Actualizar estadísticas del equipo visitante
      db.query(updateHomeQuery, [awayWins, awayLosses, awayPoints, tournament_id, away_team_id], callback);
    });
  });
}

// Regenerar partidos de un torneo (admin)
app.post("/api/tournament/:id/regenerate-matches", verifyToken, isAdmin, (req, res) => {
  const { id } = req.params;

  // Eliminar partidos existentes
  const deleteMatchesQuery = "DELETE FROM tournament_matches WHERE tournament_id = ?";
  db.query(deleteMatchesQuery, [id], (err) => {
    if (err) {
      console.error("Error eliminando partidos:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }

    // Resetear estadísticas
    const resetStatsQuery = `
      UPDATE tournament_stats 
      SET wins = 0, losses = 0, points = 0, games_played = 0 
      WHERE tournament_id = ?
    `;

    db.query(resetStatsQuery, [id], (err) => {
      if (err) {
        console.error("Error reseteando estadísticas:", err);
      }

      // Obtener datos del torneo y equipos
      const getTournamentQuery = "SELECT * FROM tournaments WHERE id = ?";
      db.query(getTournamentQuery, [id], (err, tournaments) => {
        if (err || tournaments.length === 0) {
          return res.status(404).json({ message: "Torneo no encontrado" });
        }

        const tournament = tournaments[0];

        const getTeamsQuery = `
          SELECT t.id, t.name 
          FROM teams t
          INNER JOIN tournaments_teams tt ON t.id = tt.team_id
          WHERE tt.tournament_id = ?
        `;

        db.query(getTeamsQuery, [id], (err, teams) => {
          if (err) {
            return res.status(500).json({ message: "Error obteniendo equipos" });
          }

          if (teams.length < 4) {
            return res.status(400).json({ message: "Se necesitan al menos 4 equipos" });
          }

          generateTournamentMatches(id, teams, tournament.date, (err, matchesCreated) => {
            if (err) {
              console.error("Error generando partidos:", err);
              return res.status(500).json({ message: "Error regenerando partidos" });
            }

            res.json({ 
              message: `Partidos regenerados exitosamente. Se crearon ${matchesCreated} partidos.`,
              matchesCreated 
            });
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
