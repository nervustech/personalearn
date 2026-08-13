export function mapApiError(error: unknown): { message: string; status: number } {
  const message = error instanceof Error ? error.message : "Request failed";

  if (message === "Not authenticated") {
    return { message, status: 401 };
  }

  if (message === "Class not found" || message === "Conversation not found") {
    return { message, status: 403 };
  }

  return { message, status: 500 };
}
