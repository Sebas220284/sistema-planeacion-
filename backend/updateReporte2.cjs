const fs = require('fs');
let code = fs.readFileSync('src/interfaces/http/controllers/reportesCIPController.js', 'utf8');

code = code.replace(/res\.json\(\{\s*reporte:\s*"CIPs con Montos por Trimestre".*?\}\)/s, `
    detalle.rows = detalle.rows.map(row => {
      if (row.eje) row.eje = formatEjeName(row.eje);
      return row;
    });
    resumen.rows = resumen.rows.map(row => {
      if (row.eje) row.eje = formatEjeName(row.eje);
      return row;
    });

    res.json({
      reporte:    "CIPs con Montos por Trimestre",
      generado:   new Date().toISOString(),
      filtros:    { estado: estado||"todos", anio: anio||"todos", dep_id: dep_id||"todas" },
      proyectos:  detalle.rows,
      por_dependencia: resumen.rows,
      totales:    totales.rows[0]
    })
`);

fs.writeFileSync('src/interfaces/http/controllers/reportesCIPController.js', code, 'utf8');
console.log("Updated reporte2 to format ejes");
