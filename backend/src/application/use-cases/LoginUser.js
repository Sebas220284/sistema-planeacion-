
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")

class LoginUser {

  constructor(userRepository) {
    this.userRepository = userRepository
  }

  async execute(email, password) {

    const user = await this.userRepository.findByEmail(email)

    if(!user){
      throw new Error("Usuario no encontrado en la base de datos")
    }

    const validPassword = await bcrypt.compare(password, user.password_hash)

    if(!validPassword){
      throw new Error("Contraseña incorrecta")
    }

    const token = jwt.sign(
{
id: user.id,
email: user.email
},
process.env.JWT_SECRET || "secret",
{
expiresIn:"8h"
}
)
    return token
  }
}

module.exports = LoginUser