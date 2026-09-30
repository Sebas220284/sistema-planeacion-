const fs = require('fs');
const code = fs.readFileSync('src/interfaces/http/controllers/reportesCIPController.js', 'utf8');

const idx = code.indexOf('exports.reporte2 =');
const end = code.indexOf('exports.reportePorEje =', idx);
console.log(code.substring(idx, end));
