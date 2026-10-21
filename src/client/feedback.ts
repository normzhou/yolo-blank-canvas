/**
 * Text-only app context for a request (#169).
 *
 * The app is part of the location, so a request composed over it says which
 * app it came from. The context is a visible, editable body line rather than a
 * label or hidden metadata: GitHub remains the single record, and the line can
 * be read or changed directly in the issue.
 */
export function appContextLine(app: { id: string; title: string }): string {
  return `App: ${app.title} (?app=${app.id})`;
}

/** The composer's initial body for app-scoped feedback. */
export function feedbackBody(app: { id: string; title: string }): string {
  return `${appContextLine(app)}\n\n`;
}
