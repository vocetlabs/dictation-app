#!/bin/sh
# Records which app is in front, a few times a second, until it is killed:
# "<frontmost app's name>|<1 if System Settings is running, else 0>" per line,
# appended to the file in $1. e2e_setup_front_after_grant starts it in the VM.
# `lsappinfo`, not System Events: Vocet is a menu-bar app, which System Events
# never reports as frontmost.
out=$1
[ -n "$out" ] || exit 2
while :; do
  front=$(lsappinfo info -only name "$(lsappinfo front)" 2>/dev/null | sed -n 's/.*"LSDisplayName"="\(.*\)".*/\1/p')
  if pgrep -x "System Settings" >/dev/null 2>&1; then settings=1; else settings=0; fi
  printf '%s|%s\n' "$front" "$settings" >>"$out"
  sleep 0.2
done
