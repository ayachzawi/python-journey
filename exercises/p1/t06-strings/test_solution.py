
def test_palindrome(sol):
    f = sol.is_palindrome
    assert f("Never odd or even") is True
    assert f("racecar") is True
    assert f("python") is False
    assert f("") is True


def test_slugify(sol):
    f = sol.slugify
    assert f("  My First App ") == "my-first-app"
    assert f("Hello") == "hello"
    assert f("a  b") == "a-b", "المسافات المتكررة تصبح شرطة واحدة"


def test_remove_tashkeel(sol):
    f = sol.remove_tashkeel
    assert f("مُبَرْمِجٌ") == "مبرمج"
    assert f("بايثون") == "بايثون"
    assert f("شَدَّة") == "شدة"
