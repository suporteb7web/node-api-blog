import { Worker } from 'bullmq';
import { redisConnection } from '../connection.js';
import { processReplyNotification } from './processor.js';
import { REPLY_NOTIFICATIONS_QUEUE_NAME } from './queue.js';

export function startReplyNotificationWorker() {
  return new Worker(REPLY_NOTIFICATIONS_QUEUE_NAME, processReplyNotification, {
    connection: redisConnection,
  });
}
