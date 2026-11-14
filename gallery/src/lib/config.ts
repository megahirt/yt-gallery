// Each site is built from the same code. The site's name and subtitle come
// from build-time env vars, and its videos from the videos.json the fetch
// pipeline writes for that site.
export const SITE_NAME: string = import.meta.env.VITE_SITE_NAME || 'MegaHirt Gallery';
export const SITE_SUBTITLE: string = import.meta.env.VITE_SITE_SUBTITLE || 'Memories In Motion';
