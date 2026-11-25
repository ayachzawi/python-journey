
def test_sum_even(sol):
    f = sol.sum_even
    assert f(10) == 30
    assert f(1) == 0
    assert f(2) == 2
    assert f(0) == 0


def test_countdown(sol):
    f = sol.countdown
    assert f(3) == [3, 2, 1]
    assert f(1) == [1]
    assert f(0) == []


def test_table(sol):
    t = sol.table(3)
    assert len(t) == 10
    assert t[0] == "3 x 1 = 3"
    assert t[3] == "3 x 4 = 12"
    assert t[-1] == "3 x 10 = 30"
