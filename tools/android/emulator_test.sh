#!/usr/bin/env bash
# Runs inside an Android emulator (D-168): installs the APK, drives the real app and asks the phone
# whether the reminder was scheduled and shown. Everything useful is printed to the job log.
set -u
PKG=taqweem.nawy.app
APK=${1:?apk path}
OUT=${2:-emulator-out}
mkdir -p "$OUT"

adb install -r "$APK" || exit 1
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
adb logcat -c
adb shell am start -n $PKG/.MainActivity
sleep 12
PID=$(adb shell pidof $PKG | tr -d '\r')
echo "app pid: $PID"
adb forward tcp:9222 localabstract:webview_devtools_remote_"$PID"

node tools/android/emulator_test.mjs "$OUT"
STATUS=$?

echo "===== alarms for the app ====="
adb shell dumpsys alarm | grep -B1 -A6 "$PKG" | head -80
echo "===== notifications for the app ====="
adb shell dumpsys notification --noredact | grep -A25 "pkg=$PKG" | head -120
echo "===== logcat (app, notifications, alarms) ====="
adb logcat -d | grep -iE "$PKG|LocalNotif|Capacitor|AlarmManager|NotificationService" | tail -80
adb exec-out screencap -p > "$OUT/final.png"
adb logcat -d > "$OUT/logcat.txt"
adb shell dumpsys notification --noredact > "$OUT/notifications.txt"
exit $STATUS
