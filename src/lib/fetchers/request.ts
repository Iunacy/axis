import { AppError } from "../errors";
export interface ImportOptions {
  signal?: AbortSignal;
  onRetry?: (seconds: number) => void;
}
export async function importRequest(url: string, options: ImportOptions = {}, headers?: HeadersInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    options.signal?.throwIfAborted();
    const response = await fetch(url, { headers, signal: AbortSignal.any([AbortSignal.timeout(30000), ...(options.signal ? [options.signal] : [])]) });
    if (response.ok) return response;
    if (response.status === 404) throw new AppError("syncUserNotFound");
    if (![429, 502, 503, 504].includes(response.status) || attempt >= 2) throw new AppError(response.status === 429 ? "syncRateLimit" : "network");
    const retry = response.headers.get("Retry-After");
    const seconds = retry ? (/^\d+$/.test(retry) ? Number(retry) : Math.ceil((Date.parse(retry) - Date.now()) / 1000)) : 2 ** (attempt + 1);
    // Do not retry before a long server-requested delay. The saved page can resume later.
    if (!Number.isFinite(seconds) || seconds > 60) throw new AppError("syncRateLimit");
    options.onRetry?.(Math.max(1, seconds));
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(options.signal?.reason ?? new DOMException("Cancelled", "AbortError")); };
      const timer = setTimeout(() => { options.signal?.removeEventListener("abort", abort); resolve(); }, Math.max(1, seconds) * 1000);
      options.signal?.addEventListener("abort", abort, { once: true });
      if (options.signal?.aborted) abort();
    });
  }
}
