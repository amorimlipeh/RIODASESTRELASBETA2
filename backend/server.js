require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

// ROTAS API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/empresas', require('./routes/empresas'));
app.use('/api/produtos', require('./routes/produtos'));
app.use('/api/estoque', require('./routes/estoque'));
app.use('/api/enderecos', require('./routes/enderecos'));
app.use('/api/pedidos', require('./routes/pedidos'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/notificacoes', require('./routes/notificacoes'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '2.0.0', nome: 'Sistema Logístico de Operação' }));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sistema Logístico de Operação v2.0 rodando na porta ${PORT}`);
});
