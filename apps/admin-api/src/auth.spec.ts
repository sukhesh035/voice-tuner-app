import { verifyServiceToken } from './auth';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: { create: jest.fn(() => ({ verify: jest.fn() })) },
}));

const createMock = CognitoJwtVerifier.create as jest.Mock;
const verifyMock = createMock.mock.results[0]!.value.verify as jest.Mock;

describe('verifyServiceToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts a valid ID token belonging to the admin-service service user', async () => {
    verifyMock.mockResolvedValue({ email: 'admin-service@swara.invalid' });
    await expect(verifyServiceToken('Bearer token')).resolves.toBe(true);
  });

  it('rejects a valid ID token belonging to any other user', async () => {
    verifyMock.mockResolvedValue({ email: 'player@gmail.com' });
    await expect(verifyServiceToken('Bearer token')).resolves.toBe(false);
  });

  it('rejects a valid token that carries no email claim', async () => {
    verifyMock.mockResolvedValue({ sub: 'uuid', 'cognito:username': 'admin-service' });
    await expect(verifyServiceToken('Bearer token')).resolves.toBe(false);
  });

  it('rejects when the token is invalid or verification throws', async () => {
    verifyMock.mockRejectedValue(new Error('invalid token'));
    await expect(verifyServiceToken('Bearer token')).resolves.toBe(false);
  });

  it('rejects missing or non-Bearer authorization headers without verifying', async () => {
    await expect(verifyServiceToken(undefined)).resolves.toBe(false);
    await expect(verifyServiceToken('Basic abc')).resolves.toBe(false);
    expect(verifyMock).not.toHaveBeenCalled();
  });
});
