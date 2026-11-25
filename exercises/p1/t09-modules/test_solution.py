from pathlib import Path

HERE = Path(__file__).parent


def test_structure():
    assert (HERE / "utils" / "__init__.py").exists(), "أنشئ utils/__init__.py"
    assert (HERE / "utils" / "money.py").exists(), "أنشئ utils/money.py"
    req = HERE / "requirements.txt"
    assert req.exists(), "أنشئ requirements.txt"
    assert "pytest" in req.read_text(encoding="utf-8").lower()


def test_format_usd(sol):
    from utils.money import format_usd  # noqa: E402  (sol أضاف المجلد إلى المسار)
    assert format_usd(1234.5) == "$1,234.50"
    assert format_usd(0) == "$0.00"


def test_report(sol):
    assert sol.report([1000, 234.5]) == "$1,234.50"
    assert sol.report([]) == "$0.00"
