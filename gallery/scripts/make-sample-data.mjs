// Generates a made-up sample library for local development:
//   static/sample/videos.json      — same shape as the real videos.json
//   static/sample/thumbs/<id>.svg  — a generated "photo" per video
//
// Run with `npm run sample-data`, or `npm run dev:sample` to generate it and
// start the dev server pointed at it. The output is gitignored and never
// deployed. Dates are relative to today so that "On this day" always has
// matches and the newest videos are recent.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'sample');
const THUMB_DIR = join(OUT_DIR, 'thumbs');

// Small seeded PRNG so every run produces the same library.
let seed = 20190601;
function rand() {
	seed = (seed * 1664525 + 1013904223) % 4294967296;
	return seed / 4294967296;
}
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));

const PLAYLISTS = {
	vacations: { id: 'PLsampleVacations', title: 'Vacations' },
	birthdays: { id: 'PLsampleBirthdays', title: 'Birthdays' },
	holidays: { id: 'PLsampleHolidays', title: 'Holidays' },
	school: { id: 'PLsampleSchool', title: 'School & Sports' },
	everyday: { id: 'PLsampleEveryday', title: 'Everyday' }
};

// Scene palettes for the generated thumbnails: [sky top, sky bottom, far hill, near hill, sun]
const SCENES = {
	beach: ['#7fc4e8', '#fde9c4', '#e8c98f', '#d9a95f', '#fff6d8'],
	mountain: ['#8fb3d9', '#e6eef5', '#7d8fa3', '#4f6d5a', '#ffffff'],
	snow: ['#b9c9dc', '#f4f7fa', '#dfe7ef', '#ffffff', '#fdfdfd'],
	party: ['#f2a7b5', '#fde2c8', '#c96f8a', '#8f4a6b', '#fff1a8'],
	autumn: ['#e9a25c', '#fbe3c0', '#b5652f', '#7a3f1d', '#fff3d0'],
	field: ['#8ecfa0', '#eef7d9', '#6aa66a', '#3f7d4a', '#fffbe0'],
	night: ['#2b3a67', '#6b5b95', '#3b3558', '#231f3a', '#f5f1c9'],
	home: ['#d9c2a3', '#f6ecdd', '#b8946a', '#8a6a48', '#fff8e8']
};

// [title, scene, playlists, tags, month, day, yearsAgo, options]
const N = (o = {}) => o;
const ENTRIES = [
	['Leaf Pile Jumping', 'autumn', ['everyday'], ['autumn', 'backyard'], 'TODAY', 0, 3],
	['First Snow of the Year', 'snow', ['everyday'], ['snow', 'backyard'], 'TODAY', 0, 7],
	['Thanksgiving at the Farm', 'autumn', ['holidays'], ['thanksgiving', 'farm'], 11, 26, 1],
	['Halloween Costume Parade', 'night', ['holidays', 'school'], ['halloween', 'costumes'], 10, 31, 1],
	['Soccer Semifinal Highlights', 'field', ['school'], ['soccer', 'sports'], 10, 4, 0],
	['Back to School Morning', 'home', ['school'], ['school'], 9, 2, 0],
	['Lake House Week', 'beach', ['vacations'], ['lake', 'summer', 'swimming'], 8, 3, 0],
	['Tenth Birthday Backyard Party', 'party', ['birthdays'], ['birthday', 'party'], 6, 14, 0],
	['Quarterly Planning Offsite Recap', 'home', [], ['work'], 5, 20, 0],
	['Spring Recital', 'night', ['school'], ['music', 'recital'], 4, 18, 0],
	['Sledding Hill', 'snow', ['everyday'], ['snow', 'sledding'], 1, 20, 0],
	['Christmas Morning', 'home', ['holidays'], ['christmas', 'presents'], 12, 25, 1],
	['Road Trip Through the Mountains', 'mountain', ['vacations'], ['roadtrip', 'hiking'], 7, 22, 1],
	['Fourth of July Fireworks', 'night', ['holidays'], ['fireworks', 'summer'], 7, 4, 1],
	['Ninth Birthday at the Trampoline Park', 'party', ['birthdays'], ['birthday'], 6, 14, 1],
	['Field Day Relay Races', 'field', ['school'], ['sports', 'school'], 5, 30, 1],
	['Easter Egg Hunt', 'field', ['holidays'], ['easter', 'backyard'], 4, 20, 1],
	['Pancake Saturday', 'home', ['everyday'], ['cooking'], 2, 8, 1, N({ noVideoDate: true })],
	['Christmas Eve Cookie Baking', 'home', ['holidays'], ['christmas', 'cooking'], 12, 24, 2],
	['Beach Week: Building the Giant Sandcastle', 'beach', ['vacations'], ['beach', 'summer'], 8, 11, 2],
	['Beach Week: Boogie Boards', 'beach', ['vacations'], ['beach', 'summer', 'swimming'], 8, 9, 2],
	["Grandpa's 70th Birthday Toasts", 'party', ['birthdays'], ['birthday', 'grandpa', 'family'], 3, 16, 2],
	['Conference Talk Rehearsal', 'home', [], ['work'], 2, 27, 2],
	['Learning to Ride a Bike', 'field', ['everyday'], ['bike', 'milestone'], 5, 12, 3],
	['Camping Under the Stars', 'night', ['vacations'], ['camping', 'summer'], 7, 15, 3],
	['Seventh Birthday Piñata', 'party', ['birthdays'], ['birthday', 'party'], 6, 14, 3],
	['Pumpkin Patch', 'autumn', ['holidays', 'everyday'], ['autumn', 'halloween'], 10, 12, 3],
	['Ski Trip: First Time on the Lift', 'snow', ['vacations'], ['skiing', 'snow', 'milestone'], 2, 19, 4],
	['Kindergarten Graduation', 'field', ['school'], ['school', 'milestone'], 6, 5, 4],
	['A Very Long Title for a Very Long Afternoon at the Aquarium With Everyone, Including the Cousins', 'beach', ['vacations'], ['aquarium', 'cousins'], 8, 21, 4],
	['Untitled clip', 'home', [], [], 3, 3, 4, N({ noVideoDate: true, noDescription: true })],
	['Christmas Morning: The Year of the Bike', 'home', ['holidays'], ['christmas', 'presents', 'bike'], 12, 25, 5],
	['Grand Canyon Sunrise', 'mountain', ['vacations'], ['hiking', 'roadtrip'], 6, 28, 5],
	['First Steps', 'home', ['everyday'], ['milestone', 'baby'], 4, 2, 6],
	['Coming Home From the Hospital', 'home', ['everyday'], ['baby', 'milestone', 'family'], 3, 9, 7],
	['Wedding Anniversary Slideshow', 'party', [], ['family'], 9, 17, 7]
];

function pad(n) {
	return String(n).padStart(2, '0');
}

function thumbnailSvg(scene, index) {
	const [skyTop, skyBottom, far, near, sun] = SCENES[scene];
	const sunX = randInt(180, 1100);
	const sunY = randInt(110, 300);
	const sunR = randInt(50, 95);
	const farY = randInt(380, 460);
	const nearY = randInt(500, 580);
	const wobble = () => randInt(-70, 70);
	const hill = (y, color) =>
		`<path d="M0 ${y + wobble()} C 220 ${y + wobble() - 60}, 420 ${y + wobble() + 40}, 640 ${y + wobble()} ` +
		`S 1060 ${y + wobble() - 50}, 1280 ${y + wobble()} L1280 720 L0 720 Z" fill="${color}"/>`;
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">` +
		`<defs><linearGradient id="sky${index}" x1="0" y1="0" x2="0" y2="1">` +
		`<stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${skyBottom}"/>` +
		`</linearGradient></defs>` +
		`<rect width="1280" height="720" fill="url(#sky${index})"/>` +
		`<circle cx="${sunX}" cy="${sunY}" r="${sunR}" fill="${sun}" opacity="0.9"/>` +
		hill(farY, far) +
		hill(nearY, near) +
		`</svg>`
	);
}

function duration() {
	const totalSeconds = rand() < 0.12 ? randInt(3600, 5400) : randInt(25, 1500);
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = totalSeconds % 60;
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const now = new Date();

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(THUMB_DIR, { recursive: true });

const videos = ENTRIES.map(([title, scene, playlists, tags, month, day, yearsAgo, options = {}], i) => {
	const id = `sample${pad(i + 1)}`;
	const year = now.getFullYear() - yearsAgo;
	const filmedMonth = month === 'TODAY' ? now.getMonth() + 1 : month;
	const filmedDay = month === 'TODAY' ? now.getDate() : day;
	const filmed = `${year}-${pad(filmedMonth)}-${pad(filmedDay)}T00:00:00Z`;

	// Uploaded a few days after filming, in the evening.
	const uploaded = new Date(Date.parse(filmed) + randInt(1, 9) * 86400000 + randInt(17, 23) * 3600000);

	writeFileSync(join(THUMB_DIR, `${id}.svg`), thumbnailSvg(scene, i));
	const thumb = { url: `/sample/thumbs/${id}.svg`, width: 1280, height: 720 };

	return {
		id,
		url: `https://www.youtube.com/watch?v=${id}`,
		title,
		description: options.noDescription
			? ''
			: `Sample description for "${title}".\n\nFilmed with the family. This text is generated for local development.`,
		uploadDate: uploaded.toISOString(),
		videoDate: options.noVideoDate ? null : filmed,
		duration: duration(),
		tags,
		privacyStatus: tags.includes('work') ? 'unlisted' : 'public',
		thumbnails: { high: thumb, standard: thumb },
		channelId: 'UCsampleChannel',
		categoryId: '22',
		viewCount: String(randInt(3, 180)),
		playlists: playlists.map((key) => PLAYLISTS[key])
	};
});

writeFileSync(join(OUT_DIR, 'videos.json'), JSON.stringify(videos, null, '\t') + '\n');
console.log(`Wrote ${videos.length} sample videos to ${OUT_DIR}`);
