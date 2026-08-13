import { handler } from './handler';
import { verifyServiceToken } from './auth';

jest.mock('./auth', () => ({ verifyServiceToken: jest.fn() }));
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const send = jest.fn();
  return {
    DynamoDBDocumentClient: { from: jest.fn(() => ({ send })) },
    send,
    GetCommand: jest.fn((i) => i),
    UpdateCommand: jest.fn((i) => i),
    DeleteCommand: jest.fn((i) => i),
  };
});

const mockVerify = verifyServiceToken as jest.Mock;
const { send } = require('@aws-sdk/lib-dynamodb') as { send: jest.Mock };

function event(method: string, rawPath: string, body?: unknown) {
  return {
    requestContext: { http: { method, path: rawPath } },
    headers: { authorization: 'Bearer tok' },
    rawPath,
    body: body ? JSON.stringify(body) : undefined,
    isBase64Encoded: false,
  } as never;
}

describe('admin-api handler', () => {
  beforeEach(() => { jest.clearAllMocks(); mockVerify.mockResolvedValue(true); });

  it('returns 401 when the token is invalid', async () => {
    mockVerify.mockResolvedValue(false);
    const res = await handler(event('GET', '/users/u1'));
    expect(res.statusCode).toBe(401);
  });

  it('GET returns the full user profile', async () => {
    send.mockResolvedValue({ Item: { userId: 'u1', email: 'a@b.com', displayName: 'A' } });
    const res = await handler(event('GET', '/users/u1'));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? '{}')).toMatchObject({ userId: 'u1', email: 'a@b.com' });
  });

  it('GET returns 404 when missing', async () => {
    send.mockResolvedValue({});
    const res = await handler(event('GET', '/users/u1'));
    expect(res.statusCode).toBe(404);
  });

  it('GET returns 404 for an unmapped path', async () => {
    const res = await handler(event('GET', '/nope'));
    expect(res.statusCode).toBe(404);
  });

  it('PUT rejects unknown fields', async () => {
    const res = await handler(event('PUT', '/users/u1', { hacker: true }));
    expect(res.statusCode).toBe(400);
  });

  it('PUT rejects a valid field mixed with an unknown field', async () => {
    const res = await handler(event('PUT', '/users/u1', { displayName: 'B', hacker: true }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body ?? '{}')).toEqual({ error: 'unknown field hacker' });
  });

  it('PUT rejects invalid JSON body', async () => {
    const res = await handler({
      requestContext: { http: { method: 'PUT', path: '/users/u1' } },
      headers: { authorization: 'Bearer tok' },
      body: '{not-json',
      isBase64Encoded: false,
    } as never);
    expect(res.statusCode).toBe(400);
  });

  it('PUT rejects a type mismatch (displayName must be string)', async () => {
    const res = await handler(event('PUT', '/users/u1', { displayName: 123 }));
    expect(res.statusCode).toBe(400);
  });

  it('PUT rejects a type mismatch (favoriteRagas must be string array)', async () => {
    const res = await handler(event('PUT', '/users/u1', { favoriteRagas: 'Kalyani' }));
    expect(res.statusCode).toBe(400);
  });

  it('PUT rejects a bad preference type', async () => {
    const res = await handler(event('PUT', '/users/u1', { preferences: { notificationsEnabled: 'yes' } }));
    expect(res.statusCode).toBe(400);
  });

  it('PUT updates allowed fields (displayName, favoriteRagas)', async () => {
    send.mockResolvedValue({ Attributes: { userId: 'u1', displayName: 'B' } });
    const res = await handler(event('PUT', '/users/u1', { displayName: 'B', favoriteRagas: ['Kalyani'] }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? '{}')).toMatchObject({ userId: 'u1', displayName: 'B' });
  });

  it('DELETE returns deleted', async () => {
    const res = await handler(event('DELETE', '/users/u1'));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? '{}')).toEqual({ deleted: true });
  });

  it('returns 405 for unsupported methods', async () => {
    const res = await handler(event('PATCH', '/users/u1'));
    expect(res.statusCode).toBe(405);
  });

  it('PUT rejects a JSON null body', async () => {
    const res = await handler({
      requestContext: { http: { method: 'PUT', path: '/users/u1' } },
      headers: { authorization: 'Bearer tok' },
      body: 'null',
      isBase64Encoded: false,
    } as never);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body ?? '{}')).toEqual({ error: 'Invalid JSON' });
  });

  it('PUT rejects an empty object body (no allowed fields)', async () => {
    const res = await handler(event('PUT', '/users/u1', {}));
    expect(res.statusCode).toBe(400);
  });

  it('PUT rejects a request with no body at all', async () => {
    const res = await handler(event('PUT', '/users/u1'));
    expect(res.statusCode).toBe(400);
  });

  it('OPTIONS returns 200 with an empty body', async () => {
    const res = await handler(event('OPTIONS', '/users/u1'));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? '{}')).toEqual({});
  });

  it('PUT rejects an invalid theme preference', async () => {
    const res = await handler(event('PUT', '/users/u1', { preferences: { theme: 'neon' } }));
    expect(res.statusCode).toBe(400);
  });

  it('PUT rejects an invalid instrument preference', async () => {
    const res = await handler(event('PUT', '/users/u1', { preferences: { instrument: 'flute' } }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for a malformed percent-encoded userId', async () => {
    const res = await handler(event('GET', '/users/%E0%A4%A'));
    expect(res.statusCode).toBe(400);
  });

  it('returns 500 with a generic message when DynamoDB fails', async () => {
    send.mockRejectedValue(new Error('dynamo down'));
    const res = await handler(event('GET', '/users/u1'));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body ?? '{}')).toEqual({ error: 'Internal server error' });
  });
});
