# Racing Simplified: data inventory and audit of current activities (as of 22 Oct 2026)

Paths are relative to `C:\Users\ErniB\Downloads\CLAUDE CODE MASTER - v1\Proyecto 6_Ernesto - F1 Recap Interactivo\` unless absolute. Counts were computed by reading every JSON in `web/data/` (15 GPs: Albert Park, Shanghai, Suzuka, Miami, Montreal, Monaco, Barcelona, Spielberg, Silverstone, Spa, Hungaroring, Zandvoort, Monza, Madring, Baku).

## 1. Which activities exist today, how they play, what drives them, where they are weak

### Takeaway
There are five interactive surfaces: Blind test (Activity 01), Pit wall (Activity 02), the prediction/decision/guess cards inside the race scroll, and Alfred (scripted chat). "What-if" (Activity 03) is a placeholder card only. Interactivity is concentrated in Race and Sprint; Practice and Qualifying stories contain zero interactive cards. Several card templates repeat word for word at every GP, Blind test and Pit wall are short (5 rounds / 2-4 calls), and Alfred is keyword lookup, not an LLM.

### Cited Findings

**Activities hub** — `web/app/gp/[slug]/activities/page.tsx`
- Lists exactly three tiles: "Activity 01 The blind test", "Activity 02 The pit wall", "Activity 03 The what-if" (meta text: "In the works", no link). Tiles 01/02 fall back to a disabled "Not this weekend" state when the JSON is missing. Copy promises "about 2 minutes" (blind) and "about 3 minutes" (pit wall).
- Availability is resolved in `web/lib/data.ts` `activitiesFor()`: blind needs ≥3 rounds (race file, else sprint); pit wall loads `pitwall_race.json`, else sprint.

**Activity 01: Blind test** — `web/components/BlindTest.tsx`, `pipeline/blind.py`, route `web/app/gp/[slug]/[session]/blind/page.tsx`
- Flow: cover ("Five drivers. No names.") → press Start → 5 rounds drawn at random from the pack (`ROUNDS = 5`) → each round shows a "sheet" of stats (Started, Laps led, Stops with laps, Tyres sequence, Median lap, On-track passes, Fastest lap, Penalty, Finished) and 4 name options (A-D) → pick → real headshot appears, team colour floods panel, verdict ("Got him" / "It was X") and a one-line "tell" → after 5, score /5 with one of 4 canned verdicts and a recap strip → "Again, different drivers".
- Data: only drivers whose race "has a shape" qualify; `blind.py` assigns a tell + weight (retired=5, winner=5, lost ≥6 places=6, gained ≥6=5, more stops than typical=4, fastest lap=4, penalty=3, most passes=4) and keeps the top 8. Decoys = up to 3 drivers within ±3 places on the results sheet.
- Pack sizes on disk: 8 rounds at 13 GPs, 7 at Monza, 6 at Suzuka (`web/data/*/blind_race.json`). With a 5-of-8 draw, a second run repeats at least 2 drivers. Sprint packs exist at the 5 sprint weekends (`blind_sprint.json`) but the hub only links one session.
- Weaknesses observed in code: no difficulty ramp, no hint/clue-reveal mechanic (all rows visible at once), no timer, no persistence/sharing of score, decoys are always alphabetical-sorted names, rows are the same 6-9 fields every time.

**Activity 02: Pit wall** — `web/components/PitWall.tsx`, `pipeline/pitwall.py`, route `.../[session]/pitwall/page.tsx`
- Flow: cover ("You are on X's radio") shows the measured economics (pit loss in s, ms/lap wear per compound) → "Take the wall" → for each call: kicker ("The first stop", "Stop 2", "The last set"), question ("When do you box him?" / "N laps to the flag. What goes on the car?"), facts (Running P, Tyre + age, Ahead + gap, Behind), 2-7 options each with lap and a note; costs hidden as "?" until pick → reveal "+Xs", "yours", "theirs", best option highlighted → running deficit accumulates → final screen inserts you into the real finishing gap ladder ("P{place}", "+Xs on his real race") with a canned sentence → "Take it again".
- Model (`pitwall.py`): linear tyre wear per compound fitted across the field with a fuel/track-evolution trend removed; pit loss = median of green-flag (in-lap + out-lap minus running pace of cars that stayed out); each stop option costs `stint_cost(old) + stint_cost(new)` over the window. Deliberately refuses: safety-car stops (no number), compounds with <40 clean samples, and any race where the real call lands >3.0 s from the model optimum (`TRUST = 3.0`). Seat = top-8 finisher with the tightest gap to a neighbour.
- Coverage: exists at 10/15 GPs (Barcelona/Hamilton 4 calls, Hungaroring/Leclerc 4, Madring/Russell 3, Miami/Leclerc 2, Silverstone/Hadjar 2, Spa/Hadjar 2, Spielberg/Verstappen 3, Suzuka/Leclerc 2, Zandvoort/Leclerc 4) and missing at Albert Park, Baku, Monaco, Montreal, Monza, Shanghai (`web/data/*/pitwall_race.json`). Leclerc is the seat at 4 GPs.
- Example economics (Baku file): `{"pitLoss": 24.2, "fuelTrend": -0.0408, "tyres": {"HARD": {"deg": 0.0593, ...}, "MEDIUM": {"deg": 0.0357, ...}}}`.
- Weaknesses: 2-call games at 4 GPs; the final "last set" call often has 2-3 options; one seat per GP, no choice of driver; the model's own docstring notes that "several of these calls come out within a second of the best lap", i.e. the real call is often the best answer.

**In-scroll cards: prediction / decision / guess** — `web/components/CallIt.tsx`, generators `pipeline/build_weekend.py` `prediction_cards()` (l.1335), `decision_cards()` (l.1410)
- Prediction ("Call it before it happens"): 3 buttons, one right answer, green/red reveal + reveal text. Templates: "{Driver} starts P{n}. Where does he finish?" (podium / points / out of points), "Who has the fastest lap on the board at the flag?", "One of these three does not see the chequered flag. Who?".
- Decision: state rows + 2-3 choices with `sub`, reveal says "You made the same call they did / You went the other way / Nobody can check this one", plus per-choice `outcomes` text. Four kinds: "You are the steward" (no action / 5s / 10s), "Your call on the pit wall" safety-car box-or-stay, undercut/overcut/attack ("You are X, N s behind Y and going nowhere"), and "What if" retirement ("Where does he finish if it had not?", `actual: ""`, uncheckable).
- Guess ("Guess it"): slider, Lock it in, verdict "Spot on / Close / Not even near". Only template: "How far behind was {P2} at the flag?".
- Counts per race story: 3 predictions, 1-4 decisions, 1 guess, 21-28 moment cards. Sprints: 2-3 predictions, 0-3 decisions, 1 guess. Practice and Quali stories: 0 interactive cards (6-8 moment cards each).
- Repetition measured across 15 race stories: "One of these three does not see the chequered flag. Who?" appears 15/15; "Who has the fastest lap on the board at the flag?" 15/15; the guess is always the winning margin. Moment kickers repeat heavily across all session stories: "Speed trap" 75, "Tyres" 55, "Interruptions" 47, "Conditions" 46.
- The `CardData` type also defines `"share"` (`web/lib/types.ts`), but no story file contains a share card.

**Alfred (RaceMate)** — `web/components/RaceMate.tsx`, `web/lib/alfred.ts`, `pipeline/brain.py`, data `mate_*.json` + `brain_*.json`
- Two modes: (1) scripted beats pushed into a chat drawer as the scroll reaches each beat's lap (5-8 beats per race, 9-15 canned Q&A pairs, `mate_race.json`), with a radio-click SFX; (2) free-text box answered by rule-based lookup: driver name or 3-letter code (uppercase only) → driver topic (pit/stop, tyre, penalty, pace, overtakes) → lap number → 17 topic keyword lists (`winner, podium, fastest, sc, overtakes, pits, undercut, tyres, drs, points, penalty, weather, good, newbie, pace, dnf, grid`). Starters: "who won?", "what happened to verstappen?", "what's an undercut?", "was it any good?". Code comment: "Nothing he says is generated".
- Exists only for race and sprint sessions.

**Not built from product docs**
- Anti-spoiler 0-10 rating + lap heat map: `weekend.json` has `"rating": null, "heat": []` at all 15 GPs; hard-coded in `build_weekend.py` l.2730; module docstring states "no depth selector, no spoiler gate". Planned in `MVP.md` §2-3 and `PRODUCT_MAP.md` §2, §4.

### Inferences
- The richest "game" logic (Pit wall) is gated by statistical honesty rules, which is why a third of GPs have no Pit wall; any new activity that depends on tyre fitting will inherit the same gaps.
- Practice and Qualifying are the obvious empty slots for interactivity: their data (sector times, mini-sectors, speed traps, knockouts) exists but no card asks the user anything.
- After 2-3 GPs a returning user sees identical prediction/guess prompts, which weakens the "come back next week" loop MVP.md §7 Fase 4 uses as success criterion.

### Gaps
- No analytics exist in the repo, so real play time, completion or replay rates are unknown.

## 2. What is in each JSON file type (fields + short example)

### Takeaway
Per GP folder `web/data/<slug>/`: `weekend.json`, `track.json`, `story_<session>.json` (fp1/fp2/fp3/quali/race, plus sprint-quali/sprint on sprint weekends), `race_story.json` (same shape as story_race), `blind_race.json` (+ `blind_sprint.json`), `pitwall_race.json` (10 GPs), `brain_race.json`/`mate_race.json` (+ sprint variants). Types are declared in `web/lib/types.ts`.

### Cited Findings
- `weekend.json` (`Weekend`): `slug, gp, short, circuit, country, date, laps, sessions[{slug,label,kind,headline,moments,laps}], facts{winner{first,last,team,colour,number,start,headshot}, margin, runnerUp, fastest{last,time}, passes, stops, dnfs, safetyCars, redFlag, laps}, rating, heat`. Example (Silverstone): `"headline": "59 on-track passes, 1 safety car"`, `"margin": 0.427`, `"rating": null, "heat": []`.
- `track.json` (`Track`): `circuit, view, start, points[[x,y]] (351 points at Silverstone), corners[{x,y,label}]` e.g. `{"x":422.9,"y":499.8,"label":"ABBEY"}`, `stats[{label,value,short}]` = Lap length, Corners, Full throttle (%), Top speed, Braking zones (e.g. "69%", "350 km/h"). Built with FastF1 telemetry by `pipeline/fase1_track.py` and `pipeline/fase1_circuit_stats.py`.
- `story_*.json` (`Story`): `gp, session, sessionSlug, circuit, laps, generated, result{date,podium[],fastest}, cards[]`. Card fields: `type (cover|prediction|moment|share|decision|guess), lap, kicker, title, text, bullets[], note, options[], answer, reveal, dato{label,rows}, state[[k,v]], choices[{id,label,sub}], actual, outcomes{id:text}, unit, min, max, step, target, close`. Moment example: `{"type":"moment","lap":9,"kicker":"Track limits","title":"21 lap times deleted","bullets":["Stroll lost 6 that way, more than anybody"]}`. Guess example: `{"type":"guess","title":"How far behind was Russell at the flag?","unit":"s","min":0,"max":2.0,"step":0.05,"target":0.427,"close":0.3}`.
- `blind_*.json` (`BlindTest`): `session, rounds[{answer, options[4], rows[[k,v]], tell, number, team, colour, headshot}]`. Example tell: "nobody lost more places than he did: 14" (Antonelli, Silverstone: Started P1, Penalty "5s, track limits", Finished P15).
- `pitwall_race.json` (`PitWall`): `session, laps, driver{name,number,team,colour,headshot,start,finish,margin}, economics{pitLoss,fuelTrend,tyres{COMP:{deg,base,laps}},typicalDeg}, calls[{lap,kicker,question,facts,options[{label,lap,lost,real,note}],reading}], ladder[{pos,name,team,gap}]`. Option example: `{"label":"4 laps earlier","lap":15,"lost":1.0,"real":false,"note":"15 laps on the mediums, then 23 on the hards."}`.
- `brain_*.json` (`Brain`): `typicalStops, pitLoss, session, circuit, laps, winner, drivers{key:{name,code,number,team,start,finish,moved,dnf,dns,dnfLap,points,stops[],compounds[],pace,paceRaw,overtakes,penalty,penaltyFor,led,swings[{lap,lost}],fastestLap,gap,vsWinner,extraStops}}, lapEvents{lap:[strings]}, topics[{id,keys[],say[]}]`. Example lapEvents: `"2": ["3 passes on track", "Piastri pitted"]`.
- `mate_*.json` (`MateThread`): `session, beats[{lap, msgs[], asks[{q, a[]}]}]`. Example: `{"lap":1,"msgs":["lights out","27 places changed hands before they even finished lap 1"],"asks":[{"q":"why is the start always so mad",...}]}`.

### Inferences
- Everything the web shows is pre-aggregated text/numbers; there is no per-lap time series (positions, gaps, lap times) in any web JSON except the textual `lapEvents` in brain files. A lap-by-lap chart or replay would need a new export.

### Gaps
- `race_story.json` vs `story_race.json`: both exist with the same shape; which one the web reads was not traced (data.ts was only partially read).

## 3. What is in the raw cache and fetch code but not used yet

### Takeaway
The OpenF1 cache (`pipeline/cache/`, 102 MB, 703 files) holds 12 endpoints for every session; the FastF1 cache (`pipeline/fastf1_cache/`, 1.7 GB) holds full race telemetry and positions for all 15 races. Team radio is loaded but never used; intervals, weather, sector/mini-sector and pit lane/stop splits are only partly used; car telemetry and x/y positions are used only to draw the track and compute 5 circuit stats.

### Cited Findings
- Fetch code: `pipeline/fase0_explora.py` pulls `laps, stints, pit, position, intervals, race_control, weather, drivers, team_radio, overtakes, session_result, starting_grid` from `https://api.openf1.org/v1/<ep>?session_key=`, with 429 back-off and 0.5 s sleep. It does not fetch `car_data`, `location`, `championship_*`, `meetings`, `sessions`.
- Cache file counts by endpoint: drivers/laps/pit/position/race_control/session_result/stints 75 each (all sessions), weather 66, team_radio 51, intervals 20 and overtakes 20 (races + sprints only), starting_grid 20.
- Raw field sets (Baku race files): laps `duration_sector_1..3, i1_speed, i2_speed, st_speed, segments_sector_1..3, is_pit_out_lap, lap_duration, date_start`; pit `pit_duration, lane_duration, stop_duration, lap_number, date` (stop_duration null in sampled row); intervals 24,933 rows `gap_to_leader, interval, date`; weather 168 rows `air/track temperature, humidity, pressure, rainfall, wind_direction, wind_speed`; race_control 141 rows `category, flag, scope, sector, qualifying_phase, message, lap_number, driver_number`; overtakes 160 rows; team_radio 31 rows `driver_number, date, recording_url` (e.g. `https://livetiming.formula1.com/static/2026/2026-09-26_Azerbaijan_Grand_Prix/2026-09-26_Race/TeamRadio/RUS_63_20260926_154756.mp3`).
- Team radio clips cached across 2026: Race 329, Quali 128, FP3 102, FP1 84, FP2 58, Sprint 44. In `build_weekend.py` the feed is loaded (`self.radio = load(..., "team_radio")`, l.163) and never referenced again; no web component plays clips (the only "radio" audio is a UI click SFX in `web/lib/sfx.ts`).
- Used today: sector times (Quali "Sector by sector" card, `clean_sector_laps`), speed trap `st_speed` ("Speed trap" cards), intervals ("Within a second" battles, l.973/1045), weather ("Conditions" cards), pit_duration (pit-lane time ranges, l.2006), race_control (flags, stewards, penalties, track limits, SC/VSC/red flag laps), overtakes (green-flag passes after filtering pit-lane and restart "passes"), starting_grid (grid/start positions).
- FastF1 cache per race: `car_data.ff1pkl, position_data.ff1pkl, timing_app_data.ff1pkl, track_status_data.ff1pkl, session_status_data.ff1pkl, lap_count.ff1pkl, driver_info.ff1pkl, _extended_timing_data.ff1pkl` — Race sessions only, 15 GPs (`pipeline/fastf1_cache/2026/*`). Used by `fase1_track.py` (track outline) and `fase1_circuit_stats.py` (lap length, corners, % full throttle, top speed, braking zones).
- DRS: `fase1_circuit_stats.py` comment: the DRS channel "this feed reports ... as all zeros", so DRS was dropped from the stats.
- Not used anywhere: `i1_speed`/`i2_speed`, mini-sector `segments_*`, `lane_duration` vs `stop_duration` split, intervals as a time series (gap charts), weather as a time series, throttle/brake/gear traces per driver, x/y/z positions for replays or battle animations, `tyre_age_at_start` (used indirectly), `qualifying_phase` field, radio clips.

### Inferences
- A position replay (cars moving on the existing `track.json` outline) and corner-by-corner telemetry comparisons are possible offline from data already on disk, without new API calls, for races only; quali/practice telemetry would need new FastF1 downloads.
- Start-reaction times are not in either feed directly; a proxy (positions gained by end of lap 1, already computed as "27 places changed hands" in mate beats) is what exists.

### Gaps
- Whether `stop_duration` (stationary time) is populated for most 2026 stops was not counted; one sampled Baku row was null.
- FastF1 pickles were not opened, so per-race sample counts were not measured.

## 4. What FastF1 and OpenF1 offer in 2026, and the licensing / terms situation

### Takeaway
OpenF1 offers 18 endpoints, ~3.7 Hz telemetry/location, ~4 s intervals, free historical data from 2023 with 3 req/s and 30 req/min unauthenticated; live data needs a €9.90/month sponsor tier. Its site states CC BY-NC-SA 4.0, non-commercial and "personal use" for the free tier, and no specific team-radio rights. FastF1 (MIT-licensed library) reads F1's livetiming API with ~240 ms car data and ~220 ms position data. formula1.com terms restrict content including live timing data to personal, non-commercial use without written consent. No source grants rights to embed team radio audio.

### Cited Findings
- OpenF1 telemetry: "Location, speed, throttle, brake, RPM, and gear data at 3.7 Hz sampling rate"; positions/intervals "updated every 4 seconds" — [openf1.org](https://openf1.org/)
- OpenF1 rate limits: free unauthenticated 3 req/s, 30 req/min; Sponsor 6 req/s, 60 req/min — [openf1.org](https://openf1.org/)
- OpenF1 tiers: free = historical from 2023, "for personal use"; Sponsor €9.90/month adds live REST/MQTT/WebSocket; live window = 30 min before to 30 min after a session; real-time latency ~3 s — [openf1.org](https://openf1.org/)
- OpenF1 terms: site licensed CC BY-NC-SA 4.0; intended for educational, personal, research and non-commercial fan use, other uses "contact" for licensing; attribution not required but link appreciated; does not claim ownership of F1 data/trademarks; unofficial, not affiliated with F1/FIA/FOM — [openf1.org](https://openf1.org/), [openf1.org/docs](https://openf1.org/docs/)
- OpenF1 endpoints: car_data, championship_drivers (beta), championship_teams (beta), drivers, intervals, laps, location, meetings, overtakes, pit, position, race_control, sessions, session_result, starting_grid, stints, team_radio, weather — [openf1.org/docs](https://openf1.org/docs/)
- OpenF1 caveats: team_radio "only a limited selection of communications are included" and coverage "has decreased significantly starting in 2026"; overtakes "only available during races and may be incomplete"; laps segments "not available during races"; pit `stop_duration` only from 2024 US GP, `pit_duration` deprecated and removed end of 2026; location has no lateral placement; weather updated every minute; championship endpoints beta, race sessions only; starting_grid appears minutes after official results — [openf1.org/docs](https://openf1.org/docs/)
- Local evidence on the segments caveat: the Baku race `laps` rows do include `segments_sector_*` keys (values not inspected) — `pipeline/cache/11377_Race_laps.json`.
- FastF1 sampling: car data "sample rate of (usually) 240ms", position "(usually) 220ms", streams need resampling to merge; data fetched from "the formula1 livetiming web api" — [docs.fastf1.dev/api](https://docs.fastf1.dev/api.html)
- FastF1 channels: Speed, RPM, nGear, Throttle, Brake, DRS; X, Y, Z, Status; computed Distance, DriverAhead, DistanceToDriverAhead; Laps include Sector1-3Time, SpeedI1/I2/FL/ST, Compound, TyreLife, FreshTyre, PitIn/OutTime, Deleted, DeletedReason, IsAccurate, TrackStatus; race_control_messages, weather_data (once per minute), results (GridPosition, Q1-Q3, Status, Points), get_circuit_info (corners, marshal lights/sectors, "not highly accurate") — [docs.fastf1.dev/core](https://docs.fastf1.dev/core.html)
- FastF1 has no team-radio/audio support in its API docs — [docs.fastf1.dev/api](https://docs.fastf1.dev/api.html)
- FastF1 license MIT; "unofficial and are not associated in any way with the Formula 1 companies" — [GitHub theOehrly/Fast-F1](https://github.com/theOehrly/Fast-F1), [docs.fastf1.dev](https://docs.fastf1.dev/)
- formula1.com legal notices: content "is for your personal, non-commercial use only, save where expressly provided"; users agree "not to modify, copy, reproduce, republish, upload, frame, post, transmit or distribute"; protected materials include "live timing data" under "copyrights, database rights, trademarks"; reuse needs "FODM's prior written consent" — [formula1.com Legal Notices](https://formula1.com/en/information/legal-notices.7egvZU48hzrypubGBNcQKt)
- Radio audio URLs in the cache point at `livetiming.formula1.com/static/...` (F1's own host), not OpenF1 — `pipeline/cache/11377_Race_team_radio.json`.
- Project status: `MVP.md` §7 says "términos del team radio aún pendientes"; `CONCEPTO_V1.md` §5 lists "Derechos del team radio" as open; `MVP.md` §3 puts "Team radio en cards (si derechos OK)" in v1.1.

### Inferences
- The free OpenF1 tier fits the offline, once-per-GP pipeline (no live data needed); the 30 req/min cap matters only for bulk car_data/location pulls, which FastF1 already covers locally.
- Both data providers disclaim F1 data rights; the rights question for timing data and radio audio sits with Formula One (FODM), per its published terms. Decision left to Ernesto.

### Gaps
- No page from F1/FOM specific to team radio reuse or to livetiming.formula1.com static files was found.
- OpenF1 docs page did not state the rate limit; the figure comes from the homepage only.
- FastF1 latest release version/date and explicit 2026 notes were not found on the pages fetched (local cache proves 2026 races load).

## 5. What was planned but never built

### Takeaway
Planned and missing: What-if (Activity 03), anti-spoiler rating + heat map, time selector (30 s / 3 min / 15 min), shareable cards, team radio in cards, Modo Estratega as designed (curated dilemmas with explanation), "Me dormí en la vuelta X", duels, season-as-episodes, deploy, GPs from Singapore on.

### Cited Findings
- What-if: tile copy "Take the safety car out of the race. Give the retirement its car back. Then watch the podium rearrange itself on the real pace everybody was running." marked "In the works" — `web/app/gp/[slug]/activities/page.tsx`; listed as pending in `CLAUDE.md` §6 ("Pendiente: what-if (actividad 03), deploy en Vercel..."). A lightweight version exists only as the uncheckable "What if" retirement decision card (`build_weekend.py` l.1598).
- Anti-spoiler gate, 0-10 rating and lap heat map: planned in `MVP.md` §2-3, `PRODUCT_MAP.md` §2/§4, `IDEAS_FORMATOS.md` F4; not built (`rating: null`, `heat: []` everywhere; `build_weekend.py` docstring "no depth selector, no spoiler gate").
- Time selector 30 s / 3 min / 15 min: `MVP.md` §2, `CONCEPTO_V1.md` F2; docstring says "Everyone gets the same, full analysis: no depth selector".
- Share card: `type: "share"` in `web/lib/types.ts`, zero instances in data; planned as F12 and `MVP.md` v1.1 "Cards compartibles como imagen". (`FinalPoster.tsx` exists for race pages; not inspected in detail.)
- Team radio in cards: `MVP.md` v1.1, `IDEAS_FORMATOS.md` F6 (plan B: quoted transcripts + link); data cached, unused.
- Chat with LLM + editorial sheet: `CONCEPTO_V1.md` F3 (Groq / Claude Haiku, 10-15 curated bullets per GP); actual Alfred is rule-based with no editorial input.
- Modo Estratega F5 ("4-5 momentos clave", per-dilemma explanation, "acertaste 3 de 5"): partially realised as Pit wall + decision cards; curated manual dilemmas not present.
- Fridge items: F7 duels, F8 "Me dormí en la vuelta X", F9 season as episodes, F11 everyday translations — `CONCEPTO_V1.md` §3.
- GPs from Singapore onward not built; `pipeline/_todo.txt` lists slugs/names for the first 9 GPs only.

### Inferences
- What-if can reuse two existing pieces: `pitwall.py` race economics (pace, pit loss) and `brain.py` driver pace/vsWinner; the Pit wall docstring explicitly refuses to "run the race forward", so a What-if would contradict that stated principle unless framed as an estimate (the existing retirement card already labels itself "Our read ... not a fact").

### Gaps
- No design spec or code for What-if beyond the tile text was found.
