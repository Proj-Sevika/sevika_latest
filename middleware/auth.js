const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
      console.log("Headers:", req.headers);   // ADD THIS LINE

    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Access Denied" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Invalid or Expired Token" });
        }

        req.user = user;
        next();
    });
}

function authorizeRole(...roles) {
    return (req, res, next) => {

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Forbidden: Access not allowed" });
        }

        next();
    };
}



module.exports = { authenticateToken, authorizeRole };
