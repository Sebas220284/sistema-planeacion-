const PostgresPlanningRepository = require("../../../infrastructure/repositories/PostgresPlanningRepository")
const GetPlaneacionDashboard = require("../../../application/use-cases/GetPlaneacionDashboard")

const repository = new PostgresPlanningRepository()

exports.dashboard = async (req, res) => {

try{

const useCase = new GetPlaneacionDashboard(repository)

const data = await useCase.execute()

res.json(data)

}catch(error){

console.error(error)

res.status(500).json({
error:"Error obteniendo dashboard de planeación"
})

}

}