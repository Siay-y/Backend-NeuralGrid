import type { AccessTokenClaims } from '../dtos/access-token-payload';

export interface VerifiedAccessToken {
  claims: AccessTokenClaims;
  expiresAt: Date;
}

export abstract class AccessTokenVerifier {
  abstract verify(token: string): Promise<VerifiedAccessToken>;
}
