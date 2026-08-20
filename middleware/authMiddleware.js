const { verifyToken } = require('../utils/jwt');

function authenticate(req, res, next) {
    const cookieToken = req.cookies?.accessToken;
    const authHeader   = req.headers['authorization'];
    const headerToken  = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const token = cookieToken || headerToken;

    if (!token) {
        return res.status(401).json({ error: 'Authentication token not provided' });
    }

    try {
        const payload = verifyToken(token);
        req.user = payload;
        next();
    } catch (err) {
        const expired = err.name === 'TokenExpiredError';
        return res.status(401).json({
            error: expired ? 'Token expired' : 'Invalid token',
        });
    }
}

module.exports = { authenticate };
