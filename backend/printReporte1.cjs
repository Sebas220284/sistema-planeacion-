const fs = require('fs');
let code = fs.readFileSync('src/interfaces/http/controllers/reportesCIPController.js', 'utf8');

const idx = code.indexOf('exports.reporte1 =');
const end = code.indexOf('exports.getAnios =', idx);
console.log(code.substring(idx, end));
