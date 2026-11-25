import pytest

@pytest.mark.parametrize("score,expected", [
    (100, "ممتاز"), (90, "ممتاز"), (89.5, "جيد جداً"), (80, "جيد جداً"),
    (79, "جيد"), (70, "جيد"), (69, "مقبول"), (50, "مقبول"),
    (49.9, "راسب"), (0, "راسب"),
])
def test_grades(sol, score, expected):
    assert sol.grade(score) == expected


@pytest.mark.parametrize("score", [-1, 101, 150])
def test_invalid(sol, score):
    assert sol.grade(score) == "غير صالح"
