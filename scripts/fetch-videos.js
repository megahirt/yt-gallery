#!/usr/bin/env node

/**
 * Fetches videos from a YouTube channel and generates videos.json
 * 
 * Required environment variables:
 * - YOUTUBE_API_KEY: Your YouTube Data API v3 key
 * - YOUTUBE_CHANNEL_ID: The channel ID to fetch videos from
 * 
 * Optional environment variables:
 * - YOUTUBE_PLAYLIST_MAPPING: JSON object mapping playlist IDs to names
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;
const PLAYLIST_MAPPING = process.env.YOUTUBE_PLAYLIST_MAPPING 
  ? JSON.parse(process.env.YOUTUBE_PLAYLIST_MAPPING) 
  : {};

if (!API_KEY) {
  console.error('Error: YOUTUBE_API_KEY environment variable is required');
  process.exit(1);
}

if (!CHANNEL_ID) {
  console.error('Error: YOUTUBE_CHANNEL_ID environment variable is required');
  process.exit(1);
}

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API request failed: ${response.status} - ${error}`);
  }
  return response.json();
}

async function getUploadsPlaylistId() {
  const url = `${BASE_URL}/channels?part=contentDetails&id=${CHANNEL_ID}&key=${API_KEY}`;
  const data = await fetchJson(url);
  
  if (!data.items || data.items.length === 0) {
    throw new Error(`Channel not found: ${CHANNEL_ID}`);
  }
  
  return data.items[0].contentDetails.relatedPlaylists.uploads;
}

async function getPlaylistVideos(playlistId, pageToken = null) {
  let url = `${BASE_URL}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&key=${API_KEY}`;
  if (pageToken) {
    url += `&pageToken=${pageToken}`;
  }
  return fetchJson(url);
}

async function getVideoDetails(videoIds) {
  const url = `${BASE_URL}/videos?part=snippet,contentDetails,status&id=${videoIds.join(',')}&key=${API_KEY}`;
  return fetchJson(url);
}

async function getChannelPlaylists() {
  const playlists = {};
  let pageToken = null;
  
  do {
    let url = `${BASE_URL}/playlists?part=snippet&channelId=${CHANNEL_ID}&maxResults=50&key=${API_KEY}`;
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }
    
    const data = await fetchJson(url);
    
    for (const item of data.items || []) {
      playlists[item.id] = item.snippet.title;
    }
    
    pageToken = data.nextPageToken;
  } while (pageToken);
  
  return playlists;
}

async function getVideoPlaylistMapping(playlists) {
  const videoToPlaylist = {};
  
  for (const [playlistId, playlistName] of Object.entries(playlists)) {
    let pageToken = null;
    
    do {
      const data = await getPlaylistVideos(playlistId, pageToken);
      
      for (const item of data.items || []) {
        const videoId = item.contentDetails.videoId;
        if (!videoToPlaylist[videoId]) {
          videoToPlaylist[videoId] = playlistName;
        }
      }
      
      pageToken = data.nextPageToken;
    } while (pageToken);
  }
  
  return videoToPlaylist;
}

async function getAllVideos() {
  const uploadsPlaylistId = await getUploadsPlaylistId();
  console.log(`Found uploads playlist: ${uploadsPlaylistId}`);
  
  // Get all playlists for the channel
  console.log('Fetching channel playlists...');
  const playlists = { ...PLAYLIST_MAPPING, ...(await getChannelPlaylists()) };
  console.log(`Found ${Object.keys(playlists).length} playlists`);
  
  // Get video to playlist mapping
  console.log('Building video-to-playlist mapping...');
  const videoToPlaylist = await getVideoPlaylistMapping(playlists);
  
  // Get all videos from uploads playlist
  console.log('Fetching all videos from uploads playlist...');
  const videoIds = [];
  let pageToken = null;
  
  do {
    const data = await getPlaylistVideos(uploadsPlaylistId, pageToken);
    
    for (const item of data.items || []) {
      videoIds.push(item.contentDetails.videoId);
    }
    
    pageToken = data.nextPageToken;
  } while (pageToken);
  
  console.log(`Found ${videoIds.length} total videos`);
  
  // Fetch video details in batches of 50
  const videos = [];
  
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = await getVideoDetails(batch);
    
    for (const item of data.items || []) {
      // Only include unlisted videos
      if (item.status.privacyStatus !== 'unlisted') {
        continue;
      }
      
      const video = {
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.high?.url 
          || item.snippet.thumbnails?.medium?.url 
          || item.snippet.thumbnails?.default?.url 
          || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
        publishedAt: item.snippet.publishedAt,
        playlist: videoToPlaylist[item.id] || null,
        duration: item.contentDetails.duration,
        tags: item.snippet.tags || []
      };
      
      videos.push(video);
    }
  }
  
  console.log(`Found ${videos.length} unlisted videos`);
  
  // Sort by published date (newest first)
  videos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  
  return videos;
}

async function main() {
  try {
    console.log('Starting YouTube video fetch...');
    
    const videos = await getAllVideos();
    
    const output = {
      videos,
      lastUpdated: new Date().toISOString()
    };
    
    const outputPath = join(__dirname, '..', 'static', 'videos.json');
    writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    console.log(`Successfully wrote ${videos.length} videos to ${outputPath}`);
  } catch (error) {
    console.error('Error fetching videos:', error);
    process.exit(1);
  }
}

main();
