/**
 * local-server.ts
 *
 * Express wrapper that runs all Lambda handlers locally.
 * Reads env vars from .env.local at the workspace root.
 *
 * Usage:
 *   pnpm dev:api   (runs: tsx apps/backend-api/src/local-server.ts)
 *
 * The server listens on http://localhost:3000
 * All routes are mounted under /v1 to match the deployed API Gateway path.
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

import { handler as sessionsHandler }  from './handlers/sessions.handler';
import { handler as usersHandler }     from './handlers/users.handler';
import { handler as streaksHandler }   from './handlers/streaks.handler';
import { handler as classroomHandler } from './handlers/classroom.handler';

const app  = express();
const PORT = process.env['PORT'] ?? 3000;

app.use(express.json());

// ─── CORS ──────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin',  'http://localhost:4200');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  next();
});
app.options('*path', (_req: Request, res: Response) => res.sendStatus(204));

// ─── Adapter: Express req → APIGatewayProxyEventV2 ────────────────────────
function toEvent(req: Request): APIGatewayProxyEventV2 {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathParams: Record<string, string> = {};

  // Extract path params from express route (set by buildRoute helper)
  for (const [k, v] of Object.entries(req.params)) {
    pathParams[k] = String(v);
  }

  // Convert query string
  const queryParams: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { queryParams[k] = v; });

  return {
    version:     '2.0',
    routeKey:    `${req.method} ${req.path}`,
    rawPath:     req.path,
    rawQueryString: url.search.slice(1),
    headers:     req.headers as Record<string, string>,
    queryStringParameters: queryParams,
    pathParameters: pathParams,
    body:        req.body ? JSON.stringify(req.body) : undefined,
    isBase64Encoded: false,
    requestContext: {
      accountId:    'local',
      apiId:        'local',
      domainName:   'localhost',
      domainPrefix: 'localhost',
      requestId:    `local-${Date.now()}`,
      routeKey:     `${req.method} ${req.path}`,
      stage:        '$default',
      time:         new Date().toISOString(),
      timeEpoch:    Date.now(),
      http: {
        method:    req.method,
        path:      req.path,
        protocol:  'HTTP/1.1',
        sourceIp:  req.ip ?? '127.0.0.1',
        userAgent: req.headers['user-agent'] ?? '',
      },
    },
  } as APIGatewayProxyEventV2;
}

// ─── Adapter: Lambda result → Express response ────────────────────────────
async function invoke(
  handler: (e: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>,
  req: Request,
  res: Response,
) {
  try {
    const event  = toEvent(req);
    const result = await handler(event) as {
      statusCode: number;
      headers?: Record<string, string>;
      body?: string;
    };

    // Forward Lambda headers (skip CORS — already set above)
    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) {
        if (!k.toLowerCase().startsWith('access-control')) {
          res.setHeader(k, v);
        }
      }
    }

    const body = result.body ? JSON.parse(result.body) : {};
    res.status(result.statusCode).json(body);
  } catch (err) {
    console.error('[local-server] unhandled error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────
// Sessions
app.get(   '/v1/api/sessions',     (req, res) => invoke(sessionsHandler,  req, res));
app.post(  '/v1/api/sessions',     (req, res) => invoke(sessionsHandler,  req, res));
app.get(   '/v1/api/sessions/:id', (req, res) => invoke(sessionsHandler,  req, res));
app.put(   '/v1/api/sessions/:id', (req, res) => invoke(sessionsHandler,  req, res));

// Users
app.get(   '/v1/api/users/me',     (req, res) => invoke(usersHandler,     req, res));
app.put(   '/v1/api/users/me',     (req, res) => invoke(usersHandler,     req, res));

// Streaks
app.get(   '/v1/api/streaks',          (req, res) => invoke(streaksHandler, req, res));
app.post(  '/v1/api/streaks/checkin',  (req, res) => invoke(streaksHandler, req, res));

// Classroom
app.post(  '/v1/api/classroom/sessions',              (req, res) => invoke(classroomHandler, req, res));
app.get(   '/v1/api/classroom/sessions/:code',        (req, res) => invoke(classroomHandler, req, res));
app.post(  '/v1/api/classroom/join',                  (req, res) => invoke(classroomHandler, req, res));
app.put(   '/v1/api/classroom/sessions/:code/result', (req, res) => invoke(classroomHandler, req, res));
app.delete('/v1/api/classroom/sessions/:code',        (req, res) => invoke(classroomHandler, req, res));

// ─── Start ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n[Sruti local API] listening on http://localhost:${PORT}/v1`);
  console.log(`  COGNITO_USER_POOL_ID : ${process.env['COGNITO_USER_POOL_ID']}`);
  console.log(`  USERS_TABLE          : ${process.env['USERS_TABLE']}`);
  console.log(`  SESSIONS_TABLE       : ${process.env['SESSIONS_TABLE']}`);
  console.log(`  STREAKS_TABLE        : ${process.env['STREAKS_TABLE']}`);
  console.log(`  CLASSROOM_TABLE      : ${process.env['CLASSROOM_TABLE']}\n`);
});
