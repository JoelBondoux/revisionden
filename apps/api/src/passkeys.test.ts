import { describe, expect, it } from 'vitest';
import { createPasskeyService } from './passkeys';
import { TEST_CONFIG } from './test/helpers';
import { createSoftAuthenticator } from './test/soft-authenticator';

const service = createPasskeyService(TEST_CONFIG);
const device = () =>
  createSoftAuthenticator({ origin: TEST_CONFIG.webOrigin, rpId: TEST_CONFIG.passkeyRpId });

async function register(authenticator: ReturnType<typeof device>) {
  const options = await service.registrationOptions({ userId: 'student-1', userName: 'quiz_fox' });
  const credential = await service.verifyRegistration({
    response: authenticator.register(options),
    expectedChallenge: options.challenge,
  });
  return { options, credential };
}

describe('passkey service', () => {
  it('builds registration options for the web app as relying party', async () => {
    const options = await service.registrationOptions({
      userId: 'student-1',
      userName: 'quiz_fox',
    });
    expect(options.rp.id).toBe('dev.revisionden.test');
    expect(options.user.name).toBe('quiz_fox');
    expect(options.challenge.length).toBeGreaterThan(20);
    expect(options.authenticatorSelection?.userVerification).toBe('required');
  });

  it('verifies a new passkey and returns its public credential', async () => {
    const authenticator = device();
    const { credential } = await register(authenticator);
    expect(credential).toMatchObject({ credentialId: authenticator.credentialId, counter: 0 });
    expect(credential?.publicKey.length).toBeGreaterThan(40);
  });

  it('refuses a registration answering a different challenge', async () => {
    const authenticator = device();
    const options = await service.registrationOptions({ userId: 's', userName: 'n_n' });
    const other = await service.registrationOptions({ userId: 's', userName: 'n_n' });
    expect(
      await service.verifyRegistration({
        response: authenticator.register(other),
        expectedChallenge: options.challenge,
      }),
    ).toBeNull();
  });

  it('refuses a registration made on another website', async () => {
    const authenticator = device();
    const options = await service.registrationOptions({ userId: 's', userName: 'n_n' });
    expect(
      await service.verifyRegistration({
        response: authenticator.register(options, { origin: 'https://phish.test' }),
        expectedChallenge: options.challenge,
      }),
    ).toBeNull();
  });

  it('unlocks with the registered passkey and moves the counter on', async () => {
    const authenticator = device();
    const { credential } = await register(authenticator);
    const options = await service.authenticationOptions();
    const result = await service.verifyAuthentication({
      response: authenticator.authenticate(options),
      expectedChallenge: options.challenge,
      credential: credential!,
    });
    expect(result).toEqual({ newCounter: 1 });
  });

  it('refuses an unlock signed by a different passkey', async () => {
    const { credential } = await register(device());
    const impostor = device();
    const options = await service.authenticationOptions();
    expect(
      await service.verifyAuthentication({
        response: impostor.authenticate(options),
        expectedChallenge: options.challenge,
        credential: credential!,
      }),
    ).toBeNull();
  });
});
