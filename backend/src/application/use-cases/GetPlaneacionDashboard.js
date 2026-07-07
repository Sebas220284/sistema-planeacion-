class GetPlaneacionDashboard{

constructor(repository){
this.repository = repository
}

async execute(){

const rows = await this.repository.getPlaneacionDashboard()

const dependencias = {}

rows.forEach(r=>{

if(!dependencias[r.dependencia_id]){

dependencias[r.dependencia_id]={
id:r.dependencia_id,
name:r.dependencia,
titular:r.titular,
enlace:r.enlace,
estrategias:{}
}

}

const dep = dependencias[r.dependencia_id]

if(!dep.estrategias[r.estrategia_id]){

dep.estrategias[r.estrategia_id]={
id:r.estrategia_id,
name:r.estrategia,
lineas:[]
}

}

if(r.linea_id){
  const estrategia = dep.estrategias[r.estrategia_id]
  
  const yaExiste = estrategia.lineas.find(l => l.id === r.linea_id)
  
  if(!yaExiste){
    estrategia.lineas.push({
      id: r.linea_id,
      pmd_eje: r.pmd_eje,
      pmd_tema: r.pmd_tema,
      pmd_politica_publica: r.pmd_politica_publica,
      pmd_objetivo: r.pmd_objetivo,
      pmd_estrategia: r.pmd_estrategia,
      linea_base: r.linea_base,
      total: r.total,
      ejercicio: r.ejercicio,
      columna1: r.columna1,
      lineas_accion: r.lineas_accion,
      nomenclatura: r.nomenclatura,
      nombre2: r.nombre2,
      responsable: r.responsable,
      plazo: r.plazo,
      estado: r.estado,
      comentario: r.comentario,
      comentario_revision: r.comentario_revision,
      comentario_planeacion: r.comentario_planeacion
    })
  }
}

})

return Object.values(dependencias)

}

}

module.exports = GetPlaneacionDashboard
