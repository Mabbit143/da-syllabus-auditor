"""Recognize OregonNews's explicitly linked public Shorthand story host."""
from urllib.parse import urlsplit
from .fetch import canonical_url

HOST = "university-of-oregon-news.shorthandstories.com"


def trusted_story(parent, story):
    try:
        a, b = urlsplit(canonical_url(parent)), urlsplit(canonical_url(story))
        return a.hostname == "news.uoregon.edu" and b.hostname == HOST and not b.query and bool(b.path.strip("/"))
    except (TypeError, ValueError):
        return False


def story_from_script(parent, script):
    try:
        script = canonical_url(script)
        parsed = urlsplit(script)
        if not parsed.query and parsed.path.endswith("/embed.js"):
            story = script[:-len("embed.js")]
            return story if trusted_story(parent, story) else None
    except (TypeError, ValueError):
        pass
    return None
