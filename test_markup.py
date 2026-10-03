"""Small structural checks for the inherited HTML page."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import unittest


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.fragments = []
        self.images_without_alt = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "a" and attrs.get("href", "").startswith("#"):
            self.fragments.append(attrs["href"][1:])
        if tag == "img" and not attrs.get("alt"):
            self.images_without_alt.append(attrs.get("src", ""))


class MarkupTests(unittest.TestCase):
    def test_navigation_and_images(self):
        page = PageParser()
        page.feed(Path(__file__).with_name("index.html").read_text(encoding="utf-8"))
        self.assertEqual([key for key, count in Counter(page.ids).items() if count > 1], [])
        self.assertEqual(sorted(set(page.fragments) - set(page.ids)), [])
        self.assertEqual(page.images_without_alt, [])


if __name__ == "__main__":
    unittest.main()
