import { NextRequest, NextResponse } from "next/server";
import { getAccountScopedSettings, getCurrentAccountId, getTmdbAccesses } from "../../../lib/workflow-runtime";

/**
 * Search suggestions endpoint — called by the client-side search box with a
 * debounced partial query. Proxies TMDB search/multi with a short 2s timeout
 * so a slow proxy never blocks the user's typing experience.
 *
 * GET /api/search-suggestions?q=breaking
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const accesses = await getTmdbAccesses(
      getAccountScopedSettings(await getCurrentAccountId()),
    );

    // Try each TMDB access in order until one returns results
    for (const access of accesses) {
      try {
        const url = new URL(
          `/3/search/multi`,
          access.baseUrl ?? "https://api.themoviedb.org",
        );
        url.searchParams.set("query", q);
        url.searchParams.set("language", "zh-CN");
        url.searchParams.set("page", "1");

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);

        const headers: Record<string, string> = {};
        if (access.bearerToken) {
          headers["Authorization"] = `Bearer ${access.bearerToken}`;
        }

        const res = await fetch(url.toString(), {
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) continue;

        const data = (await res.json()) as {
          results?: Array<{
            id: number;
            media_type: string;
            title?: string;
            name?: string;
            release_date?: string;
            first_air_date?: string;
            poster_path?: string | null;
          }>;
        };

        const suggestions = (data.results ?? [])
          .filter((item) => item.media_type === "movie" || item.media_type === "tv")
          .slice(0, 6)
          .map((item) => ({
            tmdbId: item.id,
            mediaType: item.media_type as "movie" | "tv",
            title: item.title ?? item.name ?? "",
            year: (item.release_date ?? item.first_air_date ?? "").slice(0, 4),
            posterPath: item.poster_path,
          }));

        // Sort items with posters first for visual density
        suggestions.sort((a, b) => {
          if (a.posterPath && !b.posterPath) return -1;
          if (!a.posterPath && b.posterPath) return 1;
          return 0;
        });

        return NextResponse.json({ suggestions });
      } catch {
        // Try next access
        continue;
      }
    }

    return NextResponse.json({ suggestions: [] });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
