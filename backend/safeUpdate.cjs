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

code = code.replace(/const pool = require\(.*?postgres.*?\)/, "const pool = require(\"../../../database/postgres\")\n" + utilityCode);

// For reporte2:
code = code.replace(
    /res\.json\(\{\s*reporte:\s*"CIPs con Montos por Trimestre",/,
    `
    detalle.rows = detalle.rows.map(row => {
      if (row.eje) row.eje = formatEjeName(row.eje);
      return row;
    });
    resumen.rows = resumen.rows.map(row => {
      if (row.eje) row.eje = formatEjeName(row.eje);
      return row;
    });
    res.json({
      reporte:    "CIPs con Montos por Trimestre",`
);

// For reportePorEje:
code = code.replace(
    /res\.json\(\{\s*reporte:\s*"Resumen de CIPs por Eje PMD",/,
    `
    r.rows = r.rows.map(row => {
      if (row.eje) row.eje = formatEjeName(row.eje);
      return row;
    });
    res.json({
      reporte: "Resumen de CIPs por Eje PMD",`
);

fs.writeFileSync('src/interfaces/http/controllers/reportesCIPController.js', code, 'utf8');
console.log("Safely applied formatting changes.");
