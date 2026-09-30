const fs = require('fs');
let code = fs.readFileSync('src/interfaces/http/controllers/reportesCIPController.js', 'utf8');

code = code.replace(/res\.json\(\{\s*reporte:\s*"Resumen de CIPs por Eje PMD".*?\}\)/s, `
    detalle.rows = detalle.rows.map(row => {
      if (row.eje) row.eje = formatEjeName(row.eje);
      return row;
    });
    ejes.rows = ejes.rows.map(row => {
      if (row.eje) row.eje = formatEjeName(row.eje);
      return row;
    });

    res.json({
      reporte: "Resumen de CIPs por Eje PMD",
      generado: new Date().toISOString(),
      filtros: { estado: estado || "todos", anio: anio || "todos" },
      totales: totales.rows[0],
      ejes: ejes.rows,
      proyectos: detalle.rows
    })
`);

fs.writeFileSync('src/interfaces/http/controllers/reportesCIPController.js', code, 'utf8');
console.log("Updated reportePorEje to format ejes");
