/**
 * Where the definition layer reports a problem it can survive.
 *
 * The predecessor wrote straight to `console.warn` and deduped through a
 * module-global `warnOnce` set, which made warnings invisible to the UI,
 * un-assertable in tests, and stateful across a session. A sink passed in by
 * the caller fixes all three, and leaves where a message GOES to whoever knows
 * — a settings page listing what is wrong with a system, a render path, a test.
 *
 * The render path's sink will need to dedup, since a card note re-renders on
 * every keystroke in an open preview. It arrives with that render path.
 */
export interface Diagnostics {
  /** Something is wrong with the declaration, but the result is still usable. */
  warn(message: string): void;
}

/** A sink that records, for tests and for surfaces that want to show a list. */
export interface CollectedDiagnostics extends Diagnostics {
  /** Every message reported, in order, duplicates included. */
  readonly messages: readonly string[];
  /** The messages containing `needle`, for asserting without quoting in full. */
  matching(needle: string): string[];
}

export function collectDiagnostics(): CollectedDiagnostics {
  const messages: string[] = [];
  return {
    messages,
    warn(message) {
      messages.push(message);
    },
    matching(needle) {
      return messages.filter((m) => m.includes(needle));
    },
  };
}

/** A sink for callers that genuinely have nowhere to put the message. */
export const IGNORE_DIAGNOSTICS: Diagnostics = { warn() {} };
