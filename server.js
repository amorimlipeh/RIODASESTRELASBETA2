const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let db = {
  produtos: [],
  enderecos: [],
  movimentacoes: []
};

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
    nome: req.body.nome
  };

  db.produtos.push(produto);
  res.json(produto);
});

// ENDEREÇOS
app.get('/api/enderecos', (req, res) => {
  res.json(db.enderecos);
});

app.post('/api/enderecos', (req, res) => {
  const endereco = {
    id: Date.now(),
    codigo: req.body.codigo,
    produto: req.body.produto || null
  };

  db.enderecos.push(endereco);
  res.json(endereco);
});

// VINCULAR PRODUTO AO ENDEREÇO
app.post('/api/alocar', (req, res) => {
  const { codigo, produto } = req.body;

  const endereco = db.enderecos.find(e => e.codigo === codigo);

  if (!endereco) return res.status(404).json({ erro: "Endereço não encontrado" });

  endereco.produto = produto;

  db.movimentacoes.push({
    tipo: "alocacao",
    produto,
    endereco: codigo
  });

  res.json(endereco);
});

// MOVIMENTAÇÃO
app.get('/api/movimentacoes', (req, res) => {
  res.json(db.movimentacoes);
});

// SPA
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 WMS rodando na porta ' + PORT);
});
