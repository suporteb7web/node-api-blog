import type { Job } from 'bullmq';
import type { Mailer } from '../../mailer/mailer.js';
import { NodemailerMailer } from '../../mailer/nodemailer-mailer.js';
import type { ReplyNotificationJobData } from '../../repositories/reply-notification-jobs.repository.js';

const EXCERPT_MAX_LENGTH = 200;
const mailer: Mailer = new NodemailerMailer();

export async function processReplyNotification(
  job: Job<ReplyNotificationJobData>,
): Promise<void> {
  const { to, postId, postTitle, replyAuthorName, replyContent } = job.data;

  await mailer.send({
    to,
    subject: `New reply on "${postTitle}"`,
    text: [
      `${replyAuthorName} replied to your post "${postTitle}" (#${postId}):`,
      '',
      excerpt(replyContent),
    ].join('\n'),
  });
}

function excerpt(content: string): string {
  if (content.length <= EXCERPT_MAX_LENGTH) {
    return content;
  }

  return `${content.slice(0, EXCERPT_MAX_LENGTH)}...`;
}
