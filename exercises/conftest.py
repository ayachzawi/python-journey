"""يحمّل ملف solution.py الموجود في نفس مجلد الاختبار، ويقدّمه للاختبارات باسم sol."""
import importlib.util
import sys

import pytest


@pytest.fixture
def sol(request):
    folder = request.path.parent
    path = folder / "solution.py"
    if not path.exists():
        pytest.fail(f"لم أجد solution.py في {folder.name}. أنشئ الملف واكتب حلك فيه.")
    sys.path.insert(0, str(folder))
    try:
        spec = importlib.util.spec_from_file_location(f"solution_{folder.name}", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    finally:
        sys.path.remove(str(folder))
    return _Solution(module)


class _Solution:
    """يعطي رسالة واضحة بالعربية إذا كانت الدالة غير موجودة في الحل."""

    def __init__(self, module):
        self._module = module

    def __getattr__(self, name):
        if not hasattr(self._module, name):
            pytest.fail(f"لم أجد الدالة {name} في solution.py")
        return getattr(self._module, name)
