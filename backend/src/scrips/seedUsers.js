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

// Primero inserta los roles nuevos
await pool.query(`
  INSERT INTO roles (id, name, description, level)
  VALUES 
    (gen_random_uuid(), 'planeacion_estrategica', 'Acceso a Planeación Estratégica', 70),
    (gen_random_uuid(), 'inversion_publica', 'Acceso a Inversión Pública', 70)
  ON CONFLICT DO NOTHING
`)
{/*
const rolPE = await pool.query(`SELECT id FROM roles WHERE name = 'planeacion_estrategica'`)
const rolIP = await pool.query(`SELECT id FROM roles WHERE name = 'inversion_publica'`)

await pool.query(`
  INSERT INTO users (name, email, password_hash, role_id)
  VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING
`, ["Planeacion Estrategica", "estrategica@sistema.com", passwordHash, rolPE.rows[0].id])

await pool.query(`
  INSERT INTO users (name, email, password_hash, role_id)
  VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING
`, ["Inversion Publica", "inversion@sistema.com", passwordHash, rolIP.rows[0].id])*/}