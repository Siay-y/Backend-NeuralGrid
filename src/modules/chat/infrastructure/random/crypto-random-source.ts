import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { RandomSource } from '../../application/ports/random-source';

// Rolls come from the OS CSPRNG through randomInt, which also avoids modulo
// bias, so no player can predict or skew a result from previous ones.
@Injectable()
export class CryptoRandomSource extends RandomSource {
  integer(min: number, max: number): number {
    return randomInt(min, max + 1);
  }
}
