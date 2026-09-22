const jwt = require('jsonwebtoken');

// Yeh middleware har protected route se pehle chalega
const verifyToken = (req, res, next) => {

    // 1. Request ke headers mein se Authorization header nikalo
    // Format hota hai: "Bearer eyJhbGciOiJIUzI1NiJ9..."
    const authHeader = req.headers['authorization'];

    // 2. Check karo ki token hai ya nahi
    if (!authHeader) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // 3. "Bearer " hata ke sirf token nikalo
    // authHeader = "Bearer abc123" → token = "abc123"
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. Token missing.' });
    }

    // 4. Token ko verify karo using the same secret key
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 5. Decoded user data ko req.user mein daal do
        // Ab aage wala controller req.user.id se user ka id le sakta hai
        req.user = decoded;

        // 6. next() → matlab "theek hai, aage badho"
        next();

    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
};

module.exports = verifyToken;
