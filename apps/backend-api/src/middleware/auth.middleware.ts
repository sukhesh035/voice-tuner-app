import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const verifier = CognitoJwtVerifier.create({
  userPoolId:  process.env['COGNITO_USER_POOL_ID']!,
  tokenUse:    'id',
  clientId:    process.env['COGNITO_CLIENT_ID']!,
});

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
    'Access-Control-Allow-Origin': process.env['CORS_ORIGIN'] ?? '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}
