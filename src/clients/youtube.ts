import ytsr from "ytsr";

export interface VideoResult {
  title: string;
  url: string;
  channel: string;
  duration: string | null;
  views: string | null;
  description: string | null;
}

export async function searchYouTube(
  query: string,
  limit: number = 5
): Promise<VideoResult[]> {
  const filters = await ytsr.getFilters(query);
  const videoFilter = filters.get("Type")?.get("Video");

  const results = await ytsr(
    videoFilter?.url ?? query,
    { limit: limit * 2 }
  );

  return results.items
    .filter((item): item is ytsr.Video => item.type === "video")
    .slice(0, limit)
    .map((item) => ({
      title: item.title,
      url: item.url,
      channel: item.author?.name ?? "Unknown",
      duration: item.duration ?? null,
      views: item.views !== null ? String(item.views) : null,
      description: item.description ?? null,
    }));
}
