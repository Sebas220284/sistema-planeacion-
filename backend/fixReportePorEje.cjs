const fs = require('fs');
let code = fs.readFileSync('src/interfaces/http/controllers/reportesCIPController.js', 'utf8');

const regex = /detalle\.rows = detalle\.rows\.map.*?proyectos:\s*detalle\.rows\s*\}\)/s;
const replacement = `
    r.rows = r.rows.map(row => {
      if (row.eje) row.eje = formatEjeName(row.eje);
      return row;
    });

    res.json({
      reporte: "Resumen de CIPs por Eje PMD",
      generado: new Date().toISOString(),
      filtros: { estado: estado || "todos", anio: anio || "todos" },
      totales: totales.rows[0],
      ejes: r.rows
    })
`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/interfaces/http/controllers/reportesCIPController.js', code, 'utf8');
console.log("Fixed reportePorEje variables");
