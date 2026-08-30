const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const PUBLIC_KEY = fs.readFileSync(path.join(__dirname, '../keys/public.pem'));

function verifyToken(token) {
    return jwt.verify(token, PUBLIC_KEY, {
        algorithms: ['RS256'],
        issuer: 'ganjj-authorization',
    });
}

module.exports = { verifyToken };
