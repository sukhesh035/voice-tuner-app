import { verifyServiceToken } from './auth';
import * as jwtVerify from 'aws-jwt-verify';

jest.mock('aws-jwt-verify', () => {
  const accessVerify = jest.fn();
  const idVerify = jest.fn();
  return {
    __accessVerify: accessVerify,
    __idVerify: idVerify,
    CognitoJwtVerifier: {
      create: jest.fn((opts: { tokenUse: string }) => ({
        verify: opts.tokenUse === 'access' ? accessVerify : idVerify,
      })),
    },
  };
});

const accessVerify = (jwtVerify as unknown as { __accessVerify: jest.Mock }).__accessVerify;
const idVerify = (jwtVerify as unknown as { __idVerify: jest.Mock }).__idVerify;

describe('verifyServiceToken', () => {
  beforeEach(() => {
    accessVerify.mockReset();
    idVerify.mockReset();
  });

  it('accepts an access token carrying the admin-api/read scope', async () => {
    accessVerify.mockResolvedValue({ scope: 'admin-api/read' });
    await expect(verifyServiceToken('Bearer token')).resolves.toBe(true);
    expect(idVerify).not.toHaveBeenCalled();
  });

  it('rejects an access token without the admin-api/read scope', async () => {
    accessVerify.mockResolvedValue({ scope: 'admin-api/write' });
    idVerify.mockRejectedValue(new Error('not an ID token'));
    await expect(verifyServiceToken('Bearer token')).resolves.toBe(false);
  });

  it('accepts a legacy admin-service ID token during the rollout', async () => {
    accessVerify.mockRejectedValue(new Error('not an access token'));
    idVerify.mockResolvedValue({ email: 'admin-service@swara.invalid' });
    await expect(verifyServiceToken('Bearer token')).resolves.toBe(true);
  });

  it('rejects a legacy ID token belonging to any other user', async () => {
    accessVerify.mockRejectedValue(new Error('not an access token'));
    idVerify.mockResolvedValue({ email: 'player@gmail.com' });
    await expect(verifyServiceToken('Bearer token')).resolves.toBe(false);
  });

  it('rejects when both verifications throw', async () => {
    accessVerify.mockRejectedValue(new Error('invalid token'));
    idVerify.mockRejectedValue(new Error('invalid token'));
    await expect(verifyServiceToken('Bearer token')).resolves.toBe(false);
  });

  it('rejects missing or non-Bearer authorization headers without verifying', async () => {
    await expect(verifyServiceToken(undefined)).resolves.toBe(false);
    await expect(verifyServiceToken('Basic abc')).resolves.toBe(false);
    expect(accessVerify).not.toHaveBeenCalled();
    expect(idVerify).not.toHaveBeenCalled();
  });
});
