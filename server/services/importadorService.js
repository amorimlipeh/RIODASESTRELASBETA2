const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DATA_PATH = path.join(__dirname, '../../data');

function readJSON(file) {
    const filePath = path.join(DATA_PATH, file);
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath));
}

function writeJSON(file, data) {
    const filePath = path.join(DATA_PATH, file);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function importarComMapeamento(filePath, mapeamento) {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    let produtos = readJSON('produtos.json');
    let estoque = readJSON('estoque.json');

    data.forEach(row => {
        const codigo = row[mapeamento.codigo];
        if (!codigo) return;

        const nome = row[mapeamento.nome] || '';
        const fator = parseFloat(row[mapeamento.fator]) || 1;
        const quantidade = parseFloat(row[mapeamento.quantidade]) || 0;

        const caixas = fator > 0 ? quantidade / fator : 0;

        // PRODUTO
        let produto = produtos.find(p => p.codigo == codigo);

        if (!produto) {
            produto = { codigo, nome, fator };
            produtos.push(produto);
        }

        // ESTOQUE
        let item = estoque.find(e => e.codigo == codigo);

        if (!item) {
            estoque.push({
                codigo,
                unidades: quantidade,
                caixas,
                fator
            });
        } else {
            item.unidades += quantidade;
            item.caixas += caixas;
        }
    });

    writeJSON('produtos.json', produtos);
    writeJSON('estoque.json', estoque);

    return { sucesso: true, total: data.length };
}

module.exports = {
    importarComMapeamento
};
