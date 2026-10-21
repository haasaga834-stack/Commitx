export type AnalyticsProps = Record<string, string | number | boolean | null>;
const allowed = new Set(["mode", "duration_bucket", "kind", "platform", "status", "reason", "method"]);

export function safeAnalyticsProps(props?: AnalyticsProps): AnalyticsProps {
  return Object.fromEntries(Object.entries(props ?? {}).filter(([key, value]) =>
    allowed.has(key) && (typeof value !== "string" || /^[a-zA-Z0-9_<>=+ -]{1,64}$/.test(value))));
}

export function redactAnalyticsEvent<T extends { properties?: Record<string, unknown> }>(event: T | null): T | null {
  if (!event?.properties) return event;
  for (const key of ["$current_url", "$referrer", "$pathname", "$initial_current_url", "$initial_referrer", "$initial_pathname"]) {
    if (key in event.properties) event.properties[key] = "[redacted]";
  }
  for (const key of Object.keys(event.properties)) {
    if (key.startsWith("$exception") || /email|goal|name|search|query|token/i.test(key)) delete event.properties[key];
  }
  return event;
}