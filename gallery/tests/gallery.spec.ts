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

	test('displays a video card for each video', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');

		const cards = page.locator('.grid [role="button"]');
		await expect(cards).toHaveCount(sampleVideos.length);
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

	test('video cards show the date but no tag chips or view count', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');

		// vacationVid1 has tags (vacation, beach, summer) and viewCount "42"
		const vacationCard = page.locator('.grid [role="button"]', { hasText: 'Family Vacation 2023' });
		await expect(vacationCard.getByText('2023', { exact: false }).last()).toBeVisible();
		await expect(vacationCard.getByText('#vacation')).toHaveCount(0);
		await expect(vacationCard.getByText('42 views')).toHaveCount(0);
	});

	test('shows a featured memory that links to a video and can be swapped', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');

		const memory = page.getByRole('region', { name: 'Featured memory' });
		await expect(memory).toBeVisible();
		await expect(memory.getByRole('link', { name: 'Watch', exact: true })).toHaveAttribute(
			'href',
			/\/video\/.+/
		);

		const firstTitle = await memory.getByRole('heading', { level: 1 }).textContent();
		await memory.getByRole('button', { name: 'Another memory' }).click();
		await expect(memory.getByRole('heading', { level: 1 })).not.toHaveText(firstTitle ?? '');
	});

	test('hides the featured memory while searching', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/');
		await page.getByPlaceholder('Search videos...').fill('christmas');
		await expect(page.getByRole('region', { name: 'Featured memory' })).toHaveCount(0);
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
		await expect(page.locator('.grid').getByText('Family Vacation 2023')).toBeVisible();
		await expect(page.locator('.grid').getByText('Christmas Morning')).not.toBeVisible();
	});

	test('filters videos by description', async ({ page }) => {
		await page.getByPlaceholder('Search videos...').fill('Opening presents');
		await expect(page.locator('.grid').getByText('Christmas Morning')).toBeVisible();
		await expect(page.locator('.grid').getByText('Family Vacation 2023')).not.toBeVisible();
	});

	test('filters videos by tag', async ({ page }) => {
		await page.getByPlaceholder('Search videos...').fill('holidays');
		await expect(page.locator('.grid').getByText('Christmas Morning')).toBeVisible();
		await expect(page.locator('.grid').getByText('Family Vacation 2023')).not.toBeVisible();
	});

	test('filters videos by playlist name', async ({ page }) => {
		// Only "Grandma's Birthday Party" is in the "Birthdays" playlist
		await page.getByPlaceholder('Search videos...').fill('Birthdays');
		const cards = page.locator('.grid [role="button"]');
		await expect(cards).toHaveCount(1);
		await expect(cards.first()).toContainText("Grandma's Birthday Party");
	});

	test('search is case-insensitive', async ({ page }) => {
		await page.getByPlaceholder('Search videos...').fill('CHRISTMAS');
		await expect(page.locator('.grid').getByText('Christmas Morning')).toBeVisible();
	});

	test('shows "No videos found" message when no results match', async ({ page }) => {
		await page.getByPlaceholder('Search videos...').fill('xyzzy_nonexistent_query');
		await expect(page.getByText('No videos found.')).toBeVisible();
	});

	test('clears filter when search box is emptied', async ({ page }) => {
		const searchBox = page.getByPlaceholder('Search videos...');
		await searchBox.fill('vacation');
		// The vacation video plus the birthday video that is also in "Vacations"
		await expect(page.locator('.grid [role="button"]')).toHaveCount(2);

		await searchBox.fill('');
		await expect(page.locator('.grid [role="button"]')).toHaveCount(sampleVideos.length);
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

		const cards = page.locator('.grid [role="button"]');
		await expect(cards).toHaveCount(1);
		await expect(cards.first()).toContainText("Grandma's Birthday Party");
	});

	test('Vacations collection shows every video in that collection', async ({ page }) => {
		await page.getByRole('button', { name: 'Vacations' }).click();

		const cards = page.locator('.grid [role="button"]');
		await expect(cards).toHaveCount(2);
		await expect(page.locator('.grid').getByText('Family Vacation 2023')).toBeVisible();
		await expect(page.locator('.grid').getByText("Grandma's Birthday Party")).toBeVisible();
	});

	test('clicking "All Videos" clears the collection filter', async ({ page }) => {
		await page.getByRole('button', { name: 'Birthdays' }).click();
		await page.getByRole('button', { name: 'All Videos' }).click();
		await expect(page.locator('.grid [role="button"]')).toHaveCount(sampleVideos.length);
	});

	test('collection filter and search can be combined', async ({ page }) => {
		// Filter to Vacations (2 videos), then search for "beach"
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

	test('shows previous/next links and a "More from" row for the same collection', async ({ page }) => {
		// Leave out the birthday video, which is also in "Vacations", so the
		// collection is exactly the two vacation videos.
		const videos = [
			...sampleVideos.filter((v) => v.id !== 'birthdayVid2'),
			{
				...sampleVideos[0],
				id: 'vacationVid9',
				title: 'Lake Trip',
				uploadDate: '2024-08-01T12:00:00Z',
				videoDate: '2024-08-01T12:00:00Z',
			},
		] as object[];
		await mockVideos(page, videos);
		await page.goto('/video/vacationVid1');

		const nav = page.getByRole('navigation', { name: /Previous and next in Vacations/ });
		const next = nav.getByRole('link', { name: /Next in Vacations/ });
		await expect(next).toContainText('Lake Trip');
		await expect(page.getByRole('heading', { level: 2, name: 'More from Vacations' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'See all 2' })).toHaveAttribute(
			'href',
			'/?collection=Vacations'
		);

		await next.click();
		await expect(page).toHaveURL(/\/video\/vacationVid9$/);
		await expect(page.getByRole('heading', { level: 1, name: 'Lake Trip' })).toBeVisible();
		await expect(nav.getByRole('link', { name: /Previous in Vacations/ })).toContainText(
			'Family Vacation 2023'
		);
	});

	test('does not show "Filmed" label on detail page when videoDate is absent', async ({ page }) => {
		await mockVideos(page);
		await page.goto('/video/birthdayVid2');
		await expect(page.getByText(/Filmed/)).not.toBeVisible();
	});
});

// ---------------------------------------------------------------------------
// Site switcher
// ---------------------------------------------------------------------------

test.describe('Site switcher', () => {
	const sites = [
		{ id: 'family', label: 'Family', path: '', count: 3 },
		{ id: 'work', label: 'Work', path: '/work', count: 2 },
		{ id: 'other', label: 'Other', path: '/other', count: 0 },
	];

	test('links to the other sites that have videos and marks the current one', async ({ page }) => {
		await mockVideos(page);
		await page.route('**/sites.json', (route) => route.fulfill({ json: sites }));
		await page.goto('/');

		const switcher = page.getByRole('navigation', { name: 'Switch site' });
		await expect(switcher.getByText('Family')).toHaveAttribute('aria-current', 'page');
		await expect(switcher.getByRole('link', { name: 'Work' })).toHaveAttribute('href', '/work/');
		// "Other" has no videos, so it is not offered.
		await expect(switcher.getByText('Other')).toHaveCount(0);
	});

	test('is hidden when there is only one site', async ({ page }) => {
		await mockVideos(page);
		await page.route('**/sites.json', (route) => route.fulfill({ json: [sites[0]] }));
		await page.goto('/');

		await expect(page.locator('.grid [role="button"]').first()).toBeVisible();
		await expect(page.getByRole('navigation', { name: 'Switch site' })).toHaveCount(0);
	});
});
