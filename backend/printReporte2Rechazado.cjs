const fs = require('fs');
const code = fs.readFileSync('src/interfaces/http/controllers/reportesCIPController.js', 'utf8');

const idx = code.indexOf('exports.reporte2 =');
console.log(code.substring(idx, idx + 2000));
