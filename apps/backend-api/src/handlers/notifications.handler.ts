/**
 * Notifications Lambda Handler
 * Triggered by EventBridge cron rule — sends daily practice reminders
 * via Firebase Cloud Messaging (FCM) HTTP v1 API.
 */
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { sign } from 'jsonwebtoken';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssm = new SSMClient({});

const TABLE           = process.env['USERS_TABLE']!;
const FCM_PROJECT_ID  = process.env['FCM_PROJECT_ID']!;
const SSM_PARAM_NAME  = process.env['FIREBASE_SA_KEY_PARAM']!;

interface DeviceToken {
  token: string;
  platform: 'ios' | 'android';
  createdAt: string;
}

interface UserRecord {
  userId: string;
  displayName?: string;
  preferences?: {
    notificationsEnabled?: boolean;
  };
  deviceTokens?: DeviceToken[];
}

// ── FCM Auth ─────────────────────────────────────────────────────────────────

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 60_000) {
    return cachedAccessToken.token;
  }

  // Fetch service account key from SSM Parameter Store
  const param = await ssm.send(new GetParameterCommand({
    Name: SSM_PARAM_NAME,
    WithDecryption: true,
  }));

  const serviceAccount = JSON.parse(param.Parameter!.Value!);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  // Create a JWT and exchange it for an access token
  const jwt = sign(
    {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp,
    },
    serviceAccount.private_key,
    { algorithm: 'RS256' },
  );

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OAuth token exchange failed: ${resp.status} ${text}`);
  }

  const data = await resp.json() as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

// ── FCM Send ─────────────────────────────────────────────────────────────────

async function sendPush(
  accessToken: string,
  deviceToken: string,
  title: string,
  body: string,
  badge?: number,
): Promise<boolean> {
  const url = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title, body },
        android: {
          priority: 'high',
          notification: { sound: 'default', channel_id: 'daily_reminder' },
        },
        apns: {
          payload: { aps: (badge !== undefined ? { sound: 'default', badge } : { sound: 'default' }) },
        },
      },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error(`[FCM] Failed to send to ${deviceToken.slice(0, 12)}…: ${resp.status} ${text}`);
    return false;
  }

  return true;
}

// ── Reminder messages ────────────────────────────────────────────────────────

const REMINDER_MESSAGES = [
  { title: 'Time for Riyaz!', body: 'A few minutes of practice keeps your voice in shape. Start your session now.' },
  { title: 'Your voice is waiting', body: 'Keep your streak alive with a quick practice session today.' },
  { title: 'Daily Riyaz reminder', body: 'Consistency is key. Open Swara AI and practice your scales.' },
  { title: 'Namaste, musician!', body: 'Your tanpura is ready. Start your daily Riyaz now.' },
  { title: 'Keep the streak going!', body: "Don't break your practice streak. A short session is all it takes." },
];

function getRandomMessage(): { title: string; body: string } {
  return REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];
}

// ── Handler ──────────────────────────────────────────────────────────────────

interface NotificationEvent {
  /** Custom notification title (optional — picks a random reminder if omitted) */
  title?: string;
  /** Custom notification body (optional) */
  body?: string;
}

export const handler = async (event?: NotificationEvent & { clearBadge?: boolean }): Promise<void> => {
  const customTitle = event?.title;
  const customBody  = event?.body;
  const isManual    = !!(customTitle && customBody) || !!event?.clearBadge;
  const clearBadgeOnly = !!event?.clearBadge;

  console.log(`[Notifications] ${isManual ? 'Manual' : 'Daily reminder'} job started`);

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    console.error('[Notifications] Failed to get FCM access token', err);
    return;
  }

  // Scan all users with notificationsEnabled and at least one device token.
  // For a small user base this is fine. At scale, use a GSI or separate tokens table.
  let sent = 0;
  let failed = 0;
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const scan = await ddb.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'preferences.notificationsEnabled = :enabled AND size(deviceTokens) > :zero',
      ExpressionAttributeValues: {
        ':enabled': { BOOL: true },
        ':zero':    { N: '0' },
      },
      ExclusiveStartKey: lastEvaluatedKey as Record<string, import('@aws-sdk/client-dynamodb').AttributeValue> | undefined,
    }));

    const users = (scan.Items ?? []).map(item => unmarshall(item) as UserRecord);

    for (const user of users) {
      if (!user.deviceTokens?.length) continue;

      const msg = isManual
        ? { title: customTitle, body: customBody }
        : getRandomMessage();

      // Only send to the most recent token per platform — prevents duplicate
      // notifications when a user has multiple stale tokens stored (e.g. after
      // reinstalling or after an FCM token refresh).
      const latestByPlatform = new Map<string, DeviceToken>();
      for (const dt of user.deviceTokens) {
        const existing = latestByPlatform.get(dt.platform);
        if (!existing || dt.createdAt > existing.createdAt) {
          latestByPlatform.set(dt.platform, dt);
        }
      }

      for (const dt of latestByPlatform.values()) {
        // When clearBadgeOnly is true, send an APNs payload with badge:0 to
        // force the OS to clear the app icon badge on devices that currently
        // show a stale number. We keep the Android payload minimal.
        const success = await sendPush(accessToken, dt.token, msg.title ?? '', msg.body ?? '', clearBadgeOnly ? 0 : undefined);
        if (success) sent++;
        else failed++;
      }
    }

    lastEvaluatedKey = scan.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  console.log(`[Notifications] Done. Sent: ${sent}, Failed: ${failed}`);
};
