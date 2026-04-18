const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ========================
// BANCO MOCK
// ========================
let db = {
  produtos: [],
  estoque: [],
  pedidos: [],
  movimentacoes: []
};

// ========================
// ROTAS
// ========================

app.get('/api/status', (req, res) => {
  res.json({ ok: true, sistema: "RIO DAS ESTRELAS ENTERPRISE" });
});

// PRODUTOS
app.get('/api/produtos', (req, res) => {
  res.json(db.produtos);
});

app.post('/api/produtos', (req, res) => {
  const produto = req.body;
  produto.id = Date.now();
  db.produtos.push(produto);
  res.json(produto);
});

// ESTOQUE
app.get('/api/estoque', (req, res) => {
  res.json(db.estoque);
});

// PEDIDOS
app.get('/api/pedidos', (req, res) => {
  res.json(db.pedidos);
});

// SPA
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// START
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Rodando na porta ' + PORT);
});
