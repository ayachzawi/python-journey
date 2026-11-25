PAYMENTS = [
    {"client": "أحمد", "amount": 200},
    {"client": "سارة", "amount": 500},
    {"client": "أحمد", "amount": 400},
    {"client": "خالد", "amount": 100},
    {"client": "سارة", "amount": 50},
]


def test_top_clients(sol):
    f = sol.top_clients
    assert f(PAYMENTS, 2) == ["أحمد", "سارة"]
    assert f(PAYMENTS, 3) == ["أحمد", "سارة", "خالد"]
    assert f([], 3) == []


def test_top_clients_does_not_modify_input(sol):
    copy = [dict(p) for p in PAYMENTS]
    sol.top_clients(PAYMENTS, 2)
    assert PAYMENTS == copy, "لا تعدّل القائمة الأصلية"


def test_word_count(sol):
    f = sol.word_count
    assert f("كود كود جميل") == {"كود": 2, "جميل": 1}
    assert f("") == {}
