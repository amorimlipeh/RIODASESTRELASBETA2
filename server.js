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

app.get('/api/movimentacoes', (req, res) => {
  res.json(db.movimentacoes);
});

app.post('/api/movimentacoes', (req, res) => {
  db.movimentacoes.push(req.body);
  res.json({ ok: true });
});

app.get('/api/enderecos', (req, res) => {
  res.json(db.enderecos);
});

app.post('/api/enderecos', (req, res) => {
  db.enderecos.push({ codigo: req.body.codigo });
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Sistema rodando ' + PORT);
});
