import subprocess
import sys
from pathlib import Path


def test_prints_hello():
    path = Path(__file__).with_name("solution.py")
    assert path.exists(), "أنشئ ملف solution.py أولاً"
    out = subprocess.run([sys.executable, str(path)], capture_output=True, text=True, encoding="utf-8", timeout=10)
    assert out.returncode == 0, f"البرنامج توقف بخطأ:\n{out.stderr}"
    assert "مرحباً يا عالم" in out.stdout, f"المتوقع أن يطبع: مرحباً يا عالم\nلكنه طبع: {out.stdout!r}"
