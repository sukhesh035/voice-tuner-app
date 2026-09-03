/**
 * Analytics Lambda Handler
 * Route: POST /v1/api/analytics/open (PUBLIC — no auth)
 * Records an anonymous app open/foreground event per install per UTC day.
 * The Authorization header is intentionally ignored; no userId is stored.
 */
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  ok, created, badRequest, serverError, setCorsOrigin,
} from '../middleware/auth.middleware';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ANALYTICS_TABLE = process.env['ANALYTICS_TABLE']!;

const PLATFORMS = ['ios', 'android', 'web'];
const INSTALL_ID_RE = /^[A-Za-z0-9-]{8,100}$/;
const DAY_SECONDS = 24 * 60 * 60;
const TTL_DAYS = 400;

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    setCorsOrigin(event);

    const method = event.requestContext.http.method;
    if (method === 'OPTIONS') return ok({});

    if (method === 'POST') {
      // Intentionally public — any Authorization header present is ignored.
      const body: Record<string, unknown> = JSON.parse(event.body ?? '{}');

      const rawInstallId = body['installId'];
      if (typeof rawInstallId !== 'string') {
        return badRequest('installId is required');
      }
      const installId = rawInstallId.trim();
      if (!INSTALL_ID_RE.test(installId)) {
        return badRequest('installId must be 8-100 chars of A-Za-z0-9 or -');
      }

      const platformRaw = body['platform'];
      let platform = 'web';
      if (platformRaw !== undefined) {
        if (typeof platformRaw !== 'string' || !PLATFORMS.includes(platformRaw)) {
          return badRequest('platform must be one of: ios, android, web');
        }
        platform = platformRaw;
      }

      const now = new Date();
      const day = now.toISOString().slice(0, 10);

      await ddb.send(new PutCommand({
        TableName: ANALYTICS_TABLE,
        Item: {
          pk: `day#${day}`,
          sk: installId,
          installId,
          platform,
          lastSeen: now.toISOString(),
          ttl: Math.floor(now.getTime() / 1000) + TTL_DAYS * DAY_SECONDS,
        },
      }));

      return created({ ok: true });
    }

    return badRequest('Unknown route');
  } catch (err) {
    return serverError(err);
  }
};
