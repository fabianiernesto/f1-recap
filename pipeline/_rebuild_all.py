"""Rebuild every registered weekend with the current pipeline. One line each."""
import pathlib, subprocess, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from gps import GPS  # noqa: E402

P = pathlib.Path(__file__).parent
for slug in GPS:
    r = subprocess.run([sys.executable, "build_weekend.py", slug], cwd=P, capture_output=True,
                       text=True, encoding="utf-8", errors="replace")
    lines = [l for l in (r.stdout + r.stderr).splitlines() if l.strip()]
    print(f"{slug:18} rc={r.returncode}  {lines[-1] if lines else ''}")
    if r.returncode:
        print("   " + "\n   ".join(lines[-6:]))
