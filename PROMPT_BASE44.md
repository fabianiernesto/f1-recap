# Racing Simplified, the full brief

Build a web app called **Racing Simplified**. It tells every Formula 1 Grand Prix weekend as a story you scroll, for people who like F1 but do not have a whole afternoon, and it lets them play with the real race afterwards. Everything on the site comes from the official timing data. If the data cannot back a claim, the claim is not made.

Read this whole brief before building anything. Sections 1 to 4 are the product. Sections 5 to 8 are the design system, the copy rules and the non-negotiables. Section 9 is what to build first.

---

## 1. What it is, in one screen

A visitor lands and understands three things in five seconds:

1. This site rebuilds every F1 weekend from the official timing data and tells it so anyone can follow it.
2. Every circuit has two doors: **Scrolled** (read the whole weekend as a story) and **Simplified** (play with the same race: guess, decide, rewrite).
3. There is a latest race ready right now, with one button to read it and one to play it.

The audience is the casual fan: they watched half the race, or none of it, or they watched it all and want to argue about it. They do not want a data dashboard. They want to understand what happened and why, in the order it happened, with the numbers doing the talking.

## 2. Data

All content is generated from two public sources, never typed by hand:

- **OpenF1** (api.openf1.org): laps, positions, intervals, pit stops, stints and tyre compounds, race control messages (flags, safety car, VSC, red flag, penalties, deleted laps), weather, overtakes, team radio, session results, starting grid.
- **FastF1** (Python library): circuit geometry (the real track trace from car telemetry), corner positions, per-circuit stats (lap length, corners, full-throttle share, top speed, braking zones).

A pipeline runs once per session and writes static JSON. The web app reads JSON only. There is no live data and no user accounts in v1.

Per Grand Prix, the pipeline produces:
- `weekend.json`: name, circuit, country, date, laps, the list of sessions with a one-line honest headline each, and a `facts` block for the race (winner with team colour and headshot, grid position, winning margin, fastest lap, on-track passes, pit stops, retirements, safety cars, red flag).
- `story_<session>.json` for each of the five sessions (FP1, FP2, FP3, Qualifying, Race; sprint weekends have FP1, Sprint Qualifying, Sprint, Qualifying, Race): an ordered list of **cards** anchored to a lap number.
- `track.json`: the circuit trace as points, corner labels, and the stats above.
- `blind_race.json`, `pitwall_race.json`, `brain_race.json`: the activities and the assistant's data pack (see section 4).

Data rules that the pipeline already enforces and the app must respect:
- "CHEQUERED FLAG" contains the substring "RED FLAG". Never substring-match flags.
- A car sitting in the pit lane under a red flag is not a pit stop. Laps under a red flag, a safety car restart, or a VSC are not "overtakes".
- Race control writes cars as "CARS 14 (ALO) AND 87 (BEA)". Parse car numbers with the `(XXX)` pattern, never "CAR 14".
- The starting grid is not the qualifying order (penalties move cars). The race uses `starting_grid`.
- The feed never says why a car retired. Never write "mechanical failure" or "crash" unless race control says so.
- The pit wall activity never scores a safety car, because nobody can measure one.

## 3. Structure and routes

- `/` Home.
- `/gp/<slug>` Circuit front door: one locked screen, the circuit's name, the two doors (Scrolled, Simplified) with three real numbers each, and one button per door.
- `/gp/<slug>/sessions` Scrolled hub: the five sessions as a list, each with its honest headline ("545 laps run, no points at stake", "Norris on pole", "190 on-track passes, 1 virtual safety car").
- `/gp/<slug>/<session>` The Scrolled story for that session (section 3.1).
- `/gp/<slug>/activities` Simplified hub: the activities that this weekend's data supports, with real counts (7 sheets to guess, 2 calls to make), and "in the works" for the ones it does not.
- `/gp/<slug>/race/blind` The blind test (section 4.1).
- `/gp/<slug>/race/pitwall` The pit wall (section 4.2).

### 3.1 Scrolled: the story you scroll

The session page is one long scroll. The real circuit trace draws itself as you scroll, a lap counter follows you (LAP 23 / 53), and cards land at the lap they belong to. Card types:

- **cover**: session name, lap count, one sentence of totals ("190 on-track passes, 44 pit stops, 3 cars that never finished, 1 virtual safety car.").
- **moment**: kicker (e.g. "Lap 16 · Traffic", "Track limits", "Speed trap", "True pace"), a title with the number in it, one sentence, optional bullets, optional small data table (e.g. "Most overtakes: Russell 16, Stroll 15"), optional note explaining the mechanic to a newcomer in plain words.
- **prediction**: asked BEFORE the event. "Stroll starts P20. Where does he finish?" with three options and a reveal after the user picks.
- **decision**: the story stops and hands the user the call with the real state in front of them: position, gap, tyre age, laps left. "You are Antonelli, 0.5s behind Leclerc and going nowhere. Now what?" Options: box now and undercut / stay out / attack. Each option has its own consequence text. The reveal says what the team actually did and how it ended. There is almost never a correct answer, and the copy never pretends there is.
- **steward**: "Lap 3: contact between Alonso and Bearman at Turn 3. What do you give?" No further action / 5 s / 10 s. Reveal: what the stewards did.
- **what-if** (labelled as an estimate, never as a fact): "Piastri was running P7 when the car gave up. Where does he finish if it holds together?" The reveal uses his own median lap versus the winner's and says "our read from his own lap times, not a fact".
- **guess**: a slider. "How far behind was Verstappen at the flag?" with a target and a tolerance.
- **Alfred**: an assistant that rides along the scroll. He talks at the lap you are on and answers typed questions from the race data pack only. He talks like a mate, lowercase, short lines. When the data does not answer, he says so.

### 3.2 The five sessions

Practice cards: fastest of the session, who did the most laps, long-run pace (median clean lap), compounds run, speed trap, interruptions (yellow flags and red flags, "the session stopped once"), conditions (track temperature range).
Qualifying cards: pole and margin, the Q1 and Q2 cuts, deleted laps, speed trap, fastest sectors ("nobody owned the whole lap"), yellow flags, and the grid as it really starts (with who dropped and by how many places, without claiming the reason).

## 4. Simplified: the activities

### 4.1 The blind test
Five to eight real drivers from the race, names struck out. Each sheet shows where he started, how often he stopped, what the stewards made of him, his median pace, his result. The user guesses from a list of options. Score at the end. Every number is the real one.

### 4.2 The pit wall
The user takes one driver's seat (the one whose race a call actually decided). The race is frozen at each moment his garage made a call: lap, position, gap ahead and behind, tyre compound and age, what a stop costs today. The user chooses; the model runs his stint on the real degradation measured from this race (hard, medium, soft wear per lap) and tells him where his afternoon would have ended. Seats where the model contradicts the real strategist by more than 3 seconds are discarded. The safety car is never scored.

### 4.3 The what-if (in the works)
Take the safety car out of the race, give the retirement its car back, and re-run the podium on the real pace. Only shipped if it can be done honestly, labelled as an estimate.

## 5. Design system

Two grounds that alternate strictly, band by band, down every page: **dark** and **light**. Never two dark bands in a row, never two light ones.

Palette (one accent, nothing else):
- Dark ground `#0a0a0a`, light ground `#ffffff`, ink on light `#0a0a0a`, text on dark `#ffffff`, accent red `#e10600` on both grounds, muted grey `#6f6f6f` for captions.

Type: **one family only** for the whole site. Use a wide geometric grotesk (Anybody Expanded, or Syne, or Archivo Expanded). Titles in bold, all caps, at 150% width. Sentences at normal width, regular weight, 16 to 18 px, 52 characters per line at most. Kickers and labels in medium, small, tracked 0.12 em, all caps. No second family, no monospace, no serif, no pixel face.

Spacing: every section breathes the same, 14 vh top and bottom, 5 vw sides. Every section head is kicker + title + one sentence. Every card is the same box (hairline border, no radius, no shadow). Every button is the same block (red fill with white text for the primary, red outline for the secondary).

Photographs: driver headshots from the official media set, cut out, placed in the right column of a section with a soft glow in the team's colour. No stock photos, no illustrations, no icons in circles, no infographics invented by the app. The only graphics are the real circuit traces and the real numbers.

Motion: a section may fade in from a visible resting state. The circuit trace draws itself as you scroll. Nothing else moves.

## 6. Home page, section by section

1. **Hero** (dark). Kicker "Formula 1 · Season 2026". Title "EVERY RACE / SIMPLIFIED". Paragraph that opens with the latest race in one sentence built from the facts ("Antonelli started P19 at Monza and won it by 3.857s.") and then says what the site is and names the two doors. Buttons: "Scroll Monza" (primary), "Play Monza" (secondary), "How it works" (text link). A ticker at the bottom with one line per race built: "Monza · Antonelli wins from P19 by 3.857s".
2. **How it works** (light). Kicker, title, one sentence: "Every circuit has the same two doors. Both open on the official timing feed, and when the feed cannot back a claim, the claim is not made." Then two large boxes side by side, SCROLLED and SIMPLIFIED, each with one line. Both closed. Clicking one opens that door's explanation right under the boxes (title, subtitle, one paragraph, three cards with real numbers from the latest race, one button) and scrolls to it. Clicking again closes it. Nothing else is shown until the user chooses.
3. **Latest recap** (dark). Tag "Latest recap", circuit name, a one-line newspaper headline built from the facts ("Antonelli wins from P19"), a paragraph built from the facts, three facts (winning margin, fastest lap, from the grid), two buttons (Scrolled, Simplified), the winner's headshot on the right.
4. **The circuits** (light). One card per weekend, newest first: dotted trace, winner's headshot, circuit name, GP and date, "Antonelli wins from P19 · by 3.857s", sessions and moments count. The card opens the circuit's front door.
5. **Built so far** (dark). Five big numbers: Grands Prix, moments told, race laps, passes on track, pit stops. Closing line: "Counted, not estimated. Every figure on this site is read from the official timing feed, and when the feed cannot back a claim, the claim is not made."

## 7. Copy rules

- English. Bar voice: a knowledgeable friend explaining, never a press release. Short sentences mixed with longer ones. Numbers in the sentences, not in bullet spam.
- Every number on screen comes from the data. Never round to sound better. Never invent a cause.
- No em dashes anywhere, ever. Use a comma, a colon, a full stop or "·".
- No "here's the thing", "let's break it down", "what's interesting is", no template phrases.
- A punchline is never followed by the sentence that explains it. Chain them or drop one.
- Labels are plain: "Scrolled", "Simplified", "Read the weekend", "Play the race", "Open", "Close". No clever names.
- Where a card explains a mechanic (undercut, DRS, track limits, safety car), explain it the way you would to someone who has watched three races, with one concrete consequence.

## 8. Non-negotiables

1. Nothing without a number behind it. A card that cannot be backed by the feed is not shown.
2. The user decides. Predictions, decisions, steward calls and what-ifs are the product. A story you only read is not enough.
3. Estimates are labelled as estimates in the same sentence.
4. Strict light/dark alternation, one type family, one accent colour.
5. No third-party photographs beyond the official driver headshots. No F1 logo (use the site's own mark, "R//S").
6. Mobile first: every layout stacks to one column at 400 px; no horizontal scroll anywhere.
7. Static: every page must render from the JSON with no server logic and no database.

## 9. Build order

1. Home with the five sections above, wired to a `weekend.json` and `track.json` for one GP (use the data shape in section 2; if you need sample data, generate it from the shape but label the page "sample data" until real files are loaded).
2. Circuit front door with the two doors.
3. The Scrolled story page for the race, with the trace drawing on scroll and at least these card types working: cover, moment, prediction, decision, guess.
4. The blind test.
5. The pit wall.
6. Alfred.

Deliver each step working before starting the next. Show the real numbers on every screen from the first step.
