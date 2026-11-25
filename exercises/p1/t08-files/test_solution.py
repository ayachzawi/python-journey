TASKS = [{"title": "تعلم الحلقات", "done": True}, {"title": "مشروع الدخل", "done": False}]


def test_roundtrip(sol, tmp_path):
    p = tmp_path / "tasks.json"
    sol.save_tasks(p, TASKS)
    assert sol.load_tasks(p) == TASKS


def test_arabic_readable(sol, tmp_path):
    p = tmp_path / "tasks.json"
    sol.save_tasks(p, TASKS)
    raw = p.read_text(encoding="utf-8")
    assert "تعلم الحلقات" in raw, "النص العربي ظهر كرموز \\u... داخل الملف. استعمل ensure_ascii=False"


def test_missing_file(sol, tmp_path):
    assert sol.load_tasks(tmp_path / "nothing.json") == []
