import { test, expect, type Page } from '@playwright/test';
import { sampleVideos } from './fixtures/sample-videos.js';

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Intercept the /videos.json request and respond with the provided data.
 * Must be called before page.goto().
 */
async function mockVideos(page: Page, videos: ReadonlyArray<object> = sampleVideos) {
	await page.route('**/videos.json', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(videos),
		});
	});
}

/**
 * Intercept /videos.json and respond with a server error.
 */
async function mockVideosError(page: Page, status = 500) {
	await page.route('**/videos.json', async (route) => {
		await route.fulfill({ status, body: 'Internal Server Error' });
	});
}

// ---------------------------------------------------------------------------
// Page load & video display
// ---------------------------------------------------------------------------

test.describe('Gallery page — video display', () => {
	test('renders the page title in the browser tab', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');
		await expect(page).toHaveTitle('MegaHirt Gallery');
	});

	test('shows the site name in the sidebar', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');
		await expect(page.getByRole('complementary').getByText('MegaHirt Gallery')).toBeVisible();
	});

	test('displays a video card for each non-excluded video', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');

		// birthdayVid2 has the 'work' tag and is excluded by default
		const cards = page.locator('.grid [role="button"]');
		await expect(cards).toHaveCount(sampleVideos.length - 1);
	});

	test('shows video titles in the cards', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');

		await expect(page.getByText('Family Vacation 2023').first()).toBeVisible();
		await expect(page.getByText('Christmas Morning').first()).toBeVisible();
	});

	test('clicking a video card navigates to the detail page', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');
		const firstVideo = sampleVideos[0];
		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(err.message));

		const firstCard = page
			.getByRole('button', { name: new RegExp(escapeRegExp(firstVideo.title), 'i') })
			.first();
		await firstCard.click();

		await expect(page).toHaveURL(new RegExp(`/video/${firstVideo.id}$`));
		await expect(page.getByRole('heading', { level: 1, name: firstVideo.title })).toBeVisible();
		expect(pageErrors).toEqual([]);
	});

	test('shows tag chips on video cards that have tags', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');

		// "Family Vacation 2023" has tags: vacation, beach, summer
		const vacationCard = page.locator('.grid [role="button"]', { hasText: 'Family Vacation 2023' });
		await expect(vacationCard.getByText('#vacation')).toBeVisible();
	});

	test('shows view count on video cards', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');

		// vacationVid1 has viewCount: "42"
		const vacationCard = page.locator('.grid [role="button"]', { hasText: 'Family Vacation 2023' });
		await expect(vacationCard.getByText('42 views')).toBeVisible();
	});

	test('does not show tag chips on cards with no tags', async ({ page }) => {
		// Mock a video with no tags
		const videosNoTags = sampleVideos.map((v) =>
			v.id === 'christmasVid3' ? { ...v, tags: [] } : v
		) as object[];
		await mockVideos(page, videosNoTags);
		await page.goto('/');

		const christmasCard = page.locator('.grid [role="button"]', { hasText: 'Christmas Morning' });
		await expect(christmasCard.locator('.flex.flex-wrap.gap-1')).not.toBeVisible();
	});
});

// ---------------------------------------------------------------------------
// Excluded tags filter
// ---------------------------------------------------------------------------

test.describe('Gallery page — excluded tags filter', () => {
	test('hides videos with excluded tags by default', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');

		// birthdayVid2 has 'work' tag — should be hidden
		await expect(page.getByText("Grandma's Birthday Party")).not.toBeVisible();
		await expect(page.getByText('Family Vacation 2023')).toBeVisible();
	});

	test('shows excluded videos when toggle is checked', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');

		await page.getByRole('checkbox', { name: /show work videos/i }).check();

		await expect(page.getByText("Grandma's Birthday Party")).toBeVisible();
	});

	test('shows all videos when no videos have excluded tags', async ({ page }) => {
		const videosNoWork: object[] = sampleVideos.map((v) => ({
			...v,
			tags: (v.tags as readonly string[]).filter((t) => t !== 'work'),
		}));
		await mockVideos(page, videosNoWork);
		await page.goto('/');

		const cards = page.locator('.grid [role="button"]');
		await expect(cards).toHaveCount(sampleVideos.length);
	});
});

// ---------------------------------------------------------------------------
// Search filtering
// ---------------------------------------------------------------------------

test.describe('Gallery page — search', () => {
	test.beforeEach(async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');
	});

	test('search box is visible with placeholder text', async ({ page }) => {
		await expect(page.getByPlaceholder('Search videos...')).toBeVisible();
	});

	test('filters videos by title', async ({ page }) => {
		await page.getByPlaceholder('Search videos...').fill('vacation');
		await expect(page.getByText('Family Vacation 2023')).toBeVisible();
		await expect(page.getByText('Christmas Morning')).not.toBeVisible();
	});

	test('filters videos by description', async ({ page }) => {
		await page.getByPlaceholder('Search videos...').fill('Opening presents');
		await expect(page.getByText('Christmas Morning')).toBeVisible();
		await expect(page.getByText('Family Vacation 2023')).not.toBeVisible();
	});

	test('filters videos by tag', async ({ page }) => {
		await page.getByPlaceholder('Search videos...').fill('holidays');
		await expect(page.getByText('Christmas Morning')).toBeVisible();
		await expect(page.getByText('Family Vacation 2023')).not.toBeVisible();
	});

	test('filters videos by playlist name', async ({ page }) => {
		// "Birthdays" playlist only contains "Grandma's Birthday Party" but it's excluded by default
		await page.getByPlaceholder('Search videos...').fill('Birthdays');
		await expect(page.getByText('No videos found.')).toBeVisible();
	});

	test('search is case-insensitive', async ({ page }) => {
		await page.getByPlaceholder('Search videos...').fill('CHRISTMAS');
		await expect(page.getByText('Christmas Morning')).toBeVisible();
	});

	test('shows "No videos found" message when no results match', async ({ page }) => {
		await page.getByPlaceholder('Search videos...').fill('xyzzy_nonexistent_query');
		await expect(page.getByText('No videos found.')).toBeVisible();
	});

	test('clears filter when search box is emptied', async ({ page }) => {
		const searchBox = page.getByPlaceholder('Search videos...');
		await searchBox.fill('vacation');
		// Only non-excluded vacation videos visible
		await expect(page.locator('.grid [role="button"]')).toHaveCount(1);

		await searchBox.fill('');
		// Back to all non-excluded videos (2 — birthdayVid2 still excluded)
		await expect(page.locator('.grid [role="button"]')).toHaveCount(sampleVideos.length - 1);
	});
});

// ---------------------------------------------------------------------------
// Sidebar collection filter
// ---------------------------------------------------------------------------

test.describe('Gallery page — collection filter', () => {
	test.beforeEach(async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');
	});

	test('shows collection buttons in sidebar for each unique playlist', async ({ page }) => {
		// Sample data has 2 unique playlists: Birthdays, Vacations (sorted)
		await expect(page.getByRole('button', { name: 'Birthdays' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Vacations' })).toBeVisible();
	});

	test('shows "All Videos" button in sidebar', async ({ page }) => {
		await expect(page.getByRole('button', { name: 'All Videos' })).toBeVisible();
	});

	test('clicking a collection button filters to only that collection\'s videos', async ({
		page,
	}) => {
		await page.getByRole('button', { name: 'Birthdays' }).click();

		// birthdayVid2 is in Birthdays but is excluded (work tag) — no results
		await expect(page.getByText('No videos found.')).toBeVisible();
	});

	test('Vacations collection shows only non-excluded videos by default', async ({ page }) => {
		await page.getByRole('button', { name: 'Vacations' }).click();

		// birthdayVid2 (work tag) is excluded; only vacationVid1 remains
		const cards = page.locator('.grid [role="button"]');
		await expect(cards).toHaveCount(1);
		await expect(cards.first()).toContainText('Family Vacation 2023');
	});

	test('clicking "All Videos" clears the collection filter', async ({ page }) => {
		await page.getByRole('button', { name: 'Birthdays' }).click();
		await page.getByRole('button', { name: 'All Videos' }).click();
		// Back to non-excluded videos
		await expect(page.locator('.grid [role="button"]')).toHaveCount(sampleVideos.length - 1);
	});

	test('collection filter and search can be combined', async ({ page }) => {
		// Filter to Vacations (1 non-excluded video), then search for "beach"
		await page.getByRole('button', { name: 'Vacations' }).click();
		await page.getByPlaceholder('Search videos...').fill('beach');

		const cards = page.locator('.grid [role="button"]');
		await expect(cards).toHaveCount(1);
		await expect(cards.first()).toContainText('Family Vacation 2023');
	});
});

// ---------------------------------------------------------------------------
// Sidebar collection visibility
// ---------------------------------------------------------------------------

test.describe('Gallery page — collection filter visibility', () => {
	test('collection buttons are not shown when no videos have playlists', async ({ page }) => {
		const videosWithoutPlaylists: object[] = sampleVideos.map((v) => ({ ...v, playlists: [] }));
		await mockVideos(page, videosWithoutPlaylists);
		await page.goto('/');

		await expect(page.getByRole('button', { name: 'Birthdays' })).not.toBeVisible();
		await expect(page.getByRole('button', { name: 'Vacations' })).not.toBeVisible();
		await expect(page.getByRole('button', { name: 'All Videos' })).toBeVisible();
	});
});

// ---------------------------------------------------------------------------
// Empty and error states
// ---------------------------------------------------------------------------

test.describe('Gallery page — empty and error states', () => {
	test('shows error message when videos.json returns a server error', async ({ page }) => {
		await mockVideosError(page, 500);
		await page.goto('/');
		await expect(page.getByText(/Failed to fetch videos/)).toBeVisible();
	});

	test('shows "No videos found" when videos.json returns an empty array', async ({ page }) => {
		await mockVideos(page, []);
		await page.goto('/');
		await expect(page.getByText('No videos found.')).toBeVisible();
	});

	test('does not show the video grid when there are no videos', async ({ page }) => {
		await mockVideos(page, []);
		await page.goto('/');
		await expect(page.locator('.grid [role="button"]')).toHaveCount(0);
	});
});

// ---------------------------------------------------------------------------
// Grid density toggle
// ---------------------------------------------------------------------------

test.describe('Gallery page — grid density toggle', () => {
	test('density toggle buttons are visible', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');

		await expect(page.getByTitle('Large grid')).toBeVisible();
		await expect(page.getByTitle('Medium grid')).toBeVisible();
		await expect(page.getByTitle('List view')).toBeVisible();
	});
});

// ---------------------------------------------------------------------------
// Card navigation
// ---------------------------------------------------------------------------

test.describe('Gallery page — card navigation', () => {
	async function expectClickNavigatesWithoutPageErrors(page: Page) {
		const firstVideo = sampleVideos[0];
		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(err.message));

		const card = page
			.getByRole('button', { name: new RegExp(escapeRegExp(firstVideo.title), 'i') })
			.first();
		await card.click();

		await expect(page).toHaveURL(new RegExp(`/video/${firstVideo.id}$`));
		await expect(page.getByRole('heading', { level: 1, name: firstVideo.title })).toBeVisible();
		expect(pageErrors).toEqual([]);
	}

	test('clicking a card in medium (grid) view navigates to the video detail page', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');
		await expectClickNavigatesWithoutPageErrors(page);
	});

	test('clicking a card in list view navigates to the video detail page', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');

		await page.getByTitle('List view').click();
		await expectClickNavigatesWithoutPageErrors(page);
	});
});

// ---------------------------------------------------------------------------
// Video detail page
// ---------------------------------------------------------------------------

test.describe('Video detail page', () => {
	test('navigating to /video/[id] shows the video title', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');
		await page.goto('/video/vacationVid1');
		await expect(page.getByText('Family Vacation 2023')).toBeVisible();
	});

	test('shows a "Back to Gallery" link on the detail page', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/video/vacationVid1');
		await expect(page.getByRole('link', { name: /Back to Gallery/ })).toBeVisible();
	});

	test('shows a play button to load the YouTube embed', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/video/vacationVid1');
		await expect(page.getByRole('button', { name: /Play/ })).toBeVisible();
	});

	test('shows "Watch on YouTube" link on detail page', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/video/vacationVid1');

		const ytLink = page.getByRole('link', { name: /Watch on YouTube/ });
		await expect(ytLink).toBeVisible();
		const href = await ytLink.getAttribute('href');
		expect(href).toContain('youtube.com/watch?v=vacationVid1');
	});

	test('shows "Video not found" for unknown video ID', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/video/nonexistent-id');
		await expect(page.getByText('Video not found.')).toBeVisible();
	});

	test('shows "Filmed" date on detail page when videoDate is present', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/video/vacationVid1');
		await expect(page.getByText(/Filmed/)).toBeVisible();
		await expect(page.getByText('Filmed July 10, 2023')).toBeVisible();
	});

	test('does not show "Filmed" label on detail page when videoDate is absent', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/video/birthdayVid2');
		await expect(page.getByText(/Filmed/)).not.toBeVisible();
	});
});
