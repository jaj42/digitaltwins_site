/* Renders data/publications.json into #pub-list.
 *
 * The JSON is generated from PubMed's RSS feed by scripts/fetch_pubmed.py and
 * refreshed nightly by .github/workflows/publications.yml. Feed text is never
 * interpolated into innerHTML — every string goes in as a text node.
 */
(function () {
  "use strict";

  var list = document.getElementById("pub-list");
  if (!list) return;

  var stamp = document.getElementById("pub-updated");
  var FEED =
    "https://pubmed.ncbi.nlm.nih.gov/rss/search/" +
    "1nskJOntD_Iqu119bSgbh0QRPabiXWpXmYRKzaeeHlf1wRCQzp/?limit=50";

  var SHOW = 8;

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  function fail() {
    list.replaceChildren();
    var p = el(
      "p",
      "leading-relaxed text-ink-soft",
      "The publication list could not be loaded. "
    );
    var a = el(
      "a",
      "font-medium text-accent underline underline-offset-4 hover:text-accent-dark",
      "Read the feed on PubMed"
    );
    a.href = FEED;
    p.appendChild(a);
    p.appendChild(document.createTextNode("."));
    list.appendChild(p);
  }

  /* "2026-06-16" -> "June 2026". Parsed by hand: new Date() on a bare
     yyyy-mm-dd is UTC, which can slip a month backwards west of Greenwich. */
  var MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  function prettyDate(iso) {
    var m = /^(\d{4})-(\d{2})/.exec(iso || "");
    if (!m) return "";
    return MONTHS[parseInt(m[2], 10) - 1] + " " + m[1];
  }

  /* Long author lists are the norm here; show the ends and count the middle. */
  function authorLine(authors) {
    if (!authors || !authors.length) return "";
    if (authors.length <= 4) return authors.join(", ");
    return (
      authors.slice(0, 3).join(", ") +
      " … " +
      authors[authors.length - 1] +
      " (" + authors.length + " authors)"
    );
  }

  function entry(item) {
    var li = el("li", "border-t border-rule py-6 first:border-t-0 first:pt-0");

    /* PubMed's own citation date, not one derived from the feed's <dc:date> —
       the two disagree on anything published ahead of print. */
    var head = el("div", "flex flex-wrap items-baseline gap-x-4 gap-y-1");
    if (item.journal) {
      head.appendChild(el("p", "u-channel text-ink-mute", item.journal));
    }
    var when = item.published || prettyDate(item.date);
    if (when) head.appendChild(el("p", "u-channel text-ink-mute", when));
    li.appendChild(head);

    var h = el("h3", "mt-2.5 text-lg leading-snug font-semibold tracking-tight");
    var a = el("a", "transition-colors hover:text-accent", item.title);
    a.href = item.url;
    a.rel = "noopener";
    h.appendChild(a);
    li.appendChild(h);

    var au = authorLine(item.authors);
    if (au) {
      li.appendChild(el("p", "mt-2 text-[0.95rem] leading-relaxed text-ink-soft", au));
    }

    if (item.doi) {
      var doi = el("p", "mt-2");
      var dl = el(
        "a",
        "font-mono text-xs text-ink-mute underline underline-offset-4 hover:text-accent",
        "doi:" + item.doi
      );
      dl.href = "https://doi.org/" + item.doi;
      dl.rel = "noopener";
      doi.appendChild(dl);
      li.appendChild(doi);
    }

    return li;
  }

  function render(data) {
    var items = (data && data.items) || [];
    if (!items.length) return fail();

    list.replaceChildren();

    var ul = el("ul", "");
    items.slice(0, SHOW).forEach(function (it) {
      ul.appendChild(entry(it));
    });
    list.appendChild(ul);

    if (items.length > SHOW) {
      var rest = el("ul", "hidden");
      items.slice(SHOW).forEach(function (it) {
        rest.appendChild(entry(it));
      });
      list.appendChild(rest);

      var btn = el(
        "button",
        "u-channel mt-8 rounded-md border border-rule bg-white px-5 py-3 text-ink-soft transition-colors hover:border-accent hover:text-accent",
        "Show all " + items.length + " publications"
      );
      btn.type = "button";
      btn.addEventListener("click", function () {
        rest.classList.remove("hidden");
        btn.remove();
      });
      list.appendChild(btn);
    }

    var more = el("p", "mt-8");
    var ml = el(
      "a",
      "u-channel text-ink-mute underline underline-offset-4 hover:text-accent",
      "Full record on PubMed"
    );
    ml.href = FEED;
    ml.rel = "noopener";
    more.appendChild(ml);
    list.appendChild(more);

    if (stamp && data.updated) {
      stamp.textContent = "Updated " + prettyDate(data.updated);
    }
  }

  fetch("data/publications.json", { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(render)
    .catch(fail);
})();
