#!/usr/bin/env python3
"""Fetch the team's PubMed RSS feed into data/publications.json.

Stdlib only, so CI needs no dependencies. Run from the repo root:

    python3 scripts/fetch_pubmed.py

Exits non-zero on a fetch or parse failure, and refuses to overwrite a good
file with an empty list — a broken feed should surface as a red workflow, not
as a silently empty publications section on the site.
"""

from __future__ import annotations

import json
import pathlib
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date

FEED_URL = (
    "https://pubmed.ncbi.nlm.nih.gov/rss/search/"
    "1nskJOntD_Iqu119bSgbh0QRPabiXWpXmYRKzaeeHlf1wRCQzp/?limit=50"
)

OUT = pathlib.Path("data/publications.json")

NS = {
    "dc": "http://purl.org/dc/elements/1.1/",
    "content": "http://purl.org/rss/1.0/modules/content/",
}

# PubMed puts the citation line in <content:encoded>, wrapped in markup, e.g.
# "Anesthesiology. 2024 Mar 1;140(3):512-523. doi: 10.1097/ALN.0000000000004842."
TAGS = re.compile(r"<[^>]+>")
WS = re.compile(r"\s+")


def text_of(el: ET.Element | None) -> str:
    return (el.text or "").strip() if el is not None else ""


def strip_markup(html: str) -> str:
    return WS.sub(" ", TAGS.sub(" ", html)).strip()


# "Eur J Anaesthesiol. 2026 Jun 11" -> ("Eur J Anaesthesiol", "2026 Jun 11")
# "Anaesth Crit Care Pain Med. 2026 May 30;45(6):101861" -> (name, "2026 May 30")
CITATION = re.compile(r"^(?P<name>.+?)\.\s*(?P<rest>\d{4}\b.*)$")


def journal_of(item: ET.Element) -> tuple[str, str]:
    """Split PubMed's citation line into the journal name and its own date.

    The site shows PubMed's date rather than a date derived from <dc:date>:
    the two disagree whenever a paper was published ahead of print, and
    printing both side by side reads as a contradiction.
    """
    raw = text_of(item.find("content:encoded", NS))
    if not raw:
        return "", ""
    flat = strip_markup(raw)
    flat = re.split(r"\bdoi:", flat, maxsplit=1)[0].strip().rstrip(".").strip()

    m = CITATION.match(flat)
    if not m:
        return flat, ""
    # Drop volume/issue/pages, which follow a semicolon.
    when = m.group("rest").split(";", 1)[0].strip().rstrip(".").strip()
    return m.group("name").strip(), when


def canonical_url(link: str, pmid: str) -> str:
    """Drop PubMed's tracking parameters.

    The feed's links carry utm_* plus an `ff` fetch timestamp that changes on
    every request. Left alone it would defeat the no-op check below and commit a
    fresh diff every night. The PMID is all the URL needs.
    """
    if pmid:
        return f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
    return link.split("?", 1)[0]


def identifiers(item: ET.Element) -> tuple[str, str]:
    pmid = doi = ""
    for el in item.findall("dc:identifier", NS):
        val = (el.text or "").strip()
        if val.startswith("pmid:"):
            pmid = val[5:].strip()
        elif val.startswith("doi:"):
            doi = val[4:].strip()
    return pmid, doi


def parse(xml: bytes) -> list[dict]:
    root = ET.fromstring(xml)
    items = []
    for item in root.findall("./channel/item"):
        title = strip_markup(text_of(item.find("title")))
        link = text_of(item.find("link"))
        if not title or not link:
            continue
        pmid, doi = identifiers(item)
        journal, published = journal_of(item)
        items.append(
            {
                "title": title,
                "url": canonical_url(link, pmid),
                "authors": [
                    (a.text or "").strip()
                    for a in item.findall("dc:creator", NS)
                    if (a.text or "").strip()
                ],
                "journal": journal,
                "published": published,
                "date": text_of(item.find("dc:date", NS))[:10],
                "doi": doi,
                "pmid": pmid,
            }
        )
    return items


def main() -> int:
    req = urllib.request.Request(
        FEED_URL,
        headers={"User-Agent": "digital-twins-perioperative-site/1.0 (+github pages)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            xml = resp.read()
    except (urllib.error.URLError, TimeoutError) as exc:
        print(f"error: could not fetch the feed: {exc}", file=sys.stderr)
        return 1

    try:
        items = parse(xml)
    except ET.ParseError as exc:
        print(f"error: could not parse the feed: {exc}", file=sys.stderr)
        return 1

    if not items:
        print(
            "error: the feed parsed but held no publications; leaving the "
            "existing file alone",
            file=sys.stderr,
        )
        return 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {"updated": date.today().isoformat(), "items": items}

    # Keep the file byte-identical when only the date would change, so the
    # nightly workflow does not commit a no-op every night.
    if OUT.exists():
        try:
            old = json.loads(OUT.read_text())
            if old.get("items") == items:
                print(f"no change: {len(items)} publications")
                return 0
        except (json.JSONDecodeError, OSError):
            pass

    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {OUT} with {len(items)} publications")
    return 0


if __name__ == "__main__":
    sys.exit(main())
