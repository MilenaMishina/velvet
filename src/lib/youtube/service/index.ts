/**
 * Public surface of the YouTube service layer. API routes and server components
 * import from here; nothing else should reach into the modules directly.
 */
export {
  getChannel,
  getChannelPlaylists,
  getChannelUploads,
  getPlaylist,
  getPlaylistVideos,
  type PaginatedOptions,
} from '@/lib/youtube/service/channel';

export {
  fallbackCategoryDirectory,
  getCategoryDirectory,
  type CategoryDirectory,
} from '@/lib/youtube/service/categories';

export { type FeedOptions, getTrendingFeed, getVideosForIds } from '@/lib/youtube/service/feed';

export { SEARCH_PAGE_SIZE, searchVideos } from '@/lib/youtube/service/search';

export { getRelatedVideos, getWatchData, type WatchData } from '@/lib/youtube/service/watch';

export {
  decorateVideos,
  getChannelAvatars,
  getVideoMap,
  getVideosByIds,
} from '@/lib/youtube/service/shared';
