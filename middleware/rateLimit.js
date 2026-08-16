function createRateLimiter({ windowMs, max, message }) {
    const requests = new Map();

    return (req, res, next) => {
        const now = Date.now();
        const key = req.ip || req.socket.remoteAddress || "unknown";
        const recent = (requests.get(key) || []).filter(
            timestamp => now - timestamp < windowMs
        );

        if (recent.length >= max) {
            const retryAfter = Math.ceil((recent[0] + windowMs - now) / 1000);
            res.set("Retry-After", String(Math.max(retryAfter, 1)));
            return res.status(429).json({
                success: false,
                error: message || "Too many requests. Please try again later."
            });
        }

        recent.push(now);
        requests.set(key, recent);
        return next();
    };
}

module.exports = { createRateLimiter };
