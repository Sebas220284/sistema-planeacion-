const pool = require('../../database/postgres')

class PostgresUserRepository {

async create(user) {

const query = `
INSERT INTO public.users (name, email, password_hash, role_id)
VALUES ($1, $2, $3, $4)
RETURNING *
`

const values = [
user.name,
user.email,
user.password_hash,
user.role_id
]

const result = await pool.query(query, values)

return result.rows[0]

}

async findByEmail(email) {

const result = await pool.query(
'SELECT * FROM public.users WHERE email = $1',
[email]
)

return result.rows[0]

}

async findById(id) {

const result = await pool.query(
`
SELECT 
u.id,
u.name,
u.email,
r.name as role,

d.id as dependency_id,
d.name as dependencia,
d.titular,
d.enlace

FROM users u

LEFT JOIN roles r
ON u.role_id = r.id

LEFT JOIN dependencies d
ON u.dependency_id = d.id

WHERE u.id = $1
`,
[id]
)

return result.rows[0]

}


async findUserWithStrategies(userId){

  const result = await pool.query(
    `
    SELECT 
    u.id,
    u.name,
    u.email,
    r.name as role,

    d.id as dependency_id,
    d.name as dependencia,
    d.titular,
    d.enlace,

    s.id as strategy_id,
    s.name as strategy_name,
    s.description,

    p.id as linea_id,       
    p.pmd_eje,
    p.pmd_tema,
    p.pmd_politica_publica,
    p.pmd_objetivo,
    p.pmd_estrategia,
    p.linea_base,
    p.total,
    p.ejercicio,
    p.columna1,
    p.lineas_accion,
    p.nomenclatura,
    p.unidad_medida,
    p.responsable,
    p.plazo

    FROM users u

    LEFT JOIN roles r
    ON u.role_id = r.id

    LEFT JOIN dependencies d
    ON u.dependency_id = d.id

    LEFT JOIN strategies s
    ON d.id = s.dependency_id

    LEFT JOIN planning_templates p
    ON p.strategy_id = s.id

    WHERE u.id = $1
    `,
    [userId]
  )

  return result.rows
}

}

module.exports = PostgresUserRepository