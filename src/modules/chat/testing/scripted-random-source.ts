import { RandomSource } from '../application/ports/random-source';

export class ScriptedRandomSource extends RandomSource {
  private cursor = 0;

  constructor(private readonly values: readonly number[]) {
    super();
  }

  integer(min: number, max: number): number {
    const value = this.values[this.cursor % this.values.length];
    this.cursor += 1;
    return Math.min(max, Math.max(min, value));
  }
}
