// java.util.Random (48-bit LCG), for vanilla-identical procedural visuals.
const MULT = 0x5DEECE66Dn;
const MASK = (1n << 48n) - 1n;

export class JavaRandom {
  constructor(seed = 0) { this.setSeed(seed); }
  setSeed(seed) { this.seed = (BigInt.asIntN(64, BigInt(seed)) ^ MULT) & MASK; }
  next(bits) {
    this.seed = (this.seed * MULT + 0xBn) & MASK;
    return Number(BigInt.asIntN(32, this.seed >> BigInt(48 - bits)));
  }
  nextInt(bound) {
    if (bound === undefined) return this.next(32);
    if ((bound & -bound) === bound) return Number((BigInt(bound) * BigInt(this.next(31))) >> 31n);
    let bits, val;
    do { bits = this.next(31); val = bits % bound; } while (bits - val + (bound - 1) < 0 || bits - val + (bound - 1) > 0x7fffffff);
    return val;
  }
  nextFloat() { return this.next(24) / (1 << 24); }
  nextDouble() { return ((this.next(26) * 134217728) + this.next(27)) / 9007199254740992; }
}
