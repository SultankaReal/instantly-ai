import { Redis } from 'ioredis'

export const redis = new Redis(process.env['REDIS_URL']!, { maxRetriesPerRequest: null })
export const redisConnection = new Redis(process.env['REDIS_URL']!, { maxRetriesPerRequest: null })
