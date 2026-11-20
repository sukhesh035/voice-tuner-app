import { CognitoJwtVerifier } from 'aws-jwt-verify';

// The admin console authenticates with OAuth client credentials. Its access
// token carries the custom `admin-api/read` scope configured on this pool's
// resource server, so checking that scope is what makes this service-to-service
// — no human user or expiring ID token is involved.
const accessVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env['COGNITO_USER_POOL_ID']!,
  tokenUse:   'access',
  // Any client scoped to `admin-api/read` may call; the scope check below is
  // the authorization boundary, so the client id claim is not pinned here.
  clientId:   null,
});

// Legacy path: before the client-credentials rollout the console signed in as
// the `admin-service` user and sent its ID token. Kept only until the console
// is deployed with M2M; remove then.
const idVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env['COGNITO_USER_POOL_ID']!,
  tokenUse:   'id',
  clientId:   process.env['COGNITO_CLIENT_ID']!,
});

const ADMIN_SCOPE = 'admin-api/read';

// The swara pool uses email-as-username and stores a UUID as `cognito:username`,
// so the service account is identified by its reserved `.invalid` email
// (RFC 2606: no real user can register it).
const SERVICE_USER_EMAIL = 'admin-service@swara.invalid';

export async function verifyServiceToken(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);

  try {
    const payload = await accessVerifier.verify(token);
    const scope = String((payload as Record<string, unknown>)['scope'] ?? '');
    return scope.split(' ').includes(ADMIN_SCOPE);
  } catch {
    // Fall through to the legacy ID-token check.
  }

  try {
    const payload = await idVerifier.verify(token);
    return (payload as Record<string, unknown>)['email'] === SERVICE_USER_EMAIL;
  } catch {
    return false;
  }
}
