import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const verifier = CognitoJwtVerifier.create({
  userPoolId:  process.env['COGNITO_USER_POOL_ID']!,
  tokenUse:    'id',
  clientId:    process.env['COGNITO_CLIENT_ID']!,
});

// Allowed origins parsed once at cold start from comma-separated env var.
// If CORS_ORIGIN is '*' or unset, all origins are allowed.
const CORS_ORIGIN_RAW = process.env['CORS_ORIGIN'] ?? '*';
const ALLOWED_ORIGINS = CORS_ORIGIN_RAW === '*' ? null : CORS_ORIGIN_RAW.split(',').map(o => o.trim());

// Stores the current request's origin so response helpers can echo it back.
let _currentOrigin = '*';

export interface AuthContext {
  userId: string;
  email: string;
  username: string;
}

/** Call at the top of every handler to capture the request origin for CORS. */
export function setCorsOrigin(event: APIGatewayProxyEventV2): void {
  const origin = event.headers['origin'] ?? '';
  if (!ALLOWED_ORIGINS) {
    // Wildcard mode — echo the request origin (or '*' if none)
    _currentOrigin = origin || '*';
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    _currentOrigin = origin;
  } else {
    // Origin not in allow-list — use first allowed origin (preflight will block)
    _currentOrigin = ALLOWED_ORIGINS[0];
  }
}

export interface AuthContext {
  userId: string;
  email: string;
  username: string;
}

export async function verifyToken(event: APIGatewayProxyEventV2): Promise<AuthContext | null> {
  const authHeader = event.headers['authorization'] ?? event.headers['Authorization'];
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const payload = await verifier.verify(token);
    return {
      userId:   payload.sub,
      email:    (payload['email'] as string) ?? '',
      username: (payload['cognito:username'] as string) ?? '',
    };
  } catch {
    return null;
  }
}

export function unauthorized(): APIGatewayProxyResultV2 {
  return {
    statusCode: 401,
    headers: corsHeaders(),
    body: JSON.stringify({ error: 'Unauthorized' }),
  };
}

export function ok<T>(data: T): APIGatewayProxyResultV2 {
  return {
    statusCode: 200,
    headers: corsHeaders(),
    body: JSON.stringify(data),
  };
}

export function created<T>(data: T): APIGatewayProxyResultV2 {
  return {
    statusCode: 201,
    headers: corsHeaders(),
    body: JSON.stringify(data),
  };
}

export function badRequest(message: string): APIGatewayProxyResultV2 {
  return {
    statusCode: 400,
    headers: corsHeaders(),
    body: JSON.stringify({ error: message }),
  };
}

export function notFound(resource: string): APIGatewayProxyResultV2 {
  return {
    statusCode: 404,
    headers: corsHeaders(),
    body: JSON.stringify({ error: `${resource} not found` }),
  };
}

export function serverError(err: unknown): APIGatewayProxyResultV2 {
  console.error('[Lambda error]', err);
  return {
    statusCode: 500,
    headers: corsHeaders(),
    body: JSON.stringify({ error: 'Internal server error' }),
  };
}

function corsHeaders(): Record<string, string> {
  return {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': _currentOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}
