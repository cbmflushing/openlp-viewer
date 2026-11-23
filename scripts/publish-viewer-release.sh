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
refs_api="repos/$GITHUB_REPOSITORY/git/matching-refs/tags/$tag"

# Listing includes drafts, unlike the published-release-by-tag endpoint.
find_release() {
  gh api --paginate --slurp "$releases_api" | jq -c --arg tag "$tag" '
    [.[][] | select(.tag_name == $tag)] |
    if length > 1 then error("duplicate release tags") else .[0] // null end
  '
}

# Matching refs returns an empty array while the new tag is not visible.
find_tag() {
  gh api "$refs_api" | jq -c --arg ref "refs/tags/$tag" '
    [.[] | select(.ref == $ref)] |
    if length > 1 then error("duplicate tag refs") else .[0] // null end
  '
}

# Upload and edit use the same tag lookup as view, which can lag the REST
# listing. Treat lookup failures as not ready; gh still logs its error.
find_cli_release() {
  local result
  if result=$(gh release view "$tag" --json databaseId,isDraft); then
    printf '%s\n' "$result"
  else
    printf 'null\n'
  fi
}

# Retry reads, never writes. A failed API listing or invalid JSON is not
# evidence of stale state and stops the run immediately.
wait_for() {
  local description=$1 read_state=$2 check=$3 result attempt status
  shift 3
  for attempt in 1 2 3 4 5 6; do
    result=$("$read_state") || return
    if jq -e "$@" "$check" <<< "$result" >/dev/null; then
      printf '%s\n' "$result"
      return 0
    else
      status=$?
      if (( status != 1 )); then return "$status"; fi
    fi
    if (( attempt < 6 )); then sleep 2; fi
  done
  echo "Timed out waiting for $description ($tag)" >&2
  return 1
}

release=$(find_release)
if [[ "$release" == null ]]; then
  gh release create "$tag" --target "$GITHUB_SHA" --title "$title" --draft
  release=$(wait_for 'draft listing' find_release '. != null')
fi

# Do not modify an unrelated or unexpectedly populated release.
echo "$release" | jq -e --arg title "$title" '
  .name == $title and (.draft | type == "boolean") and
  (.assets | type == "array" and all(.[]; .name == "lyrics-display.html"))
' >/dev/null

uploaded_asset='(.assets | length == 1 and .[0].name == "lyrics-display.html" and .[0].state == "uploaded")'
published=".name == \$title and .draft == false and $uploaded_asset"
tag_targets_sha='.object.type == "commit" and .object.sha == $sha'

if [[ $(jq -r '.draft' <<< "$release") == true ]]; then
  # A tagless draft creates its tag at target_commitish when published. An
  # existing tag takes precedence, so verify it too before changing the draft.
  ref=$(find_tag)
  if ! jq -e --arg sha "$GITHUB_SHA" --argjson ref "$ref" \
    ".target_commitish == \$sha and (\$ref | . == null or ($tag_targets_sha))" <<< "$release" >/dev/null; then
    echo "Draft $tag does not target $GITHUB_SHA" >&2
    exit 1
  fi

  id=$(jq -e '.id | select(type == "number" and . > 0)' <<< "$release")
  wait_for 'CLI draft lookup' find_cli_release '.isDraft == true and .databaseId == $id' --argjson id "$id" >/dev/null
  gh release upload "$tag" lyrics-display.html --clobber
  wait_for 'uploaded draft asset' find_release ".id == \$id and .draft == true and $uploaded_asset" --argjson id "$id" >/dev/null
  gh release edit "$tag" --draft=false

  wait_for 'published release' find_release ".id == \$id and $published" --argjson id "$id" --arg title "$title" >/dev/null
  ref=$(wait_for 'published tag' find_tag '. != null')
else
  # A rerun of an already published release should only verify, never write.
  jq -e --arg title "$title" "$published" <<< "$release" >/dev/null
  ref=$(find_tag)
fi
jq -e --arg sha "$GITHUB_SHA" "$tag_targets_sha" <<< "$ref" >/dev/null
