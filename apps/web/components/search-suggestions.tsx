"use client";

import { Film, Tv } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface Suggestion {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: string;
  posterPath: string | null;
}

/**
 * Dropdown search suggestions that appear as the user types.
 * Debounces the input and fetches from /api/search-suggestions.
 * Supports full keyboard navigation (ArrowDown/ArrowUp/Enter/Escape).
 */
export function SearchSuggestions({
  query,
  basePath,
  visible,
  onClose,
}: {
  query: string;
  basePath: string;
  visible: boolean;
  onClose: () => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!visible || query.length < 2) {
      setSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    // Cancel previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setHighlightedIndex(-1); // Reset highlight on new query
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search-suggestions?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250); // 250ms debounce

    return () => {
      clearTimeout(timer);
    };
  }, [query, visible]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[role="option"]');
    const target = items[highlightedIndex] as HTMLElement | undefined;
    if (target) {
      target.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  // Close on click outside
  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [visible, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const max = suggestions.length - 1;
          if (prev >= max) return 0;
          return prev + 1;
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const max = suggestions.length - 1;
          if (prev <= 0) return max;
          return prev - 1;
        });
        return;
      }
      if (e.key === "Enter" && highlightedIndex >= 0) {
        e.preventDefault();
        const item = suggestions[highlightedIndex];
        if (item) {
          const navigateTo = () => {
            router.push(
              `${basePath}?tab=search&q=${encodeURIComponent(item.title)}`,
            );
            onClose();
          };
          navigateTo();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [visible, onClose, suggestions, highlightedIndex, basePath, router]);

  if (!visible) return null;

  const hasResults = suggestions.length > 0 || loading;

  return (
    <div className="suggestions-dropdown" ref={ref}>
      {!hasResults ? (
        <div className="suggestions-empty">
          {query.length >= 2 ? (
            <span>未找到匹配结果，按回车搜索 "{query}"</span>
          ) : null}
        </div>
      ) : (
        <ul className="suggestions-list" role="listbox" ref={listRef}>
          {suggestions.map((item, index) => (
            <li key={`${item.mediaType}_${item.tmdbId}`} role="option" aria-selected={index === highlightedIndex}>
              <button
                className={`suggestion-item${index === highlightedIndex ? " is-highlighted" : ""}`}
                onClick={() => {
                  router.push(
                    `${basePath}?tab=search&q=${encodeURIComponent(item.title)}`,
                  );
                  onClose();
                }}
              >
                <span className="suggestion-poster">
                  {item.posterPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://image.tmdb.org/t/p/w92${item.posterPath}`}
                      alt=""
                    />
                  ) : (
                    <span className="suggestion-fallback">
                      {item.mediaType === "movie" ? (
                        <Film size={14} />
                      ) : (
                        <Tv size={14} />
                      )}
                    </span>
                  )}
                </span>
                <span className="suggestion-body">
                  <span className="suggestion-title">{item.title}</span>
                  <span className="suggestion-meta">
                    {item.year && `${item.year} · `}
                    {item.mediaType === "movie" ? "电影" : "剧集"}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {loading && (
            <li className="suggestion-loading">
              <span className="search-spinner" aria-hidden />
              <span>搜索中...</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
