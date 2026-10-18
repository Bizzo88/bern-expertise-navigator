"""robots.txt wildcards (UniBE uses them) and URL dedup keys."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))

from navigator.crawl import RobotRules, url_key  # noqa: E402

UNIBE = """User-Agent: *
Disallow: /error
Disallow: /*index.html
Disallow: */manage
Disallow: /*?preview=preview$
"""


def test_wildcards():
    r = RobotRules(UNIBE, "HackApertus-ExpertiseNavigator/0.1")
    assert r.can_fetch("https://www.artorg.unibe.ch/research/index_eng.html")
    assert not r.can_fetch("https://www.artorg.unibe.ch/research/index.html")
    assert not r.can_fetch("https://www.artorg.unibe.ch/error/404")
    assert not r.can_fetch("https://x.unibe.ch/a?preview=preview")
    assert r.can_fetch("https://x.unibe.ch/a?preview=preview&x=1")


def test_allow_overrides_shorter_disallow_and_specific_agent():
    txt = "User-agent: *\nDisallow: /\n\nUser-agent: hackapertus\nDisallow: /private\nAllow: /private/ok\n"
    r = RobotRules(txt, "HackApertus-ExpertiseNavigator/0.1")
    assert r.can_fetch("https://a.ch/public")
    assert not r.can_fetch("https://a.ch/private/x")
    assert r.can_fetch("https://a.ch/private/ok/page")
    assert not RobotRules(txt, "OtherBot").can_fetch("https://a.ch/public")


def test_empty_robots_allows_everything():
    assert RobotRules("", "x").can_fetch("https://a.ch/anything")


def test_url_key():
    assert url_key("https://www.dcberne.com/en/team/#x") == url_key("http://dcberne.com/en/team")
