#!/usr/bin/env bash
# Cuts the scroll-story shots out of the master film and exports them as WebP frame
# sequences in public/story/<chapter>/{lg,sm}/0001.webp. Re-run after changing a cut.
set -euo pipefail

SRC="${1:-video/iro_a_little_more_morning_final.mp4}"
OUT="public/story"
FPS=24

# chapter  start-end[,start-end...]  (seconds in the master film)
CHAPTERS=(
  "wake    10.60-12.75"
  "feel    41.20-42.50"
  "coffee  35.70-41.12"
  "bring   46.62-49.45,62.83-64.45"
  "sun     69.00-73.50"
)

for entry in "${CHAPTERS[@]}"; do
  read -r name ranges <<<"$entry"
  IFS=',' read -ra parts <<<"$ranges"

  filter=""
  labels=""
  i=0
  for part in "${parts[@]}"; do
    start="${part%-*}"
    end="${part#*-}"
    filter+="[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS,fps=${FPS}[c${i}];"
    labels+="[c${i}]"
    i=$((i + 1))
  done
  # The film is letterboxed (1920x804 picture inside 1080); crop the bars. Phones get a
  # center crop at a taller height so portrait screens stay sharp.
  filter+="${labels}concat=n=${i}:v=1:a=0,crop=1920:800:0:140,split=2[a][b];"
  filter+="[a]scale=1920:-2:flags=lanczos[lg];[b]crop=1120:800,scale=-2:880:flags=lanczos[sm]"

  rm -rf "${OUT:?}/${name}"
  mkdir -p "${OUT}/${name}/lg" "${OUT}/${name}/sm"
  ffmpeg -v error -y -i "$SRC" -filter_complex "$filter" \
    -map "[lg]" -c:v libwebp -quality 64 -compression_level 6 "${OUT}/${name}/lg/%04d.webp" \
    -map "[sm]" -c:v libwebp -quality 60 -compression_level 6 "${OUT}/${name}/sm/%04d.webp"

  count=$(find "${OUT}/${name}/lg" -name '*.webp' | wc -l | tr -d ' ')
  echo "${name}: ${count} frames, $(du -sh "${OUT}/${name}/lg" | cut -f1) lg, $(du -sh "${OUT}/${name}/sm" | cut -f1) sm"
done
