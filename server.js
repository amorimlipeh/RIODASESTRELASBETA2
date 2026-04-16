const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const dataPath = path.join(__dirname, 'data', 'estoque.json');

// garante pasta e arquivo
if (!fs.existsSync('data')) fs.mkdirSync('data');
if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, '[]');

// ler estoque
function getEstoque() {
  return JSON.parse(fs.readFileSync(dataPath));
}

// salvar estoque
function saveEstoque(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

const server = http.createServer((req, res) => {

  // API GET
  if (req.method === 'GET' && req.url === '/api/estoque') {
    const data = getEstoque();
    res.writeHead(200, {'Content-Type': 'application/json'});
    return res.end(JSON.stringify(data));
  }

  // API POST
  if (req.method === 'POST' && req.url === '/api/estoque') {
    let body = '';

    req.on('data', chunk => body += chunk);

    req.on('end', () => {
      const novo = JSON.parse(body);

      const estoque = getEstoque();
      estoque.push(novo);

      saveEstoque(estoque);

      res.writeHead(200);
      res.end('OK');
    });

    return;
  }

  // arquivos estáticos
  let filePath = './public' + (req.url === '/' ? '/index.html' : req.url);

  const ext = path.extname(filePath);

  const map = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css'
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }

    res.writeHead(200, {'Content-Type': map[ext] || 'text/plain'});
    res.end(data);
  });

});

server.listen(PORT, () => {
  console.log('Servidor rodando na porta ' + PORT);
});
