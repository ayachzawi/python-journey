import pytest

def test_discount_default(sol):
    assert sol.apply_discount(200) == pytest.approx(180)


def test_discount_custom(sol):
    f = sol.apply_discount
    assert f(200, 25) == pytest.approx(150)
    assert f(99, 0) == pytest.approx(99)


def test_split(sol):
    f = sol.split_bill
    assert f(100, 4) == 25
    assert f(100, 3) == 33.33
    assert f(100, 4, tip=10) == 27.5


@pytest.mark.parametrize("people", [0, -2])
def test_split_invalid(sol, people):
    with pytest.raises(ValueError):
        sol.split_bill(100, people)
