import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const USERS_TABLE = process.env['USERS_TABLE']!;
const WEBHOOK_SECRET = process.env['REVENUECAT_WEBHOOK_SECRET']!;

interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  expiration_at_ms?: number;
  purchased_at_ms?: number;
}

interface RevenueCatWebhookBody {
  event: RevenueCatEvent;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const authHeader = event.headers?.['authorization'] ?? '';
  if (authHeader !== WEBHOOK_SECRET) {
    console.warn('RevenueCat webhook: invalid secret');
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let body: RevenueCatWebhookBody;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { type, app_user_id, expiration_at_ms, purchased_at_ms } = body.event;

  if (!app_user_id) {
    return { statusCode: 400, body: 'Missing app_user_id' };
  }

  console.log(`RevenueCat webhook: type=${type} userId=${app_user_id}`);

  try {
    switch (type) {
      case 'INITIAL_PURCHASE':
        await setPremium(app_user_id, true, purchased_at_ms, expiration_at_ms);
        break;
      case 'RENEWAL':
        await setPremium(app_user_id, true, undefined, expiration_at_ms);
        break;
      case 'CANCELLATION':
        await updateExpiry(app_user_id, expiration_at_ms);
        break;
      case 'EXPIRATION':
      case 'BILLING_ISSUE':
      case 'REFUND':
        await setPremium(app_user_id, false, undefined, undefined);
        break;
      default:
        console.log(`RevenueCat webhook: ignoring event type=${type}`);
    }
  } catch (err) {
    console.error('RevenueCat webhook: DynamoDB update failed', err);
    return { statusCode: 500, body: 'Internal error' };
  }

  return { statusCode: 200, body: 'OK' };
};

async function setPremium(
  userId: string,
  isPremium: boolean,
  purchasedAtMs?: number,
  expirationAtMs?: number,
): Promise<void> {
  const now = new Date().toISOString();
  let updateExpr = 'SET isPremium = :premium, updatedAt = :now';
  const exprAttrValues: Record<string, unknown> = {
    ':premium': isPremium,
    ':now': now,
  };

  if (isPremium && purchasedAtMs) {
    updateExpr += ', premiumSince = if_not_exists(premiumSince, :since)';
    exprAttrValues[':since'] = new Date(purchasedAtMs).toISOString();
  }

  if (expirationAtMs) {
    updateExpr += ', premiumExpiresAt = :expires';
    exprAttrValues[':expires'] = new Date(expirationAtMs).toISOString();
  } else if (!isPremium) {
    updateExpr += ' REMOVE premiumExpiresAt';
  }

  await dynamo.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId },
    UpdateExpression: updateExpr,
    ExpressionAttributeValues: exprAttrValues,
  }));
}

async function updateExpiry(userId: string, expirationAtMs?: number): Promise<void> {
  if (!expirationAtMs) return;
  await dynamo.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId },
    UpdateExpression: 'SET premiumExpiresAt = :expires, updatedAt = :now',
    ExpressionAttributeValues: {
      ':expires': new Date(expirationAtMs).toISOString(),
      ':now': new Date().toISOString(),
    },
  }));
}
