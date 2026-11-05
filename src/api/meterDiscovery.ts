/** Private, short-lived discovery results. Never persisted or shared between accounts. */
export class MeterDiscoveryCache {
  private readonly entries = new Map<string, { serial: string; expiresAt: number }>();

  async select(
    mpan: string,
    serials: string[],
    signal: AbortSignal,
    discover: () => Promise<string>,
  ): Promise<string> {
    signal.throwIfAborted();
    const id = JSON.stringify([mpan, [...new Set(serials)].sort()]);
    const cached = this.entries.get(id);
    if (cached && cached.expiresAt > Date.now()) return cached.serial;
    this.entries.delete(id);
    // Do not share in-flight promises: each query owns its cancellation signal.
    const serial = await discover();
    signal.throwIfAborted();
    if (this.entries.size >= 16) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(id, { serial, expiresAt: Date.now() + 5 * 60_000 });
    return serial;
  }
}
