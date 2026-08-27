module.exports = (requiredRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "No autorizado" });
        }

        const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

        if (!roles.includes(req.user.rol)) {
            return res.status(403).json({ error: "Acceso denegado: Rol insuficiente" });
        }

        next();
    };
};
