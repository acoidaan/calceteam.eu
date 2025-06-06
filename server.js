const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();

app.use(cors()); // Permitir CORS para todas las rutas

// Crear / conectar DB
const db = new sqlite3.Database('./calceteam.db');

// Crear tabla de usuarios si no existe
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Endpoint registro
  app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
      [username, email, hashedPassword],
      (err) => {
        if (err) return res.status(400).json({ error: "Usuario ya existe" });
        res.json({ message: "Usuario registrado con éxito" });
      }
    );
  });

  // Endpoint login
  app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
      if (!user) return res.status(400).json({ error: "Usuario no encontrado" });

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.status(400).json({ error: "Contraseña incorrecta" });

      const token = jwt.sign({ id: user.id }, 'token_secreto');
      res.json({ token, username: user.username });
    });
  });

const app = express();
const PORT = process.env.PORT || 8080;

// Ruta del archivo donde se guardan los resultados
const resultsFile = path.join(__dirname, "calceteam/data/results.json");

// Configurar almacenamiento de capturas en /uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "calceteam/uploads"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Añadido para React
app.use("/uploads", express.static("calceteam/uploads")); // Acceso a capturas

// RUTAS API PRIMERO (antes que React)
// Ruta para subir resultados
app.post("/submit", upload.single("screenshot"), (req, res) => {
  const { teamName, opponentName, score } = req.body;
  const screenshot = req.file?.filename;

  const resultado = {
    teamName,
    opponentName,
    score,
    screenshot,
    date: new Date().toISOString(),
  };

  // Leer archivo de resultados existente
  fs.readFile(resultsFile, "utf-8", (err, data) => {
    let results = [];
    if (!err && data) {
      try {
        results = JSON.parse(data);
      } catch {
        console.error("Error al parsear el archivo JSON existente");
      }
    }

    // Añadir nuevo resultado y guardar
    results.push(resultado);
    fs.writeFile(resultsFile, JSON.stringify(results, null, 2), (err) => {
      if (err) {
        console.error("Error guardando resultado:", err);
        return res.status(500).send("Error al guardar resultado");
      }

      res.send("Resultado enviado y guardado ✅");
    });
  });
});

// API para obtener resultados (para React)
app.get("/api/resultados", (req, res) => {
  fs.readFile(resultsFile, "utf-8", (err, data) => {
    if (err) {
      console.error("Error leyendo los resultados:", err);
      return res.status(500).json({ error: "Error al cargar los resultados" });
    }

    let results = [];
    try {
      results = JSON.parse(data);
    } catch {
      return res.status(500).json({ error: "Archivo de resultados corrupto" });
    }

    res.json(results);
  });
});

// Página HTML para ver resultados (fallback)
app.get("/resultados", (req, res) => {
  fs.readFile(resultsFile, "utf-8", (err, data) => {
    if (err) {
      console.error("Error leyendo los resultados:", err);
      return res.status(500).send("Error al cargar los resultados");
    }

    let results = [];
    try {
      results = JSON.parse(data);
    } catch {
      return res.status(500).send("Archivo de resultados corrupto");
    }

    // Generar HTML dinámicamente
    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Resultados - Calce Team</title>
        <style>
          body { font-family: Arial; padding: 20px; background: #f4f4f4; }
          h1 { text-align: center; }
          table { width: 100%; border-collapse: collapse; background: #fff; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: center; }
          th { background-color: #333; color: white; }
          img { max-height: 80px; }
        </style>
      </head>
      <body>
        <h1>Resultados de partidas</h1>
        <table>
          <tr>
            <th>Fecha</th>
            <th>Equipo</th>
            <th>Rival</th>
            <th>Resultado</th>
            <th>Captura</th>
          </tr>
          ${results
            .map(
              (r) => `
              <tr>
                <td>${new Date(r.date).toLocaleString()}</td>
                <td>${r.teamName}</td>
                <td>${r.opponentName}</td>
                <td>${r.score}</td>
                <td>${
                  r.screenshot
                    ? `<a href="/uploads/${r.screenshot}" target="_blank"><img src="/uploads/${r.screenshot}"></a>`
                    : "Sin imagen"
                }</td>
              </tr>
            `
            )
            .join("")}
        </table>
        <a href="/">← Volver al inicio</a>
      </body>
      </html>
    `;

    res.send(html);
  });
});

// SERVIR REACT AL FINAL
const frontendPath = path.join(__dirname, "frontend/dist");
app.use(express.static(frontendPath));

// Ruta específica para React (evita conflictos con path-to-regexp)
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Fallback para rutas no encontradas
app.use((req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Escuchar en todas las interfaces
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});
