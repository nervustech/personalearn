/** Deep-linkable split-pane review route (ADR-004 §6). */
export function scriptReviewPath(
  classId: string,
  assessmentId: string,
  scriptId: string
) {
  return `/classes/${classId}/assessments/${assessmentId}/review/${scriptId}`;
}
