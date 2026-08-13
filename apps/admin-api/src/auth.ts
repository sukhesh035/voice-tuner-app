import { CognitoJwtVerifier } from 'aws-jwt-verify';

// Mirrors apps/backend-api/src/middleware/auth.middleware.ts — the admin-api
// validates the same Cognito pool's ID tokens.
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env['COGNITO_USER_POOL_ID']!,
  tokenUse:   'id',
  clientId:   process.env['COGNITO_CLIENT_ID']!,
});

// The swara user pool is created with `signInAliases: { email: true }`, which
// sets `UsernameAttributes = ['email']`. Cognito therefore REQUIRES email
// usernames (verified empirically: `AdminCreateUser` with username
// `admin-service` fails with "Username should be an email") and stores a UUID
// as the internal `cognito:username` for every user, including service
// accounts created via AdminCreateUser. As a result `cognito:username` can NOT
// be used to identify the service account (the `cognito:username ===
// 'admin-service'` check used by the Sports Hub admin-api does not apply to
// this pool).
//
// The admin console's `swara-service-token` is an ID token minted for the swara
// `admin-service` service user. That user is provisioned with the reserved
// email `admin-service@swara.invalid` — the `.invalid` TLD is reserved by
// RFC 2606 and cannot receive mail, so no real user can ever register it. The
// ID token's `email` claim is therefore a fail-closed discriminator: only a
// token issued to the service account passes. This is what stops any logged-in
// app user from presenting their own token as an admin token.
const SERVICE_USER_EMAIL = 'admin-service@swara.invalid';

export async function verifyServiceToken(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false;
  try {
    const payload = await verifier.verify(authHeader.slice(7));
    return (payload as Record<string, unknown>)['email'] === SERVICE_USER_EMAIL;
  } catch {
    return false;
  }
}
