import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import {
  DynamoDBDocumentClient, GetCommand, UpdateCommand, DeleteCommand, ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { verifyServiceToken } from './auth';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env['USERS_TABLE']!;

// Mirrors apps/backend-api/src/middleware/auth.middleware.ts CORS helpers:
// the response echoes the request origin when CORS_ORIGIN is '*' (or unset).
const CORS_ORIGIN_RAW = process.env['CORS_ORIGIN'] ?? '*';
const ALLOWED_ORIGINS = CORS_ORIGIN_RAW === '*' ? null : CORS_ORIGIN_RAW.split(',').map(o => o.trim());
let _currentOrigin = '*';

function setCorsOrigin(event: APIGatewayProxyEventV2): void {
  const origin = event.headers?.['origin'] ?? '';
  if (!ALLOWED_ORIGINS) {
    _currentOrigin = origin || '*';
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    _currentOrigin = origin;
  } else {
    _currentOrigin = ALLOWED_ORIGINS[0];
  }
}

function corsHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': _currentOrigin,
    'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body),
  };
}

// Whitelisted editable top-level fields with light per-field type validation.
const TOP_VALIDATORS: Record<string, (v: unknown) => boolean> = {
  displayName:   (v) => typeof v === 'string',
  favoriteRagas: (v) => Array.isArray(v) && v.every((s) => typeof s === 'string'),
  photoUrl:      (v) => typeof v === 'string' || v === null,
};

// Whitelisted editable preference keys (all 8 keys from UserProfile.preferences).
const SORT_COLUMNS: Record<string, (u: Record<string, unknown>) => string | number | null> = {
  displayName: (u) => String(u.displayName ?? ''),
  email: (u) => String(u.email ?? ''),
  createdAt: (u) => String(u.createdAt ?? ''),
  updatedAt: (u) => String(u.updatedAt ?? ''),
};

function sortAndPage<T>(items: T[], sortBy: string, sortDir: string, page: number, pageSize: number): { users: T[]; total: number; page: number; pageSize: number } {
  const sorted = [...items];
  const key = SORT_COLUMNS[sortBy];
  if (key) {
    sorted.sort((a: any, b: any) => {
      const va = key(a) ?? '';
      const vb = key(b) ?? '';
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }
  const start = (page - 1) * pageSize;
  return { users: sorted.slice(start, start + pageSize), total: sorted.length, page, pageSize };
}

const PREF_VALIDATORS: Record<string, (v: unknown) => boolean> = {
  defaultKey:           (v) => typeof v === 'string',
  defaultTempo:         (v) => typeof v === 'number',
  pitchSensitivity:     (v) => typeof v === 'number',
  theme:                (v) => v === 'dark' || v === 'light',
  notificationsEnabled: (v) => typeof v === 'boolean',
  micPermissionGranted: (v) => typeof v === 'boolean',
  dailyGoalMinutes:     (v) => typeof v === 'number',
  instrument:           (v) => v === 'tanpura' || v === 'keyboard' || v === 'guitar',
};

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  setCorsOrigin(event);
  const method = event.requestContext.http.method;
  // API Gateway answers true CORS preflights itself; this mirrors backend-api
  // (ok({})) for OPTIONS requests that still reach the Lambda.
  if (method === 'OPTIONS') return json(200, {});

  const ok = await verifyServiceToken(event.headers?.['authorization']);
  if (!ok) return json(401, { error: 'Unauthorized' });

  // GET /users — paged, sorted list (swara users table).
  if (method === 'GET' && /^\/users\/?$/.test(event.requestContext.http.path)) {
    const q = event.queryStringParameters ?? {};
    const sortBy = q['sortBy'] ?? 'displayName';
    if (!SORT_COLUMNS[sortBy]) return json(400, { error: 'invalid sortBy' });
    const sortDir = q['sortDir'] === 'desc' ? 'desc' : 'asc';
    const page = Math.max(1, parseInt(q['page'] ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(q['pageSize'] ?? '25', 10) || 25));
    const search = (q['search'] ?? '').toLowerCase();

    try {
      const res = await ddb.send(new ScanCommand({ TableName: TABLE }));
      const rows = (res.Items ?? []) as Record<string, unknown>[];
      const filtered = search
        ? rows.filter((u) =>
            String(u.email ?? '').toLowerCase().includes(search) ||
            String(u.displayName ?? '').toLowerCase().includes(search))
        : rows;
      const mapped = filtered.map((u) => ({
        userId: String(u.userId ?? ''),
        displayName: String(u.displayName ?? ''),
        email: String(u.email ?? ''),
        createdAt: String(u.createdAt ?? ''),
        updatedAt: u.updatedAt != null ? String(u.updatedAt) : null,
        thumbnail: u.photoUrl != null ? String(u.photoUrl) : null,
      }));
      return json(200, sortAndPage(mapped, sortBy, sortDir, page, pageSize));
    } catch (err) {
      return json(500, { error: err instanceof Error ? err.message : 'Internal server error' });
    }
  }

  const m = event.requestContext.http.path.match(/^\/users\/([^/]+)\/?$/);
  if (!m) return json(404, { error: 'not found' });
  let userId: string;
  try {
    userId = decodeURIComponent(m[1]);
  } catch {
    return json(400, { error: 'Invalid path' });
  }

  try {
    if (method === 'GET') {
      const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { userId } }));
      return res.Item ? json(200, res.Item) : json(404, { error: 'user not found' });
    }

    if (method === 'PUT') {
      let body: Record<string, unknown>;
      try { body = event.body ? JSON.parse(event.body) : {}; } catch { return json(400, { error: 'Invalid JSON' }); }

      // JSON.parse('null') yields null and scalars/arrays are meaningless as an
      // update body — treat any non-object as invalid (was a 500 before).
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return json(400, { error: 'Invalid JSON' });
      }

      const updates: string[] = [];
      const values: Record<string, unknown> = {};
      const names: Record<string, string> = {};
      let has = false;

      for (const key of Object.keys(body)) {
        if (key in TOP_VALIDATORS) {
          if (!TOP_VALIDATORS[key](body[key])) return json(400, { error: `invalid field ${key}` });
          updates.push(`#${key} = :${key}`);
          names[`#${key}`] = key;
          values[`:${key}`] = body[key];
          has = true;
        } else if (key !== 'preferences') {
          return json(400, { error: `unknown field ${key}` });
        }
      }

      if (body['preferences'] !== undefined) {
        if (typeof body['preferences'] !== 'object' || body['preferences'] === null || Array.isArray(body['preferences'])) {
          return json(400, { error: 'invalid field preferences' });
        }
        for (const [k, v] of Object.entries(body['preferences'] as Record<string, unknown>)) {
          if (!(k in PREF_VALIDATORS)) return json(400, { error: `invalid field preferences.${k}` });
          if (!PREF_VALIDATORS[k](v)) return json(400, { error: `invalid field preferences.${k}` });
          updates.push(`preferences.${k} = :pref_${k}`);
          values[`:pref_${k}`] = v;
          has = true;
        }
      }

      if (!has) return json(400, { error: 'no allowed fields provided' });

      names['#u'] = 'updatedAt';
      values[':now'] = new Date().toISOString();
      updates.push('#u = :now');

      const res = await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { userId },
        UpdateExpression: `SET ${updates.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
      }));
      return json(200, res.Attributes ?? { userId });
    }

    if (method === 'DELETE') {
      // Mirrors the swara app's own user deletion semantics (users.handler.ts
      // DELETE): removes the profile row from the users table. Related rows in
      // sessions/streaks/classroom tables and the Cognito account are left
      // untouched, matching existing app behavior.
      await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { userId } }));
      return json(200, { deleted: true });
    }

    return json(405, { error: 'method not allowed' });
  } catch (err) {
    console.error('[Lambda error]', err);
    return json(500, { error: 'Internal server error' });
  }
}
