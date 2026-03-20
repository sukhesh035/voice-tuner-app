/**
 * Sessions Lambda Handler
 * Routes: GET /sessions, POST /sessions, GET /sessions/:id, PUT /sessions/:id
 */
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand,
  QueryCommand, UpdateCommand, DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import {
  verifyToken, unauthorized, ok, created,
  badRequest, notFound, serverError, setCorsOrigin,
} from '../middleware/auth.middleware';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env['SESSIONS_TABLE']!;

export interface PracticeSession {
  pk: string;           // userId
  sk: string;           // SESS#timestamp#sessionId
  sessionId: string;
  userId: string;
  createdAt: string;
  duration: number;     // seconds
  mode: 'shruti' | 'raga' | 'free';
  raagaId?: string;
  key: string;          // e.g. "C", "D#"
  score: number;        // 0–100
  avgAccuracy: number;
  stabilityScore: number;
  noteAccuracies: Record<string, number>;
  aiSummary?: string;
  ttl?: number;
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    setCorsOrigin(event);
    const auth = await verifyToken(event);
    if (!auth) return unauthorized();

    const method = event.requestContext.http.method;
    const path   = event.requestContext.http.path;
    const sessionId = event.pathParameters?.['id'];

    // OPTIONS (CORS preflight)
    if (method === 'OPTIONS') return ok({});

    // GET /sessions — list user sessions
    if (method === 'GET' && !sessionId) {
      const rawLimit = parseInt(event.queryStringParameters?.['limit'] ?? '20', 10);
      const limit    = Math.min(Math.max(isNaN(rawLimit) ? 20 : rawLimit, 1), 100);
      const rawCursor = event.queryStringParameters?.['cursor'];

      let exclusiveStartKey: Record<string, unknown> | undefined;
      if (rawCursor) {
        try {
          const cursor = JSON.parse(Buffer.from(rawCursor, 'base64').toString()) as Record<string, unknown>;
          // Validate the cursor belongs to the authenticated user to prevent cross-user data leakage
          if (cursor['pk'] !== auth.userId) {
            return badRequest('Invalid cursor');
          }
          exclusiveStartKey = cursor;
        } catch {
          return badRequest('Invalid cursor');
        }
      }

      const result = await ddb.send(new QueryCommand({
        TableName:              TABLE,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk':     auth.userId,
          ':prefix': 'SESS#',
        },
        ScanIndexForward: false,   // newest first
        Limit: limit,
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      }));

      return ok({
        sessions: result.Items ?? [],
        nextCursor: result.LastEvaluatedKey
          ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
          : null,
      });
    }

    // POST /sessions — save new session
    if (method === 'POST') {
      const body = JSON.parse(event.body ?? '{}');
      const now  = new Date().toISOString();
      const id   = body.sessionId ?? uuidv4();

      const session: PracticeSession = {
        pk:             auth.userId,
        sk:             `SESS#${now}#${id}`,
        sessionId:      id,
        userId:         auth.userId,
        createdAt:      now,
        duration:       body.duration        ?? 0,
        mode:           body.mode            ?? 'free',
        raagaId:        body.raagaId,
        key:            body.key             ?? 'C',
        score:          body.score           ?? 0,
        avgAccuracy:    body.avgAccuracy     ?? 0,
        stabilityScore: body.stabilityScore  ?? 0,
        noteAccuracies: body.noteAccuracies  ?? {},
        aiSummary:      body.aiSummary,
        // Auto-expire raw sessions after 1 year
        ttl:        Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
      };

      await ddb.send(new PutCommand({ TableName: TABLE, Item: session }));
      return created({ sessionId: id, createdAt: now });
    }

    // GET /sessions/:id
    if (method === 'GET' && sessionId) {
      // sessionId alone isn't enough for the composite key — client passes sk via query
      const sk = event.queryStringParameters?.['sk'];
      if (!sk) return badRequest('sk query parameter required');

      const result = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { pk: auth.userId, sk },
      }));
      if (!result.Item) return notFound('Session');
      return ok(result.Item);
    }

    return badRequest('Unknown route');
  } catch (err) {
    return serverError(err);
  }
};
