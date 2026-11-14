"""
Reads videos_full.json and playlists_full.json and writes one simplified video
list per site (videos.json for the default site, videos_<site>.json for the
rest) plus sites.json, the list of sites the gallery's site switcher shows.
See MAPPINGS.md for the full field mapping reference.
"""

import json
import os
import re
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
VIDEOS_FULL_FILE = HERE / "videos_full.json"
PLAYLISTS_FULL_FILE = HERE / "playlists_full.json"
OUTPUT_FILE = HERE / "videos.json"
PRIVATE_FILE = HERE / "videos_private.json"

# The catalog holds the metadata YouTube has no field for, keyed by video ID.
# It lives in the private yt-gallery-catalog repo, checked out at fetch/catalog.
# It is optional locally; the deploy sets REQUIRE_CATALOG=1 so that a missing
# catalog fails the run instead of publishing a site without it.
CATALOG_FILE = HERE / "catalog" / "catalog.json"
# Only these catalog fields are copied into the published video lists.
# Anything else in the catalog stays private.
CATALOG_FIELDS = ("site", "people", "places", "summary")

SITES_FILE = HERE / "sites.json"

# Every video belongs to exactly one site, and each site gets its own output
# file, so a site's published videos.json never lists another site's videos.
# All sites are served from one domain: the default site at the root, the
# others under their path. `label` is the name in the site switcher, `title`
# the name shown at the top of that site.
SITES = [
    {"id": "family", "label": "Family", "title": "MegaHirt Gallery", "path": ""},
    {"id": "work", "label": "Work", "title": "MegaHirt Work Videos", "path": "/work"},
    {"id": "other", "label": "Other", "title": "MegaHirt Other Videos", "path": "/other"},
]
DEFAULT_SITE = SITES[0]["id"]
# A video carrying any of these tags belongs to that site instead of the
# default one, unless the catalog says otherwise. Tags are compared
# case-insensitively.
SITE_TAGS = {
    "work": ["work"],
}


def site_for(tags):
    """Return the site a video with these tags belongs to."""
    lowered = {tag.lower() for tag in tags}
    for site, site_tags in SITE_TAGS.items():
        if lowered & {tag.lower() for tag in site_tags}:
            return site
    return DEFAULT_SITE


def site_output_file(site):
    """videos.json for the default site, videos_<site>.json for the others."""
    if site == DEFAULT_SITE:
        return OUTPUT_FILE
    return OUTPUT_FILE.with_name(f"{OUTPUT_FILE.stem}_{site}{OUTPUT_FILE.suffix}")


def build_membership_lookup(playlists_full):
    """Return {video_id: [{"id": playlist_id, "title": playlist_title}, ...]}."""
    lookup = defaultdict(list)
    for m in playlists_full["memberships"]:
        lookup[m["video_id"]].append({
            "id": m["playlist_id"],
            "title": m["playlist_title"],
        })
    return lookup


_DURATION_RE = re.compile(r"^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$")


def format_duration(iso_duration):
    """Turn a YouTube ISO 8601 duration ("PT1H2M3S") into "1:02:03" / "2:03".

    Returns None when the duration is missing or not in the expected form.
    """
    if not iso_duration:
        return None
    match = _DURATION_RE.match(iso_duration)
    if not match:
        return None
    days, hours, minutes, seconds = (int(part or 0) for part in match.groups())
    hours += days * 24
    if hours:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"


def load_catalog():
    """Return {video_id: {field: value}} from the catalog, or {} if absent."""
    if not CATALOG_FILE.exists():
        if os.environ.get("REQUIRE_CATALOG"):
            raise FileNotFoundError(f"Catalog not found: {CATALOG_FILE}")
        return {}
    return json.loads(CATALOG_FILE.read_text())


def apply_catalog(video, catalog):
    """Copy the published catalog fields for this video onto it.

    A `site` in the catalog overrides the one derived from the tags.
    """
    entry = catalog.get(video["id"], {})
    for field in CATALOG_FIELDS:
        if entry.get(field):
            video[field] = entry[field]
    return video


def simplify_video(item, membership_lookup):
    video_id = item["id"]
    snippet = item["snippet"]
    status = item["status"]
    statistics = item.get("statistics", {})
    thumbnails = snippet.get("thumbnails", {})
    recording = item.get("recordingDetails", {})

    high_thumb = thumbnails.get("high")
    standard_thumb = thumbnails.get("standard") or high_thumb

    return {
        "id": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "title": snippet["title"],
        "description": snippet.get("description", ""),
        "uploadDate": snippet["publishedAt"],
        "videoDate": recording.get("recordingDate"),
        "duration": format_duration(item.get("contentDetails", {}).get("duration")),
        "tags": snippet.get("tags", []),
        "site": site_for(snippet.get("tags", [])),
        "privacyStatus": status["privacyStatus"],
        "thumbnails": {
            "high": high_thumb,
            "standard": standard_thumb,
        },
        "channelId": snippet["channelId"],
        "categoryId": snippet.get("categoryId"),
        "viewCount": statistics.get("viewCount", "0"),
        "playlists": membership_lookup.get(video_id, []),
    }


def main():
    if not VIDEOS_FULL_FILE.exists():
        raise FileNotFoundError(
            f"Input file not found: {VIDEOS_FULL_FILE}\n"
            "Run `uv run fetch_videos.py` first."
        )
    if not PLAYLISTS_FULL_FILE.exists():
        raise FileNotFoundError(
            f"Input file not found: {PLAYLISTS_FULL_FILE}\n"
            "Run `uv run fetch_videos.py` first."
        )

    videos_full = json.loads(VIDEOS_FULL_FILE.read_text())
    playlists_full = json.loads(PLAYLISTS_FULL_FILE.read_text())

    membership_lookup = build_membership_lookup(playlists_full)
    catalog = load_catalog()
    simplified = [
        apply_catalog(simplify_video(item, membership_lookup), catalog)
        for item in videos_full
    ]

    public = [v for v in simplified if v["privacyStatus"] != "private"]
    private = [v for v in simplified if v["privacyStatus"] == "private"]

    site_ids = [site["id"] for site in SITES]
    unknown = sorted({v["site"] for v in public} - set(site_ids))
    if unknown:
        raise ValueError(f"Catalog uses unknown site(s): {', '.join(unknown)}")

    site_list = []
    for site in SITES:
        site_videos = [v for v in public if v["site"] == site["id"]]
        output_file = site_output_file(site["id"])
        output_file.write_text(json.dumps(site_videos, indent=2))
        print(f"Wrote {len(site_videos)} {site['id']} videos → {output_file}")
        site_list.append({**site, "count": len(site_videos), "file": output_file.name})

    SITES_FILE.write_text(json.dumps(site_list, indent=2))
    print(f"Wrote {len(site_list)} sites → {SITES_FILE}")

    PRIVATE_FILE.write_text(json.dumps(private, indent=2))
    print(f"Wrote {len(private)} private videos → {PRIVATE_FILE}")


if __name__ == "__main__":
    main()
