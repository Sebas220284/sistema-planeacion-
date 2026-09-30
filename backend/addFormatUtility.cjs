const fs = require('fs');
let code = fs.readFileSync('src/interfaces/http/controllers/reportesCIPController.js', 'utf8');

const utilityCode = `
const formatEjeName = (str) => {
    if (!str) return str;
    const lowers = ['y', 'e', 'a', 'ante', 'bajo', 'cabe', 'con', 'contra', 'de', 'desde', 'en', 'entre', 'hacia', 'hasta', 'para', 'por', 'según', 'sin', 'so', 'sobre', 'tras', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'al', 'del'];
    return str.toLowerCase().split(' ').map((word, index) => {
        if (index > 0 && lowers.includes(word)) {
            return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
};
`;

if (!code.includes('formatEjeName')) {
    code = code.replace(/const pool = require\(.*?postgres.*?\)/, "const pool = require(\"../../../database/postgres\")\n" + utilityCode);
    fs.writeFileSync('src/interfaces/http/controllers/reportesCIPController.js', code, 'utf8');
    console.log("Added formatEjeName utility.");
} else {
    console.log("formatEjeName already exists.");
}
