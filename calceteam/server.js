const express = require('express');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Configura almacenamiento de archivos subidos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Ruta para subir resultados
app.post('/submit', upload.single('screenshot'), (req, res) => {
  const { teamName, opponentName, score } = req.body;
  const screenshot = req.file?.filename;

  console.log(`Partido enviado:
- Equipo: ${teamName}
- Rival: ${opponentName}
- Resultado: ${score}
- Captura: ${screenshot}`);

  res.send('Resultado enviado con éxito ✅');
});

app.listen(PORT,'0.0.0.0', () => {
  console.log(`Servidor activo en http://localhost`);
});
