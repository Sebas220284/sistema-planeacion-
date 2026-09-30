const fs = require('fs');
const code = fs.readFileSync('src/interfaces/http/controllers/reportesCIPController.js', 'utf8');

const idx = code.indexOf('const resumenQuery = `');
const end = code.indexOf('`;', idx);
console.log(code.substring(idx, end));
