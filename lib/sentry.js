/**
 * Sentry helpers — thin wrappers around @sentry/react-native.
 * Sentry.init() lives in _layout.jsx (set up by the Sentry wizard).
 *
 * Import these anywhere you want to report errors or add context.
 */
import * as Sentry from "@sentry/react-native";

/** Manually report a caught error (use inside catch blocks) */
export function captureException(error, context) {
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(error);
  });
}

/** Add a breadcrumb for important user actions (score events, game start, etc.) */
export function addBreadcrumb(category, message, data) {
  Sentry.addBreadcrumb({ category, message, data, level: "info" });
}

/** Set user context after login so crashes are attributed to a specific player */
export function setSentryUser(user) {
  Sentry.setUser(user ? { id: user._id || user.id, email: user.email } : null);
}
