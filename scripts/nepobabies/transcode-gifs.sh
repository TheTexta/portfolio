#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_DIR="$REPO_ROOT/app/components/projects/nepobabiesruntheunderground/assets/images"
OUTPUT_DIR="$REPO_ROOT/app/components/projects/nepobabiesruntheunderground/assets/media/optimized"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required but not installed." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

transcode_gif() {
  local source_file="$1"
  local output_stem="$2"
  local input_path="$SOURCE_DIR/$source_file"
  local webm_path="$OUTPUT_DIR/${output_stem}.webm"
  local mp4_path="$OUTPUT_DIR/${output_stem}.mp4"
  local poster_path="$OUTPUT_DIR/${output_stem}-poster.jpg"

  if [[ ! -f "$input_path" ]]; then
    echo "Missing source GIF: $input_path" >&2
    exit 1
  fi

  echo "Transcoding $source_file -> $output_stem"

  ffmpeg -y -hide_banner -loglevel error \
    -i "$input_path" \
    -an \
    -c:v libvpx-vp9 \
    -b:v 0 \
    -crf 35 \
    -pix_fmt yuva420p \
    -row-mt 1 \
    -deadline good \
    "$webm_path"

  ffmpeg -y -hide_banner -loglevel error \
    -i "$input_path" \
    -an \
    -c:v libx264 \
    -crf 24 \
    -preset medium \
    -pix_fmt yuv420p \
    -movflags +faststart \
    "$mp4_path"

  ffmpeg -y -hide_banner -loglevel error \
    -i "$input_path" \
    -frames:v 1 \
    -q:v 3 \
    "$poster_path"
}

transcode_gif "me_background.gif" "me-background"
transcode_gif "me_foreground.gif" "me-foreground"
transcode_gif "me_hover.gif" "me-hover"
transcode_gif "nettspend.gif" "nettspend"

echo "Generated optimized media in: $OUTPUT_DIR"
