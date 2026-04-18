const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============================
// BANCO
// ============================
let db = {
  produtos: [],
  movimentacoes: [],
  enderecos: []
};

// ============================
// PRODUTOS
// ============================
app.get('/api/produtos', (req, res) => {
  res.json(db.produtos);
});

app.post('/api/produtos', (req, res) => {
  db.produtos.push(req.body);
  res.json({ ok: true });
});

// ============================
// MOVIMENTAÇÕES
// ============================
app.get('/api/movimentacoes', (req, res) => {
  res.json(db.movimentacoes);
});

app.post('/api/movimentacoes', (req, res) => {
  db.movimentacoes.push(req.body);
  res.json({ ok: true });
});

// ============================
// WMS
// ============================
app.get('/api/enderecos', (req, res) => {
  res.json(db.enderecos);
});

app.post('/api/enderecos', (req, res) => {
  db.enderecos.push({ codigo: req.body.codigo });
  res.json({ ok: true });
});

// ============================
// DASHBOARD (🔥 FALTAVA ISSO)
// ============================
app.get('/api/dashboard', (req, res) => {
  res.json({
    produtos: db.produtos.length,
    movimentacoes: db.movimentacoes.length,
    enderecos: db.enderecos.length
  });
});

// ============================
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Sistema rodando na porta ' + PORT);
});
