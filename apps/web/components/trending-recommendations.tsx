"use client";

import { TrendingItem } from "../lib/trending";
import { useRouter } from "next/navigation";
import { Film, Tv } from "lucide-react";
import { useState } from "react";

/**
 * Trending recommendations panel shown on the search page when no query is active.
 * Mirrors the visual language of the search candidate cards.
 */
export function TrendingRecommendations({
  movies,
  tvShows,
  basePath,
}: {
  movies: TrendingItem[];
  tvShows: TrendingItem[];
  basePath: string;
}) {
  const [activeTab, setActiveTab] = useState<"movie" | "tv">("movie");
  const items = activeTab === "movie" ? movies : tvShows;
  const router = useRouter();

  return (
    <section className="trending-section">
      <div className="section-heading">
        <div>
          <h2>热门推荐</h2>
          <p>TMDB 本周趋势</p>
        </div>
      </div>

      <div className="trending-tabs">
        <button
          className={`tab ${activeTab === "movie" ? "is-active" : ""}`}
          onClick={() => setActiveTab("movie")}
        >
          <Film size={14} />
          电影
        </button>
        <button
          className={`tab ${activeTab === "tv" ? "is-active" : ""}`}
          onClick={() => setActiveTab("tv")}
        >
          <Tv size={14} />
          剧集
        </button>
      </div>

      <div className="trending-grid">
        {items.map((item) => (
          <button
            key={`${item.mediaType}_${item.tmdbId}`}
            className="trending-card"
            onClick={() => {
              router.push(
                `${basePath}?tab=search&q=${encodeURIComponent(item.title)}`,
              );
            }}
          >
            <span className="trending-poster">
              {item.posterPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://image.tmdb.org/t/p/w342${item.posterPath}`}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <span className="trending-fallback">{item.title.slice(0, 2)}</span>
              )}
            </span>
            <span className="trending-copy">
              <strong>{item.title}</strong>
              <small>{item.year || "即将上映"}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
