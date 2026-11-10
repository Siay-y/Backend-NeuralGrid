export type DomainErrorCategory =
  'invalid' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict';

export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly category: DomainErrorCategory;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
