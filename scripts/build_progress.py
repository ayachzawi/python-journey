"""يبني progress.json من محتوى المستودع.

يقرأ content/roadmap.json، ويفحص كل خطوة حسب نوع التحقق الخاص بها
(اختبارات، ملفات، مشاريع، عدد commits)، ثم يكتب النتيجة في progress.json
ليقرأها التطبيق. يعمل تلقائياً في GitHub Actions بعد كل push،
ويمكنك تشغيله محلياً: python scripts/build_progress.py
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROADMAP = ROOT / "content" / "roadmap.json"
OUT = ROOT / "progress.json"
CODE_EXT = {".py", ".ts", ".tsx", ".js", ".jsx", ".html", ".css", ".sql"}
IGNORED_DIRS = {"node_modules", ".venv", "venv", "__pycache__", ".git", "dist", "build"}
BOT_AUTHORS = {"github-actions[bot]", "github-actions", "Claude"}  # commits الإعداد لا تُحسب لك


def git_activity() -> tuple[int, list[str]]:
    """عدد commits الخاصة بك (بدون commits البوت) والأيام التي عملت فيها."""
    try:
        out = subprocess.run(
            ["git", "log", "--format=%an|%ad", "--date=short"],
            cwd=ROOT, capture_output=True, text=True, check=True,
        ).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        return 0, []
    count, days = 0, set()
    for line in out.splitlines():
        author, _, day = line.partition("|")
        if author in BOT_AUTHORS or not day:
            continue
        count += 1
        days.add(day)
    return count, sorted(days)[-400:]


def files_in(path: Path, exts: set[str] | None = None) -> list[Path]:
    if not path.is_dir():
        return []
    found = []
    for f in path.rglob("*"):
        if not f.is_file() or any(part in IGNORED_DIRS for part in f.relative_to(path).parts):
            continue
        if exts is None or f.suffix.lower() in exts:
            found.append(f)
    return found


def run_tests(folder: Path) -> dict:
    if not (folder / "solution.py").exists():
        return {"done": False, "detail": "لم يُرفع الحل بعد"}
    with tempfile.TemporaryDirectory() as tmp:
        report = Path(tmp) / "report.xml"
        try:
            proc = subprocess.run(
                [sys.executable, "-m", "pytest", str(folder.relative_to(ROOT)),
                 "-p", "no:cacheprovider", f"--junitxml={report}"],
                cwd=ROOT, capture_output=True, text=True, timeout=120,
            )
        except subprocess.TimeoutExpired:
            return {"done": False, "detail": "الاختبارات استغرقت أكثر من دقيقتين (حلقة لا تنتهي؟)"}
        total = failed = 0
        if report.exists():
            for suite in ET.parse(report).getroot().iter("testsuite"):
                total += int(suite.get("tests", 0))
                failed += int(suite.get("failures", 0)) + int(suite.get("errors", 0))
    passed = max(total - failed, 0)
    done = proc.returncode == 0 and total > 0
    detail = "كل الاختبارات نجحت" if done else f"نجح {passed} من {total}"
    return {"done": done, "passed": passed, "total": total, "detail": detail}


def evaluate(check: dict, commits: int) -> dict:
    kind = check.get("type")
    if kind == "tests":
        return {"via": "tests", **run_tests(ROOT / check["dir"])}
    if kind == "commits":
        need = int(check.get("min", 1))
        return {"via": "commits", "done": commits >= need, "detail": f"{min(commits, need)} من {need} commits"}
    if kind == "file":
        f = ROOT / check["path"]
        size = len(f.read_text(encoding="utf-8").strip()) if f.is_file() else 0
        need = int(check.get("min_chars", 1))
        return {"via": "file", "done": size >= need,
                "detail": "تم" if size >= need else (f"الملف قصير: {size} من {need} حرفاً" if size else "الملف غير موجود")}
    if kind == "dir":
        exts = {e.lower() for e in check.get("ext", [])} or None
        n = len(files_in(ROOT / check["path"], exts))
        need = int(check.get("min_files", 1))
        return {"via": "dir", "done": n >= need, "detail": f"{min(n, need)} من {need} ملفات"}
    if kind == "project":
        p = ROOT / check["path"]
        has_readme = (p / "README.md").is_file()
        code = len(files_in(p, CODE_EXT))
        done = has_readme and code > 0
        missing = [m for m, ok in (("README.md", has_readme), ("ملف كود", code > 0)) if not ok]
        return {"via": "project", "done": done, "detail": "تم" if done else "ينقصه: " + "، ".join(missing)}
    return {"via": "manual", "done": False, "detail": "تؤشّر عليها بنفسك في التطبيق"}


def main() -> None:
    roadmap = json.loads(ROADMAP.read_text(encoding="utf-8"))
    previous = {}
    if OUT.exists():
        try:
            previous = json.loads(OUT.read_text(encoding="utf-8")).get("items", {})
        except json.JSONDecodeError:
            previous = {}
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    commits, days = git_activity()
    items = {}
    for phase in roadmap["phases"]:
        for item in phase["items"]:
            result = evaluate(item.get("check", {}), commits)
            if result["done"]:
                result["since"] = previous.get(item["id"], {}).get("since") or now
            items[item["id"]] = result
    data = {"generated_at": now, "commits": commits, "commit_days": days, "items": items}
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    done = sum(1 for v in items.values() if v["done"])
    print(f"progress.json: {done}/{len(items)} خطوة مكتملة تلقائياً، {commits} commits")


if __name__ == "__main__":
    main()
