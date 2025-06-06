const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const mysql = require("mysql2");
const path = require("path");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 8080;

// Middlewares
app.use(cors());
app.use(express.json());

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

// Registro de usuario
app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: "Faltan campos" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const query =
    "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";

  db.query(query, [username, email, hashedPassword], (err) => {
    if (err) {
      console.error("❌ Error al registrar:", err);
      return res.status(500).json({ message: "Error al registrar" });
    }
    res.status(200).json({ message: "Usuario registrado con éxito" });
  });
});

// Login de usuario
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const query = "SELECT * FROM users WHERE email = ?";

  db.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Error interno" });
    if (results.length === 0)
      return res.status(401).json({ message: "Email no encontrado" });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: "Contraseña incorrecta" });

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({ token, username: user.username });
  });
});

// Ruta para manejar rutas API no existentes
app.all("/api/*", (req, res) => {
  res.status(404).json({ message: "Ruta API no encontrada" });
});

// Servir frontend en producción
app.use(express.static(path.join(__dirname, "frontend", "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

// Middleware de manejo de errores general
app.use((err, req, res, next) => {
  console.error("🔥 Error en middleware:", err.stack);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(port, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${port}`);
});
