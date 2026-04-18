const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ========================
// BANCO SIMPLES
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

// STATUS
app.get('/api/status', (req, res) => {
  res.json({ ok: true });
});

// PRODUTOS
app.get('/api/produtos', (req, res) => {
  res.json(db.produtos);
});

app.post('/api/produtos', (req, res) => {
  const produto = {
    id: Date.now(),
    nome: req.body.nome,
    quantidade: req.body.quantidade || 0
  };

  db.produtos.push(produto);

  db.movimentacoes.push({
    tipo: "entrada",
    produto: produto.nome,
    data: new Date()
  });

  res.json(produto);
});

// MOVIMENTAÇÕES
app.get('/api/movimentacoes', (req, res) => {
  res.json(db.movimentacoes);
});

// SPA
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Sistema rodando na porta ' + PORT);
});
