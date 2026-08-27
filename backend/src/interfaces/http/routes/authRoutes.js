const express = require("express")
const router = express.Router()

const AuthController = require("../controllers/AuthController")
const authMiddleware = require("../middlewares/authMiddleware")
const rateLimit = require("express-rate-limit")

// 2. Escudo Anti-Fuerza Bruta para el Login
const loginLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 15 minutos
  max: 10, // Maximo 10 intentos por IP
  message: { error: "Demasiados intentos de inicio de sesión. Por favor intente nuevamente en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
})

router.post("/login", loginLimiter, AuthController.login)

router.get("/me", authMiddleware, AuthController.me)

module.exports = router

