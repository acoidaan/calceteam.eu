const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const mysql = require("mysql2");
const path = require("path");
const multer = require("multer");
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
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
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

      const insertQuery =
        "INSERT INTO users (username, email, password, verified) VALUES (?, ?, ?, ?)";
      db.query(
        insertQuery,
        [username, email, hashedPassword, false],
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
                 <p>Haz clic <a href="http://calceteam.eu:${port}/api/verify/${verificationToken}">aquí</a> para verificar tu cuenta.</p>
                 <p>Este enlace caduca en 1 hora.</p>`,
          });

          res
            .status(200)
            .json({
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
      { expiresIn: "1h" }
    );
    res.status(200).json({
      token,
      username: user.username
    });
  });
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
    if (err || results.length === 0) return res.status(500).json({ message: "Error al buscar usuario" });

    const user = results[0];
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ message: "Contraseña incorrecta" });

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
    if (err || results.length === 0) return res.status(500).json({ message: "Error al buscar usuario" });

    const user = results[0];
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ message: "Contraseña actual incorrecta" });

    const hashed = await bcrypt.hash(newPassword, 10);
    const updateQuery = "UPDATE users SET password = ? WHERE id = ?";
    db.query(updateQuery, [hashed, req.userId], (err) => {
      if (err) return res.status(500).json({ message: "Error al cambiar contraseña" });
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
