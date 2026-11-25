
def test_total_income(sol):
    f = sol.total_income
    assert f(4, 150) == 600
    assert f(0, 150) == 0
    assert f(3, 99.5) == 298.5


def test_summary_contains_values(sol):
    s = sol.summary("صدارة", 4, 150)
    assert isinstance(s, str), "summary يجب أن ترجع نصاً، لا أن تطبعه"
    for part in ["صدارة", "4", "600"]:
        assert part in s, f"الجملة يجب أن تحتوي على {part}، والناتج كان: {s}"


def test_summary_other_values(sol):
    s = sol.summary("قارئ", 10, 25)
    assert "قارئ" in s and "10" in s and "250" in s
