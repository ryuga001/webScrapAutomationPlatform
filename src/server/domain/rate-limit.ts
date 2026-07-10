// Abstraction for request rate limiting. A strategy interface (like
// IPasswordHasher / ITokenService) so services depend on the behaviour, not a
// concrete in-memory / Redis implementation.

export interface IRateLimiter {
  /** Record a hit for `key`; throws RateLimitError when the quota is exceeded. */
  check(key: string): void;
}
