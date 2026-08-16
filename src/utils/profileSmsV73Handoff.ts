/**
 * Frontend → v73 handoff helper (Phase 1C).
 * Posts a window message for profile_sms_bridge.js (allowlisted origins).
 * Never sends user_id, password, or main JWT.
 */

export const PROFILE_SMS_HANDOFF_SOURCE = "profile-sms-web";
export const PROFILE_SMS_HANDOFF_TYPE = "PROFILE_SMS_BATCH_HANDOFF";

export type BatchHandoffPayload = {
  batch_id: number;
  handoff_token: string;
  requested_count?: number;
  total_links?: number;
  status?: string;
};

export type HandoffToExtensionResult = {
  ok: boolean;
  error?: string;
  timedOut?: boolean;
};

/**
 * Deliver batch capability to the installed v73 bridge.
 * Safe no-op failure if extension is missing (does not corrupt UI/batch).
 */
export function handoffBatchToV73Extension(
  payload: BatchHandoffPayload,
  opts?: { timeoutMs?: number }
): Promise<HandoffToExtensionResult> {
  const timeoutMs = opts?.timeoutMs ?? 2500;

  if (typeof window === "undefined") {
    return Promise.resolve({ ok: false, error: "no_window" });
  }

  const batchId = Number(payload.batch_id);
  const token = String(payload.handoff_token || "");
  if (!batchId || !token) {
    return Promise.resolve({ ok: false, error: "invalid_payload" });
  }

  return new Promise((resolve) => {
    let settled = false;
    const origin = window.location.origin;

    const onAck = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data;
      if (!data || data.source !== "profile-sms-v73-bridge") return;
      if (data.type !== "PROFILE_SMS_HANDOFF_ACK") return;
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onAck);
      window.clearTimeout(timer);
      resolve({
        ok: data.ok === true,
        error: data.error ? String(data.error) : undefined,
      });
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onAck);
      resolve({
        ok: false,
        timedOut: true,
        error: "extension_bridge_unavailable",
      });
    }, timeoutMs);

    window.addEventListener("message", onAck);

    // Strip any accidental sensitive fields — only allowlisted keys.
    window.postMessage(
      {
        source: PROFILE_SMS_HANDOFF_SOURCE,
        type: PROFILE_SMS_HANDOFF_TYPE,
        batch_id: batchId,
        handoff_token: token,
        requested_count: payload.requested_count ?? null,
        total_links: payload.total_links ?? null,
        status: payload.status ?? "queued",
      },
      origin
    );
  });
}
