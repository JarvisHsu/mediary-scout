import {
  getAccountScopedSettings,
  getCurrentAccountId,
  getTmdbAccesses,
} from "./workflow-runtime";

export interface TrendingItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  year: string;
  overview: string;
}

/**
 * Fetch trending movies or TV shows from TMDB.
 * Tries each TMDB access in order and returns the first successful result.
 */
export async function fetchTrending(
  mediaType: "movie" | "tv",
  timeWindow: "day" | "week" = "week",
): Promise<TrendingItem[]> {
  const accesses = await getTmdbAccesses(
    getAccountScopedSettings(await getCurrentAccountId()),
  );

  for (const access of accesses) {
    try {
      const base = access.baseURL ?? "https://api.themoviedb.org";
      const url = new URL(`/3/trending/${mediaType}/${timeWindow}`, base);
      url.searchParams.set("language", "zh-CN");

      const headers: Record<string, string> = {};
      if (access.readToken) {
        headers["Authorization"] = `Bearer ${access.readToken}`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url.toString(), {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const data = (await res.json()) as {
        results?: Array<{
          id: number;
          title?: string;
          name?: string;
          poster_path?: string | null;
          release_date?: string;
          first_air_date?: string;
          overview?: string;
        }>;
      };

      return (data.results ?? []).slice(0, 10).map((item) => ({
        tmdbId: item.id,
        mediaType,
        title: item.title ?? item.name ?? "",
        posterPath: item.poster_path ?? null,
        year: (item.release_date ?? item.first_air_date ?? "").slice(0, 4),
        overview: item.overview ?? "",
      }));
    } catch {
      continue;
    }
  }

  return [];
}
