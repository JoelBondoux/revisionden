import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { AppConfig } from './env';

/** The public half of a passkey, as stored in `devices`. */
export interface StoredCredential {
  credentialId: string;
  /** COSE public key, base64url. */
  publicKey: string;
  counter: number;
  transports?: string[] | null;
}

export interface PasskeyService {
  registrationOptions(input: {
    userId: string;
    userName: string;
  }): Promise<PublicKeyCredentialCreationOptionsJSON>;
  verifyRegistration(input: {
    response: RegistrationResponseJSON;
    expectedChallenge: string;
  }): Promise<StoredCredential | null>;
  authenticationOptions(input?: {
    credentialIds?: string[];
    /** E10: ask the browser to offer a phone first (WebAuthn hybrid, shown as a QR code). */
    usePhone?: boolean;
  }): Promise<PublicKeyCredentialRequestOptionsJSON>;
  verifyAuthentication(input: {
    response: AuthenticationResponseJSON;
    expectedChallenge: string;
    credential: StoredCredential;
  }): Promise<{ newCounter: number } | null>;
}

const toB64url = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64url = (value: string) => {
  const s = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

/**
 * WebAuthn for student devices. The web app is the relying party (its host is the RP id and its
 * origin the expected origin). A failed check returns null rather than throwing.
 */
export function createPasskeyService(config: AppConfig): PasskeyService {
  const rpID = config.passkeyRpId;
  const expectedOrigin = config.webOrigin;

  return {
    registrationOptions({ userId, userName }) {
      return generateRegistrationOptions({
        rpName: 'RevisionDen',
        rpID,
        userName,
        userID: Uint8Array.from(new TextEncoder().encode(userId)),
        attestationType: 'none',
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      });
    },

    async verifyRegistration({ response, expectedChallenge }) {
      try {
        const result = await verifyRegistrationResponse({
          response,
          expectedChallenge,
          expectedOrigin,
          expectedRPID: rpID,
          requireUserVerification: true,
        });
        if (!result.verified) return null;
        const { credential } = result.registrationInfo;
        return {
          credentialId: credential.id,
          publicKey: toB64url(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports ?? null,
        };
      } catch {
        return null;
      }
    },

    async authenticationOptions({ credentialIds, usePhone } = {}) {
      // No transports on the allow list: a filter there could leave out the phone (hybrid).
      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: 'required',
        allowCredentials: credentialIds?.map((id) => ({ id })),
      });
      return usePhone ? { ...options, hints: ['hybrid'] } : options;
    },

    async verifyAuthentication({ response, expectedChallenge, credential }) {
      try {
        const result = await verifyAuthenticationResponse({
          response,
          expectedChallenge,
          expectedOrigin,
          expectedRPID: rpID,
          requireUserVerification: true,
          credential: {
            id: credential.credentialId,
            publicKey: fromB64url(credential.publicKey),
            counter: credential.counter,
            transports: (credential.transports ?? undefined) as
              AuthenticatorTransport[] | undefined,
          },
        });
        return result.verified ? { newCounter: result.authenticationInfo.newCounter } : null;
      } catch {
        return null;
      }
    },
  };
}
