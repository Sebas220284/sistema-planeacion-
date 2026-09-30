const fs = require('fs');
const code = fs.readFileSync('src/interfaces/http/controllers/reportesCIPController.js', 'utf8');

const lines = code.split('\n');
let start = -1;
let end = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('exports.reportePorEje =')) start = i;
    if (start !== -1 && i > start && lines[i].includes('exports.')) {
        end = i;
        break;
    }
}
if (end === -1) end = lines.length;

console.log(lines.slice(start, end).join('\n'));
