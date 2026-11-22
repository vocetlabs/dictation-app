// U8, TOS1: the four onboarding steps, with the app's commands replaced by a fake
// backend through `mockIPC` that keeps the step and refuses to skip one, as
// the app does. The keys here are made up.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LocalModelInfo_Serialize,
  OnboardingStatus,
  PermissionStatus,
  Settings_Serialize,
  Step,
  Transcription,
  View,
} from "./bindings";
import { App } from "./App";
import { Onboarding, RELAUNCH_AFTER_POLLS, STEPS } from "./Onboarding";
import css from "./settings.css?raw";
import {
  KEY_POINTS,
  KEY_REASON,
  KEY_SAVED,
  KEY_SUMMARY,
  MODEL_SUMMARY,
  OPENROUTER_EXPLAINER,
  SpeechStep,
  modelPoints,
} from "./onboarding/SpeechStep";
import { PASTE_AFTER_MS } from "./settings/connection";
import {
  ASKED_AGAIN,
  BOTH_REASON,
  BOTH_REASON_DONE,
  OLD_ROW_LEAD,
  OLD_ROW_STEPS,
} from "./onboarding/PermissionsStep";
import { PRACTICE_WORDS } from "./onboarding/TryStep";
import { Privacy } from "./settings/Privacy";
import { keyDown, keyUp, releaseAllKeys } from "./testKeys";

const KEY = "sk-or-dummy-NOT-A-REAL-KEY-0123456789";
const ORDER: Step[] = ["welcome", "speech", "permissions", "try"];

const PARAKEET: LocalModelInfo_Serialize = {
  id: "parakeet-unified-en-0.6b-q4_k_m",
  name: "Parakeet Unified 0.6B",
  languages: "English only",
  size_bytes: 477_000_000,
  downloaded_bytes: 0,
  state: "missing",
  error: null,
  default: true,
  resumed_from_bytes: null,
  restarted: false,
};

const GEMMA: LocalModelInfo_Serialize = {
  id: "gemma-4-e2b-it-q4_k_m",
  name: "Gemma 4 E2B",
  languages: "English only",
  size_bytes: 3_106_738_272,
  downloaded_bytes: 0,
  state: "missing",
  error: null,
  default: true,
  resumed_from_bytes: null,
  restarted: false,
};

interface Call {
  command: string;
  args: Record<string, unknown>;
}

/** The app's side: permissions, the step it keeps, keys, settings and models. */
class Backend {
  view: View = "onboarding";
  step: Step = "welcome";
  welcomePassed = false;
  microphone: PermissionStatus = "not_determined";
  accessibility: PermissionStatus = "not_determined";
  needsRelaunch = false;
  askedAgain = false;
  acceptedTerms = false;
  /** The server answers a resume with the whole file. */
  ignoresRange = false;
  micAnswer: PermissionStatus = "granted";
  keys = { openrouter: false };
  models: LocalModelInfo_Serialize[] = [{ ...PARAKEET }];
  /** The cleanup model (Gemma): "On this Mac"'s second part. None until a test adds it. */
  cleanup: LocalModelInfo_Serialize[] = [];
  settings: Settings_Serialize = {
    version: 2,
    hotkey: "RightAlt",
    launch_at_login: false,
    transcription: "cloud",
    share_usage_events: true,
    history_limit: 25,
  };
  engine: { state: "loading" | "ready" | "failed"; message: string | null } = {
    state: "ready",
    message: null,
  };
  testResult: string | null = null;
  /** What `openrouter_credits` answers (`null`: nothing readable). */
  credit: { balance: number | null; key_limit_left: number | null } | null = {
    balance: 4.82,
    key_limit_left: null,
  };
  /** Fails the command named, with the message (a string, as the app sends). */
  failing = new Map<string, string>();
  /** Holds the command named until the promise settles. */
  holds = new Map<string, Promise<void>>();
  /** What `cancel_connect` answers: `false` once the key is being saved. */
  cancelResult = true;
  calls: Call[] = [];

  status(): OnboardingStatus {
    return {
      view: this.view,
      step: this.step,
      microphone: this.microphone,
      accessibility: this.accessibility,
      needs_relaunch: this.needsRelaunch,
      asked_again: this.askedAgain,
    };
  }

  allows(step: Step): boolean {
    const done: Record<Step, boolean> = {
      welcome: this.welcomePassed,
      speech: this.settings.transcription === "local" || this.keys.openrouter,
      permissions: this.microphone === "granted" && this.accessibility === "granted",
      try: true,
    };
    return ORDER.slice(0, ORDER.indexOf(step)).every((before) => done[before]);
  }

  model(id: string): LocalModelInfo_Serialize {
    const found = this.models.find((model) => model.id === id);
    if (found === undefined) throw new Error(`no model ${id}`);
    return found;
  }

  handle = (command: string, payload: unknown): unknown => {
    const args = (payload ?? {}) as Record<string, unknown>;
    this.calls.push({ command, args });
    switch (command) {
      case "get_onboarding":
        return this.status();
      case "accept_terms":
        this.acceptedTerms = true;
        return null;
      case "request_permission":
        if (args.permission === "microphone" && this.microphone === "not_determined") {
          this.microphone = this.micAnswer;
        }
        return this.status();
      case "set_onboarding_step": {
        const step = args.step as Step;
        if (step !== "welcome") this.welcomePassed = true;
        // The app's `NotYet` message, sent as a string.
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        if (!this.allows(step)) throw "Choose how speech becomes text first.";
        this.step = step;
        return this.status();
      }
      case "finish_onboarding":
        this.view = "settings";
        return null;
      case "list_history":
        return { entries: [], unreadable: false, write_error: null };
      case "relaunch_app":
        return null;
      case "set_hotkey_recording":
      case "open_link":
        return null;
      case "get_settings":
        return this.settings;
      case "set_share_usage_events":
        this.settings = { ...this.settings, share_usage_events: args.share as boolean };
        return null;
      case "set_hotkey":
        this.settings = { ...this.settings, hotkey: args.spec as string };
        return null;
      case "set_launch_at_login":
        this.settings = { ...this.settings, launch_at_login: args.enabled as boolean };
        return args.enabled;
      case "saved_key_hint":
        return this.keys.openrouter ? "sk-or-…cdef" : null;
      case "openrouter_credits": {
        const held = this.holds.get(command);
        if (held !== undefined) return held.then(() => null);
        return this.keys.openrouter ? this.credit : null;
      }
      case "connect_openrouter": {
        const failure = this.failing.get(command);
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        if (failure !== undefined) throw failure;
        const held = this.holds.get(command);
        if (held !== undefined) {
          return held.then(() => {
            this.keys.openrouter = true;
            return null;
          });
        }
        this.keys.openrouter = true;
        return null;
      }
      case "cancel_connect":
        return this.cancelResult;
      case "set_api_key":
        this.keys.openrouter = true;
        return null;
      case "test_api_key":
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        if (this.testResult !== null) throw this.testResult;
        return null;
      case "set_transcription":
        this.settings = {
          ...this.settings,
          transcription: args.transcription as Transcription,
        };
        return null;
      case "download_local_model": {
        const model = this.model(args.id as string);
        const part = model.downloaded_bytes ?? 0;
        if (model.state === "ready") {
          // A ready speech model: the app goes on to the cleanup model.
          for (const gemma of this.cleanup)
            if (gemma.state !== "ready") gemma.state = "downloading";
          return null;
        }
        model.state = "downloading";
        if (part > 0 && this.ignoresRange) model.restarted = true;
        else if (part > 0) model.resumed_from_bytes = part;
        return null;
      }
      case "cancel_local_model_download": {
        const model = this.model(args.id as string);
        model.state = model.downloaded_bytes ? "partial" : "missing";
        // One download: cancelling the speech model cancels the cleanup model too.
        for (const gemma of this.cleanup) {
          if (gemma.state === "downloading") {
            gemma.state = gemma.downloaded_bytes ? "partial" : "missing";
          }
        }
        return null;
      }
      case "list_cleanup_models":
        return this.cleanup.map((model) => ({ ...model }));
      case "list_local_models":
        // A new list each time, as the app sends.
        return this.models.map((model) => ({ ...model }));
      case "get_engine_status":
        return this.engine;
      default:
        throw new Error(`unexpected command ${command}`);
    }
  };

  named(command: string): Call[] {
    return this.calls.filter((call) => call.command === command);
  }

  /** Permissions granted and a local model ready: every step can be reached. */
  allSet(step: Step) {
    this.step = step;
    this.welcomePassed = true;
    this.microphone = "granted";
    this.accessibility = "granted";
    this.settings = { ...this.settings, transcription: "local" };
    this.model(PARAKEET.id).state = "ready";
    this.model(PARAKEET.id).downloaded_bytes = PARAKEET.size_bytes;
  }
}

let backend: Backend;

beforeEach(() => {
  backend = new Backend();
  mockIPC(backend.handle);
});

afterEach(() => {
  cleanup();
  clearMocks();
});

function show() {
  return render(<Onboarding onFinished={() => undefined} />);
}

/** What the window does when it comes back: asks the app again. */
function refocus() {
  act(() => {
    window.dispatchEvent(new Event("focus"));
  });
}

/** The one element the page has for `selector`. */
function found(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(`nothing matches ${selector}`);
  return element;
}

function primary(name: string | RegExp): HTMLButtonElement {
  return screen.getByRole("button", { name });
}

describe("the frame", () => {
  it("criterion 1: exactly these four steps, in order, on the rail", async () => {
    show();
    const rail = await screen.findByRole("navigation", { name: "Setup steps" });
    expect(
      within(rail)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["1Welcome", "2Speech", "3Permissions", "4Try it"]);
    expect(STEPS.map((step) => step.id)).toEqual(ORDER);
  });

  it("criterion 1: the rail marks done, current and upcoming", async () => {
    backend.allSet("permissions");
    show();
    const rail = await screen.findByRole("navigation", { name: "Setup steps" });
    const items = within(rail).getAllByRole("listitem");
    expect(items[0]?.textContent).toBe("✓Welcome");
    expect(items[1]?.textContent).toBe("✓Speech");
    expect(items[2]?.getAttribute("aria-current")).toBe("step");
    expect(items[3]?.className).toContain("upcoming");
  });

  it("criterion 1: every step has Back except Welcome, and one primary", async () => {
    for (const step of ORDER) {
      backend = new Backend();
      mockIPC(backend.handle);
      backend.allSet(step);
      const { unmount } = show();
      await screen.findByRole("navigation", { name: "Setup steps" });
      await waitFor(() => {
        expect(document.querySelectorAll(".ob-footer .primary")).toHaveLength(1);
      });
      expect(screen.queryByRole("button", { name: "Back" }) === null).toBe(step === "welcome");
      unmount();
    }
  });

  it("criterion 1: a disabled primary always says why", async () => {
    backend.allSet("permissions");
    backend.accessibility = "not_determined";
    show();
    await waitFor(() => {
      expect(primary("Continue").disabled).toBe(true);
    });
    expect(primary("Continue").getAttribute("aria-describedby")).toBe("ob-reason");
    expect(screen.getByText(BOTH_REASON)).toBeTruthy();
  });

  it("criterion 1: the layout holds: rail, scrolling content, fixed footer", () => {
    const rule = (selector: string) => {
      const found = new RegExp(`(^|\\n)${selector.replace(".", "\\.")} \\{([^}]*)\\}`).exec(css);
      expect(found, selector).not.toBeNull();
      return found?.[2] ?? "";
    };
    expect(rule(".ob-rail")).toContain("150px");
    expect(rule(".ob-content")).toContain("overflow: hidden auto");
    // Long words wrap instead of widening the window at 680×520.
    expect(rule(".ob-content")).toContain("overflow-wrap: anywhere");
    expect(rule(".ob-main")).toContain("min-width: 0");
    expect(rule(".ob-footer")).toContain("flex: 0 0 auto");
    expect(rule(".ob-reason")).toContain("overflow-wrap: anywhere");
  });
});

describe("Welcome", () => {
  // Replaces U8's three tests here, which required the switch on this screen
  // and no event before leaving it (U10 reverses both).
  it("U10 criterion 1: has no sharing switch, caption or What's sent", async () => {
    show();
    await screen.findByText("Talk instead of type");
    await waitFor(() => {
      expect(primary("Get started").disabled).toBe(false);
    });
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByText(/usage|error events|anonymous/i)).toBeNull();
    expect(screen.queryByText("What's sent")).toBeNull();
  });

  it("U11 criterion 1: only the title, the line, the demo and Get started", async () => {
    show();
    await screen.findByText("Talk instead of type");
    await screen.findByText("Vocet turns what you say into text, in any app.");
    await waitFor(() => {
      expect(primary("Get started").disabled).toBe(false);
    });
    const content = document.querySelector<HTMLElement>(".ob-content");
    // The only controls are the two links in the Terms line.
    expect(
      Array.from(content?.querySelectorAll("input, select, textarea, button, a") ?? []).map(
        (control) => control.textContent,
      ),
    ).toEqual(["Terms", "Privacy Policy"]);
    expect(content?.textContent).not.toMatch(
      /usage|error events|anonymous|sharing|share|analytics/i,
    );
    expect(document.querySelectorAll(".ob-footer button")).toHaveLength(1);
    expect(document.querySelector(".ob-demo")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("U11: gives the screen one sentence for screen readers, with the stored key", async () => {
    backend.settings = { ...backend.settings, hotkey: "RightCmd" };
    show();
    await screen.findByText(
      "Hold Right Command, say what you mean, and let go. The words land at your cursor.",
    );
  });

  it("U11 criterion 3: the keycap has the long form of the stored key", async () => {
    show();
    await screen.findByText("Right Option (⌥)");
    cleanup();
    backend.settings = { ...backend.settings, hotkey: "RightCmd" };
    show();
    await screen.findByText("Right Command (⌘)");
    expect(document.body.textContent).not.toContain("RightCmd");
  });

  it("U11 criterion 3: keycap and caption stand on one baseline", () => {
    const beat = /\.ob-beat \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(beat).toContain("align-items: baseline");
  });

  it("round 2: a caption keeps its bold width, so the keycap beside it doesn't move", async () => {
    show();
    const caption = (await screen.findByText("Hold the key")).parentElement;
    expect(caption?.className).toBe("ob-beat-caption");
    expect(caption?.getAttribute("data-text")).toBe("Hold the key");
    const copy = /\.ob-beat-caption::after \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(copy).toContain("content: attr(data-text)");
    expect(copy).toContain("font-weight: 600");
    expect(/\.ob-beat\.lit \{([^}]*)\}/.exec(css)?.[1]).toContain("font-weight: 600");
  });

  it("Get started moves on", async () => {
    show();
    await screen.findByText("Talk instead of type");
    await waitFor(() => {
      expect(primary("Get started").disabled).toBe(false);
    });
    fireEvent.click(primary("Get started"));
    await screen.findByText("How should Vocet transcribe?");
    expect(backend.step).toBe("speech");
  });

  it("TOS1 round 3: says the person agrees to the Terms and Privacy Policy, right under the demo", async () => {
    show();
    await screen.findByText("Talk instead of type");
    const line = found(".ob-terms");
    expect(line.textContent).toBe("By continuing, you agree to the Terms and Privacy Policy.");
    // Right below the demo card, above the footer's divider; not a checkbox.
    expect(document.querySelector(".ob-demo")?.nextElementSibling).toBe(line);
    expect(document.querySelector(".ob-content")?.contains(line)).toBe(true);
    expect(document.querySelector(".ob-footer")?.contains(line)).toBe(false);
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(within(line).getByRole("button", { name: "Terms" }));
    fireEvent.click(within(line).getByRole("button", { name: "Privacy Policy" }));
    await waitFor(() => {
      expect(backend.named("open_link").map((call) => call.args.link)).toEqual([
        "terms",
        "privacy",
      ]);
    });
    expect(backend.acceptedTerms).toBe(false);
  });

  it("TOS1: Get started stores the Terms first, then moves on; nothing before it", async () => {
    show();
    await screen.findByText("Talk instead of type");
    await waitFor(() => {
      expect(primary("Get started").disabled).toBe(false);
    });
    expect(backend.named("accept_terms")).toEqual([]);
    fireEvent.click(primary("Get started"));
    await screen.findByText("How should Vocet transcribe?");
    expect(backend.acceptedTerms).toBe(true);
    const order = backend.calls.map((call) => call.command);
    expect(order.indexOf("accept_terms")).toBeLessThan(order.indexOf("set_onboarding_step"));
  });

  it("TOS1: if the Terms can't be stored, it stays on Welcome and says so; Get started retries", async () => {
    const original = backend.handle;
    let failing = true;
    mockIPC((command, payload) => {
      if (command === "accept_terms" && failing) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "the onboarding task crashed";
      }
      return original(command, payload);
    });
    show();
    await screen.findByText("Talk instead of type");
    await waitFor(() => {
      expect(primary("Get started").disabled).toBe(false);
    });
    fireEvent.click(primary("Get started"));
    await screen.findByText(/onboarding task crashed/);
    expect(backend.step).toBe("welcome");
    failing = false;
    fireEvent.click(primary("Get started"));
    await screen.findByText("How should Vocet transcribe?");
  });
});

describe("Settings → Privacy", () => {
  it("What's sent opens on Settings → Privacy, and links to both pages", async () => {
    render(<Privacy settings={backend.settings} onStored={() => undefined} />);
    const summary = screen.getByText("What's sent");
    const details = summary.closest("details");
    if (details === null) throw new Error("no disclosure");
    expect(details.open).toBe(false);
    fireEvent.click(summary);
    expect(details.open).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Read the privacy policy" }));
    fireEvent.click(screen.getByRole("button", { name: "Read the Terms" }));
    await waitFor(() => {
      expect(backend.named("open_link").map((call) => call.args.link)).toEqual([
        "privacy",
        "terms",
      ]);
    });
  });

  it("says reports start at Get started, with no exception for setup", () => {
    render(<Privacy settings={backend.settings} onStored={() => undefined} />);
    fireEvent.click(screen.getByText("What's sent"));
    expect(document.body.textContent).toContain("starting when you press Get started");
    expect(document.body.textContent).not.toMatch(/before the switch is shown/i);
  });
});

describe("Speech", () => {
  beforeEach(() => {
    backend.step = "speech";
    backend.welcomePassed = true;
  });

  it("Q3: a fresh install selects OpenRouter, listed first, with Continue to Connect", async () => {
    show();
    await screen.findByText(MODEL_SUMMARY);
    const radios = screen.getAllByRole<HTMLInputElement>("radio", {
      name: /OpenRouter|Use this Mac/,
    });
    expect(radios.map((radio) => radio.checked)).toEqual([true, false]);
    expect(radios[0]?.getAttribute("aria-label")).toBe("Use OpenRouter");
    expect(primary("Continue").disabled).toBe(false);
    expect(backend.settings.transcription).toBe("cloud");
  });

  it("TOS1: the on-device card shows the whole download, speech plus cleanup", async () => {
    backend.cleanup = [{ ...GEMMA }];
    backend.models = [{ ...PARAKEET, size_bytes: 1_319_830_656 }];
    show();
    await screen.findByText("Works offline after a one-time 4.4 GB download");
  });

  it("TOS1: until the cleanup model is listed there is no size, so none is claimed", async () => {
    show();
    await screen.findByText(MODEL_SUMMARY);
    screen.getByText("Works offline after a one-time download");
    expect(document.querySelector(".ob-main")?.textContent).not.toMatch(/\d GB/);
  });

  it("TOS1 round 3: each card has a title, a one-line summary and short points", async () => {
    backend.cleanup = [{ ...GEMMA }];
    backend.models = [{ ...PARAKEET, size_bytes: 1_319_830_656 }];
    show();
    await screen.findByText("Works offline after a one-time 4.4 GB download");
    const [openrouter, mac] = Array.from(document.querySelectorAll<HTMLElement>(".ob-option"));
    expect(openrouter?.querySelector(".ob-card-title")?.textContent).toBe(
      "Use OpenRouter Recommended",
    );
    expect(openrouter?.querySelector(".ob-caption")?.textContent).toBe(KEY_SUMMARY);
    expect(
      Array.from(openrouter?.querySelectorAll("li") ?? []).map((item) => item.textContent),
    ).toEqual([...KEY_POINTS]);
    expect(mac?.querySelector(".ob-card-title")?.textContent).toBe("On this Mac");
    expect(mac?.querySelector(".ob-caption")?.textContent).toBe(MODEL_SUMMARY);
    expect(Array.from(mac?.querySelectorAll("li") ?? []).map((item) => item.textContent)).toEqual([
      ...modelPoints("4.4 GB"),
    ]);
    // Three or four points each, and the facts the owner gave.
    expect(KEY_POINTS.length).toBeGreaterThanOrEqual(3);
    expect(KEY_POINTS.length).toBeLessThanOrEqual(4);
    expect(modelPoints(null)).toHaveLength(4);
    expect(KEY_POINTS).toContain("OpenRouter is one account for many AI models.");
    expect(KEY_POINTS).toContain("Most accurate");
    expect(KEY_POINTS).toContain("Needs internet");
    expect(modelPoints("4.4 GB")).toContain("Free, no account");
    expect(modelPoints("4.4 GB")).toContain("Your audio and text never leave your Mac");
  });

  it("TOS1 round 3: the cards claim no price, speed or memory figure", () => {
    const words = [KEY_SUMMARY, MODEL_SUMMARY, ...KEY_POINTS, ...modelPoints("4.4 GB")].join(" ");
    expect(words).not.toMatch(/\$|cents|per hour|\bms\b|seconds|RAM|memory/i);
    // The only number is the download's size, from the catalogue.
    expect(words.match(/\d/g)?.join("")).toBe("44");
  });

  it("criterion 3: English preselects Parakeet English, with its real size", async () => {
    show();
    const name = await screen.findByText(MODEL_SUMMARY);
    fireEvent.click(screen.getByRole("radio", { name: "Use this Mac" }));
    expect(name).toBeTruthy();
    expect(screen.getByText("On this Mac")).toBeTruthy();
    expect(screen.getByText(MODEL_SUMMARY)).toBeTruthy();
    expect(primary("Download and continue").disabled).toBe(false);
  });

  it("criterion 3: Download and continue chooses, starts the download and moves on", async () => {
    show();
    await screen.findByText(MODEL_SUMMARY);
    fireEvent.click(screen.getByRole("radio", { name: "Use this Mac" }));
    fireEvent.click(primary("Download and continue"));
    await screen.findByText("Two permissions");
    expect(backend.named("set_transcription")[0]?.args).toEqual({ transcription: "local" });
    expect(backend.named("download_local_model")[0]?.args).toEqual({ id: PARAKEET.id });
    expect(backend.settings.transcription).toBe("local");
    expect(backend.step).toBe("permissions");
  });

  it("criterion 3: a model already here says Continue and downloads nothing", async () => {
    backend.model(PARAKEET.id).state = "ready";
    show();
    await screen.findByText(MODEL_SUMMARY);
    fireEvent.click(screen.getByRole("radio", { name: "Use this Mac" }));
    fireEvent.click(primary("Continue"));
    await screen.findByText("Two permissions");
    expect(backend.named("download_local_model")).toEqual([]);
    expect(backend.settings.transcription).toBe("local");
  });

  it("Q4 round 6: a restart during the cleanup part resumes the download", async () => {
    // OrukQwen is in; Gemma was cut off by a quit, and the Mac is chosen already.
    backend.model(PARAKEET.id).state = "ready";
    backend.model(PARAKEET.id).downloaded_bytes = PARAKEET.size_bytes;
    backend.cleanup = [{ ...GEMMA, state: "partial", downloaded_bytes: 1_000_000_000 }];
    backend.settings = { ...backend.settings, transcription: "local" };
    show();
    await screen.findByText(MODEL_SUMMARY);
    fireEvent.click(screen.getByRole("radio", { name: "Use this Mac" }));
    // The label says a download is left.
    await waitFor(() => {
      expect(primary("Download and continue").disabled).toBe(false);
    });
    fireEvent.click(primary("Download and continue"));
    await screen.findByText("Two permissions");
    expect(backend.named("download_local_model")[0]?.args).toEqual({ id: PARAKEET.id });
    expect(backend.cleanup[0]?.state).toBe("downloading");
  });

  it("Q4 round 6: with the cleanup model still downloading, Continue starts nothing", async () => {
    backend.model(PARAKEET.id).state = "ready";
    backend.model(PARAKEET.id).downloaded_bytes = PARAKEET.size_bytes;
    backend.cleanup = [{ ...GEMMA, state: "downloading", downloaded_bytes: 1_000_000_000 }];
    backend.settings = { ...backend.settings, transcription: "local" };
    show();
    await screen.findByText(MODEL_SUMMARY);
    fireEvent.click(screen.getByRole("radio", { name: "Use this Mac" }));
    fireEvent.click(await screen.findByRole("button", { name: "Download and continue" }));
    await screen.findByText("Two permissions");
    expect(backend.named("download_local_model")).toEqual([]);
  });

  it("Q4 round 7: a missing speech model starts the download even while the cleanup model downloads", async () => {
    backend.cleanup = [{ ...GEMMA, state: "downloading", downloaded_bytes: 1_000_000_000 }];
    show();
    await screen.findByText(MODEL_SUMMARY);
    fireEvent.click(screen.getByRole("radio", { name: "Use this Mac" }));
    fireEvent.click(await screen.findByRole("button", { name: "Download and continue" }));
    await screen.findByText("Two permissions");
    expect(backend.named("download_local_model")[0]?.args).toEqual({ id: PARAKEET.id });
  });

  it("stays on the step and says why when the download can't start", async () => {
    backend.handle = ((original) => (command: string, payload: unknown) => {
      if (command === "set_transcription") {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "The disk is full.";
      }
      return original(command, payload);
    })(backend.handle);
    mockIPC(backend.handle);
    show();
    await screen.findByText(MODEL_SUMMARY);
    fireEvent.click(screen.getByRole("radio", { name: "Use this Mac" }));
    fireEvent.click(primary("Download and continue"));
    await screen.findByText("The disk is full.");
    expect(backend.step).toBe("speech");
  });

  /** Selects OpenRouter on the two choices, and nothing else happens. */
  async function selectCloud() {
    show();
    await screen.findByText(MODEL_SUMMARY);
    // OpenRouter is the default: move off it and back, so the choice is written.
    fireEvent.click(screen.getByRole("radio", { name: "Use this Mac" }));
    fireEvent.click(screen.getByRole("radio", { name: /Use OpenRouter/ }));
  }

  /** On the Connect OpenRouter screen. */
  async function openConnectScreen() {
    await selectCloud();
    fireEvent.click(primary("Continue"));
    await screen.findByText("Connect OpenRouter", { selector: "h1, h2" });
    // The saved-key lookup (a zero-delay timer, then the app) has settled.
    await waitFor(() => {
      expect(screen.queryByText("Checking for a saved key…")).toBeNull();
    });
  }

  it("Q4 round 6: pressing the preselected OpenRouter card records the choice in state", () => {
    // A click on a checked radio fires no change, so the card records it on click.
    const picks: string[] = [];
    render(
      <SpeechStep
        parts={{ back: null, strip: null, error: null, busy: false }}
        kept={null}
        onPick={(choice) => picks.push(choice)}
        settings={backend.settings}
        onStored={() => undefined}
        models={backend.models}
        cleanup={null}
        modelsError={null}
        refreshModels={() => Promise.resolve()}
        refreshEngine={() => Promise.resolve()}
        onContinue={() => undefined}
      />,
    );
    const card = screen.getByRole<HTMLInputElement>("radio", { name: "Use OpenRouter" });
    expect(card.checked).toBe(true);
    expect(picks).toEqual([]);
    fireEvent.click(card);
    expect(picks).toEqual(["key"]);
    expect(card.checked).toBe(true);
  });

  it("Q4 round 6: pressing the preselected OpenRouter card keeps the choice after Back", async () => {
    // A click on a checked radio fires no change, so the card records it on click.
    show();
    await screen.findByText(MODEL_SUMMARY);
    const card = () => screen.getByRole<HTMLInputElement>("radio", { name: /Use OpenRouter/ });
    expect(card().checked).toBe(true);
    fireEvent.click(card());
    fireEvent.click(primary("Continue"));
    await screen.findByText("Connect OpenRouter", { selector: "h1, h2" });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByText("How should Vocet transcribe?");
    expect(card().checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>("radio", { name: "Use this Mac" }).checked).toBe(
      false,
    );
  });

  it("Q3: selecting OpenRouter shows no form, only Continue", async () => {
    await selectCloud();
    expect(screen.queryByText("Connect OpenRouter", { selector: "button" })).toBeNull();
    expect(primary("Continue").disabled).toBe(false);
    expect(document.querySelector(".ob-reason")?.textContent).toBe("");
    expect(backend.step).toBe("speech");
  });

  it("Q3: Continue opens the screen, Back returns with all as it was", async () => {
    show();
    await screen.findByText(MODEL_SUMMARY);
    fireEvent.click(screen.getByRole("radio", { name: /Use OpenRouter/ }));
    fireEvent.click(primary("Continue"));
    await screen.findByText("Connect OpenRouter", { selector: "h1, h2" });
    screen.getByText(OPENROUTER_EXPLAINER);
    const current = () => document.querySelector('[aria-current="step"]')?.textContent;
    expect(current()).toContain("Speech");
    expect(backend.step).toBe("speech");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByText("How should Vocet transcribe?");
    expect(current()).toContain("Speech");
    expect(backend.step).toBe("speech");
    expect(backend.named("set_onboarding_step")).toEqual([]);
    expect(screen.getByRole<HTMLInputElement>("radio", { name: /Use OpenRouter/ }).checked).toBe(
      true,
    );
  });

  it("TOS1: not connected: one sentence and one primary button; no paste link up front", async () => {
    await openConnectScreen();
    // The saved-key lookup has settled once the footer gives its reason.
    await screen.findByText(KEY_REASON);
    expect(OPENROUTER_EXPLAINER).toContain("a few dollars of credit");
    expect(OPENROUTER_EXPLAINER).not.toMatch(/\$|per hour|cents/i);
    expect(primary("Continue").disabled).toBe(true);
    const panel = found("#connect-panel");
    expect(panel.querySelectorAll("button.primary")).toHaveLength(1);
    expect(within(panel).getByRole("button", { name: "Connect OpenRouter" })).toBeTruthy();
    for (const gone of [
      "Paste a key instead",
      "Add credits",
      "Disconnect",
      "Connect again",
      "I'll use Vocet on this Mac only",
    ]) {
      expect(screen.queryByRole("button", { name: gone })).toBeNull();
    }
  });

  it("Q3: Connect OpenRouter saves the key, unlocks Continue, and the provider is the engine", async () => {
    await openConnectScreen();
    fireEvent.click(screen.getByRole("button", { name: "Connect OpenRouter" }));
    await screen.findByText(KEY_SAVED);
    expect(backend.named("connect_openrouter")).toHaveLength(1);
    expect(primary("Continue").disabled).toBe(false);
    fireEvent.click(primary("Continue"));
    await screen.findByText("Two permissions");
    expect(backend.named("set_transcription")[0]?.args).toEqual({ transcription: "cloud" });
    expect(backend.named("download_local_model")).toEqual([]);
  });

  it.each([["Back", () => fireEvent.click(screen.getByRole("button", { name: "Back" }))]])(
    "Q3: %s while the key is already being saved stays on the screen and shows the outcome",
    async (_name, leave) => {
      let release: () => void = () => undefined;
      const hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      backend.holds.set("connect_openrouter", hold);
      backend.cancelResult = false;
      await openConnectScreen();
      fireEvent.click(screen.getByRole("button", { name: "Connect OpenRouter" }));
      await screen.findByText("Waiting for OpenRouter in your browser…");
      leave();
      expect((await screen.findAllByText("Saving your key…")).length).toBeGreaterThan(0);
      expect(screen.queryByText("How should Vocet transcribe?")).toBeNull();
      await act(async () => {
        release();
        await hold;
      });
      await screen.findByText(KEY_SAVED);
      await waitFor(() => {
        expect(primary("Continue").disabled).toBe(false);
      });
    },
  );

  it("Q3: a failed sign-in says why and keeps Continue locked", async () => {
    backend.failing.set("connect_openrouter", "Connecting took too long. Try again.");
    await openConnectScreen();
    fireEvent.click(screen.getByRole("button", { name: "Connect OpenRouter" }));
    await screen.findByText("Connecting took too long. Try again.");
    expect(primary("Continue").disabled).toBe(true);
    expect(backend.keys.openrouter).toBe(false);
  });

  it("Q3: Back during the wait cancels it", async () => {
    backend.holds.set("connect_openrouter", new Promise<void>(() => undefined));
    await openConnectScreen();
    fireEvent.click(screen.getByRole("button", { name: "Connect OpenRouter" }));
    await screen.findByText("Waiting for OpenRouter in your browser…");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByText("How should Vocet transcribe?");
    expect(backend.named("cancel_connect")).toHaveLength(1);
  });

  it("TOS1 round 3: connected: a tick, the credit left with an Add credits button beside it, Continue", async () => {
    backend.keys.openrouter = true;
    await openConnectScreen();
    await screen.findByText(KEY_SAVED);
    const left = await screen.findByText("$4.82 left");
    expect(primary("Continue").disabled).toBe(false);
    const credits = screen.getByRole("button", { name: "Add credits" });
    // A button, beside the balance (the same row), not a link.
    expect(credits.className).toBe("");
    expect(credits.parentElement?.className).toBe("ob-credit");
    expect(credits.parentElement?.contains(left)).toBe(true);
    fireEvent.click(credits);
    await waitFor(() => {
      expect(backend.named("open_link")[0]?.args).toEqual({ link: "openrouter_credits" });
    });
    // The key isn't shown in setup at all.
    expect(document.body.textContent).not.toMatch(/sk-or|cdef|Key ending/);
    for (const gone of [
      "Connect again",
      "Connect OpenRouter",
      "Paste a key instead",
      "Disconnect",
      "I'll use Vocet on this Mac only",
    ]) {
      expect(screen.queryByRole("button", { name: gone })).toBeNull();
    }
  });

  it("TOS1 round 3: a key with a spending limit shows what is left of it", async () => {
    backend.keys.openrouter = true;
    backend.credit = { balance: 4.8, key_limit_left: 2.5 };
    await openConnectScreen();
    await screen.findByText("$4.80 left");
    screen.getByText("Spending limit: $2.50 left");
  });

  it.each([
    ["nothing readable", null],
    ["no number in it", { balance: null, key_limit_left: null }],
  ])(
    "TOS1 round 3: with %s, just the tick and the button, and Continue works",
    async (_n, credit) => {
      backend.keys.openrouter = true;
      backend.credit = credit;
      await openConnectScreen();
      await screen.findByText(KEY_SAVED);
      await waitFor(() => {
        expect(backend.named("openrouter_credits")).toHaveLength(1);
      });
      expect(screen.getByRole("button", { name: "Add credits" })).toBeTruthy();
      expect(document.querySelector("#connect-credit")).toBeNull();
      expect(primary("Continue").disabled).toBe(false);
    },
  );

  it("TOS1 round 3: a slow or failing balance never blocks Continue", async () => {
    backend.keys.openrouter = true;
    backend.holds.set("openrouter_credits", new Promise<void>(() => undefined));
    await openConnectScreen();
    await screen.findByText(KEY_SAVED);
    expect(primary("Continue").disabled).toBe(false);
    expect(document.querySelector("#connect-credit")).toBeNull();
  });

  it("TOS1 round 3: the balance is asked again when the window gets focus back", async () => {
    backend.keys.openrouter = true;
    await openConnectScreen();
    await screen.findByText("$4.82 left");
    backend.credit = { balance: 9.5, key_limit_left: null };
    fireEvent.focus(window);
    await screen.findByText("$9.50 left");
    expect(backend.named("openrouter_credits").length).toBeGreaterThanOrEqual(2);
  });

  it("TOS1 round 3: a failed refresh keeps the amount already shown", async () => {
    backend.keys.openrouter = true;
    await openConnectScreen();
    await screen.findByText("$4.82 left");
    backend.credit = null;
    fireEvent.focus(window);
    await waitFor(() => {
      expect(backend.named("openrouter_credits").length).toBeGreaterThanOrEqual(2);
    });
    screen.getByText("$4.82 left");
  });

  it("TOS1 round 3: not connected, the balance isn't asked for", async () => {
    await openConnectScreen();
    await screen.findByText(KEY_REASON);
    expect(backend.named("openrouter_credits")).toEqual([]);
  });

  it("TOS1 round 3: Having trouble? Paste a key instead appears only after the sign-in waits", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      backend.holds.set("connect_openrouter", new Promise<void>(() => undefined));
      await openConnectScreen();
      fireEvent.click(screen.getByRole("button", { name: "Connect OpenRouter" }));
      await screen.findByText("Waiting for OpenRouter in your browser…");
      expect(screen.queryByRole("button", { name: "Paste a key instead" })).toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PASTE_AFTER_MS - 1000);
      });
      expect(screen.queryByRole("button", { name: "Paste a key instead" })).toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });
      screen.getByText("Having trouble?");
      screen.getByRole("button", { name: "Paste a key instead" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("TOS1 round 3: a key pasted while the sign-in waits ends the wait and is saved", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      backend.holds.set("connect_openrouter", new Promise<void>(() => undefined));
      await openConnectScreen();
      fireEvent.click(screen.getByRole("button", { name: "Connect OpenRouter" }));
      await screen.findByText("Waiting for OpenRouter in your browser…");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PASTE_AFTER_MS + 500);
      });
      fireEvent.click(screen.getByRole("button", { name: "Paste a key instead" }));
      fireEvent.change(await screen.findByLabelText("OpenRouter API key"), {
        target: { value: KEY },
      });
      expect(screen.getByRole<HTMLButtonElement>("button", { name: "Test & Save" }).disabled).toBe(
        false,
      );
      fireEvent.click(screen.getByRole("button", { name: "Test & Save" }));
      await screen.findByText(KEY_SAVED);
      expect(backend.named("cancel_connect")).toHaveLength(1);
      expect(backend.named("set_api_key")).toHaveLength(1);
      expect(primary("Continue").disabled).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("TOS1 round 3: the paste link also appears after a failed sign-in, and stays", async () => {
    backend.failing.set("connect_openrouter", "Connecting took too long. Try again.");
    await openConnectScreen();
    expect(screen.queryByRole("button", { name: "Paste a key instead" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Connect OpenRouter" }));
    await screen.findByText("Connecting took too long. Try again.");
    screen.getByRole("button", { name: "Paste a key instead" });
  });

  /** A sign-in that failed: the paste link is then offered. */
  async function afterFailedSignIn() {
    backend.failing.set("connect_openrouter", "Connecting took too long. Try again.");
    await openConnectScreen();
    fireEvent.click(screen.getByRole("button", { name: "Connect OpenRouter" }));
    await screen.findByText("Connecting took too long. Try again.");
    backend.failing.delete("connect_openrouter");
  }

  it("Q3: Paste a key instead tests and saves a typed key", async () => {
    await afterFailedSignIn();
    fireEvent.click(screen.getByRole("button", { name: "Paste a key instead" }));
    const field = await screen.findByLabelText("OpenRouter API key");
    expect(field.getAttribute("type")).toBe("password");
    fireEvent.change(field, { target: { value: KEY } });
    fireEvent.click(screen.getByRole("button", { name: "Test & Save" }));
    await screen.findByText(KEY_SAVED);
    expect(backend.named("set_api_key")).toHaveLength(1);
    expect(document.body.textContent).not.toContain(KEY);
  });

  it("Q3: a pasted key the provider rejects keeps Continue locked, and saves nothing", async () => {
    backend.testResult = "OpenRouter rejected this API key.";
    await afterFailedSignIn();
    fireEvent.click(screen.getByRole("button", { name: "Paste a key instead" }));
    fireEvent.change(await screen.findByLabelText("OpenRouter API key"), {
      target: { value: KEY },
    });
    fireEvent.click(screen.getByRole("button", { name: "Test & Save" }));
    await screen.findByText("OpenRouter rejected this API key.");
    expect(backend.named("set_api_key")).toEqual([]);
    expect(primary("Continue").disabled).toBe(true);
  });

  describe("U11 criterion 5: the cards' exact wording", () => {
    it("English", async () => {
      show();
      await screen.findByText(MODEL_SUMMARY);
      screen.getByText("Use OpenRouter", { exact: false });
      screen.getByText(KEY_SUMMARY);
    });

    it("no catalogue name and no refused wording, on any of the screens", async () => {
      show();
      await screen.findByText(MODEL_SUMMARY);
      fireEvent.click(screen.getByRole("radio", { name: "Use this Mac" }));
      const shown = () => document.querySelector(".ob-main")?.textContent ?? "";
      const clean = () => {
        for (const gone of [PARAKEET.name, "Parakeet", "Qwen", "Multilingual"]) {
          expect(shown()).not.toContain(gone);
        }
        expect(shown()).not.toMatch(/All languages|100\+/);
      };
      clean();
      fireEvent.click(primary("Download and continue"));
      await screen.findByText("Downloading on-device models (speech + cleanup) · 0 of 477 MB");
      clean();
    });
  });
});

describe("the form's and the chip's looks (round 2)", () => {
  it("Test & Save is regular height inside the form", () => {
    const form = /\.ob-key-panel button\.primary \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(form).toContain("min-height: var(--vc-control-h);");
    // After the onboarding rule of the same weight, so it wins.
    expect(css.indexOf(".ob-key-panel button.primary")).toBeGreaterThan(
      css.indexOf(".onboarding button.primary"),
    );
  });
});

describe("the download strip", () => {
  function downloading() {
    backend.step = "permissions";
    backend.welcomePassed = true;
    backend.settings = { ...backend.settings, transcription: "local" };
    const model = backend.model(PARAKEET.id);
    model.state = "downloading";
    model.downloaded_bytes = 212_000_000;
  }

  it("criterion 3: shows real progress and Cancel on every later step", async () => {
    for (const step of ["permissions", "try"] as const) {
      backend = new Backend();
      mockIPC(backend.handle);
      downloading();
      backend.step = step;
      backend.microphone = "granted";
      backend.accessibility = "granted";
      const { unmount } = show();
      await screen.findByText("Downloading on-device models (speech + cleanup) · 212 of 477 MB");
      expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
      expect(screen.getByText("Download running")).toBeTruthy();
      unmount();
    }
  });

  it("Q4: the cleanup part shows in the one strip, practice stays available, Cancel stops it", async () => {
    backend.allSet("try");
    backend.cleanup = [{ ...GEMMA, state: "downloading", downloaded_bytes: 1_000_000_000 }];
    show();
    // One download: the speech model's 477 MB plus Gemma's progress, one bar.
    await screen.findByText("Downloading on-device models (speech + cleanup) · 1477 of 3584 MB");
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    // The speech model is in, so practice doesn't wait for cleanup.
    expect(screen.queryByText(/Getting the model ready/)).toBeNull();
    await waitFor(() => {
      expect(screen.getByLabelText<HTMLTextAreaElement>(/Hold the key, say/).disabled).toBe(false);
    });
    // The strip's one Cancel stops the Gemma phase too.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByText("Download paused · 1477 of 3584 MB");
    expect(backend.named("cancel_local_model_download")[0]?.args).toEqual({ id: PARAKEET.id });
    expect(backend.cleanup[0]?.state).toBe("partial");
    expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
  });

  it("Cancel stops it and offers Resume", async () => {
    downloading();
    show();
    await screen.findByText("Downloading on-device models (speech + cleanup) · 212 of 477 MB");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByText("Download paused · 212 of 477 MB");
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    await screen.findByText("Downloading on-device models (speech + cleanup) · 212 of 477 MB");
  });

  it("a failed download offers Retry and the own key", async () => {
    downloading();
    const model = backend.model(PARAKEET.id);
    model.state = "partial";
    model.error = "The disk is full.";
    show();
    await screen.findByText(/stopped: The disk is full\./);
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use my own key" }));
    await screen.findByText("How should Vocet transcribe?");
  });
});

describe("Permissions", () => {
  beforeEach(() => {
    backend.step = "permissions";
    backend.welcomePassed = true;
    backend.keys.openrouter = true;
  });

  it("N1: someone who finished setup is told why macOS asks again, and Done ends it", async () => {
    backend.askedAgain = true;
    backend.microphone = "not_determined";
    backend.accessibility = "not_determined";
    show();
    await screen.findByText(/This happens after an update that changes how Vocet is signed/);
    expect(screen.getByText(ASKED_AGAIN + ".")).toBeTruthy();
    expect(
      screen.getByText(/Your settings, history and saved key are all\s+still here\.$/),
    ).toBeTruthy();
    expect(screen.queryByText(/nothing else to set up/)).toBeNull();
    expect(screen.queryByText(/means the old version/)).toBeNull();
    expect(screen.queryByText(/Allow or Open System Settings/)).toBeNull();
    // The fix is numbered steps inside the Accessibility card, in the Design Lead's words.
    const card = within(screen.getByRole("region", { name: "Accessibility" }));
    expect(card.getByText(OLD_ROW_LEAD)).toBeTruthy();
    const steps = card.getAllByRole("listitem").map((item) => item.textContent);
    expect(steps).toEqual(OLD_ROW_STEPS);
    expect(OLD_ROW_STEPS).toEqual([
      "In System Settings → Privacy & Security → Accessibility, select Vocet and click −.",
      "Click Allow here, then turn on the new Vocet row.",
      "No new row? Click + and add Vocet from Applications.",
    ]);
    expect(
      within(screen.getByRole("region", { name: "Microphone" })).queryByText(OLD_ROW_LEAD),
    ).toBeNull();
    expect(primary("Done").disabled).toBe(true);
    expect(screen.getByText(BOTH_REASON_DONE)).toBeTruthy();
    backend.microphone = "granted";
    backend.accessibility = "granted";
    refocus();
    await waitFor(() => {
      expect(primary("Done").disabled).toBe(false);
    });
    expect(screen.queryByText(OLD_ROW_LEAD)).toBeNull();
    fireEvent.click(primary("Done"));
    await waitFor(() => {
      expect(backend.named("finish_onboarding").length).toBe(1);
    });
  });

  it("N1: the relaunch hint agrees with removing the old row", async () => {
    backend.askedAgain = true;
    backend.microphone = "granted";
    backend.accessibility = "not_determined";
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Allow Accessibility" }));
    await screen.findByText(/Turning the old row off and on won't help/);
    expect(screen.queryByText(/^Turned it on and nothing changed/)).toBeNull();
    expect(screen.getByText(OLD_ROW_LEAD)).toBeTruthy();
  });

  it("N1: the steps go once Accessibility is allowed, even with the microphone still to do", async () => {
    backend.askedAgain = true;
    backend.microphone = "not_determined";
    backend.accessibility = "granted";
    show();
    await screen.findByText(ASKED_AGAIN + ".");
    expect(screen.queryByText(OLD_ROW_LEAD)).toBeNull();
  });

  it("N1: Done still closes it after a relaunch, with both allowed by then", async () => {
    backend.askedAgain = true;
    backend.microphone = "granted";
    backend.accessibility = "granted";
    show();
    await screen.findByText(ASKED_AGAIN + ".");
    expect(primary("Done").disabled).toBe(false);
    expect(screen.queryByText(OLD_ROW_LEAD)).toBeNull();
  });

  it("N1: first-time setup and a repeat with both allowed show no such notice", async () => {
    backend.microphone = "not_determined";
    backend.accessibility = "not_determined";
    const first = show();
    await screen.findByText("Two permissions");
    expect(screen.queryByText(ASKED_AGAIN + ".")).toBeNull();
    primary("Continue");
    first.unmount();

    backend.microphone = "granted";
    backend.accessibility = "granted";
    show();
    await screen.findByText("Two permissions");
    expect(screen.queryByText(ASKED_AGAIN + ".")).toBeNull();
    expect(primary("Continue").disabled).toBe(false);
  });

  it("criterion 4: explains both before anything is asked", async () => {
    show();
    await screen.findByText("Records only while you hold your key.");
    expect(
      screen.getByText("Notices your key and pastes at your cursor. It doesn't read your screen."),
    ).toBeTruthy();
    expect(backend.named("request_permission")).toEqual([]);
    expect(primary("Continue").disabled).toBe(true);
    expect(screen.getByText(BOTH_REASON)).toBeTruthy();
  });

  it("criterion 4: Allow asks, and a grant is detected without pressing anything", async () => {
    backend.micAnswer = "not_determined";
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Allow Microphone" }));
    await screen.findByText("Waiting for macOS…");
    backend.microphone = "granted";
    refocus();
    await screen.findByText("✓ Allowed");
    expect(backend.step).toBe("permissions");
  });

  it("criterion 4: Continue unlocks only when both are allowed", async () => {
    backend.microphone = "granted";
    show();
    await screen.findByText("✓ Allowed");
    expect(primary("Continue").disabled).toBe(true);
    backend.accessibility = "granted";
    refocus();
    await waitFor(() => {
      expect(primary("Continue").disabled).toBe(false);
    });
    fireEvent.click(primary("Continue"));
    await screen.findByText("Your dictation key");
  });

  it("criterion 4: denied gives Open System Settings, the exact path, and the relaunch", async () => {
    backend.microphone = "denied";
    show();
    await screen.findByText("System Settings → Privacy & Security → Microphone → turn on Vocet.");
    fireEvent.click(screen.getByRole("button", { name: "Open System Settings" }));
    await waitFor(() => {
      expect(backend.named("request_permission")[0]?.args).toEqual({ permission: "microphone" });
    });
    fireEvent.click(screen.getByRole("button", { name: "Relaunch and resume" }));
    await waitFor(() => {
      expect(backend.named("relaunch_app")).toHaveLength(1);
    });
  });

  it("criterion 4: granted but not applied offers Relaunch only once it has lasted", async () => {
    backend.microphone = "granted";
    backend.accessibility = "granted";
    backend.needsRelaunch = true;
    show();
    await screen.findByText("Two permissions");
    expect(screen.queryByRole("button", { name: "Relaunch and resume" })).toBeNull();
    for (let i = 0; i < RELAUNCH_AFTER_POLLS + 1; i += 1) {
      refocus();
      await act(async () => {
        await Promise.resolve();
      });
    }
    await screen.findByRole("button", { name: "Relaunch and resume" });
  });
});

describe("Try it", () => {
  beforeEach(() => {
    backend.allSet("try");
  });

  async function stepOpen() {
    show();
    await screen.findByText("Your dictation key");
    return screen.getByLabelText<HTMLTextAreaElement>(/Hold the key, say/);
  }

  it("criterion 5: while the model downloads, practice is blocked with progress", async () => {
    const model = backend.model(PARAKEET.id);
    model.state = "downloading";
    model.downloaded_bytes = 477_000_000 * 0.82;
    const box = await stepOpen();
    expect(box.disabled).toBe(true);
    await screen.findByText("Getting the model ready: 82%");
    await waitFor(() => {
      expect(backend.named("set_hotkey_recording")[0]?.args).toEqual({ recording: true });
    });
  });

  it("criterion 5: the key comes back when the model is ready", async () => {
    const model = backend.model(PARAKEET.id);
    model.state = "downloading";
    const box = await stepOpen();
    await waitFor(() => {
      expect(box.disabled).toBe(true);
    });
    model.state = "ready";
    await waitFor(
      () => {
        expect(box.disabled).toBe(false);
      },
      { timeout: 2500 },
    );
    // The pause is lifted by an effect's cleanup, after the box is enabled.
    await waitFor(() => {
      expect(backend.named("set_hotkey_recording").at(-1)?.args).toEqual({ recording: false });
    });
  });

  it("Design Lead: the title is Try it, with the key as a small label", async () => {
    await stepOpen();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Try it");
    expect(screen.getByText("Your dictation key").tagName).toBe("SPAN");
  });

  it("TOS1: Done finishes setup, whatever the box holds, and applies the checkbox (on by default)", async () => {
    render(<App />);
    await screen.findByText("Your dictation key");
    const box = screen.getByRole<HTMLInputElement>("checkbox", {
      name: "Open Vocet when I log in",
    });
    expect(box.checked).toBe(true);
    expect(backend.settings.launch_at_login).toBe(false);
    fireEvent.click(primary("Done"));
    await waitFor(() => {
      expect(backend.named("finish_onboarding")).toHaveLength(1);
    });
    expect(backend.named("set_launch_at_login")[0]?.args).toEqual({ enabled: true });
    expect(backend.settings.launch_at_login).toBe(true);
    // Applied before setup ends, so a failure can still be shown.
    const order = backend.calls.map((call) => call.command);
    expect(order.indexOf("set_launch_at_login")).toBeLessThan(order.indexOf("finish_onboarding"));
    await waitFor(() => {
      expect(screen.queryByRole("navigation", { name: "Setup steps" })).toBeNull();
    });
    expect(screen.queryByText("You're set")).toBeNull();
  });

  it("TOS1: an unchecked box is applied as off", async () => {
    backend.settings = { ...backend.settings, launch_at_login: true };
    await stepOpen();
    fireEvent.click(screen.getByRole("checkbox", { name: "Open Vocet when I log in" }));
    fireEvent.click(primary("Done"));
    await waitFor(() => {
      expect(backend.named("finish_onboarding")).toHaveLength(1);
    });
    expect(backend.named("set_launch_at_login")[0]?.args).toEqual({ enabled: false });
    expect(backend.settings.launch_at_login).toBe(false);
  });

  it("TOS1: a login item that can't be set is said, and setup stays open", async () => {
    const original = backend.handle;
    mockIPC((command, payload) => {
      if (command === "set_launch_at_login") {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "Couldn't change the login item.";
      }
      return original(command, payload);
    });
    await stepOpen();
    fireEvent.click(primary("Done"));
    await screen.findByText("Couldn't change the login item.");
    expect(backend.named("finish_onboarding")).toEqual([]);
  });

  it("TOS1: Try it is the last step and points to the menu bar", async () => {
    await stepOpen();
    expect(screen.getByText(/Find Vocet in the menu bar/)).toBeTruthy();
    expect(screen.queryByText("Ready")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(document.body.textContent).not.toMatch(/usage and error events/i);
  });

  it("U11 criterion 7: no Reset to default, a small Change key, and the instruction", async () => {
    backend.settings = { ...backend.settings, hotkey: "RightCmd" };
    await stepOpen();
    expect(screen.queryByRole("button", { name: /Reset to default|Use default/ })).toBeNull();
    const change = screen.getByRole("button", { name: "Change key" });
    expect(change.className).toBe("link");
    expect(screen.getByText(new RegExp(PRACTICE_WORDS))).toBeTruthy();
    expect(document.body.textContent).not.toContain("Click the box");
    fireEvent.click(change);
    await screen.findByText("Press a key…");
    expect(screen.queryByRole("button", { name: /Reset to default|Use default/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByRole("button", { name: "Change key" });
  });

  it("shows the dictation key and records a different one", async () => {
    await stepOpen();
    await waitFor(() => {
      expect(screen.getByLabelText("Dictation key").textContent).toBe("Right ⌥");
    });
    fireEvent.click(screen.getByRole("button", { name: "Change key" }));
    keyDown("MetaRight");
    keyUp("MetaRight");
    await waitFor(() => {
      expect(backend.settings.hotkey).toBe("RightCmd");
    });
    releaseAllKeys();
  });

  describe("the box's focus (U9 criterion 6)", () => {
    it("has it on arriving, so the first dictation needs no click", async () => {
      const box = await stepOpen();
      expect(document.activeElement).toBe(box);
    });

    it("gets it back after a new key is recorded, and stays empty", async () => {
      const box = await stepOpen();
      fireEvent.click(screen.getByRole("button", { name: "Change key" }));
      box.blur();
      keyDown("MetaRight");
      keyUp("MetaRight");
      await waitFor(() => {
        expect(backend.settings.hotkey).toBe("RightCmd");
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(box);
      });
      expect(box.value).toBe("");
      releaseAllKeys();
    });

    it("gets it back after a cancelled recording, by Cancel and by Esc", async () => {
      const box = await stepOpen();
      fireEvent.click(screen.getByRole("button", { name: "Change key" }));
      box.blur();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => {
        expect(document.activeElement).toBe(box);
      });

      fireEvent.click(screen.getByRole("button", { name: "Change key" }));
      box.blur();
      keyDown("Escape");
      keyUp("Escape");
      await waitFor(() => {
        expect(document.activeElement).toBe(box);
      });
      expect(box.value).toBe("");
      releaseAllKeys();
    });
  });
});

describe("the window", () => {
  it("criterion 7: resumes at the step the app kept", async () => {
    backend.allSet("permissions");
    show();
    await screen.findByText("Two permissions");
  });

  it("says when the setup can't load", async () => {
    mockIPC((command) => {
      if (command === "get_onboarding") {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "No state.";
      }
      return null;
    });
    show();
    await screen.findByText(/Couldn't load the setup/);
  });

  it("shows the app's refusal when a step isn't done", async () => {
    // Both permissions, but no engine chosen: the app won't go to Try it.
    backend.step = "permissions";
    backend.welcomePassed = true;
    backend.microphone = "granted";
    backend.accessibility = "granted";
    show();
    await waitFor(() => {
      expect(primary("Continue").disabled).toBe(false);
    });
    fireEvent.click(primary("Continue"));
    await screen.findByText("Choose how speech becomes text first.");
    expect(backend.step).toBe("permissions");
  });
});
