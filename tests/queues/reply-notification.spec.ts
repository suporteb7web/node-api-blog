import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';
import { processReplyNotification } from '../../src/queues/reply-notifications/processor.js';
import type { ReplyNotificationJobData } from '../../src/repositories/reply-notification-jobs.repository.js';
import { cleanMailpit, getMailpitMessage, listMailpitMessages } from '../helpers/mailpit.js';

function job(data: ReplyNotificationJobData): Job<ReplyNotificationJobData> {
  return { data } as Job<ReplyNotificationJobData>;
}

describe('processReplyNotification', () => {
  beforeEach(async () => {
    await cleanMailpit();
  });

  it('emails the post author with reply details', async () => {
    await processReplyNotification(
      job({
        to: 'alice@example.com',
        postId: 42,
        postTitle: 'Post to reply',
        replyAuthorName: 'Bob',
        replyContent: 'Nice post',
      }),
    );

    const messages = await listMailpitMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].To).toEqual([expect.objectContaining({ Address: 'alice@example.com' })]);
    expect(messages[0].Subject).toContain('Post to reply');

    const message = await getMailpitMessage(messages[0].ID);
    expect(message.Text).toContain('Bob');
    expect(message.Text).toContain('Nice post');
    expect(message.Text).toContain('#42');
    expect(message.Text).toContain('Post to reply');
    expect(message.Text).not.toContain('secret1');
    expect(message.Text).not.toContain('session-token');
  });

  it('emails an excerpt when the reply content is long', async () => {
    const content = `${'A'.repeat(200)}UNIQUE_TAIL`;

    await processReplyNotification(
      job({
        to: 'alice@example.com',
        postId: 1,
        postTitle: 'Long reply post',
        replyAuthorName: 'Bob',
        replyContent: content,
      }),
    );

    const messages = await listMailpitMessages();
    expect(messages).toHaveLength(1);

    const message = await getMailpitMessage(messages[0].ID);
    expect(message.Text).toContain(`${'A'.repeat(200)}...`);
    expect(message.Text).not.toContain('UNIQUE_TAIL');
  });
});
