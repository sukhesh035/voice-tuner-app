/**
 * Swara admin analytics.
 *  - computeOurAnalytics(): usage counts from the swara DynamoDB tables
 *    (users, sessions, analytics) — registered/signed-up + anonymous devices.
 *  - fetchGa4(): read-only GA4 numbers via the Analytics Data API, using the
 *    swara Firebase service account (the same one the notifications Lambda
 *    uses). Returns configured:false when the SA or property id isn't set.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, ScanCommand, QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { sign } from 'jsonwebtoken';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssm = new SSMClient({});

const USERS_TABLE     = process.env['USERS_TABLE'];
const SESSIONS_TABLE  = process.env['SESSIONS_TABLE'];
const ANALYTICS_TABLE = process.env['ANALYTICS_TABLE'];
const STAGE           = process.env['STAGE'] ?? 'dev';

const DAY_MS  = 24 * 60 * 60 * 1000;
const TRAILING_DAYS = 30;

export interface AnalyticsSeriesPoint {
  date: string;          // YYYY-MM-DD (UTC)
  signups: number;
  activeDevices: number;
  sessions: number;
  minutes: number;
}

export interface AnalyticsOur {
  totals: {
    registeredUsers: number;
    sessions: number;
    practiceMinutes: number;
    dau: number;
    wau: number;
    mau: number;
  };
  series: AnalyticsSeriesPoint[];
}

export interface Ga4Point {
  date: string;
  activeUsers: number;
}

export interface Ga4Result {
  configured: boolean;
  dau?: number;
  wau?: number;
  mau?: number;
  newUsers30d?: number;
  series?: Ga4Point[];
}

// ── DynamoDB helpers ────────────────────────────────────────────────────────

/** Last N UTC days as YYYY-MM-DD, oldest first (today = last element). */
function trailingDates(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

type DdbRow = Record<string, unknown>;

async function scanAll(table: string): Promise<DdbRow[]> {
  const rows: DdbRow[] = [];
  let last: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: table,
      ...(last ? { ExclusiveStartKey: last as never } : {}),
    }));
    rows.push(...((res.Items ?? []) as DdbRow[]));
    last = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (last);
  return rows;
}

/** Query every item under a pk (only the sort key is projected). */
async function querySkUnder(table: string, pk: string): Promise<string[]> {
  const rows: string[] = [];
  let last: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(new QueryCommand({
      TableName: table,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': pk },
      ProjectionExpression: 'sk',
      ...(last ? { ExclusiveStartKey: last as never } : {}),
    }));
    for (const item of res.Items ?? []) {
      const sk = (item as DdbRow)['sk'];
      if (typeof sk === 'string') rows.push(sk);
    }
    last = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (last);
  return rows;
}

// ── Our analytics ───────────────────────────────────────────────────────────

export async function computeOurAnalytics(): Promise<AnalyticsOur> {
  const dates   = trailingDates(TRAILING_DAYS);
  const dateIdx = new Map(dates.map((d, i) => [d, i]));

  const series: AnalyticsSeriesPoint[] = dates.map(date => ({
    date, signups: 0, activeDevices: 0, sessions: 0, minutes: 0,
  }));
  const totals = {
    registeredUsers: 0, sessions: 0, practiceMinutes: 0, dau: 0, wau: 0, mau: 0,
  };

  // Missing table env vars are treated as "no data" (allows local/dev without
  // the table); only genuine DynamoDB failures propagate.
  const [users, sessions] = await Promise.all([
    USERS_TABLE ? scanAll(USERS_TABLE) : [],
    SESSIONS_TABLE ? scanAll(SESSIONS_TABLE) : [],
  ]);

  totals.registeredUsers = users.length;
  for (const u of users) {
    const day = String((u as DdbRow)['createdAt'] ?? '').slice(0, 10);
    const i = dateIdx.get(day);
    if (i !== undefined) series[i].signups++;
  }

  totals.sessions = sessions.length;
  for (const s of sessions) {
    const row = s as DdbRow;
    const minutes = Math.round((Number(row['duration']) || 0) / 60);
    totals.practiceMinutes += minutes;
    const day = String(row['createdAt'] ?? '').slice(0, 10);
    const i = dateIdx.get(day);
    if (i !== undefined) {
      series[i].sessions++;
      series[i].minutes += minutes;
    }
  }

  // Anonymous opens: query the day pk for each trailing day. activeDevices is
  // the row count per day (one row per install per day). wau/mau are the
  // distinct install ids across the trailing 7 / 28 days.
  if (ANALYTICS_TABLE) {
    const last28 = dates.slice(-28);
    const dayIds = new Map<string, string[]>();
    for (const date of last28) {
      dayIds.set(date, await querySkUnder(ANALYTICS_TABLE, `day#${date}`));
    }
    for (const date of dates) {
      const ids = dayIds.get(date);
      if (ids) series[dateIdx.get(date)!].activeDevices = ids.length;
    }

    const wauIds = new Set<string>();
    for (const date of dates.slice(-7)) for (const id of dayIds.get(date) ?? []) wauIds.add(id);
    const mauIds = new Set<string>();
    for (const date of last28) for (const id of dayIds.get(date) ?? []) mauIds.add(id);

    totals.dau = series[series.length - 1].activeDevices;
    totals.wau = wauIds.size;
    totals.mau = mauIds.size;
  }

  return { totals, series };
}

// ── GA4 (Google analytics) ──────────────────────────────────────────────────

interface Ga4Row {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
}

function metricTotal(rows: Ga4Row[]): number {
  return Number(rows[0]?.metricValues?.[0]?.value ?? 0);
}

function toDashDate(compact: string): string {
  if (compact.length !== 8) return '';
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

async function ssmParam(name: string): Promise<string> {
  const res = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
  return res.Parameter?.Value ?? '';
}

async function runReport(token: string, propertyId: string, body: Record<string, unknown>): Promise<Ga4Row[]> {
  const resp = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    },
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GA4 runReport failed: ${resp.status} ${text}`);
  }
  const data = await resp.json() as { rows?: Ga4Row[] };
  return data.rows ?? [];
}

export async function fetchGa4(): Promise<Ga4Result> {
  try {
    const [saJson, propertyId] = await Promise.all([
      ssmParam(`/swara-${STAGE}/firebase-sa-key`),
      ssmParam(`/swara-${STAGE}/ga4-property-id`),
    ]);
    if (!propertyId || propertyId === 'PLACEHOLDER' || !saJson) {
      return { configured: false };
    }
    const serviceAccount = JSON.parse(saJson) as { client_email: string; private_key: string };

    const now = Math.floor(Date.now() / 1000);
    const jwt = sign(
      {
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/analytics.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      },
      serviceAccount.private_key,
      { algorithm: 'RS256' },
    );

    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    if (!tokenResp.ok) throw new Error(`OAuth token exchange failed: ${tokenResp.status}`);
    const tokenData = await tokenResp.json() as { access_token: string };
    const token = tokenData.access_token;

    const baseMetrics = { metrics: [{ name: 'activeUsers' }] };
    const [dauRows, wauRows, mauRows, newUsersRows, seriesRows] = await Promise.all([
      runReport(token, propertyId, { dateRanges: [{ startDate: 'today', endDate: 'today' }], ...baseMetrics }),
      runReport(token, propertyId, { dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }], ...baseMetrics }),
      runReport(token, propertyId, { dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }], ...baseMetrics }),
      runReport(token, propertyId, {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        metrics: [{ name: 'newUsers' }],
      }),
      runReport(token, propertyId, {
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }],
      }),
    ]);

    const series = seriesRows
      .map(r => ({
        date: toDashDate(String(r.dimensionValues?.[0]?.value ?? '')),
        activeUsers: Number(r.metricValues?.[0]?.value ?? 0),
      }))
      .filter(p => p.date.length === 10)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .slice(-TRAILING_DAYS);

    return {
      configured: true,
      dau: metricTotal(dauRows),
      wau: metricTotal(wauRows),
      mau: metricTotal(mauRows),
      newUsers30d: metricTotal(newUsersRows),
      series,
    };
  } catch (err) {
    console.error('[GA4] fetch failed', err);
    return { configured: false };
  }
}
