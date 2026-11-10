import { PasswordHasher } from '../application/ports/password-hasher';

export class FakePasswordHasher extends PasswordHasher {
  readonly verifiedHashes: string[] = [];

  hash(plain: string): Promise<string> {
    return Promise.resolve(`hashed:${plain}`);
  }

  verify(hash: string, plain: string): Promise<boolean> {
    this.verifiedHashes.push(hash);
    return Promise.resolve(hash === `hashed:${plain}`);
  }
}
