#!/usr/bin/env bash
# Builds player/vendor/crsid/crsid.wasm from vendor/crsid (cRSID by Hermit, see its README).
# Needs clang with the wasm32 target and wasm-ld (no Emscripten, no libc).
set -euo pipefail
cd "$(dirname "$0")/.."
clang --target=wasm32 -O2 -nostdlib -ffreestanding -fno-builtin -I vendor/crsid/wasm/stub \
	-Wno-everything -Wl,--no-entry -Wl,--strip-all -Wl,--initial-memory=1048576 \
	-o player/vendor/crsid/crsid.wasm vendor/crsid/wasm/crsid_wasm.c
ls -l player/vendor/crsid/crsid.wasm
