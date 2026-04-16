const express = require('express');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// evitar cache
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ================================
// ESTOQUE
// ================================
app.get('/api/estoque', (req, res) => {
  const data = JSON.parse(fs.readFileSync('./data/estoque.json'));
  res.json(data);
});

app.post('/api/estoque', (req, res) => {
  const data = JSON.parse(fs.readFileSync('./data/estoque.json'));

  const novo = {
    id: Date.now(),
    nome: req.body.nome,
    quantidade: Number(req.body.quantidade)
  };

  data.push(novo);

  fs.writeFileSync('./data/estoque.json', JSON.stringify(data, null, 2));

  res.json(novo);
});

app.listen(PORT, () => {
  console.log('Servidor rodando na porta ' + PORT);
});
