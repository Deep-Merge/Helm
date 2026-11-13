/** Minimal Chrome extension API types for dashboard ↔ extension messaging. */
declare const chrome: {
  runtime?: {
    sendMessage?: (
      extensionId: string,
      message: unknown,
      callback?: (response: unknown) => void,
    ) => Promise<{ ok?: boolean } | undefined>;
    lastError?: { message?: string };
  };
};
