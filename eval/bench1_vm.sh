#!/usr/bin/env bash
# BENCH1, internal: runs the dictation bench (github.com/vocetlabs/dictation-bench, ./bench) inside this
# Mac's Lume VM dictation-vm-bench, a clone of dictation-vm-golden that stands in for dictation-vm-2 while it
# holds that VM's e2e lock (the Lead, 2026-11-21), so a Tester's tests/e2e/run.sh says "VM busy" instead of
# resetting a VM in use. For local and quiet-Mac timed runs; the bench's own CI runs accuracy on GitHub.
# BENCH_DIR is a local clone of the bench (default: dictation-bench next to this repository's clone).
#
#   eval/bench1_vm.sh lock | unlock          # dictation-vm-2's e2e lock, held by a sleeper process
#   eval/bench1_vm.sh vm-create              # clone the golden image (once; 8 GB, 4 CPUs)
#   eval/bench1_vm.sh vm-start [--timed] | vm-stop     # --timed refuses while any other VM runs
#   eval/bench1_vm.sh push                   # the bench (BENCH_DIR) and its clips into ~/bench in the VM
#   eval/bench1_vm.sh install <App.app|App.dmg>        # into /Applications in the VM
#   eval/bench1_vm.sh bench <./bench args>   # ./bench in the VM's Terminal (Accessibility lives there),
#                                            #   waits, prints the log; e.g. bench run --app vocet --smoke
#   eval/bench1_vm.sh pull <app>-<machine>   # out/<run>/{run.json,results.csv,score.json} back to the host
#   eval/bench1_vm.sh ssh <cmd> | screenshot <png> | cua <tool> '<json>'
#
# Host load (load average, free memory) is appended to $BENCH_DIR/out/host_load.txt at the start and end
# of every `bench run`.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
common=$(cd "$HERE/.." && git rev-parse --path-format=absolute --git-common-dir)  # <clone>/.git
BENCH=${BENCH_DIR:-$(dirname "$(dirname "$common")")/dictation-bench}
VM=dictation-vm-bench
GOLDEN=dictation-vm-golden
LOCK=${E2E_LOCK_DIR:-$HOME/.cache/dictation-e2e}/dictation-vm-2.lock
SSH_KEY=${SSH_KEY:-$HOME/.ssh/dictation_vm_ed25519}
VM_DIR=/Users/lume/bench
WAIT_LIMIT=${BENCH_WAIT_LIMIT:-14400}   # seconds a Terminal job may run before we give up waiting

die() { echo "bench1_vm: $*" >&2; exit 1; }
vm_ip() { lume get "$VM" -f json 2>/dev/null | jq -r 'if type=="array" then .[0] else . end | .ipAddress // empty'; }
# vm <words...>: one remote shell command (the remote shell joins and parses them); callers pass only fixed
# text and arguments already quoted with q.
vm() { ssh -i "$SSH_KEY" -o HostKeyAlias="$VM" -o BatchMode=yes -o ConnectTimeout=5 -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=4 "lume@$(vm_ip)" "$@"; }
# q <args...>: each argument quoted for the remote shell, so its boundaries and characters survive SSH.
q() { printf '%q ' "$@"; }
# A run, app or tool name: one path component of plain characters (no /, no .., no shell syntax).
valid_name() { [[ $1 =~ ^[A-Za-z0-9._-]+$ && $1 != . && $1 != .. ]] || die "not a plain name: '$1'"; }
known_host() {
  local known=$HOME/.ssh/known_hosts
  ssh-keygen -F "$VM" -f "$known" >/dev/null 2>&1 && return 0
  grep -q '^dictation-vm ' "$known" || die "no host key for dictation-vm to copy"
  sed -n "s/^dictation-vm /$VM /p" "$known" >>"$known"
}
host_load() {
  printf '%s load %s; memory free %s\n' "$(date -u +%FT%TZ)" "$(sysctl -n vm.loadavg | tr -d '{}' | xargs)" \
    "$(memory_pressure 2>/dev/null | awk -F': ' '/free percentage/ {print $2}')"
}

# One Terminal job at a time per VM: a lock directory on this Mac holding the owner's PID (a dead owner's
# lock is taken over).
JOB_LOCK=${E2E_LOCK_DIR:-$HOME/.cache/dictation-e2e}/$VM.job.lock
job_lock() {
  mkdir -p "$(dirname "$JOB_LOCK")"
  if ! mkdir "$JOB_LOCK" 2>/dev/null; then
    local owner
    owner=$(cat "$JOB_LOCK/pid" 2>/dev/null || true)
    if [ -n "$owner" ] && kill -0 "$owner" 2>/dev/null; then die "another job (PID $owner) is running in $VM"; fi
    echo "bench1_vm: taking over a stale job lock (PID ${owner:-?})" >&2
    rm -rf "$JOB_LOCK"; mkdir "$JOB_LOCK" || die "could not take $JOB_LOCK"
  fi
  echo $$ >"$JOB_LOCK/pid"
  trap 'rm -rf "$JOB_LOCK"' EXIT
}

# vm_terminal <argv...>: runs the command in the VM's Terminal (Accessibility lives there) from ~/bench, in a
# job folder of its own (mktemp in the VM); waits (bounded) for its status; prints the log; returns the status.
vm_terminal() {
  local job start=$SECONDS st
  job_lock
  job=$(vm "mkdir -p $(q "$VM_DIR/out") && mktemp -d $(q "$VM_DIR/out/job.XXXXXX")") || die "no job folder in the VM"
  { printf '#!/bin/zsh\ncd %s || exit 97\n( ' "$(q "$VM_DIR")"; q "$@"
    printf ') >%s 2>&1\nst=$?\necho $st >%s && mv -f %s %s\n' "$(q "$job/log")" "$(q "$job/status.tmp")" \
      "$(q "$job/status.tmp")" "$(q "$job/status")"
  } | vm "cat >$(q "$job/job.command") && chmod +x $(q "$job/job.command")"
  vm "open -a Terminal $(q "$job/job.command")"
  until vm "test -f $(q "$job/status")" 2>/dev/null; do
    [ $((SECONDS - start)) -lt "$WAIT_LIMIT" ] || die "no status after ${WAIT_LIMIT}s; see $job/log in the VM"
    vm "tail -n 1 $(q "$job/log")" 2>/dev/null | cut -c1-160 || echo "(VM not answering)"
    sleep 30
  done
  st=$(vm "cat $(q "$job/status")")
  vm "cat $(q "$job/log")"
  [[ $st =~ ^[0-9]+$ ]] || die "unreadable job status"
  return "$st"
}

# Installs a .dmg already copied into the VM: the image must mount and hold an .app, the copy must land
# whole (same bundle id), and the image is detached and removed however it ends.
INSTALL_DMG='set -euo pipefail
dmg=$1
mnt=$(hdiutil attach -nobrowse -readonly "$dmg" | awk -F"\t" "/\\/Volumes\\// {print \$NF}" | tail -1)
[ -n "$mnt" ] && [ -d "$mnt" ] || { echo "the image did not mount" >&2; rm -f "$dmg"; exit 1; }
trap '"'"'hdiutil detach -quiet "$mnt" || true; rm -f "$dmg"'"'"' EXIT
app=$(find "$mnt" -maxdepth 1 -name "*.app" -print -quit)
[ -n "$app" ] || { echo "no .app in the image" >&2; exit 1; }
dest="/Applications/$(basename "$app")"
rm -rf "$dest"
ditto "$app" "$dest"
want=$(defaults read "$app/Contents/Info" CFBundleIdentifier)
got=$(defaults read "$dest/Contents/Info" CFBundleIdentifier)
[ "$want" = "$got" ] || { echo "the copy in $dest is incomplete" >&2; exit 1; }
echo "installed $(basename "$app") ($got)"'

cmd=${1:-}; shift || true
case "$cmd" in
  lock)
    mkdir -p "$(dirname "$LOCK")"
    [ ! -L "$LOCK" ] || die "locked already: $(readlink "$LOCK")"
    nohup sleep 172800 >/dev/null 2>&1 &
    holder=$!
    ln -s "$holder $(date '+%F %T') BENCH1 ($VM)" "$LOCK" || { kill "$holder"; die "lost the race for $LOCK"; }
    echo "$holder" >"$LOCK.bench-holder"
    echo "holding $LOCK (pid $holder)"
    ;;
  unlock)
    holder=$(cat "$LOCK.bench-holder" 2>/dev/null || true)
    [ -n "$holder" ] || die "the bench holds no lock"
    if [ "$(readlink "$LOCK" 2>/dev/null | cut -d' ' -f1)" = "$holder" ]; then rm -f "$LOCK"; fi
    kill "$holder" 2>/dev/null || true
    rm -f "$LOCK.bench-holder"
    echo "released $LOCK"
    ;;
  vm-create)
    lume ls | grep -q "^$VM " && die "$VM exists already"
    lume clone "$GOLDEN" "$VM" && lume set "$VM" --memory 8GB --cpu 4
    ;;
  vm-start)
    others=$(lume ls 2>/dev/null | awk '/running/ {print $1}' | grep -vx "$VM" || true)
    [ "${1:-}" != --timed ] || [ -z "$others" ] || die "timed runs need the only running VM; running: $(echo "$others" | xargs)"
    [ "$(echo "$others" | grep -c . || true)" -lt 2 ] || die "two other macOS VMs are running (Apple's limit)"
    lume run "$VM" --no-display --detach >/dev/null 2>&1 || true
    for _ in $(seq 1 90); do [ -n "$(vm_ip)" ] && break; sleep 2; done
    known_host
    for _ in $(seq 1 60); do vm true 2>/dev/null && break; sleep 2; done
    vm "sw_vers -productVersion"
    ;;
  vm-stop)
    vm "osascript -e 'tell application \"System Events\" to shut down'" 2>/dev/null || lume stop "$VM"
    ;;
  push)
    [ -d "$BENCH" ] || die "no bench at $BENCH: git clone https://github.com/vocetlabs/dictation-bench (or set BENCH_DIR)"
    [ -f "$BENCH/clips/manifest.csv" ] || die "no clips: $BENCH/bench fetch"
    vm "test -x ~/.local/bin/uv || curl -LsSf https://astral.sh/uv/install.sh | sh" >/dev/null
    vm "mkdir -p $(q "$VM_DIR")"
    tar -C "$BENCH" --exclude clips --exclude out --exclude work --exclude __pycache__ --exclude .git -cf - . |
      vm "tar -C $(q "$VM_DIR") -xf -"
    tar -C "$BENCH" -cf - clips | vm "rm -rf $(q "$VM_DIR/clips") && tar -C $(q "$VM_DIR") -xf -"
    vm "ls $(q "$VM_DIR")"
    ;;
  install)
    src=${1:?App.app or App.dmg}; name=$(basename "$src")
    case "$name" in
      *.app)
        tar -C "$(dirname "$src")" -cf - "$name" |
          vm "rm -rf $(q "/Applications/$name") && tar -C /Applications -xf - && test -d $(q "/Applications/$name/Contents")" ||
          die "installing $name failed"
        echo "installed $name" ;;
      *.dmg)
        tmp=$(vm 'mktemp -t bench-dmg') || die "no temporary file in the VM"
        vm "cat >$(q "$tmp")" <"$src" || die "copying $name into the VM failed"
        printf '%s\n' "$INSTALL_DMG" | vm "bash -s -- $(q "$tmp")" || die "installing $name failed" ;;
      *) die "not an .app or .dmg: $src" ;;
    esac
    ;;
  bench)
    mkdir -p "$BENCH/out"
    is_run=0; [ "${1:-}" = run ] && is_run=1
    [ "$is_run" = 0 ] || echo "start $* $(host_load)" >>"$BENCH/out/host_load.txt"
    prev=""
    for arg in "$@"; do [ "$prev" != --app ] || valid_name "$arg"; prev=$arg; done
    st=0; vm_terminal env BENCH_MACHINE=mac-vm ./bench "$@" || st=$?
    [ "$is_run" = 0 ] || echo "end   $* $(host_load)" >>"$BENCH/out/host_load.txt"
    exit "$st"
    ;;
  pull)
    run=${1:?run folder name}; valid_name "$run"; mkdir -p "$BENCH/out/$run"
    for f in run.json results.csv score.json; do
      vm "cat $(q "$VM_DIR/out/$run/$f")" >"$BENCH/out/$run/$f" 2>/dev/null || rm -f "$BENCH/out/$run/$f"
    done
    ls -l "$BENCH/out/$run"
    ;;
  ssh) vm "$@" ;;  # a raw remote shell command, by design
  screenshot) vm "~/.local/bin/cua-driver call get_desktop_state '{}'" | jq -r '.screenshot_png_b64 // empty' | base64 -d >"${1:?png}" ;;
  cua) tool=${1:?tool}; valid_name "$tool"
    printf '%s' "${2:-{\}}" | vm "cat >/tmp/cua.json; ~/.local/bin/cua-driver call $(q "$tool") \"\$(cat /tmp/cua.json)\"" ;;
  *) sed -n '2,19p' "$0"; exit 2 ;;
esac
