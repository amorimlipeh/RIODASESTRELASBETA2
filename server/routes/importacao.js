const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const upload = multer({ dest: 'uploads/' });

router.post('/preview', upload.single('file'), (req, res) => {
    try {
        const filePath = req.file.path;

        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);

        fs.unlinkSync(filePath);

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
