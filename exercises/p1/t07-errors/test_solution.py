import pytest

def test_safe_divide(sol):
    f = sol.safe_divide
    assert f(10, 2) == 5
    assert f(1, 0) is None
    assert f(0, 5) == 0


def test_parse_price(sol):
    f = sol.parse_price
    assert f("12.5$") == 12.5
    assert f(" 40 $ ") == 40.0
    assert f("7") == 7.0


@pytest.mark.parametrize("bad", ["abc", "", "$", "12.5.3$"])
def test_parse_price_invalid(sol, bad):
    with pytest.raises(ValueError) as e:
        sol.parse_price(bad)
    assert str(e.value).strip(), "اكتب رسالة خطأ واضحة"
