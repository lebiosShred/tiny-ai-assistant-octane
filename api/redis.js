const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let redisClient = null;
let isRedisReady = false;

// Fallback in-memory cache in case Redis is down
const memoryCache = new Map();

try {
    // Set a max connect timeout of 2 seconds so startup does not hang
    redisClient = new Redis(REDIS_URL, {
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
            // Stop retrying to connect after 3 attempts, fallback to in-memory
            if (times > 3) {
                console.warn('⚠️ Redis connection attempts exhausted. Falling back to in-memory cache.');
                return null; // stop retrying
            }
            return Math.min(times * 100, 1000);
        }
    });

    redisClient.on('connect', () => {
        console.log('✅ Connected to Redis successfully.');
        isRedisReady = true;
    });

    redisClient.on('error', (err) => {
        console.warn(`⚠️ Redis connection error: ${err.message}. Using fallback in-memory cache.`);
        isRedisReady = false;
    });

    redisClient.on('end', () => {
        console.warn('⚠️ Redis connection closed. Using fallback in-memory cache.');
        isRedisReady = false;
    });
} catch (e) {
    console.warn(`⚠️ Failed to initialize Redis client: ${e.message}. Using fallback in-memory cache.`);
}

async function getCache(key) {
    if (isRedisReady && redisClient) {
        try {
            const val = await redisClient.get(key);
            if (val !== null) {
                return JSON.parse(val);
            }
        } catch (e) {
            console.warn(`Redis getCache failed for key ${key}:`, e.message);
        }
    }
    
    // In-memory fallback
    const memVal = memoryCache.get(key);
    if (memVal) {
        if (Date.now() < memVal.expiry) {
            return memVal.value;
        }
        memoryCache.delete(key); // Expired
    }
    return null;
}

async function setCache(key, value, ttlSeconds = 86400) {
    if (isRedisReady && redisClient) {
        try {
            await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
            return;
        } catch (e) {
            console.warn(`Redis setCache failed for key ${key}:`, e.message);
        }
    }
    
    // In-memory fallback
    memoryCache.set(key, {
        value,
        expiry: Date.now() + (ttlSeconds * 1000)
    });
}

// Helper to shut down Redis client cleanly on exit (lifecycle control)
async function closeRedis() {
    if (redisClient) {
        try {
            await redisClient.quit();
            console.log('🔌 Redis client disconnected cleanly.');
        } catch (e) {}
    }
}

module.exports = {
    getCache,
    setCache,
    closeRedis,
    isRedisActive: () => isRedisReady,
    getRedisClient: () => redisClient
};
