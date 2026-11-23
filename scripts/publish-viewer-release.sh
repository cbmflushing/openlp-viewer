#!/usr/bin/env bash
set -euo pipefail

version=$(sed -nE "s/^[[:space:]]*const VIEWER_VERSION = '([^']+)';[[:space:]]*$/\1/p" lyrics-display.html)
if [[ -z "$version" || "$version" == *$'\n'* ]]; then
  echo 'Expected exactly one VIEWER_VERSION declaration' >&2
  exit 1
fi
tag="viewer-$GITHUB_RUN_ID"
title="Viewer v$version"
releases_api="repos/$GITHUB_REPOSITORY/releases?per_page=100"
ref_api="repos/$GITHUB_REPOSITORY/git/ref/tags/$tag"

# Listing includes drafts, unlike the published-release-by-tag endpoint.
find_release() {
  gh api --paginate --slurp "$releases_api" | jq -c --arg tag "$tag" '
    [.[][] | select(.tag_name == $tag)] |
    if length > 1 then error("duplicate release tags") else .[0] // null end
  '
}
release=$(find_release)
if [[ "$release" == null ]]; then
  gh release create "$tag" --target "$GITHUB_SHA" --title "$title" --draft
  release=$(find_release)
fi

# Do not modify an unrelated or unexpectedly populated release.
echo "$release" | jq -e --arg title "$title" '
  .name == $title and (.draft | type == "boolean") and
  (.assets | type == "array" and all(.[]; .name == "lyrics-display.html"))
' >/dev/null

if [[ $(echo "$release" | jq -r '.draft') == true ]]; then
  # A tagless draft creates its tag at target_commitish when published. An
  # existing tag takes precedence, so verify it too before changing the draft.
  refs=$(gh api "repos/$GITHUB_REPOSITORY/git/matching-refs/tags/$tag")
  if ! jq -e --arg tag "refs/tags/$tag" --arg sha "$GITHUB_SHA" --argjson refs "$refs" '
    .target_commitish == $sha and
    ($refs | all(.[] | select(.ref == $tag); .object.type == "commit" and .object.sha == $sha))
  ' <<< "$release" >/dev/null; then
    echo "Draft $tag does not target $GITHUB_SHA" >&2
    exit 1
  fi
  gh release upload "$tag" lyrics-display.html --clobber
  release=$(find_release)
  echo "$release" | jq -e '.draft == true and (.assets | length == 1 and .[0].name == "lyrics-display.html" and .[0].state == "uploaded")' >/dev/null
  gh release edit "$tag" --draft=false
fi

# Both a fresh publication and a rerun must be complete and point at this commit.
release=$(find_release)
echo "$release" | jq -e --arg title "$title" '
  .name == $title and .draft == false and
  (.assets | length == 1 and .[0].name == "lyrics-display.html" and .[0].state == "uploaded")
' >/dev/null
ref=$(gh api "$ref_api")
echo "$ref" | jq -e --arg sha "$GITHUB_SHA" '.object.type == "commit" and .object.sha == $sha' >/dev/null
