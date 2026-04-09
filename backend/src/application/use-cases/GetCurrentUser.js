class GetCurrentUser {

constructor(userRepository){
this.userRepository = userRepository
}

async execute(id){

const rows = await this.userRepository.findUserWithStrategies(id)

if(!rows.length){
throw new Error("Usuario no encontrado")
}

const user = {
  id: rows[0].id,
  name: rows[0].name,
  email: rows[0].email,
  rol: rows[0].role,
  dependency_id: rows[0].dependency_id, 
  dependencia: rows[0].dependencia,
  titular: rows[0].titular,
  enlace: rows[0].enlace,
  estrategias: []
}

rows.forEach(r => {
  if(r.strategy_id){
    user.estrategias.push({
      id: r.strategy_id,
      linea_id: r.linea_id, 
      name: r.strategy_name,
      description: r.description,
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
      plazo: r.plazo
    })
  }
})

return user

}

}

module.exports = GetCurrentUser