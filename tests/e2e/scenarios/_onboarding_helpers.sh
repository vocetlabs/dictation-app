# Helpers for the onboarding scenarios (U8).

# The tray lists "Resume setup…" (it reads the app's state every few seconds).
tray_has_resume_setup() {
  local i
  for i in $(seq 1 10); do
    case $(tray_menu) in
      *"Resume setup"*) return 0 ;;
    esac
    sleep 1
  done
  log "  the tray has no Resume setup: $(tray_menu | paste -sd '|' -)"
  return 1
}

# The tray doesn't list "Resume setup…", within a few seconds.
tray_has_no_resume_setup() {
  local i
  for i in $(seq 1 10); do
    case $(tray_menu) in
      *"Resume setup"*) sleep 1 ;;
      *) return 0 ;;
    esac
  done
  log "  the tray still has Resume setup: $(tray_menu | paste -sd '|' -)"
  return 1
}

# Settings with an engine chosen, as an earlier launch leaves them: setup then
# opens past Welcome, at the first step that isn't done. The scenario's
# settings_reset removes them.
seed_engine_chosen() {
  vm "mkdir -p $(q "$(dirname "$SETTINGS_FILE_VM")") &&
    printf '%s' '{\"version\":2,\"transcription\":\"local\"}' >$(q "$SETTINGS_FILE_VM")"
}

# Screenshots of the setup window (moved from the retired screenshot
# walkthroughs): the appearance, the window from the cua-driver daemon, and
# obs_shot <name> saving it as onboarding-<name>.png in the run's output.
obs_appearance() {
  vm "osascript -e 'tell application \"System Events\" to tell appearance preferences to set dark mode to $([ "$1" = dark ] && echo true || echo false)'"
  sleep 2
}

# The app's window with <title part> ("Set up" by default), from the cua-driver
# daemon, which may capture windows where an ssh session or a Terminal job may not.
obs_window() {
  vm "~/.local/bin/cua-driver call list_windows '{}'" |
    jq -c --arg title "${1:-Set up}" '[.windows[] | select(.app_name == "'"$APP_NAME"'" and (.title | contains($title)))] | first // empty'
}

# obs_shot <name> [title part]: the window, as onboarding-<name>.png in the run's output.
obs_shot() {
  local window id pid png="$OUT_DIR/onboarding-$1.png"
  sleep 1
  window=$(obs_window "${2:-Set up}")
  if [ -z "$window" ]; then
    log "  no window for $1"
    return 0
  fi
  id=$(printf '%s' "$window" | jq -r .window_id)
  pid=$(printf '%s' "$window" | jq -r .pid)
  vm "rm -f /tmp/obs.png; ~/.local/bin/cua-driver call get_window_state '{\"pid\":$pid,\"window_id\":$id,\"include_accessibility_tree\":false,\"screenshot_out_file\":\"/tmp/obs.png\"}' >/dev/null" || true
  vm "base64 -i /tmp/obs.png" | base64 -d >"$png" || true
  log "  window screenshot $png: $(wc -c <"$png") bytes"
}

# obs_set_frame <app> <title part> <x> <y> <width> <height>: puts that app's
# on-screen window at that frame, in points (the VM's screen is 960 by 720), through
# the cua-driver daemon. Setup's smallest window is 680 by 520.
obs_set_frame() {
  local window id pid
  window=$(vm "~/.local/bin/cua-driver call list_windows '{}'" |
    jq -c --arg app "$1" --arg title "$2" '[.windows[] | select(.app_name == $app and .is_on_screen and (.title | contains($title)))] | first // empty')
  [ -n "$window" ] || return 1
  id=$(printf '%s' "$window" | jq -r .window_id)
  pid=$(printf '%s' "$window" | jq -r .pid)
  vm "~/.local/bin/cua-driver call set_window_frame '{\"pid\":$pid,\"window_id\":$id,\"x\":$3,\"y\":$4,\"width\":$5,\"height\":$6}' >/dev/null"
}
