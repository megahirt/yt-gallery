// Each site is built from the same code (scripts/build-sites.mjs). The site's
// id, name and base path come from build-time env vars, and its videos from
// the videos.json the fetch pipeline writes for that site.
/** Which site this build is: its id in sites.json (see fetch/make_simple_video_list.py). */
export const SITE_ID: string = import.meta.env.VITE_SITE_ID || 'family';
export const SITE_NAME: string = import.meta.env.VITE_SITE_NAME || 'MegaHirt Gallery';
export const SITE_SUBTITLE: string = import.meta.env.VITE_SITE_SUBTITLE || 'Memories In Motion';
