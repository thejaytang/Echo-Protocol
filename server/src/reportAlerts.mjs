function sanitizeDestination(value) {
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

function safeError(error) {
  return String(error?.message || error || "report_alert_failed").slice(0, 160);
}

export function createReportAlertDispatcherFromEnv(env, { fetchImpl = globalThis.fetch } = {}) {
  const webhookUrl = String(env.REPORT_ALERT_WEBHOOK_URL || "").trim();
  const webhookSecret = String(env.REPORT_ALERT_WEBHOOK_SECRET || "").trim();
  const timeoutMs = Number(env.REPORT_ALERT_TIMEOUT_MS || 3000);
  const destination = sanitizeDestination(webhookUrl);

  return {
    describe() {
      return {
        configured: Boolean(webhookUrl),
        destination,
        timeoutMs,
      };
    },

    async notifyReportCreated({ report, blockRequested = false }) {
      if (!webhookUrl) {
        return { status: "disabled" };
      }
      if (!fetchImpl) {
        return { status: "failed", destination, error: "fetch_unavailable" };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const headers = {
        "Content-Type": "application/json",
        "User-Agent": "mirage-report-alert/1.0",
      };
      if (webhookSecret) {
        headers["X-Mirage-Alert-Secret"] = webhookSecret;
      }

      try {
        const response = await fetchImpl(webhookUrl, {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            type: "report.created",
            report: {
              id: report.id,
              status: report.status,
              reason: report.reason,
              reporterUserId: report.reporterUserId,
              targetUserId: report.targetUserId,
              roomId: report.roomId,
              gameId: report.gameId,
              messageId: report.messageId,
              blockRequested,
              createdAt: report.createdAt,
            },
          }),
        });
        if (!response.ok) {
          return { status: "failed", destination, statusCode: response.status, error: `webhook_${response.status}` };
        }
        return { status: "sent", destination, statusCode: response.status };
      } catch (error) {
        return { status: "failed", destination, error: safeError(error) };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
