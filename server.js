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
// WMS
// ============================
app.get('/api/enderecos', (req, res) => {
  res.json(db.enderecos);
});

app.post('/api/enderecos', (req, res) => {
  db.enderecos.push({
    codigo: req.body.codigo,
    estoque: []
  });
  res.json({ ok: true });
});

// ============================
// MOVIMENTAÇÃO COM ENDEREÇO
// ============================
app.post('/api/movimentacoes', (req, res) => {
  const { tipo, produto, quantidade, endereco } = req.body;

  const end = db.enderecos.find(e => e.codigo === endereco);

  if (!end) {
    return res.status(400).json({ erro: 'Endereço não existe' });
  }

  let item = end.estoque.find(i => i.produto === produto);

  if (!item) {
    item = { produto, quantidade: 0 };
    end.estoque.push(item);
  }

  if (tipo === 'entrada') {
    item.quantidade += Number(quantidade);
  }

  if (tipo === 'saida') {
    item.quantidade -= Number(quantidade);
  }

  db.movimentacoes.push(req.body);

  res.json({ ok: true });
});

app.get('/api/movimentacoes', (req, res) => {
  res.json(db.movimentacoes);
});

// ============================
// ESTOQUE POR ENDEREÇO
// ============================
app.get('/api/estoque', (req, res) => {
  res.json(db.enderecos);
});

// ============================
// DASHBOARD
// ============================
app.get('/api/dashboard', (req, res) => {
  res.json({
    produtos: db.produtos.length,
    movimentacoes: db.movimentacoes.length,
    enderecos: db.enderecos.length
  });
});

app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 WMS rodando na porta ' + PORT);
});
