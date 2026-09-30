const fs = require('fs');
let code = fs.readFileSync('src/interfaces/http/controllers/reportesCIPController.js', 'utf8');

const idx = code.indexOf('exports.dashboard =');
const end = code.indexOf('exports.reportes =', idx);
console.log(code.substring(idx, end));
