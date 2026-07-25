interface Listener {
  afterSequence: number;
  resolve: () => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

export class EventNotifier {
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly latest = new Map<string, number>();

  publish(runId: string, sequenceNumber: number): void {
    this.latest.set(runId, Math.max(sequenceNumber, this.latest.get(runId) ?? 0));
    const listeners = this.listeners.get(runId);
    if (listeners === undefined) return;
    for (const listener of [...listeners]) {
      if (sequenceNumber > listener.afterSequence) this.finish(runId, listener);
    }
  }

  wait(runId: string, afterSequence: number, signal?: AbortSignal): Promise<void> {
    if ((this.latest.get(runId) ?? 0) > afterSequence || signal?.aborted === true) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const listener: Listener = {
        afterSequence,
        resolve,
        ...(signal === undefined ? {} : { signal }),
      };
      const onAbort = () => this.finish(runId, listener);
      listener.onAbort = onAbort;
      const listeners = this.listeners.get(runId) ?? new Set<Listener>();
      listeners.add(listener);
      this.listeners.set(runId, listeners);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  private finish(runId: string, listener: Listener): void {
    const listeners = this.listeners.get(runId);
    listeners?.delete(listener);
    if (listeners?.size === 0) this.listeners.delete(runId);
    if (listener.signal !== undefined && listener.onAbort !== undefined) {
      listener.signal.removeEventListener('abort', listener.onAbort);
    }
    listener.resolve();
  }
}
