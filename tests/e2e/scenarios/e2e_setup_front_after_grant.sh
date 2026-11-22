# TOS1 round 3: after the person allows a permission, setup comes back to the
# front. On the owner's Mac it stayed behind System Settings: the window's own
# poll stopped while macOS reported the covered window as hidden to its page,
# so the grant was never noticed. The app now watches the two permissions from
# Rust while setup is open.
#
# In this VM's clone only: the microphone is really reset for the app (as in
# e2e_microphone_denied_then_recover) and setup opens on Permissions. System
# Settings is put over it, as big as the screen, and a press of the hotkey
# makes macOS ask for the microphone; "Allow" is pressed in the prompt. A
# sampler in the VM (fixtures/front-sampler.sh) records the frontmost app, and
# whether System Settings is still running, while that happens: setup must be
# in front while System Settings is still open. Screenshots before and after
# go to the run's output. (Accessibility is the same code path; its switch
# needs a password typed over VNC, which this scenario doesn't depend on.)

FRONT_WINDOW="Set up"
FRONT_LOG=/tmp/front.log

front_restore() {
  front_sampler_stop || true
  mic_restore
}

front_sampler_start() {
  vm "rm -f $FRONT_LOG; nohup sh $(q "$VM_FIXTURES/front-sampler.sh") $FRONT_LOG >/dev/null 2>&1 & echo \$! >/tmp/front.pid"
}

front_sampler_stop() {
  vm "kill \$(cat /tmp/front.pid 2>/dev/null) 2>/dev/null; rm -f /tmp/front.pid" || true
}

# Setup at its smallest (680 by 520 points) and System Settings over it, as big
# as it gets: System Settings is about 715 points wide, so only the smallest
# setup window is covered all over, and macOS then tells its page it is hidden.
front_cover_setup() {
  obs_set_frame "$APP_NAME" 'Set up' 20 60 680 520 || return 1
  obs_set_frame "System Settings" '' 0 0 960 720
}

# The sampler saw System Settings in front.
front_saw_settings_in_front() {
  vm "grep -q '^System Settings|1\$' $FRONT_LOG"
}

# After System Settings was in front, the app was in front while System
# Settings was still running: the app came forward by itself.
front_app_came_forward() {
  vm "awk -F'|' -v app=$(q "$PROC_NAME") '\$1 == \"System Settings\" { seen = 1 } seen && \$1 == app && \$2 == 1 { found = 1 } END { exit !found }' $FRONT_LOG"
}

e2e_setup_front_after_grant() {
  MIC_EVIDENCE="$OUT_DIR/e2e_setup_front_after_grant.evidence.txt"
  : >"$MIC_EVIDENCE"
  arm_key_cleanup e2e_setup_front_after_grant
  KEY_CLEANUP_HOOK=front_restore
  fresh_app_state
  settings_reset
  quit_system_settings
  seed_engine_chosen
  expect "the app's microphone permission is reset in this clone" mic_reset

  launch --mock-text "$MOCK_TEXT" --debug-onboarding
  expect "setup opens on Permissions" \
    wait_for_log 'onboarding shown at launch step=Permissions' 30
  expect "its window is on screen" ax_ok wait-window "$APP_NAME" "$FRONT_WINDOW" 10
  expect "Permissions is shown" \
    ax_ok wait-text "$APP_NAME" "$FRONT_WINDOW" "Records only while you hold your key" 15

  # System Settings over it, so setup is covered all over:
  # macOS then tells setup's page it is hidden. (Terminal jobs take the front
  # for themselves, so System Settings is brought back by a plain ssh `open`.)
  expect "the sampler starts" front_sampler_start
  vm "open $(q "$MIC_SETTINGS_URL")"
  expect "System Settings is open" ax_ok wait-window "$MIC_SETTINGS_APP" "$MIC_SETTINGS_WINDOW" 15
  expect "setup is at its smallest and System Settings covers it" front_cover_setup
  vm "open -a $(q "$MIC_SETTINGS_APP")"
  sleep 2
  expect "System Settings is in front of setup" front_saw_settings_in_front
  screenshot "e2e_setup_front_after_grant-before"

  # macOS asks while System Settings is in front; the person allows.
  launch --press
  expect "macOS shows its prompt" mic_prompt_showing
  expect "Allow is pressed" mic_prompt_answer "Allow"
  MIC_GRANTED=1
  launch --release
  expect "the app noticed the grant" wait_for_log 'a permission was granted' 15
  sleep 1
  front_sampler_stop
  mic_evidence "frontmost app over time (name|System Settings running): $(vm "uniq -c $FRONT_LOG | tr '\n' ' '")"
  expect "setup came to the front while System Settings was still open" front_app_came_forward
  screenshot "e2e_setup_front_after_grant-after"

  [ "$SCENARIO_FAILED" = 0 ] || dump_ui e2e_setup_front_after_grant
  collect_log e2e_setup_front_after_grant
}
