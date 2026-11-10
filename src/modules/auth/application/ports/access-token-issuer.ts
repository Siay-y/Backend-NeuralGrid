import type { AccessTokenClaims } from '../dtos/access-token-payload';

export interface IssuedAccessToken {
  token: string;
  expiresIn: number;
}

export abstract class AccessTokenIssuer {
  abstract issue(claims: AccessTokenClaims): Promise<IssuedAccessToken>;
}
