const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');

const { salvarMapeamento, encontrarMapeamento } = require('../services/mapeamentoService');

const upload = multer({
    dest: path.join(__dirname, '../../uploads/importacao')
});

// PREVIEW + SUGESTÃO
router.post('/preview', upload.single('file'), (req, res) => {
    try {
        const workbook = XLSX.readFile(req.file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const headers = data[0];
        const linhas = data.slice(1, 6);

        const sugestao = {};
        headers.forEach(h => {
            const nome = String(h).toLowerCase();

            if (nome.includes('item') || nome.includes('codigo')) sugestao.codigo = h;
            if (nome.includes('desc') || nome.includes('produto')) sugestao.nome = h;
            if (nome.includes('q/c')) sugestao.fator = h;
            if (nome.includes('qtd')) sugestao.quantidade = h;
        });

        const salvo = encontrarMapeamento(headers);

        res.json({
            headers,
            linhas,
            sugestao,
            salvo
        });

    } catch (err) {
        res.status(500).json({ erro: 'Erro preview' });
    }
});

// SALVAR MAPEAMENTO
router.post('/mapear', (req, res) => {
    salvarMapeamento(req.body);
    res.json({ ok: true });
});

module.exports = router;
