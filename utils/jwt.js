const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be defined in .env');
}

function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

module.exports = { verifyToken };
