const fs = require('fs');
let code = fs.readFileSync('src/interfaces/http/controllers/reportesCIPController.js', 'utf8');

code = code.replace(/WHERE c\.estado != 'rechazado'/g, "WHERE 1=1");
code = code.replace(/c\.estado != 'rechazado'/g, "1=1");

fs.writeFileSync('src/interfaces/http/controllers/reportesCIPController.js', code, 'utf8');
console.log("Replaced rechazado filters with 1=1");
