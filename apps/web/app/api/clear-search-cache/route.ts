import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { postgresConnectionString } from "../../../lib/workflow-runtime";

/**
 * Clear a single search cache entry so the next search re-fetches from TMDB.
 *
 * POST /api/clear-search-cache
 * Body: { "query": "breaking bad" }
 */
export async function POST(request: NextRequest) {
  try {
    const { query } = (await request.json()) as { query?: string };
    if (!query || !query.trim()) {
      return NextResponse.json({ cleared: false }, { status: 400 });
    }

    const key = query.trim().toLowerCase();
    const pool = new Pool({ connectionString: postgresConnectionString() });
    try {
      const result = await pool.query(
        "DELETE FROM tmdb_search_cache WHERE cache_key = $1",
        [key],
      );
      return NextResponse.json({ cleared: (result.rowCount ?? 0) > 0 });
    } finally {
      await pool.end();
    }
  } catch {
    return NextResponse.json({ cleared: false }, { status: 500 });
  }
}
