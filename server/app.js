const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname,'../public')));

// ROTAS
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/produtos', require('./routes/produtos'));
app.use('/api/estoque', require('./routes/estoque'));
app.use('/api/wms', require('./routes/wms'));
app.use('/api/mov', require('./routes/mov'));

// SPA
app.get('*',(req,res)=>{
res.sendFile(path.join(__dirname,'../public/index.html'));
});

module.exports = app;
