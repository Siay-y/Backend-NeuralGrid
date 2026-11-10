import type { UserView } from '../../../users/application/dtos/user-view';

export type AuthenticatedUser = UserView;

export interface AuthSession {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthenticatedUser;
}
