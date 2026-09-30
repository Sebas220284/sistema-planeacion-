const fs = require('fs');
let code = fs.readFileSync('src/interfaces/http/controllers/reportesCIPController.js', 'utf8');

const regex = /WHERE user_id = \$\{params\.length\}/g;
code = code.replace(regex, () => 'WHERE user_id = $${params.length}');

fs.writeFileSync('src/interfaces/http/controllers/reportesCIPController.js', code, 'utf8');
console.log("Properly fixed missing $ prefix!");
