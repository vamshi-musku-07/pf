const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  sanitizeBrowseQuery,
  browseSearchHint,
  BROWSE_SEARCH_MIN_CHARS,
  BROWSE_SEARCH_MAX_CHARS,
} = require("../../../features/tournament/browseConfig");

test("sanitizeBrowseQuery requires min chars", () => {
  assert.equal(sanitizeBrowseQuery("a"), "");
  assert.equal(sanitizeBrowseQuery("ab"), "ab");
  assert.equal(sanitizeBrowseQuery("  Summer Cup  "), "Summer Cup");
});

test("sanitizeBrowseQuery caps length", () => {
  const long = "t".repeat(BROWSE_SEARCH_MAX_CHARS + 10);
  assert.equal(sanitizeBrowseQuery(long).length, BROWSE_SEARCH_MAX_CHARS);
});

test("browseSearchHint guides short queries", () => {
  assert.match(browseSearchHint(""), /Search by name/);
  assert.match(browseSearchHint("a"), new RegExp(`${BROWSE_SEARCH_MIN_CHARS - 1}`));
  assert.equal(browseSearchHint("ab"), null);
});
