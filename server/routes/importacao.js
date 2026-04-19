const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const { importarXLSX } = require('../services/importadorService');

const upload = multer({
    dest: path.join(__dirname, '../../uploads/importacao')
});

router.post('/xlsx', upload.single('file'), (req, res) => {
    try {
        const resultado = importarXLSX(req.file.path);
        res.json(resultado);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro na importação' });
    }
});

module.exports = router;
