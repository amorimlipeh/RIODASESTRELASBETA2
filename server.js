const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db = {
  produtos: [],
  estoque: {},
  movimentacoes: [],
  enderecos: {}
};

// ================= PRODUTOS =================
app.get('/api/produtos', (req, res) => res.json(db.produtos));

app.post('/api/produtos', (req, res) => {
  const { nome } = req.body;
  const produto = {
    id: Date.now(),
    nome
  };
  db.produtos.push(produto);
  res.json(produto);
});

// ================= ESTOQUE =================
app.get('/api/estoque', (req, res) => res.json(db.estoque));

app.post('/api/estoque', (req, res) => {
  const { produto, quantidade, tipo } = req.body;

  if (!db.estoque[produto]) db.estoque[produto] = 0;

  if (tipo === 'entrada') {
    db.estoque[produto] += quantidade;
  } else {
    db.estoque[produto] -= quantidade;
  }

  db.movimentacoes.push({
    produto,
    quantidade,
    tipo,
    data: new Date()
  });

  res.json({ ok: true });
});

// ================= MOVIMENTACOES =================
app.get('/api/movimentacoes', (req, res) => {
  res.json(db.movimentacoes);
});

// ================= WMS =================
app.post('/api/wms', (req, res) => {
  const { endereco, produto, quantidade } = req.body;

  if (!db.enderecos[endereco]) {
    db.enderecos[endereco] = [];
  }

  db.enderecos[endereco].push({
    produto,
    quantidade
  });

  res.json({ ok: true });
});

app.get('/api/wms', (req, res) => {
  res.json(db.enderecos);
});

// ================= DASHBOARD =================
app.get('/api/dashboard', (req, res) => {
  res.json({
    produtos: db.produtos.length,
    movimentacoes: db.movimentacoes.length,
    enderecos: Object.keys(db.enderecos).length
  });
});

// ================= SPA =================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Sistema rodando na porta ' + PORT);
});
