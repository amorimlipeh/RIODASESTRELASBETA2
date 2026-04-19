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

function detectarColunas(headers) {
    const map = {};

    headers.forEach((h, index) => {
        const nome = String(h).toLowerCase();

        if (nome.includes('item') || nome.includes('codigo'))
            map.codigo = index;

        if (nome.includes('desc') || nome.includes('produto'))
            map.nome = index;

        if (nome.includes('q/c') || nome.includes('fator'))
            map.fator = index;

        if (nome.includes('qtd') || nome.includes('quantidade'))
            map.quantidade = index;
    });

    return map;
}

function importarXLSX(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const headers = data[0];
    const col = detectarColunas(headers);

    let produtos = readJSON('produtos.json');
    let estoque = readJSON('estoque.json');

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;

        const codigo = row[col.codigo];
        if (!codigo) continue;

        const nome = row[col.nome] || '';
        const fator = parseFloat(row[col.fator]) || 1;
        const quantidade = parseFloat(row[col.quantidade]) || 0;

        const caixas = fator > 0 ? quantidade / fator : 0;

        let produto = produtos.find(p => p.codigo == codigo);

        if (!produto) {
            produto = { codigo, nome, fator };
            produtos.push(produto);
        }

        let itemEstoque = estoque.find(e => e.codigo == codigo);

        if (!itemEstoque) {
            estoque.push({
                codigo,
                unidades: quantidade,
                caixas,
                fator
            });
        } else {
            itemEstoque.unidades += quantidade;
            itemEstoque.caixas += caixas;
        }
    }

    writeJSON('produtos.json', produtos);
    writeJSON('estoque.json', estoque);

    return {
        sucesso: true,
        totalImportado: data.length - 1
    };
}

module.exports = { importarXLSX };
