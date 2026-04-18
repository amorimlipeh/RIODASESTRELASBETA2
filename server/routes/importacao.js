const router = require('express').Router();
const XLSX = require('xlsx');
const fs = require('fs');

router.post('/', (req, res) => {
  try {
    const file = req.body.file;

    const buffer = Buffer.from(file, 'base64');
    fs.writeFileSync('temp.xlsx', buffer);

    const workbook = XLSX.readFile('temp.xlsx');

    const sheets = workbook.SheetNames;

    const preview = sheets.map(name => {
      const sheet = workbook.Sheets[name];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      return {
        nome: name,
        colunas: data[0],
        linhas: data.slice(1, 6)
      };
    });

    fs.unlinkSync('temp.xlsx');

    res.json({ sheets, preview });

  } catch (err) {
    res.status(500).json({ erro: 'Falha ao ler arquivo' });
  }
});

module.exports = router;
