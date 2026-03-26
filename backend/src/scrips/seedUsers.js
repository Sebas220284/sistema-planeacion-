require("dotenv").config({ path: "../.env" })

const bcrypt = require("bcrypt")
const pool = require("../database/postgres")

async function seedUsers(){

try{

const password = "123456"
const passwordHash = await bcrypt.hash(password,10)

await pool.query(`
INSERT INTO users (name,email,password_hash,role_id)
VALUES ($1,$2,$3,$4)
ON CONFLICT (email) DO NOTHING
`,[
"Administrador",
"admin@sistema.com",
passwordHash,
"6474d40f-489c-4b9c-b861-25c5f56caee1"
])

await pool.query(`
INSERT INTO users (name,email,password_hash,role_id)
VALUES ($1,$2,$3,$4)
ON CONFLICT (email) DO NOTHING
`,[
"Planeacion",
"planeacion@sistema.com",
passwordHash,
"e24d93ca-f219-4f65-872d-bfd5209383f3"
])

console.log("Usuarios creados correctamente")

process.exit()

}catch(error){

console.error("Error creando usuarios:",error)

process.exit(1)

}

}

seedUsers()