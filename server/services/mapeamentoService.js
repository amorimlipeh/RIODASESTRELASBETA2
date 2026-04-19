const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../../data/mapeamentos.json');

function getMapeamentos() {
    if (!fs.existsSync(FILE)) return [];
    return JSON.parse(fs.readFileSync(FILE));
}

function salvarMapeamento(m) {
    const lista = getMapeamentos();
    lista.push(m);
    fs.writeFileSync(FILE, JSON.stringify(lista, null, 2));
}

function encontrarMapeamento(headers) {
    const lista = getMapeamentos();

    return lista.find(m => {
        return headers.every(h =>
            Object.values(m.campos).includes(h)
        );
    });
}

module.exports = {
    salvarMapeamento,
    encontrarMapeamento
};
