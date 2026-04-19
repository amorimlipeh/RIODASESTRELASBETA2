const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');

const upload = multer({
    dest: path.join(__dirname, '../../uploads/importacao')
});

// 🔍 PREVIEW
router.post('/preview', upload.single('file'), (req, res) => {
    try {
        const workbook = XLSX.readFile(req.file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const headers = data[0];
        const linhas = data.slice(1, 11);

        res.json({
            headers,
            linhas
        });

    } catch (err) {
        res.status(500).json({ erro: 'Erro ao ler arquivo' });
    }
});

module.exports = router;
