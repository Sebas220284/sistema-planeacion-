const fs = require('fs');
let code = fs.readFileSync('src/interfaces/http/controllers/reportesCIPController.js', 'utf8');

const regex = /WHERE user_id = \$\{params\.length\}/g;
if (code.match(regex)) {
    code = code.replace(regex, 'WHERE user_id = $${params.length}');
    fs.writeFileSync('src/interfaces/http/controllers/reportesCIPController.js', code, 'utf8');
    console.log("Fixed missing $ prefix using regex!");
} else {
    console.log("Not found with regex either.");
}
