import { Queue } from 'bullmq';
import { redisConnection } from '../connection.js';

export const REPLY_NOTIFICATIONS_QUEUE_NAME = 'reply-notifications';

export const replyNotificationsQueue = new Queue(REPLY_NOTIFICATIONS_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    removeOnComplete: true,
    removeOnFail: false,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
});
