const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');

const upload = multer({ dest: 'uploads/importacao/' });

router.post('/preview', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ erro: 'Arquivo não enviado' });
        }

        const workbook = XLSX.readFile(req.file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        res.json({
            sucesso: true,
            total: json.length,
            dados: json.slice(0, 20) // preview limitado
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao processar planilha' });
    }
});

module.exports = router;
