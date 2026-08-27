const express = require("express")
const router = express.Router()

const AuthController = require("../controllers/AuthController")
const authMiddleware = require("../middlewares/authMiddleware")
const rateLimit = require("express-rate-limit")

// 2. Escudo Anti-Fuerza Bruta para el Login
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // t
  max: 5,
  message: { error: "Demasiados intentos. Por favor intentar mas tarde" },
  standardHeaders: true,
  legacyHeaders: false,
})

router.post("/login", loginLimiter, AuthController.login)

router.get("/me", authMiddleware, AuthController.me)

module.exports = router

