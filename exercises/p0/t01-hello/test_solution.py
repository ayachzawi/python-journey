import runpy
from pathlib import Path


def test_prints_hello(capsys):
    path = Path(__file__).with_name("solution.py")
    assert path.exists(), "أنشئ ملف solution.py أولاً"
    runpy.run_path(str(path), run_name="__main__")
    out = capsys.readouterr().out
    assert "مرحباً يا عالم" in out, f"المتوقع أن يطبع: مرحباً يا عالم\nلكنه طبع: {out!r}"
