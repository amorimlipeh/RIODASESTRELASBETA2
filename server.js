
const express = require('express');
const path = require('path');

const app = express();
// ANTI CACHE GLOBAL
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const importacaoRoutes = require('./server/routes/importacao');
app.use('/api/importacao', importacaoRoutes);

app.get('/api/status', (req, res) => {
    res.json({ ok: true });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Rodando na porta ' + PORT);
});
