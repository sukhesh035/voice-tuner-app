/**
 * Feedback Lambda Handler
 * Route: POST /v1/api/feedback (PUBLIC — no auth)
 * Stores user feedback: comments, suggestions, and problem reports.
 */
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  ok, created, badRequest, serverError, setCorsOrigin,
} from '../middleware/auth.middleware';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const FEEDBACK_TABLE = process.env['FEEDBACK_TABLE']!;

const CATEGORIES = ['comment', 'suggestion', 'problem'];

const NAME_MAX    = 80;
const MESSAGE_MAX = 2000;

function cleanName(raw: unknown): string | null {
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  if (name.length > NAME_MAX) return null;
  return name;
}

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

      const category = body['category'];
      if (typeof category !== 'string' || !CATEGORIES.includes(category)) {
        return badRequest('category must be one of: comment, suggestion, problem');
      }

      const rating = body['rating'];
      if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return badRequest('rating must be an integer between 1 and 5');
      }

      const rawMessage = body['message'];
      if (typeof rawMessage !== 'string') return badRequest('message is required');
      const message = rawMessage.trim();
      if (message.length < 1 || message.length > MESSAGE_MAX) {
        return badRequest(`message must be between 1 and ${MESSAGE_MAX} characters`);
      }

      const name = cleanName(body['name']);
      if (name === null) return badRequest(`name must be at most ${NAME_MAX} characters`);

      const feedbackId = randomUUID();
      const createdAt  = new Date().toISOString();

      await ddb.send(new PutCommand({
        TableName: FEEDBACK_TABLE,
        Item: { feedbackId, name, category, rating, message, createdAt },
      }));

      return created({ feedbackId, createdAt });
    }

    return badRequest('Unknown route');
  } catch (err) {
    return serverError(err);
  }
};
