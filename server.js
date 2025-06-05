

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8080;

// Ruta del archivo donde se guardan los resultados
const resultsFile = path.join(__dirname, "data/results.json");

// Configurar almacenamiento de capturas en /uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public")); // Archivos estáticos
app.use("/uploads", express.static("uploads")); // Acceso a capturas

// Página principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

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

// Página para ver resultados guardados
app.get('/resultados', (req, res) => {
  fs.readFile(resultsFile, 'utf-8', (err, data) => {
    if (err) {
      console.error('Error leyendo los resultados:', err);
      return res.status(500).send('Error al cargar los resultados');
    }

    let results = [];
    try {
      results = JSON.parse(data);
    } catch {
      return res.status(500).send('Archivo de resultados corrupto');
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
          ${
            results.map(r => `
              <tr>
                <td>${new Date(r.date).toLocaleString()}</td>
                <td>${r.teamName}</td>
                <td>${r.opponentName}</td>
                <td>${r.score}</td>
                <td>${r.screenshot ? `<a href="/uploads/${r.screenshot}" target="_blank"><img src="/uploads/${r.screenshot}"></a>` : 'Sin imagen'}</td>
              </tr>
            `).join('')
          }
        </table>
      </body>
      </html>
    `;

    res.send(html);
  });
});


// Servir React desde Express (producción)
const frontendPath = path.join(__dirname, 'frontend/dist');
app.use(express.static(frontendPath));

app.get(/^\/(?!api|submit|resultados|uploads).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});


// Escuchar en todas las interfaces (necesario para acceso externo)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});
