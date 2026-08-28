import { type ExpoMessage, sendExpoPush } from './push.ts';
import { activeRecipientsForState, type PushRecipient } from './push-recipients.ts';

const POST_WINDOW_DAYS = 3;
const NEWS_CAP_HOURS = 24;

type Queued = { recipient: PushRecipient; message: ExpoMessage; log: Record<string, unknown> };
export type HealthNewsDispatchMetrics = {
  postsConsidered: number;
  eligibleRecipients: number;
  deduplicatedRecipients: number;
  cappedRecipients: number;
  queued: number;
  accepted: number;
  failed: number;
};

const emptyMetrics = (): HealthNewsDispatchMetrics => ({
  postsConsidered: 0,
  eligibleRecipients: 0,
  deduplicatedRecipients: 0,
  cappedRecipients: 0,
  queued: 0,
  accepted: 0,
  failed: 0,
});

async function beginAudit(admin: any, job: string): Promise<string | null> {
  const { data } = await admin.from('notification_dispatch_runs').insert({ job, status: 'running' }).select('id').maybeSingle();
  return data?.id ? String(data.id) : null;
}

async function finishAudit(admin: any, id: string | null, status: 'completed' | 'failed', metrics: HealthNewsDispatchMetrics): Promise<void> {
  if (!id) return;
  await admin.from('notification_dispatch_runs').update({
    status,
    completed_at: new Date().toISOString(),
    posts_considered: metrics.postsConsidered,
    eligible_recipients: metrics.eligibleRecipients,
    deduplicated_recipients: metrics.deduplicatedRecipients,
    capped_recipients: metrics.cappedRecipients,
    queued: metrics.queued,
    accepted: metrics.accepted,
    failed: metrics.failed,
  }).eq('id', id);
}

/** Deliver the newest eligible official post per user, while sending it to all of that user's active devices. */
export async function dispatchHealthNews(
  admin: any,
  options: { postIds?: string[]; auditJob?: string } = {},
): Promise<HealthNewsDispatchMetrics> {
  const metrics = emptyMetrics();
  const auditId = await beginAudit(admin, options.auditJob ?? 'health_news_fallback');
  const queued: Queued[] = [];
  const usersSelectedThisRun = new Set<string>();

  try {
    const since = new Date(Date.now() - POST_WINDOW_DAYS * 86_400_000).toISOString();
    let query = admin.from('health_posts').select('id, title, source, state')
      .eq('status', 'published').eq('category', 'official_update')
      .gte('published_at', since).order('published_at', { ascending: false });
    if (options.postIds?.length) query = query.in('id', options.postIds);
    const { data: posts, error: postsError } = await query;
    if (postsError) throw postsError;
    metrics.postsConsidered = posts?.length ?? 0;

    const cutoff = new Date(Date.now() - NEWS_CAP_HOURS * 3_600_000).toISOString();
    for (const post of (posts ?? []) as Array<Record<string, unknown>>) {
      const recipients = await activeRecipientsForState(admin, post.state ? String(post.state) : null);
      metrics.eligibleRecipients += recipients.length;
      if (!recipients.length) continue;

      const byUser = new Map<string, PushRecipient[]>();
      for (const recipient of recipients) byUser.set(recipient.userId, [...(byUser.get(recipient.userId) ?? []), recipient]);
      const userIds = [...byUser.keys()];
      const postId = String(post.id);

      const [{ data: alreadyRows, error: alreadyError }, { data: cappedRows, error: cappedError }] = await Promise.all([
        admin.from('notification_log').select('user_id').eq('notification_type', 'health_post').eq('ref_id', postId)
          .in('user_id', userIds).in('status', ['pending', 'accepted', 'receipt_ok']),
        admin.from('notification_log').select('user_id').eq('notification_type', 'health_post')
          .in('user_id', userIds).in('status', ['pending', 'accepted', 'receipt_ok']).gte('created_at', cutoff),
      ]);
      if (alreadyError || cappedError) throw alreadyError ?? cappedError;
      const alreadySent = new Set((alreadyRows ?? []).map((row: Record<string, unknown>) => String(row.user_id)));
      const capped = new Set((cappedRows ?? []).map((row: Record<string, unknown>) => String(row.user_id)));

      for (const [userId, devices] of byUser) {
        if (alreadySent.has(userId)) {
          metrics.deduplicatedRecipients += devices.length;
          continue;
        }
        if (capped.has(userId) || usersSelectedThisRun.has(userId)) {
          metrics.cappedRecipients += devices.length;
          continue;
        }
        usersSelectedThisRun.add(userId);
        const title = `${String(post.source ?? 'Official')} update`;
        const body = String(post.title ?? 'A new official health update is available.');
        for (const recipient of devices) {
          queued.push({
            recipient,
            message: { to: recipient.token, title, body, sound: 'default', channelId: 'health-news', data: { type: 'health_post', postId } },
            log: { user_id: recipient.userId, push_device_id: recipient.deviceId, notification_type: 'health_post', ref_id: postId, title, body, scheduled_for: new Date().toISOString() },
          });
        }
      }
    }

    metrics.queued = queued.length;
    if (queued.length) {
      const tickets = await sendExpoPush(queued.map((item) => item.message));
      metrics.accepted = tickets.filter((ticket) => ticket.status === 'accepted').length;
      metrics.failed = tickets.length - metrics.accepted;
      const now = new Date().toISOString();
      const rows = tickets.map((ticket, index) => ({
        ...queued[index].log,
        status: ticket.status,
        expo_ticket_id: ticket.ticketId ?? null,
        error_message: ticket.error ?? null,
        sent_at: ticket.status === 'accepted' ? now : null,
      }));
      const { error: insertError } = await admin.from('notification_log').insert(rows);
      if (insertError) throw insertError;
    }
    await finishAudit(admin, auditId, 'completed', metrics);
    return metrics;
  } catch (error) {
    metrics.failed = Math.max(metrics.failed, metrics.queued - metrics.accepted);
    await finishAudit(admin, auditId, 'failed', metrics);
    throw error;
  }
}
