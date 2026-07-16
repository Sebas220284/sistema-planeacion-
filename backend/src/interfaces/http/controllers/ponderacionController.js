const pool = require("../../../database/postgres")


exports.calcularPonderacion = async (req, res) => {
  try {
    const { dependency_id, anio } = req.params

    const fichasRes = await pool.query(`
      SELECT id, nombre_indicador, meta_trianual, meta_anual,
             avance_anual, valor_inicial, anio
      FROM fichas_tecnicas
      WHERE dependency_id=$1 AND anio=$2
        AND meta_trianual IS NOT NULL AND meta_trianual > 0
      ORDER BY nombre_indicador
    `, [dependency_id, parseInt(anio)])

    if (fichasRes.rows.length === 0) {
      return res.json({
        fichas: [],
        total_meta_trianual: 0,
        total_avance_ponderado: 0,
        mensaje: "Sin fichas con meta trianual para este año"
      })
    }

    const totalTrianual = fichasRes.rows.reduce(
      (sum, f) => sum + Number(f.meta_trianual || 0), 0
    )

    if (totalTrianual === 0) {
      return res.status(400).json({ error: "La suma de metas trianual es 0" })
    }

    const fichasCalculadas = fichasRes.rows.map(f => {
      const metaTrianual = Number(f.meta_trianual || 0)
      const metaAnual    = Number(f.meta_anual    || 0)
      const avanceAnual  = Number(f.avance_anual  || 0)

      const ponderacion = (metaTrianual / totalTrianual) * 100

      const porcentaje_cumplimiento = metaAnual > 0
        ? Math.min((avanceAnual / metaAnual) * 100, 100)
        : 0

      const avance_ponderado = (porcentaje_cumplimiento / 100) * ponderacion

      return {
        id: f.id,
        nombre_indicador:       f.nombre_indicador,
        meta_trianual:          metaTrianual,
        meta_anual:             metaAnual,
        avance_anual:           avanceAnual,
        ponderacion:            Math.round(ponderacion * 100) / 100,
        porcentaje_cumplimiento: Math.round(porcentaje_cumplimiento * 100) / 100,
        avance_ponderado:       Math.round(avance_ponderado * 100) / 100,
      }
    })

    for (const f of fichasCalculadas) {
      await pool.query(`
        UPDATE fichas_tecnicas
        SET ponderacion=$1, avance_ponderado=$2, porcentaje_cumplimiento=$3
        WHERE id=$4
      `, [f.ponderacion, f.avance_ponderado, f.porcentaje_cumplimiento, f.id])
    }

    const totalAvancePonderado = fichasCalculadas.reduce(
      (sum, f) => sum + f.avance_ponderado, 0
    )

    const sumaPonderaciones = fichasCalculadas.reduce(
      (sum, f) => sum + f.ponderacion, 0
    )

    res.json({
      dependency_id,
      anio:                  parseInt(anio),
      total_fichas:          fichasCalculadas.length,
      total_meta_trianual:   totalTrianual,
      suma_ponderaciones:    Math.round(sumaPonderaciones * 100) / 100,
      total_avance_ponderado: Math.round(totalAvancePonderado * 100) / 100,
      fichas:                fichasCalculadas,
      semaforo:              getSemaforo(totalAvancePonderado)
    })

  } catch(e) {
    console.error("Error calculando ponderación:", e)
    res.status(500).json({ error: e.message })
  }
}


exports.getResumen = async (req, res) => {
  try {
    const { dependency_id, anio } = req.params

    const r = await pool.query(`
      SELECT
        f.id, f.nombre_indicador, f.anio,
        f.meta_trianual, f.meta_anual, f.avance_anual,
        f.valor_inicial,
        f.ponderacion, f.avance_ponderado, f.porcentaje_cumplimiento,
        f.eje, f.tema, f.objetivo, f.estrategia,
        f.tipo_indicador, f.unidad_medida,
        f.calendarizacion,
        f.planning_template_id,
        d.name AS dependencia_nombre,
        -- Datos en vivo del POA si está vinculada
        COALESCE((
          SELECT SUM(tr.valor) FROM planning_trimestres tr
          WHERE tr.planning_id = f.planning_template_id
            AND tr.tipo = 'ejecutado' AND tr.anio = f.anio
        ), f.avance_anual) AS ejecutado_poa,
        COALESCE((
          SELECT SUM(tr.valor) FROM planning_trimestres tr
          WHERE tr.planning_id = f.planning_template_id
            AND tr.tipo = 'programado' AND tr.anio = f.anio
        ), f.meta_anual) AS programado_poa
      FROM fichas_tecnicas f
      LEFT JOIN dependencies d ON d.id = f.dependency_id
      WHERE f.dependency_id=$1 AND f.anio=$2
      ORDER BY f.ponderacion DESC, f.nombre_indicador
    `, [dependency_id, parseInt(anio)])

    if (r.rows.length === 0) {
      return res.json({
        fichas: [],
        totales: { total_meta_trianual: 0, avance_ponderado_global: 0 }
      })
    }

    const totalTrianual = r.rows.reduce((s, f) => s + Number(f.meta_trianual||0), 0)

    const fichasConCalculo = r.rows.map(f => {
      const metaAnual   = Number(f.meta_anual   || 0)
      const avancePOA   = Number(f.ejecutado_poa || f.avance_anual || 0)
      const ponderacion = Number(f.ponderacion   || 0)

      const pct_cumplimiento = metaAnual > 0
        ? Math.min((avancePOA / metaAnual) * 100, 100)
        : 0

      const avance_pond = (pct_cumplimiento / 100) * ponderacion

      return {
        ...f,
        avance_anual_efectivo:   avancePOA,
        porcentaje_cumplimiento: Math.round(pct_cumplimiento * 100) / 100,
        avance_ponderado:        Math.round(avance_pond * 100) / 100,
      }
    })

    const avancePonderadoGlobal = fichasConCalculo.reduce(
      (s, f) => s + f.avance_ponderado, 0
    )

    res.json({
      dependency_id,
      anio: parseInt(anio),
      fichas: fichasConCalculo,
      totales: {
        total_fichas:           fichasConCalculo.length,
        total_meta_trianual:    totalTrianual,
        suma_ponderaciones:     fichasConCalculo.reduce((s,f)=>s+Number(f.ponderacion||0),0).toFixed(2),
        avance_ponderado_global: Math.round(avancePonderadoGlobal * 100) / 100,
        semaforo:               getSemaforo(avancePonderadoGlobal)
      }
    })
  } catch(e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}

exports.getResumenGlobal = async (req, res) => {
  try {
    const anio = parseInt(req.query.anio) || new Date().getFullYear()

    const r = await pool.query(`
      SELECT
        d.id AS dependency_id,
        d.name AS dependencia_nombre,
        COUNT(f.id)::int AS total_fichas,
        COALESCE(SUM(f.meta_trianual), 0) AS total_meta_trianual,
        COALESCE(AVG(f.ponderacion), 0) AS ponderacion_promedio,
        COALESCE(SUM(f.avance_ponderado), 0) AS avance_ponderado_global,
        COALESCE(AVG(f.porcentaje_cumplimiento), 0) AS cumplimiento_promedio
      FROM dependencies d
      LEFT JOIN fichas_tecnicas f
        ON f.dependency_id = d.id AND f.anio = $1
          AND f.meta_trianual IS NOT NULL AND f.meta_trianual > 0
      GROUP BY d.id, d.name
      HAVING COUNT(f.id) > 0
      ORDER BY SUM(f.avance_ponderado) DESC NULLS LAST
    `, [anio])

    const resultado = r.rows.map(dep => ({
      ...dep,
      avance_ponderado_global:
        Math.round(Number(dep.avance_ponderado_global) * 100) / 100,
      cumplimiento_promedio:
        Math.round(Number(dep.cumplimiento_promedio) * 100) / 100,
      semaforo: getSemaforo(Number(dep.avance_ponderado_global))
    }))

    res.json({ anio, dependencias: resultado })
  } catch(e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}


const getSemaforo = (porcentaje) => {
  const p = Number(porcentaje)
  if (p >= 90) return { color:"#16a34a", bg:"#d1fae5", label:"Óptimo",     emoji:"🟢", nivel:4 }
  if (p >= 70) return { color:"#d97706", bg:"#fef3c7", label:"Bueno",      emoji:"🟡", nivel:3 }
  if (p >= 50) return { color:"#f59e0b", bg:"#fffbeb", label:"Regular",    emoji:"🟠", nivel:2 }
  return        { color:"#dc2626", bg:"#fee2e2", label:"Bajo",       emoji:"🔴", nivel:1 }
}