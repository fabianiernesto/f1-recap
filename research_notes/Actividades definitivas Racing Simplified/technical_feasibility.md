# Technical feasibility of data-driven F1 interactives (static Next.js + pre-computed JSON)

Research date: 22/10/2026. Every claim below has a source link; items marked "inference" or "estimate" are my own reasoning from the cited facts, not sourced numbers.

## 1. Race replays and "ghost" cars (f1-race-replay, f1-dash, TracingInsights, MultiViewer)

### Takeaway
A browser race replay or ghost-car lap can be built from public data. Position data is only about 4 to 4.5 Hz with no lateral (racing-line) detail, so cars must be interpolated between samples and the result is a smooth dot on a track outline, not a true racing line. The reference projects are desktop apps or live dashboards. None of them is a static-web replay you could copy wholesale, but their data pipelines (FastF1, caching, column JSON, spline interpolation) carry over directly.

### Cited Findings
**Data rates and accuracy**
- FastF1's legacy API docs give the raw stream sample interval as "usually" 240 ms in one passage and 220 ms in another (about 4.2 Hz and 4.5 Hz). They also say position and car samples do not line up, so merging them requires interpolation. — [FastF1 legacy F1 API docs](https://docs.fastf1.dev/api_reference/legacy/f1_api.html)
- FastF1 recommends merging with `frequency='original'`. Resampling to a fixed Hz makes most values interpolated and "hurts accuracy". Continuous channels (Speed, RPM) are linearly interpolated, and gear is forward-filled. `get_telemetry()` "at least partially contains interpolated values". — [FastF1 core docs](https://docs.fastf1.dev/core.html)
- Position X/Y/Z is in 1/10 m. `add_distance` integrates speed, so error accumulates and should be applied to one or a few laps only. Overlapping laps carry about ±10 m of error. Circuit corner markers are hand-made, "not highly accurate", and come from MultiViewer. — [FastF1 core docs](https://docs.fastf1.dev/core.html)
- OpenF1 `car_data` and `location` are about 3.7 Hz. Location is "useful for gauging their progress along the track, but lacks details about lateral placement", and its origin is arbitrary. — [OpenF1 docs](https://openf1.org/docs/)
- OpenF1 free tier: historical data from 2023 onwards, no auth, 18 endpoints, 3 req/s and 30 req/min. Live data costs €9.90/month (Sponsor). Positions and intervals update every 4 s. Intended for "personal use" and non-commercial fan use, and other uses require contacting the project. Site content is CC BY-NC-SA 4.0. — [openf1.org](https://openf1.org/)

**Reference projects**
- **f1-race-replay (IAmTomShaw):** a Python desktop app (Arcade for rendering, PySide6 for menus), not a browser app, MIT licence. It uses FastF1 and caches computed data in `computed_data/` as `.pkl`. The first load of a session is slow (download, process, cache). The Safety Car position is simulated from `session.track_status` because there is no GPS for the SC. The author warns the leaderboard is inaccurate in the first corners, during pit stops and at the finish because of telemetry inaccuracies. No sampling rate or file size is given. — [GitHub f1-race-replay](https://github.com/IAmTomShaw/f1-race-replay)
- **f1-replay (web-based, FastF1):** raw position about 4.5 Hz (samples about 0.22 s apart). The frontend smooths car motion with cubic Hermite splines. Data ships as column-oriented JSON with rounded floats and NaN converted to null. "Position compaction" for stationary periods cuts size by 15 to 30 %. Per-race size and rendering library are not stated. — [f1-replay telemetry reference](https://f1-replay.readthedocs.io/en/latest/TELEMETRY.html)
- **f1-dash (slowlydev):** a real-time dashboard (leaderboard, tyres, gaps, mini sectors). Next.js frontend plus Rust services (`signalr`, `realtime`, `simulator` directories). AGPL-3.0, about 1.9k stars. It is a live tool and needs a backend, so it does not fit a static site. — [GitHub f1-dash](https://github.com/slowlydev/f1-dash)
- **TracingInsights:** data published on GitHub under Apache-2.0, no API keys. Telemetry, lap times, weather and race control are aggregated from FastF1, MultiViewer and Jolpica. The 2025 archive serves telemetry as static JSON files built by GitHub Actions. I could not confirm that the website front-end itself is open source. — [TracingInsights 2026 docs](https://www.mintlify.com/TracingInsights/2026); [DeepWiki 2025 archive](https://deepwiki.com/TracingInsights-Archive/2025) (from the search snippet; the page returned HTTP 429 when fetched)
- **MultiViewer:** a fan-made desktop client that needs a subscription to use. It offers multi-stream onboards, live timing synced to live or replay, Race Trace, a lap-time table and a marshal-sector track map. Watching F1 TV content needs a paid F1 TV subscription. I found no statement that it is open source. — [multiviewer.app](https://multiviewer.app/)
- The FastF1 examples gallery already includes "Speed visualization on track map", "Gear shifts on track", "Draw a track map with numbered corners" and "Position changes during a race". These are ready recipes for the Python pre-compute step. — [FastF1 examples gallery](https://docs.fastf1.dev/gen_modules/examples_gallery/index.html)

### Inferences
- **File-size estimate (my own calculation, not sourced):** a 90-minute race at about 4 Hz is about 21,600 samples per driver, or about 430k for 20 cars. As naive JSON with two coordinates per sample (about 12 to 14 bytes each) that comes to about 5 to 6 MB raw, likely 1.5 to 2.5 MB gzipped. Resampling to 1 to 2 Hz for a "race overview" replay, storing int16 coordinates rounded to 1 m, delta-encoding and serving one file per chunk of laps should bring it under about 1 MB gzipped per race. A single-lap ghost comparison of two drivers (about 90 s × 4 Hz × 2 cars, plus speed, throttle, brake and gear) is only a few tens of KB.
- **Rendering:** 20 dots on a Canvas 2D track path at 60 fps is light work even on mid-range phones. WebGL (PixiJS, three.js) only pays off for 3D or heavy effects. Interpolate between about 4 Hz samples on the client (linear or Hermite, as f1-replay does) and drive it with `requestAnimationFrame`.
- A ghost car "vs you" lap is feasible as a dot plus delta-time readout. A "real racing line" is not, because there is no lateral precision.
- Expect visible glitches in pit stops, on the first lap and at the finish (the f1-race-replay author reports these). Pre-clean them in Python or hide them with UI choices.
- OpenF1's non-commercial and personal-use wording matters if the site is a portfolio with any commercial angle. FastF1, which pulls from the F1 live-timing feed, carries the same underlying data-rights question.

### Gaps
- No published per-race JSON or file sizes for any of the replay projects. The figures above are my estimates.
- Whether TracingInsights' web front-end is open source is unconfirmed.
- I found no open-source, purely static-hosted (no API) browser race replay to use as a reference.

## 2. Strategy simulation ("what if you had pitted on lap X")

### Takeaway
Credible open models exist. The reference is TUM's lap-wise race simulation (Heilmeier et al., LGPL-3.0, Monte Carlo, parameters derivable from public lap times). Smaller MIT-licensed counterfactual tools such as PITWALL also exist. A simplified "pit on lap X" model (lap time = base + tyre-age × degradation + fuel term + pit loss + traffic penalty) is buildable from FastF1 lap times and can be pre-computed per lap in Python into a small JSON lookup. It is credible as an illustration, not as a prediction. Degradation estimates from lap times are noisy, and traffic and safety cars dominate real outcomes.

### Cited Findings
- **TUMFTM race-simulation:** lap-wise discretisation, fuel-mass loss, tyre degradation, interactions between all cars, and Monte Carlo for probabilistic effects. It includes a "Virtual Strategy Engineer" (a neural net trained on real data, or RL) and example parameter files for 121 races from 2014 to 2019. LGPL-3.0. Papers: Heilmeier, Graf & Lienkamp 2018 (ITSC); Heilmeier et al. 2020, two papers in *Applied Sciences* (Monte Carlo, Virtual Strategy Engineer). — [GitHub TUMFTM/race-simulation](https://github.com/TUMFTM/race-simulation)
- The 2018 TUM paper's simulation covers tyre degradation, fuel-mass loss, pit stops and overtaking, with parameters derivable from public lap-time data (2017 Abu Dhabi as the example). — [mediaTUM record](https://mediatum.ub.tum.de/node?id=1462798); full dissertation: [Heilmeier 2022, mediaTUM](https://mediatum.ub.tum.de/doc/1647512/1647512.pdf)
- **PITWALL (MIT):** a counterfactual strategy evaluator with a statistical tyre-degradation model, fuel-pace decay, dirty-air delays and logistic overtake probabilities. It uses paired Monte Carlo with Common Random Numbers and claims 5,000 simulated races in under 300 ms with NumPy. Data comes from FastF1, Jolpica and OpenF1. The README reports no accuracy validation. — [GitHub Ad1th/pitwall](https://github.com/Ad1th/pitwall)
- **F1 StratLab (Apache-2.0):** degradation forecasting with a TCN and Monte Carlo dropout (P10/P50/P90), trained on 2023–2025 FastF1 and OpenF1 data. — [Hugging Face VforVitorio/f1-strategy-models](https://huggingface.co/VforVitorio/f1-strategy-models)
- A simple ML project uses linear per-compound degradation constants, for example 0.085 s/lap for soft and 0.028 s/lap for hard. — [Formula-1-prediction docs](https://www.mintlify.com/TomandJerry0811/Formula-1-prediction/api/tire-degradation)
- **Credibility evidence (Bayesian state-space model on FastF1 lap times, arXiv 2512.00640):** hard tyres lose about 0.054 s/lap (95 % CI 0.004–0.133) and mediums about 0.060 s/lap (95 % CI 0.009–0.120). The authors write that "the data provides little evidence that there is a difference in degradation rate between the compounds". Lap times vary about 0.5 s within a stint. Fuel is assumed (110 kg, linear burn), not measured. Safety cars and traffic are not modelled. The study covers a single race and driver (Hamilton, Austria 2025). — [arXiv 2512.00640](https://arxiv.org/html/2512.00640v1)
- **Pit loss is net:** the time spent in the pit lane minus the time needed to cover the same distance on track. A forum example for Interlagos gives 22.8 s in the lane but a 16.4 s net loss (unverified forum figure). — [f1technical.net](https://f1technical.net/forum/viewtopic.php?p=608753)
- **Undercut magnitudes reported by teams and drivers:** Binotto said Vettel gained 3.9 s via the undercut at Singapore 2019. Leclerc said that even on undercut-friendly tracks it is "four seconds and a half or four seconds". — [f1technical.net Singapore 2019](https://www.f1technical.net/forum/viewtopic.php?p=863348); [grandprix247](https://www.grandprix247.com/formula-1-news/undercut-vs-overcut-the-real-strategy-war-in-formula-1)
- **Safety car modelling:** McLaren's head of race strategy starts from the historic SC probability for each grand prix and notes that debris and collisions are better predictors than past weather. Montreal has had an SC in 22 of 42 editions, rising to 88 % over the last 25. Most circuit-level percentages in the press are old (2011–2012) and should be rebuilt from race-control data, with VSC counted separately. — [McLaren](https://www.mclaren.com/racing/2019/canadian-grand-prix/how-make-right-call-safety-car); [Motorsport.com ES](https://es.motorsport.com/f1/news/probabilidad-safety-car-canada-historia/10620990/); [crash.net](https://www.crash.net/f1/feature/177814/1/focus-the-f1-safety-car)

### Inferences
- **Feasible pattern for a static site:** in Python, fit per-stint degradation (linear or quadratic on fuel-corrected lap times) and take pit loss from the actual pit-lane times in FastF1 or OpenF1 `pit` data. Then pre-compute, for each candidate pit lap X (and maybe 2–3 compounds), the resulting race time and the virtual gap to the rivals around. The output is a small table (laps × compounds × key drivers, a few KB), so no backend or client-side simulator is needed.
- A client-side simulator is also feasible. A deterministic lap-wise model of 20 cars × 70 laps is trivial in JS. Monte Carlo with a few thousand runs is fine in a Web Worker, given PITWALL's NumPy figure, though JS will be slower.
- **Honest limits to state in the UI:** no traffic or overtaking realism without a probabilistic model, safety cars are counterfactual, degradation confidence intervals are wide, and the real drivers managed their tyres to targets. Present it as "model estimate" with a range rather than as a verdict.
- The SC timing "what if" is the most persuasive and the cheapest to compute. During an SC the field compresses and pit loss shrinks a lot. The reduced pit loss under SC is a known effect, but I found no sourced per-track figure.

### Gaps
- No authoritative per-circuit table of pit-loss values or reduced pit loss under SC/VSC was found. It needs to be computed from pit-lane timing data.
- The TUM parameter files stop at 2019. Car generations from 2022 and 2026 change degradation and fuel behaviour.
- PITWALL's validation document was not read.

## 3. Driver comparison, telemetry overlays, "drive the lap" and reaction starts

### Takeaway
Speed-trace overlays, braking points, gear maps and minisector comparisons are the most mature and best-documented use of FastF1. All of them can be pre-computed per lap into small JSON. A "drive the lap" experience can use the real speed trace as a ghost or target. True "reaction start" data (driver reaction times) is not in the public feeds. A reaction game must use a generic light sequence, with only the real launch outcome (positions after turn 1 or lap 1) taken from data.

### Cited Findings
- The FastF1 gallery includes "Overlaying speed traces of two laps", "Plot speed traces with corner annotations", "Gear shifts on track", "Speed visualization on track map", "Team Pace Comparison", "Tyre strategies during a race" and "Grid Average Speed Trace: 2025 vs 2026". — [FastF1 examples gallery](https://docs.fastf1.dev/gen_modules/examples_gallery/index.html)
- Car data channels include Speed, RPM, nGear, Throttle, Brake and DRS. A Source flag marks each sample as car data, position data or interpolated. — [FastF1 telemetry API](https://docs.fastf1.dev/api_reference/telemetry.html)
- At about 4 Hz and 300 km/h, consecutive samples are roughly 20 m apart (inference from the rates above). Combined with the ±10 m lap-overlay error, braking-point comparisons are approximate. — [FastF1 core docs](https://docs.fastf1.dev/core.html)
- The OpenF1 car_data rate is about 3.7 Hz. — [OpenF1 docs](https://openf1.org/docs/)

### Inferences
- Braking points: show "braking zone starts about here (±20 m)" rather than precise metres. Brake is a boolean channel in FastF1 data and has no pressure value (inferred from typical FastF1 data; not explicitly confirmed above).
- **"Drive the lap":** a tap/hold throttle and brake mini-game scored against the real speed trace, on Canvas, is feasible and cheap. Physics stays fake. The real data supplies the target speed per distance and the corner markers.
- **Reaction start:** the light sequence timing is generic, not data-driven. The real data can supply each driver's position change on lap 1.

### Gaps
- No source found for public driver reaction-time data at starts.
- No browser-game reference project built on real telemetry was reviewed in depth (F1Sim was found in search but not examined: [GitHub Preet37/F1Sim](https://github.com/Preet37/F1Sim)).

## 4. Team radio audio from OpenF1

### Takeaway
OpenF1 exposes `team_radio` with direct MP3 URLs. Coverage is a curated selection only, and OpenF1 says it dropped sharply in 2026, with most events having no radio. Rights to republish the audio on a public site are not granted by OpenF1, and I found no public F1 licence for fan use. Hot-linking or re-hosting clips is a rights question for Ernesto to decide. Quoting a transcript is a different case from serving the audio.

### Cited Findings
- `team_radio` fields: `date`, `driver_number`, `meeting_key`, `recording_url`, `session_key`. Example URL ends `.../TeamRadio/SERPER01_11_20230915_104008.mp3`. — [OpenF1 docs](https://openf1.org/docs/)
- "Team radio is not released by F1 for every session". The endpoint holds a limited selection, not the full record, and coverage fell sharply from 2026, with most events having no radio data. — [OpenF1 docs](https://openf1.org/docs/)
- OpenF1 does not claim ownership of F1 data, trademarks or broadcasts. It is for non-commercial fan use, and other uses require contacting the project. — [openf1.org](https://openf1.org/)
- Since 2016, teams must give the commercial rights holder unrestricted access to radio while cars are out of the garage. This concerns access for broadcast and is not a third-party licence. — [Motorsport.com](https://www.motorsport.com/f1/news/f1-clarifies-team-radio-messages-now-largely-unrestricted-803215/803215/?nrt=54); [Autosport](https://www.autosport.com/f1/news/115804/fia-to-enforce-f1-team-radio-limits)
- A third-party (non-official) summary says FOM owns the rights to broadcast footage. — [TracingInsights 26Regs media](https://www.mintlify.com/TracingInsights/26Regs/operational/media-commercial)

### Inferences
- Technically, embedding an `<audio>` element that points at the F1 livetiming MP3 URL works with no hosting cost. The rights status is the same whether the file is hot-linked or re-hosted.
- With 2026 coverage this thin, a radio-based activity for 2026 GPs may simply lack material. Check per GP before designing around it.

### Gaps
- No official Formula One Licensing terms for fan use of team radio were found.
- Audio quality (bitrate) was not verified.

## 5. Lightweight backends for crowd stats ("X % chose this")

### Takeaway
A tiny vote counter (one Redis `INCR` per vote plus a read per view) fits easily within free tiers. Upstash Redis via the Vercel Marketplace is the natural fit for a Next.js site: Vercel KV no longer exists and was migrated to Upstash. Supabase Free works too, but pauses after a week of inactivity, which suits a seasonal site badly. For GDPR, store only aggregate counters. If duplicate votes must be limited, use a client token in localStorage or a short-lived salted hash rather than raw IPs, since IPs count as personal data.

### Cited Findings
- **Upstash Redis free tier:** 500K commands/month, 250 MB data, 10 GB bandwidth. Pay-as-you-go costs $0.20 per 100K commands. — [Upstash pricing](https://upstash.com/pricing/redis)
- **Vercel KV:** "no longer available". Existing stores were moved to Upstash Redis in December 2024, and new projects install Redis from the Marketplace. The `@vercel/kv` package was replaced by `@upstash/redis`. — [Vercel Redis docs](https://vercel.com/docs/redis); [Vercel community](https://community.vercel.com/t/alternatives-to-vercel-kv/43233)
- **Supabase Free:** 500 MB DB, 50,000 MAU, 5 GB egress, 2 active projects, and projects pause after 1 week of inactivity. Pro starts at $25/month. — [Supabase pricing](https://supabase.com/pricing)
- **Supabase GDPR:** each project lives in one primary region, so pick a specific EU region such as Frankfurt (the "Europe" group also includes London and Zurich). A DPA is available, but region choice alone does not make an app compliant. — [Supabase GDPR guide](https://supabase.com/docs/guides/security/gdpr-compliance)
- IP addresses are generally personal data under GDPR (EDPB position). Properly anonymised data falls outside GDPR. — [TechGDPR](https://techgdpr.com/blog/is-an-ip-address-considered-personal-data/)
- A poll service example keeps IPs for 90 days and then anonymises them, with legitimate interest (fraud prevention) as the legal basis. — [Pref.Tools privacy](https://pref.tools/vote/privacy)

### Inferences
- **Cost estimate (my calculation):** each vote costs about 2 commands (INCR plus a read of the totals). 10,000 votes plus 50,000 result views per month is about 70K commands, well inside the free 500K. Even 1M commands would cost about $1–2 on pay-as-you-go.
- **Architecture:** the static Next.js site plus one serverless route (Vercel Function or Edge) that calls Upstash. Alternatively, call Upstash's REST API directly from the browser through a restricted token. A server route is safer for abuse control.
- **Cheaper still, no backend:** show "what the real teams or drivers did" or pre-seeded expert answers instead of live crowd percentages.

### Gaps
- The Upstash pricing page did not state EU regions or a DPA. Upstash does offer EU regions in my understanding, but I did not verify this in this session.
- Vercel Function free-tier limits were not fetched.
- The GDPR notes are general context, not legal advice. Per Ernesto's standing rule, legal choices are his.

## 6. Mobile performance budgets (JSON size, frame rate)

### Takeaway
Treat about 170 KB of compressed JavaScript per page as the mobile reference budget. Load interactive data lazily, per activity, and target under about 200–500 KB gzipped per interactive dataset (my working estimate). Canvas 2D animation of 20 interpolated dots is well within 60 fps on mid-range phones. The costly parts are JSON parsing and large charting libraries, not drawing.

### Cited Findings
- web.dev's example budget: a product page under 170 KB of JS on mobile, calculated for baseline devices on 3G. — [web.dev performance budgets 101](https://web.dev/articles/performance-budgets-101)
- Origin of the figure: Alex Russell recommended about 130–170 KB of critical-path resources for a low-cost Android phone on a slow network. — [Infrequently Noted](https://infrequently.org/2017/10/can-you-afford-it-real-world-web-performance-budgets)
- f1-replay rounds floats, nulls NaN and compacts stationary positions (15–30 % saving), and ships column-oriented JSON. — [f1-replay telemetry reference](https://f1-replay.readthedocs.io/en/latest/TELEMETRY.html)

### Inferences
- **Practical rules:** column-oriented arrays instead of arrays of objects; integers instead of floats (decimetres to metres, ms); one file per activity or per GP, fetched on demand; gzip or brotli from the CDN (Vercel does this automatically for static files, not verified here); and parse in a Web Worker if files exceed about 1 MB.
- **Frame-rate tactics:** a single `requestAnimationFrame` loop, the track drawn once to an offscreen canvas, and only the dots redrawn each frame. Avoid SVG with hundreds of animating nodes, and respect `prefers-reduced-motion`.

### Gaps
- No authoritative source found for a JSON payload budget specifically, as opposed to a JS budget. The sizes above are working estimates.
- No measured mobile fps benchmarks for F1 replay canvases were found.
