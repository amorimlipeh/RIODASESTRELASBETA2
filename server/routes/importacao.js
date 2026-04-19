const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

router.post('/preview', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ sucesso: false, erro: "Arquivo não enviado" });
        }

        const workbook = XLSX.readFile(req.file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);

        fs.unlinkSync(req.file.path);

        res.json({
            sucesso: true,
            total: data.length,
            preview: data.slice(0, 20)
        });

    } catch (err) {
        res.status(500).json({
            sucesso: false,
            erro: err.message
        });
    }
});

module.exports = router;
