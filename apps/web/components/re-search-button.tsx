"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Re-search button — clears the search cache for the current query and
 * performs a fresh search.
 */
export function ReSearchButton({
  query,
  basePath,
}: {
  query: string;
  basePath: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleReSearch = () => {
    startTransition(async () => {
      // Clear the cache entry via the API
      await fetch("/api/clear-search-cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      // Navigate to trigger a fresh server fetch
      router.push(`${basePath}?tab=search&q=${encodeURIComponent(query)}`);
    });
  };

  return (
    <button
      className="re-search-btn"
      onClick={handleReSearch}
      disabled={isPending}
      title="清除缓存并重新搜索"
    >
      <RefreshCw
        size={14}
        className={isPending ? "spin" : ""}
        aria-hidden
      />
      {isPending ? "重新搜索中..." : "重新搜索"}
    </button>
  );
}
