const PostgresUserRepository = require("../../../infrastructure/repositories/PostgresUserRepository")
const LoginUser = require("../../../application/use-cases/LoginUser")
const GetCurrentUser = require("../../../application/use-cases/GetCurrentUser")

const userRepository = new PostgresUserRepository()


exports.login = async (req,res) => {
  
  try {
    const { email, password } = req.body
    
    const loginUser = new LoginUser(userRepository)
    
    const token = await loginUser.execute(email,password)
    
    res.json({ token })
    
  } catch(error) {
    res.status(400).json({ error: error.message })
    
  }
  
}

exports.me = async (req,res)=>{

  try{

    const getCurrentUser = new GetCurrentUser(userRepository)

    const user = await getCurrentUser.execute(req.user.id)

    res.json(user)

  }catch(error){

    res.status(400).json({error:error.message})

  }

}

