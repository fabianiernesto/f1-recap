"""Builds every weekend in _todo.txt: circuit, download, weekend. One log line
per step; a failure on one circuit is logged and the loop moves on."""
import pathlib, subprocess, sys, time

P = pathlib.Path(__file__).parent
log = P / "_run_all.log"


def say(msg):
    with log.open("a", encoding="utf-8") as f:
        f.write(time.strftime("%H:%M:%S ") + msg + "\n")


def run(args, tail=6):
    r = subprocess.run([sys.executable] + args, cwd=P, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    out = [l for l in (r.stdout + r.stderr).splitlines()
           if l.strip() and " INFO " not in l and "WARNING" not in l and "DEBUG" not in l]
    return r.returncode, out[-tail:]


log.write_text("", encoding="utf-8")
for line in (P / "_todo.txt").read_text(encoding="utf-8").splitlines():
    slug, ff1, gp, country = line.split("|")
    say(f"=== {slug}")
    code, out = run(["add_circuit.py", "2026", ff1, slug, gp, country], tail=7)
    say(f"circuit rc={code} " + " / ".join(out))
    if code != 0:
        continue
    code, out = run(["fase0_explora.py", slug], tail=14)
    say(f"download rc={code}\n    " + "\n    ".join(out))
    if code != 0:
        continue
    # the official tables and FastF1's reading of the laps: both optional, the
    # builder does without them and says only what the feed saw
    run(["official.py", slug])
    run(["ff1laps.py", slug])
    code, out = run(["build_weekend.py", slug], tail=8)
    say(f"build rc={code} " + " / ".join(out))
say("ALL DONE")
