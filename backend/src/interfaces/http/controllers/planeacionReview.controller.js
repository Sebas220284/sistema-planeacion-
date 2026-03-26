const PostgresPlanningRepository = require("../../../infrastructure/repositories/PostgresPlanningRepository")

const ReviewTrimestre = require("../../../application/use-cases/ReviewTrimestre")

const repository = new PostgresPlanningRepository()

exports.review = async(req,res)=>{

try{

const useCase = new ReviewTrimestre(repository)

const data = await useCase.execute({

id:req.params.id,
...req.body
})

req.app.get("io").emit("revision_trimestre",data)

res.json(data)

}catch(error){

console.error(error)

res.status(500).json({
error:"Error revisando trimestre"
})

}

}