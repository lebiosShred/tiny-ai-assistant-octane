const { Queue, Worker, QueueEvents } = require('bullmq');
const redisModule = require('./redis');
const searchService = require('./searchService');

let searchQueue = null;
let searchWorker = null;
let searchQueueEvents = null;

function initQueue() {
    if (redisModule.isRedisActive() && !searchQueue) {
        const connection = redisModule.getRedisClient();
        searchQueue = new Queue('search-tasks', { connection });
        searchQueueEvents = new QueueEvents('search-tasks', { connection });
        
        searchWorker = new Worker('search-tasks', async (job) => {
            const { type, payload } = job.data;
            console.log(`👷 Worker processing search job ${job.id} of type ${type}`);
            
            let result = '';
            switch (type) {
                case 'tavily-rag':
                    result = await searchService.fetchTavilyRAGContext(payload.name, payload.company);
                    break;
                case 'tavily-news':
                    result = await searchService.fetchTavilyCompanyNews(payload.company, payload.website);
                    break;
                case 'github-tech':
                    result = await searchService.fetchGithubTechnographics(payload.company);
                    break;
                case 'exa-rag':
                    result = await searchService.fetchExaRAGContext(payload.name, payload.company);
                    break;
                case 'web-search':
                    result = await searchService.searchWeb(payload.query);
                    break;
                default:
                    throw new Error(`Unknown search job type: ${type}`);
            }
            return result;
        }, { 
            connection,
            limiter: {
                max: 5, // Process max 5 search tasks concurrently
                duration: 1000
            }
        });

        searchWorker.on('failed', (job, err) => {
            console.error(`❌ Job ${job.id} failed: ${err.message}`);
        });

        searchWorker.on('completed', (job, result) => {
            console.log(`✅ Job ${job.id} completed successfully.`);
        });
    }
}

// Dynamically check and initialize queue on demand
function getQueueInstances() {
    if (redisModule.isRedisActive()) {
        initQueue();
    }
    return {
        queue: searchQueue,
        events: searchQueueEvents
    };
}

// Local in-memory store for tracking simulated async jobs when Redis is down
const simulatedJobs = new Map();

async function addSearchJob(type, payload) {
    const { queue } = getQueueInstances();
    if (queue) {
        const job = await queue.add(type, { type, payload }, {
            timeout: 30000,
            removeOnComplete: true,
            removeOnFail: true
        });
        return { status: 'queued', jobId: job.id };
    }
    
    // Fallback if Redis is down: simulate async queue in-memory using setTimeout
    console.warn(`⚠️ Redis is down. Simulating asynchronous search type ${type} in-memory.`);
    const jobId = `sim_${type}_${Date.now()}_${Math.random().toString(16).substring(2, 6)}`;
    
    simulatedJobs.set(jobId, { status: 'active', result: null, error: null });
    
    setTimeout(async () => {
        try {
            const result = await executeSearchDirectly(type, payload);
            simulatedJobs.set(jobId, { status: 'completed', result, error: null });
        } catch (err) {
            simulatedJobs.set(jobId, { status: 'failed', result: null, error: err.message });
        }
    }, 100);
    
    return { status: 'queued', jobId };
}

async function executeSearchDirectly(type, payload) {
    switch (type) {
        case 'tavily-rag':
            return await searchService.fetchTavilyRAGContext(payload.name, payload.company);
        case 'tavily-news':
            return await searchService.fetchTavilyCompanyNews(payload.company, payload.website);
        case 'github-tech':
            return await searchService.fetchGithubTechnographics(payload.company);
        case 'exa-rag':
            return await searchService.fetchExaRAGContext(payload.name, payload.company);
        case 'web-search':
            return await searchService.searchWeb(payload.query);
        default:
            throw new Error(`Unknown search type: ${type}`);
    }
}

async function getJobStatus(jobId) {
    const { queue } = getQueueInstances();
    if (queue) {
        const job = await queue.getJob(jobId);
        if (!job) {
            return { status: 'not_found' };
        }
        const state = await job.getState();
        if (state === 'completed') {
            return { status: 'completed', result: job.returnvalue };
        }
        if (state === 'failed') {
            return { status: 'failed', error: job.failedReason };
        }
        return { status: state };
    }
    
    // Fallback in-memory status
    if (simulatedJobs.has(jobId)) {
        return simulatedJobs.get(jobId);
    }
    return { status: 'not_found' };
}

// Clean termination helper
async function closeQueue() {
    if (searchWorker) {
        await searchWorker.close();
        console.log('🔌 Worker closed.');
    }
    if (searchQueue) {
        await searchQueue.close();
        console.log('🔌 Queue closed.');
    }
    if (searchQueueEvents) {
        await searchQueueEvents.close();
        console.log('🔌 QueueEvents closed.');
    }
}

module.exports = {
    addSearchJob,
    getJobStatus,
    executeSearchDirectly,
    getQueueInstances,
    closeQueue
};
