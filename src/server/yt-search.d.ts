declare module 'yt-search' {
  export interface VideoResult {
    videoId: string;
    title: string;
    url: string;
    seconds: number;
    views: number;
    author?: {
      name?: string;
    };
  }
  export interface SearchResult {
    videos: VideoResult[];
  }
  export default function ytSearch(query: string): Promise<SearchResult>;
}
