const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = './data/db.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data');
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    produtos: [],
    estoque: {},
    movimentacoes: [],
    enderecos: {}
  }, null, 2));
}

function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// PRODUTOS
app.get('/api/produtos', (req, res) => {
  res.json(readDB().produtos);
});

app.post('/api/produtos', (req, res) => {
  const db = readDB();
  const produto = { id: Date.now(), nome: req.body.nome };
  db.produtos.push(produto);
  saveDB(db);
  res.json(produto);
});

// ESTOQUE
app.post('/api/estoque', (req, res) => {
  const db = readDB();
  const { produto, quantidade, tipo } = req.body;

  if (!db.estoque[produto]) db.estoque[produto] = 0;

  if (tipo === 'entrada') db.estoque[produto] += quantidade;
  else db.estoque[produto] -= quantidade;

  db.movimentacoes.push({
    produto,
    quantidade,
    tipo,
    data: new Date()
  });

  saveDB(db);
  res.json({ ok: true });
});

// MOVIMENTAÇÕES
app.get('/api/movimentacoes', (req, res) => {
  res.json(readDB().movimentacoes);
});

// WMS
app.post('/api/wms', (req, res) => {
  const db = readDB();
  const { endereco, produto, quantidade } = req.body;

  if (!db.enderecos[endereco]) db.enderecos[endereco] = [];
  db.enderecos[endereco].push({ produto, quantidade });

  saveDB(db);
  res.json({ ok: true });
});

app.get('/api/wms', (req, res) => {
  res.json(readDB().enderecos);
});

// DASHBOARD
app.get('/api/dashboard', (req, res) => {
  const db = readDB();
  res.json({
    produtos: db.produtos.length,
    movimentacoes: db.movimentacoes.length,
    enderecos: Object.keys(db.enderecos).length
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 WMS rodando na porta ' + PORT);
});
