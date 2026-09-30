const fs = require('fs');
let code = fs.readFileSync('src/interfaces/http/controllers/reportesCIPController.js', 'utf8');

const search = 'WHERE user_id = ${params.length}';
const replacement = 'WHERE user_id = $${params.length}';

if (code.includes(search)) {
    code = code.replace(search, replacement);
    fs.writeFileSync('src/interfaces/http/controllers/reportesCIPController.js', code, 'utf8');
    console.log("Fixed missing $ prefix in reporte2!");
} else {
    console.log("Could not find the typo.");
}
