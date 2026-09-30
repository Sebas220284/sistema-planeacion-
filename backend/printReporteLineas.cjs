const fs = require('fs');
let code = fs.readFileSync('src/interfaces/http/controllers/reportesCIPController.js', 'utf8');

const idx = code.indexOf('exports.reporteLineasAccion =');
const end = code.indexOf('exports.reporte2 =', idx);
console.log(code.substring(idx, end));
