// The OpenRouter connection (Q3), shared by Settings' sheet and onboarding's
// key screen: Connect OpenRouter (sign in in the browser), what is saved
// (the masked key), Disconnect, Add credits, and "Paste a key instead" for
// when the browser can't come back.

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { commands } from "../bindings";
import type { CreditView_Serialize } from "../bindings";
import { BROKEN, messageOf } from "../messages";
import { validateKey } from "../validation";
import { PROVIDER_NAME } from "./modelRow";

/** Shown once the key is saved. */
export const CONNECTED = "✓ Connected to OpenRouter";
/** What the first screen says before the button (owner-approved, Q3). */
export const EXPLAINER =
  "Vocet uses your OpenRouter account. You pay OpenRouter directly for what you use; new accounts need a few dollars of credit.";
/** A good key the Keychain wouldn't keep. */
export const KEY_NOT_SAVED = "Key works, but couldn't be saved to your Keychain";

/** How long the browser sign-in waits before it offers "Paste a key instead". */
export const PASTE_AFTER_MS = 10_000;

export type Status =
  | { state: "checking" }
  | { state: "none" }
  | { state: "connected"; hint: string }
  | { state: "error"; message: string };

type Notice = { kind: "ok" | "error"; text: string } | null;
type Busy = "connecting" | "saving" | "disconnecting" | null;

interface Options {
  /** A key was saved (by sign-in or paste). */
  onConnected?: () => Promise<void>;
  /** Reads the engine's status again. */
  refreshEngine: () => Promise<void>;
}

/** The connection's state and actions. */
export function useConnection({ onConnected, refreshEngine }: Options) {
  const [status, setStatus] = useState<Status>({ state: "checking" });
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<Busy>(null);
  // Only the newest status lookup counts.
  const lookup = useRef(0);
  // The user pressed Cancel: the attempt's "cancelled" is not an error.
  const cancelled = useRef(false);
  // The browser sign-in has waited a while, or an attempt failed or was
  // cancelled: only then is "Paste a key instead" offered (the fallback for a
  // browser that can't reach the app). Stays until a key is saved.
  const [slow, setSlow] = useState(false);
  const [troubled, setTroubled] = useState(false);
  useEffect(() => {
    if (busy !== "connecting") return;
    const timer = window.setTimeout(() => {
      setSlow(true);
    }, PASTE_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
      setSlow(false);
    };
  }, [busy]);

  const refresh = useCallback(async () => {
    lookup.current += 1;
    const run = lookup.current;
    let next: Status;
    try {
      const hint = await commands.savedKeyHint();
      if (hint.status === "error") {
        next = { state: "error", message: messageOf(hint.error) };
      } else if (hint.data === null) {
        next = { state: "none" };
      } else {
        next = { state: "connected", hint: hint.data };
      }
    } catch {
      next = { state: "error", message: BROKEN };
    }
    if (run === lookup.current) setStatus(next);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [refresh]);

  async function saved() {
    setTroubled(false);
    setNotice({ kind: "ok", text: CONNECTED });
    await refresh();
    await onConnected?.();
    await refreshEngine();
  }

  // Read through a function: the flag changes while the attempt is awaited.
  const wasCancelled = () => cancelled.current;

  async function connect() {
    if (busy !== null) return;
    cancelled.current = false;
    setNotice(null);
    setBusy("connecting");
    let failed: string | null = null;
    try {
      const result = await commands.connectOpenrouter();
      if (result.status === "error") failed = messageOf(result.error);
    } catch {
      failed = BROKEN;
    }
    // A pasted key may have taken over while the sign-in waited: its own
    // "saving" stays.
    setBusy((now) => (now === "connecting" ? null : now));
    if (failed === null) {
      await saved();
    } else {
      setTroubled(true);
      if (!wasCancelled()) setNotice({ kind: "error", text: failed });
    }
  }

  /** Cancels the wait. `false` if it was too late: the key is being saved. */
  async function cancel(): Promise<boolean> {
    cancelled.current = true;
    try {
      const result = await commands.cancelConnect();
      if (result.status === "ok" && !result.data) {
        // The key has already arrived and is being saved, which always
        // finishes: say so, keep the exits shut, and report how it ends.
        cancelled.current = false;
        setBusy((now) => (now === "connecting" ? "saving" : now));
        return false;
      }
    } catch {
      // The attempt ends by itself at its own deadline.
    }
    return true;
  }

  /**
   * Every way out (Done, Esc, Back, "this Mac only") asks this first: a sign-in
   * still waiting is cancelled, and the answer says whether leaving is safe.
   * `false` while a key is being saved: stay, the window shows the outcome.
   */
  async function canLeave(): Promise<boolean> {
    if (busy === "saving" || busy === "disconnecting") return false;
    if (busy === "connecting") return await cancel();
    return true;
  }

  /** "Paste a key instead": tested, then saved only if it works. */
  async function pasteKey(typed: string) {
    // The link comes up while the browser sign-in waits: a pasted key ends that
    // wait (unless its key has arrived: then that one is being saved).
    if (busy !== null && busy !== "connecting") return;
    const key = typed.trim();
    const problem = validateKey(key);
    if (problem !== null) {
      setNotice({ kind: "error", text: problem });
      return;
    }
    if (busy === "connecting" && !(await cancel())) return;
    setNotice(null);
    setBusy("saving");
    let failed: string | null = null;
    try {
      const tested = await commands.testApiKey(key);
      if (tested.status === "error") {
        failed = tested.error;
      } else {
        const stored = await commands.setApiKey(key);
        if (stored.status === "error") failed = `${KEY_NOT_SAVED}: ${messageOf(stored.error)}`;
      }
    } catch {
      failed = BROKEN;
    }
    setBusy(null);
    if (failed === null) {
      await saved();
    } else {
      setTroubled(true);
      setNotice({ kind: "error", text: failed });
    }
  }

  async function disconnect() {
    if (busy !== null) return;
    setNotice(null);
    setBusy("disconnecting");
    let failed: string | null = null;
    try {
      const result = await commands.deleteApiKey();
      if (result.status === "error") failed = messageOf(result.error);
    } catch {
      failed = BROKEN;
    }
    setBusy(null);
    setNotice(
      failed === null
        ? { kind: "ok", text: "Disconnected. The key is removed." }
        : { kind: "error", text: failed },
    );
    await refresh();
    await refreshEngine();
  }

  function addCredits() {
    void commands.openLink("openrouter_credits").catch(() => undefined);
  }

  return {
    status,
    notice,
    busy,
    /** "Paste a key instead" may be offered. */
    canPaste: slow || troubled,
    /** The last sign-in or paste worked in this panel. */
    justConnected: notice?.text === CONNECTED,
    connect,
    cancel,
    canLeave,
    pasteKey,
    disconnect,
    addCredits,
    refresh,
    clearNotice: () => {
      setNotice(null);
    },
  };
}

export type Connection = ReturnType<typeof useConnection>;

/**
 * "Key ending 1161", from the masked hint ("sk-or-…1161"): enough to find the
 * key in OpenRouter's key list and revoke it. `null` if the hint shows none.
 */
export function keyEnding(hint: string): string | null {
  const tail = hint.split("…")[1] ?? "";
  return tail === "" ? null : `Key ending ${tail}`;
}

/** "$4.82": dollars and cents. */
export function dollars(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * The credit left, as short lines for the connected state: "$4.82 left" and,
 * if the key has its own spending limit, "Spending limit: $3.25 left". Empty
 * when OpenRouter said nothing.
 */
export function creditLines(credit: CreditView_Serialize | null): string[] {
  const lines: string[] = [];
  if (credit?.balance != null) lines.push(`${dollars(credit.balance)} left`);
  if (credit?.key_limit_left != null) {
    lines.push(`Spending limit: ${dollars(credit.key_limit_left)} left`);
  }
  return lines;
}

/**
 * OpenRouter's credit for the saved key (TOS1): asked once `connected`, and
 * again whenever the window gets focus back (after "Add credits" in the
 * browser). `null` while unknown, slow or refused: the screen then shows
 * nothing, and nothing waits for it.
 */
export function useCredit(connected: boolean): CreditView_Serialize | null {
  const [credit, setCredit] = useState<CreditView_Serialize | null>(null);
  // Only the newest answer counts.
  const lookup = useRef(0);
  const ask = useCallback(async () => {
    lookup.current += 1;
    const run = lookup.current;
    let found: CreditView_Serialize | null = null;
    try {
      const result = await commands.openrouterCredits();
      if (result.status === "ok") found = result.data;
    } catch {
      // No amount shown.
    }
    // A failed refresh keeps the last amount: it is still the best answer.
    if (run === lookup.current && found !== null) setCredit(found);
  }, []);
  useEffect(() => {
    if (!connected) {
      lookup.current += 1;
      const clear = window.setTimeout(() => {
        setCredit(null);
      }, 0);
      return () => {
        window.clearTimeout(clear);
      };
    }
    const first = window.setTimeout(() => void ask(), 0);
    const onFocus = () => void ask();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(first);
      window.removeEventListener("focus", onFocus);
    };
  }, [connected, ask]);
  return credit;
}

/**
 * What the last attempt said, and why the saved key couldn't be read. Both
 * screens show "✓ Connected" themselves, so that notice isn't repeated here.
 */
export function ConnectNotices({ connection }: { connection: Connection }) {
  const { status, notice } = connection;
  return (
    <>
      {notice !== null && notice.text !== CONNECTED && (
        <p
          id="connect-notice"
          role={notice.kind === "error" ? "alert" : "status"}
          className={`notice ${notice.kind}`}
        >
          {notice.text}
        </p>
      )}
      {status.state === "error" && (
        <p role="alert" className="notice error">
          Couldn&apos;t check for a saved key: {status.message}
        </p>
      )}
    </>
  );
}

/**
 * "Having trouble? Paste a key instead": a small link that opens the key
 * field. Only once the browser sign-in is slow or has failed (`canPaste`).
 */
export function PasteKey({ connection }: { connection: Connection }) {
  const { busy } = connection;
  const [pasting, setPasting] = useState(false);
  const [typed, setTyped] = useState("");
  // Pasting is allowed while the sign-in waits: it ends the wait.
  const working = busy !== null && busy !== "connecting";
  if (!connection.canPaste) return null;
  return pasting ? (
    <div className="panel-row">
      <label htmlFor="api-key">{PROVIDER_NAME} API key</label>
      <input
        id="api-key"
        type="password"
        value={typed}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Paste your key"
        readOnly={busy === "saving"}
        onChange={(event) => {
          setTyped(event.target.value);
          connection.clearNotice();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") void connection.pasteKey(typed);
        }}
      />
      <button
        type="button"
        disabled={working}
        onClick={() => {
          void connection.pasteKey(typed).then(() => {
            setTyped("");
          });
        }}
      >
        {busy === "saving" ? "Saving…" : "Test & Save"}
      </button>
    </div>
  ) : (
    <p className="hint">
      Having trouble?{" "}
      <button
        type="button"
        className="link"
        onClick={() => {
          setPasting(true);
        }}
      >
        Paste a key instead
      </button>
    </p>
  );
}

/**
 * Settings' panel, the same two states as setup's Connect screen. Connected:
 * "✓ Connected to OpenRouter", the credit left, Add credits and Disconnect
 * (Disconnect, then Connect again, is how to reconnect). Not connected: the
 * explainer and one Connect OpenRouter button; "Paste a key instead" comes
 * only when the sign-in is slow or failed.
 */
export function ConnectPanel({ connection }: { connection: Connection }) {
  const { status, busy } = connection;
  const connected = status.state === "connected";
  const working = busy !== null;
  const lines = creditLines(useCredit(connected));
  const ending = status.state === "connected" ? keyEnding(status.hint) : null;
  return (
    <div className="own-key-panel" id="connect-panel">
      {connected ? (
        <>
          <p id="connect-status" className="own-key-connected" role="status">
            {CONNECTED}
          </p>
          {lines.length > 0 && (
            <p id="connect-credit" className="hint">
              {lines.join(" · ")}
            </p>
          )}
          {ending !== null && <p className="hint">{ending}</p>}
        </>
      ) : (
        <p className="hint">{EXPLAINER}</p>
      )}
      <div className="row own-key-actions">
        {connected ? (
          <>
            <button type="button" onClick={connection.addCredits}>
              Add credits
            </button>
            <button
              type="button"
              className="destructive"
              disabled={working}
              onClick={() => void connection.disconnect()}
            >
              {busy === "disconnecting" ? "Disconnecting…" : "Disconnect"}
            </button>
          </>
        ) : busy === "connecting" ? (
          <>
            <span role="status">Waiting for OpenRouter in your browser…</span>
            <button type="button" onClick={() => void connection.cancel()}>
              Cancel
            </button>
          </>
        ) : busy === "saving" ? (
          <span role="status">Saving your key…</span>
        ) : (
          <button
            type="button"
            className="primary"
            disabled={working || status.state === "checking"}
            onClick={() => void connection.connect()}
          >
            Connect OpenRouter
          </button>
        )}
        {status.state === "error" && (
          <button type="button" onClick={() => void connection.refresh()}>
            Retry
          </button>
        )}
      </div>
      <ConnectNotices connection={connection} />
      {!connected && <PasteKey connection={connection} />}
    </div>
  );
}

/**
 * The connection as a sheet over the window (U12): modal, Tab stays inside,
 * Esc and Done close it, except while a key is being written.
 */
export function ConnectSheet({
  connection,
  onDone,
}: {
  connection: Connection;
  onDone: () => void;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const writing = connection.busy === "saving" || connection.busy === "disconnecting";
  useEffect(() => {
    sheet.current?.querySelector<HTMLElement>("button.primary")?.focus();
  }, []);
  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!writing) onDone();
    } else if (event.key === "Tab") {
      const focusable = [
        ...(sheet.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input, select:not(:disabled)",
        ) ?? []),
      ];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
  return (
    <>
      <div className="confirm-backdrop" />
      <div
        ref={sheet}
        className="key-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="key-sheet-title"
        onKeyDown={onKey}
      >
        <h2 id="key-sheet-title">OpenRouter</h2>
        <ConnectPanel connection={connection} />
        <div className="confirm-actions">
          <button type="button" disabled={writing} onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}
