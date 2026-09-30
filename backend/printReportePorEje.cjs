const fs = require('fs');
const code = fs.readFileSync('src/interfaces/http/controllers/reportesCIPController.js', 'utf8');

const idx = code.indexOf('exports.reportePorEje =');
const end = code.indexOf('exports.reportes =', idx) !== -1 ? code.indexOf('exports.reportes =', idx) : code.length;
console.log(code.substring(idx, end));
