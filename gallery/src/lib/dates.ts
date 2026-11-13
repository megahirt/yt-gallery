import type { Video } from '$lib/types';

type DateStyle = 'short' | 'long';

const MONTH: Record<DateStyle, 'short' | 'long'> = { short: 'short', long: 'long' };

/**
 * A recording date (`videoDate`) is a calendar day that YouTube stores as
 * midnight UTC, so it must be read in UTC — reading it in local time shows the
 * previous day anywhere west of Greenwich.
 */
export function formatFilmedDate(iso: string, style: DateStyle = 'short'): string {
	return new Date(iso).toLocaleDateString('en-US', {
		month: MONTH[style],
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

/** An upload date is a real moment in time, so it is shown in local time. */
export function formatUploadDate(iso: string, style: DateStyle = 'short'): string {
	return new Date(iso).toLocaleDateString('en-US', {
		month: MONTH[style],
		day: 'numeric',
		year: 'numeric'
	});
}

/** The date a video is shown under: when it was filmed, else when it was uploaded. */
export function formatVideoDate(video: Video, style: DateStyle = 'short'): string {
	return video.videoDate
		? formatFilmedDate(video.videoDate, style)
		: formatUploadDate(video.uploadDate, style);
}

export function filmedYear(iso: string): number {
	return new Date(iso).getUTCFullYear();
}

export function uploadYear(iso: string): number {
	return new Date(iso).getFullYear();
}

export function videoYear(video: Video): number {
	return video.videoDate ? filmedYear(video.videoDate) : uploadYear(video.uploadDate);
}

export function videoTime(video: Video): number {
	return new Date(video.videoDate ?? video.uploadDate).getTime();
}
