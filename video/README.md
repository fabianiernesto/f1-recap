# Racing Simplified, the film

A 9:16 showcase of the web, cut on the song's beat grid (110 BPM). Built with
Remotion: the film is React, so it uses the web's own fonts, colours and
effects, and the web itself appears as real recordings.

## Pieces

| Path | What it is |
|---|---|
| `src/time.ts` | The beat grid and the act map. Every cut is a beat number. |
| `src/kit.tsx` | The web's speed kit redrawn for 1080x1920: glow, LED, smear, speed lines, beam, rip. |
| `src/scenes/` | One file per act: Intro, LightsOut, Scrolled, Simplified (+ Breakdown, Activities), Built (+ EndCard). |
| `src/data.json` | Track shapes, winners and season totals, pulled from `../data` by `scripts/data.mjs`. |
| `public/clips/` | The web as 30fps JPEG sequences. `scripts/capture.mjs` makes the ones in the film frame by frame (exact eased scroll, a virtual page clock, CSS animations stepped 1/30 s), so they play 1:1 and glide. `scripts/record.mjs` is the older real-time recorder. |
| `public/music/` | The song and the cut soundtrack. Not in git. |

## Rebuild from zero

```bash
# 1. the web running on localhost:3000, then
node scripts/data.mjs
node scripts/capture.mjs
# 2. the soundtrack (decode the song to a 48k stereo wav first)
npx remotion ffmpeg -i public/music/track.m4a -ac 2 -ar 48000 -c:a pcm_s16le full.wav
node scripts/soundtrack.mjs full.wav
# 3. preview or render
npm run studio
npm run render
```

`scripts/stills.mjs` renders chosen frames and a contact sheet for review;
`scripts/sheet.mjs` makes contact sheets from any images.

## Music

The current track is a placeholder for private testing only. Before the film
is published, swap `public/music/track.m4a` for a licensed track. The beat
grid (`BEAT`, the phase in `soundtrack.mjs`) and the splice points then have to
be measured again for the new song.
