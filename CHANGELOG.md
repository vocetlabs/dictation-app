# Changelog

All notable changes to dictation-app are listed here, newest first. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The section
for a version is the text of its GitHub release and of the "Update available"
window (`scripts/release.sh` copies it, so keep each section plain text for
testers: short lines, no HTML).

## [Unreleased]

## [0.2.1] — 2026-11-25

Cloud cleanup now understands when you correct yourself.

- **Self-corrections.** Say "let's meet at 3, sorry, 4 pm" or "invite Sam,
  I mean Sara" and Vocet writes only what you meant: "Let's meet at 4 pm",
  "Invite Sara". It also removes a few more filler sounds and ends a sentence
  with a period when you forget one.
- **"Scratch that" is safe.** If the cleaned text drops "scratch that" or
  "never mind" but keeps what you cancelled, Vocet pastes your plain
  transcript instead, so a cancelled instruction never reads as a real one.
- **On this Mac.** On-device cleanup also removes "erm", "hmm" and "mm".

## [0.2.0] — 2026-11-22

Dictation that comes out ready to send: with your own OpenRouter account, or
on your Mac, where your audio and dictated text stay.

- **Cleaner text, in the cloud and on your Mac.** After your speech becomes
  text, Vocet removes filler words, false starts and stammers before it pastes.
  Cleanup has one 3 second deadline, the same for both: if it takes longer, or
  its answer looks wrong, you get the plain transcript instead, so a dictation
  is never lost.
- **Connect OpenRouter in one click.** Setup and Settings, Speech have a
  Connect OpenRouter button: sign in at OpenRouter in your browser and Vocet
  keeps the key in your Keychain. It is the default. Add credits opens
  OpenRouter's credits page, and a dictation that fails for lack of credits
  offers the same. Pasting a key still works. Groq and OpenAI keys are no
  longer used.
- **Zero-data-retention routing for cleanup.** The cleanup request tells
  OpenRouter to use only hosts with zero data retention that do not train on
  your text. That is a routing policy, not a guarantee: OpenRouter self-serve
  accounts allow Safety Retention by default, so turn on "ZDR only" in your
  OpenRouter privacy settings, and OpenRouter's published exceptions to zero
  retention still apply
  (https://openrouter.ai/docs/guides/features/zdr). If no such host is
  available you get the plain transcript. Speech is transcribed by a separate
  route, which has no zero-retention option. The privacy policy has the
  details.
- **On this Mac.** A new choice in Speech that runs both models on your Mac:
  OrukQwen 1.7B for speech and Gemma 4 E2B for cleanup. One download of about
  4.4 GB, with one progress bar. Your audio and the text you dictate stay on
  the Mac. (Usage and error reports are on by default, with no audio or text;
  turn them off in Settings, Privacy.) It is a choice, not the default.
- **Setup in four steps.** Welcome, Speech, Permissions, Try it. The first
  screen says "By continuing, you agree to the Terms and Privacy Policy" and
  nothing is reported before you press Get started. Setup comes back to the
  front after you allow a permission in System Settings.
- **Terms and privacy pages** at vocetlabs.com/terms and
  vocetlabs.com/privacy, linked from setup and the app.
- **Fixed: a held recording that ended early.** A recording could stop by
  itself while you were still holding the key, and nothing was pasted
  (https://github.com/vocetlabs/dictation-app/issues/364).
- **The project moved** to https://github.com/vocetlabs/dictation-app. Old
  links redirect, and updates come from there.
- **Licence.** The source is now under the Functional Source License
  (FSL-1.1-ALv2): you can read, run, modify and self-host it, and each
  version becomes Apache 2.0 after two years.

### Requirements

- A Mac with Apple Silicon (M1 or newer), on macOS 13 (Ventura) or newer.
- For OpenRouter: internet and an OpenRouter account with credit.
- For On this Mac: disk space for the 4.4 GB download.

### Known limits

- Mac only. Windows comes later.
- With a modifier-only dictation key (the default, right Option), pressing a
  letter or another non-modifier key while you hold it drops the recording
  without a message
  (https://github.com/vocetlabs/dictation-app/issues/315).
- A long dictation on a model on your Mac can take a while, and has no time
  limit yet (https://github.com/vocetlabs/dictation-app/issues/316).
- Recordings stop after 5 minutes.
- If cleanup takes longer than 3 seconds, you get the plain transcript
  (https://github.com/vocetlabs/dictation-app/issues/374).
- If the on-device engine crashes, Vocet does not report it, because a crash
  report could contain what you said. If Vocet quits on its own, tell us in a
  bug report
  (https://github.com/vocetlabs/dictation-app/issues/226).
- With OpenRouter, your speech goes through OpenRouter to OpenAI, and the text
  to a cleanup model. Do not dictate anything you would not send to a cloud
  service.

## [0.1.0] — 2026-11-18

Vocet is a dictation app for the Mac. Hold a key, speak, let go, and your
words are typed into the app you are using. This is the first release, for
testers. Thank you for trying it.

### What Vocet does

- **Dictate into any app.** Hold the right Option key, speak, and let go. A
  small overlay shows when Vocet is recording and when it is working. The
  text is typed where your cursor is. Password fields are skipped on purpose.
- **Change the dictation key** in Settings, Dictation.
- **Speech on your Mac.** Download a model once (Parakeet for English, about
  480 MB; Qwen3-ASR for about 30 languages, including Hindi, about 590 MB).
  After that your speech is turned into text on the Mac and not sent anywhere.
- **Or speech with your own key.** Choose Groq or OpenAI and paste your key.
  Your speech goes to that provider. The key is kept in your macOS Keychain
  and never shown again.

### What is in this release

- **Setup.** A first-run window picks your language and speech, asks for the
  Microphone and Accessibility permissions, and has you try a dictation.
- **History.** Vocet keeps your last 25 dictations on this Mac so you can get
  the words back. Text only, never sent. Change the number or turn it off in
  Settings, History.
- **Menu bar.** Copy last dictation, History, Settings, Help and Quit.
- **Settings.** General, Dictation, Speech, Privacy, History, Help and About.
- **Help.** Troubleshoot checks the microphone, Accessibility, the dictation
  key and the speech engine. Report a problem shows you the exact text of a
  report to save, copy or open as a GitHub issue. Vocet never sends it for
  you. The log file never holds your words or your keys.
- **Updates.** Vocet checks when it starts, and Settings, General, Check now
  does it any time. Nothing is installed until you click Install and restart.
  Every update is signed.
- **Anonymous usage sharing, on by default.** It sends which features work and
  which fail, never audio, text you dictated, keys, app names or file paths.
  Turn it off in Settings, Privacy, "Share usage and error events". Off takes
  effect at once. The full list is in
  https://github.com/vocetlabs/dictation-app/blob/main/docs/privacy.md

### Requirements

- A Mac with Apple Silicon (M1 or newer), on macOS 13 (Ventura) or newer.
- For your own key: internet and a Groq or OpenAI API key.
- For speech on your Mac: disk space for the model you pick.

### Known limits

- Mac only. Windows comes later.
- Do not press other keys while you hold the dictation key. If you do, the
  recording is dropped without a message
  (https://github.com/vocetlabs/dictation-app/issues/315).
- A long dictation on a model on your Mac can take a while, and has no time
  limit yet (https://github.com/vocetlabs/dictation-app/issues/316).
- Recordings stop after 5 minutes.
- Using speech on your Mac with no network is built in but not yet checked.
- If the on-device engine crashes, Vocet does not report it, because a crash
  report could contain what you said. If Vocet quits on its own, tell us in a
  bug report
  (https://github.com/vocetlabs/dictation-app/issues/226).
- With your own key, your speech goes to Groq or OpenAI. Do not dictate
  anything you would not send to a cloud service.

[Unreleased]: https://github.com/vocetlabs/dictation-app/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/vocetlabs/dictation-app/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/vocetlabs/dictation-app/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/vocetlabs/dictation-app/releases/tag/v0.1.0
