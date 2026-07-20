/** Minimal Chrome extension API types for dashboard ↔ extension messaging. */
declare const chrome: {
  runtime?: {
    sendMessage?: (
      extensionId: string,
      message: unknown,
    ) => Promise<{ ok?: boolean } | undefined>;
  };
};
