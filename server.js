const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1>🚀 RIO DAS ESTRELAS ONLINE</h1>');
});

server.listen(PORT, () => {
  console.log('Servidor rodando na porta ' + PORT);
});
