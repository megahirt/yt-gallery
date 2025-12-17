export interface Video {
	id: string;
	title: string;
	description: string;
	thumbnail: string;
	publishedAt: string;
	playlist: string | null;
	duration: string;
	tags: string[];
}

export interface VideosData {
	videos: Video[];
	lastUpdated: string;
}
