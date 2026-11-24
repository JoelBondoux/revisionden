/**
 * A software passkey authenticator for tests: produces real WebAuthn registration and
 * authentication responses (P-256, "none" attestation) so the server's verification runs for
 * real. Test-only; never used in the app.
 */
import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';
import { isoCBOR } from '@simplewebauthn/server/helpers';

const b64url = (b: Uint8Array | Buffer) => Buffer.from(b).toString('base64url');
const sha256 = (b: Uint8Array | Buffer | string) => createHash('sha256').update(b).digest();
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};

export interface SoftAuthenticatorOptions {
  origin: string;
  rpId: string;
}

export function createSoftAuthenticator({ origin, rpId }: SoftAuthenticatorOptions) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const credentialId = randomBytes(16);
  let signCount = 0;

  function coseKey(key: KeyObject): Uint8Array {
    const jwk = key.export({ format: 'jwk' });
    return isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2], // kty: EC2
        [3, -7], // alg: ES256
        [-1, 1], // crv: P-256
        [-2, Buffer.from(jwk.x!, 'base64url')],
        [-3, Buffer.from(jwk.y!, 'base64url')],
      ]),
    );
  }

  function clientData(type: string, challenge: string, overrideOrigin?: string) {
    return Buffer.from(
      JSON.stringify({ type, challenge, origin: overrideOrigin ?? origin, crossOrigin: false }),
    );
  }

  return {
    credentialId: b64url(credentialId),

    /** Answers `navigator.credentials.create()` for the given server options. */
    register(options: { challenge: string }, overrides: { origin?: string } = {}) {
      const clientDataJSON = clientData('webauthn.create', options.challenge, overrides.origin);
      const idLen = Buffer.alloc(2);
      idLen.writeUInt16BE(credentialId.length);
      const authData = Buffer.concat([
        sha256(rpId),
        Buffer.from([0x45]), // user present + user verified + attested credential data
        u32(signCount),
        Buffer.alloc(16), // AAGUID
        idLen,
        credentialId,
        Buffer.from(coseKey(publicKey)),
      ]);
      const attestationObject = isoCBOR.encode(
        new Map<string, unknown>([
          ['fmt', 'none'],
          ['attStmt', new Map()],
          ['authData', authData],
        ]) as never,
      );
      return {
        id: b64url(credentialId),
        rawId: b64url(credentialId),
        type: 'public-key' as const,
        response: {
          clientDataJSON: b64url(clientDataJSON),
          attestationObject: b64url(attestationObject),
          transports: ['internal' as const],
        },
        clientExtensionResults: {},
      };
    },

    /** Answers `navigator.credentials.get()` for the given server options. */
    authenticate(options: { challenge: string }, overrides: { origin?: string } = {}) {
      signCount += 1;
      const clientDataJSON = clientData('webauthn.get', options.challenge, overrides.origin);
      const authenticatorData = Buffer.concat([sha256(rpId), Buffer.from([0x05]), u32(signCount)]);
      const signature = sign('sha256', Buffer.concat([authenticatorData, sha256(clientDataJSON)]), {
        key: privateKey,
        dsaEncoding: 'der',
      });
      return {
        id: b64url(credentialId),
        rawId: b64url(credentialId),
        type: 'public-key' as const,
        response: {
          clientDataJSON: b64url(clientDataJSON),
          authenticatorData: b64url(authenticatorData),
          signature: b64url(signature),
        },
        clientExtensionResults: {},
      };
    },
  };
}
