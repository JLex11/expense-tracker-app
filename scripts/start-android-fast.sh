#!/usr/bin/env bash
set -euo pipefail

SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Android/Sdk}}"
EMULATOR_BIN="${ANDROID_EMULATOR_BIN:-$SDK_ROOT/emulator/emulator}"
ADB_BIN="${ADB_BIN:-$SDK_ROOT/platform-tools/adb}"
LOG_FILE="${EXPO_ANDROID_EMULATOR_LOG:-/tmp/expo-android-emulator.log}"

if [[ ! -x "$EMULATOR_BIN" ]]; then
  echo "No se encontro emulator en: $EMULATOR_BIN"
  exit 1
fi

if [[ ! -x "$ADB_BIN" ]]; then
  if command -v adb >/dev/null 2>&1; then
    ADB_BIN="$(command -v adb)"
  else
    echo "No se encontro adb en: $ADB_BIN ni en PATH"
    exit 1
  fi
fi

AVD_NAME="${AVD_NAME:-}"
if [[ -z "$AVD_NAME" ]]; then
  AVD_NAME="$("$EMULATOR_BIN" -list-avds | head -n1 || true)"
fi

if [[ -z "$AVD_NAME" ]]; then
  echo "No hay AVDs disponibles. Crea uno en Android Studio (Device Manager)."
  exit 1
fi

if "$ADB_BIN" devices | awk 'NR>1 {print $1,$2}' | rg -q '^emulator-[0-9]+\s+device$'; then
  echo "Ya hay un emulador activo. Reutilizando dispositivo."
else
  start_emulator() {
    : > "$LOG_FILE"
    nohup "$EMULATOR_BIN" "$@" >>"$LOG_FILE" 2>&1 &
    local pid=$!
    sleep 4
    if ! kill -0 "$pid" 2>/dev/null; then
      return 1
    fi
    return 0
  }

  base_args=(
    -avd "$AVD_NAME"
    -accel on
    -gpu host
    -no-boot-anim
  )

  # Only a subset of QEMU flags is supported by Android Emulator.
  fast_args=(
    "${base_args[@]}"
    -qemu
    -cpu host
  )
  if [[ -n "${ANDROID_QEMU_EXTRA_ARGS:-}" ]]; then
    # Deliberate word splitting to allow: ANDROID_QEMU_EXTRA_ARGS="-smp 8 -m 6144"
    # shellcheck disable=SC2206
    extra_qemu_args=( ${ANDROID_QEMU_EXTRA_ARGS} )
    fast_args+=("${extra_qemu_args[@]}")
  fi

  echo "Iniciando AVD '$AVD_NAME' con flags de rendimiento..."
  if ! start_emulator "${fast_args[@]}"; then
    echo "El emulador rechazo algunos flags QEMU. Usando modo compatible..."
    if ! start_emulator "${base_args[@]}"; then
      echo "No se pudo iniciar el emulador. Ultimas lineas del log:"
      tail -n 80 "$LOG_FILE" || true
      exit 1
    fi
  fi
fi

echo "Esperando a que Android termine de iniciar..."
"$ADB_BIN" wait-for-device
until [[ "$("$ADB_BIN" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do
  sleep 2
done

echo "Ejecutando Expo en Android..."
npx expo run:android
