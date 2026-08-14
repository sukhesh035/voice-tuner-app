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
    ScanCommand: jest.fn((i) => i),
  };
});

const mockVerify = verifyServiceToken as jest.Mock;
const { send } = require('@aws-sdk/lib-dynamodb') as { send: jest.Mock };

function event(method: string, rawPath: string, body?: unknown, query?: Record<string, string>) {
  return {
    requestContext: { http: { method, path: rawPath } },
    headers: { authorization: 'Bearer tok' },
    rawPath,
    queryStringParameters: query,
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

  it('GET /users returns 500 with a generic message when DynamoDB fails', async () => {
    send.mockRejectedValue(new Error('dynamo down'));
    const res = await handler(event('GET', '/users'));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body ?? '{}')).toEqual({ error: 'Internal server error' });
  });

  it('GET /users returns a paged, sorted slice with total', async () => {
    send.mockResolvedValue({
      Items: [
        { userId: 'u1', email: 'b@b.com', displayName: 'Bob', createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-03T00:00:00.000Z', photoUrl: null },
        { userId: 'u2', email: 'a@a.com', displayName: 'Alice', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', photoUrl: 'https://cdn/a.jpg' },
        { userId: 'u3', email: 'c@c.com', displayName: 'Carol', createdAt: '2026-01-03T00:00:00.000Z', updatedAt: null, photoUrl: null },
      ],
    });
    // page=1, pageSize=2, sortBy=displayName asc
    const res = await handler(event('GET', '/users', undefined, { page: '1', pageSize: '2', sortBy: 'displayName', sortDir: 'asc' }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.total).toBe(3);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(2);
    expect(body.users.map((u: any) => u.displayName)).toEqual(['Alice', 'Bob']);
  });

  it('GET /users sorts descending by email', async () => {
    send.mockResolvedValue({
      Items: [
        { userId: 'u1', email: 'a@a.com', displayName: 'A', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: null, photoUrl: null },
        { userId: 'u2', email: 'c@c.com', displayName: 'C', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: null, photoUrl: null },
        { userId: 'u3', email: 'b@b.com', displayName: 'B', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: null, photoUrl: null },
      ],
    });
    const res = await handler(event('GET', '/users', undefined, { sortBy: 'email', sortDir: 'desc' }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.users.map((u: any) => u.email)).toEqual(['c@c.com', 'b@b.com', 'a@a.com']);
  });

  it('GET /users filters by search and returns the correct page', async () => {
    send.mockResolvedValue({
      Items: [
        { userId: 'u1', email: 'alice@a.com', displayName: 'Alice', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: null, photoUrl: null },
        { userId: 'u2', email: 'bob@b.com', displayName: 'Bob', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: null, photoUrl: null },
      ],
    });
    const res = await handler(event('GET', '/users', undefined, { search: 'alice' }));
    const body = JSON.parse(res.body ?? '{}');
    expect(body.users).toHaveLength(1);
    expect(body.users[0].displayName).toBe('Alice');
    expect(body.total).toBe(1);
  });

  it('GET /users rejects an unknown sortBy with 400', async () => {
    send.mockResolvedValue({ Items: [] });
    const res = await handler(event('GET', '/users', undefined, { sortBy: 'hacker' }));
    expect(res.statusCode).toBe(400);
  });

  it('GET /users maps fields to UserRow (photoUrl → thumbnail)', async () => {
    send.mockResolvedValue({
      Items: [
        { userId: 'u1', email: 'a@a.com', displayName: 'Alice', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', photoUrl: 'https://cdn/a.jpg' },
      ],
    });
    const res = await handler(event('GET', '/users'));
    const body = JSON.parse(res.body ?? '{}');
    expect(body.users[0]).toEqual({
      userId: 'u1', displayName: 'Alice', email: 'a@a.com',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', thumbnail: 'https://cdn/a.jpg',
    });
  });
});
