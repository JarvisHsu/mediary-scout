import {
  getAccountScopedSettings,
  getCurrentAccountId,
  getTmdbAccesses,
} from "./workflow-runtime";

// ---- Skill Type Definitions ----

export interface SkillParameter {
  name: string;
  type: "string" | "number" | "enum";
  label: string;
  description: string;
  required: boolean;
  options?: string[]; // for enum type
  default?: string | number;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: "recommend" | "search" | "utility";
  icon: string; // lucide icon name
  parameters: SkillParameter[];
  execute: (params: Record<string, string | number>, accesses: TmdbAccess[]) => Promise<SkillResult>;
}

export interface SkillResult {
  type: "media_list" | "recommendation" | "message";
  items?: SkillMediaItem[];
  message?: string;
}

export interface SkillMediaItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: string;
  posterPath: string | null;
  overview: string;
}

interface TmdbAccess {
  baseUrl?: string | null;
  bearerToken?: string | null;
}

// ---- TMDB API Helper ----

async function tmdbFetch(
  path: string,
  params: Record<string, string>,
  accesses: TmdbAccess[],
): Promise<any> {
  for (const access of accesses) {
    try {
      const base = access.baseUrl ?? "https://api.themoviedb.org";
      const url = new URL(path, base);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      url.searchParams.set("language", "zh-CN");

      const headers: Record<string, string> = {};
      if (access.bearerToken) {
        headers["Authorization"] = `Bearer ${access.bearerToken}`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url.toString(), { headers, signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) continue;
      return await res.json();
    } catch {
      continue;
    }
  }
  return null;
}

function mapResults(data: any, mediaType: "movie" | "tv"): SkillMediaItem[] {
  const results = data?.results ?? [];
  return results.slice(0, 12).map((item: any) => ({
    tmdbId: item.id,
    mediaType: item.media_type === "tv" ? "tv" : mediaType,
    title: item.title ?? item.name ?? "",
    year: (item.release_date ?? item.first_air_date ?? "").slice(0, 4),
    posterPath: item.poster_path,
    overview: item.overview ?? "",
  }));
}

// ---- Skill Definitions ----

export const movieRecommendSkill: SkillDefinition = {
  id: "movie-recommend",
  name: "电影推荐",
  description: "根据类型、心情或相似影片推荐电影",
  category: "recommend",
  icon: "Film",
  parameters: [
    {
      name: "genre",
      type: "enum",
      label: "类型",
      description: "选择电影类型",
      required: false,
      options: [
        "动作", "喜剧", "剧情", "恐怖", "科幻",
        "爱情", "动画", "悬疑", "纪录片", "奇幻",
      ],
      default: "科幻",
    },
    {
      name: "yearRange",
      type: "enum",
      label: "年代",
      description: "选择出品年代",
      required: false,
      options: ["不限", "2020年后", "2010-2020", "2000-2010", "经典(2000前)"],
      default: "不限",
    },
  ],
  execute: async (params, accesses) => {
    const genre = (params.genre as string) || "科幻";
    const yearRange = (params.yearRange as string) || "不限";

    // Map Chinese genre to TMDB genre ID
    const genreMap: Record<string, number> = {
      "动作": 28, "喜剧": 35, "剧情": 18, "恐怖": 27,
      "科幻": 878, "爱情": 10749, "动画": 16, "悬疑": 9648,
      "纪录片": 99, "奇幻": 14,
    };

    // Map year range to date filters
    const yearFilters: Record<string, string> = {
      "2020年后": "2020-01-01",
      "2010-2020": "2010-01-01",
      "2000-2010": "2000-01-01",
      "经典(2000前)": "1900-01-01",
    };

    const params_: Record<string, string> = {
      sort_by: "vote_average.desc",
      "vote_count.gte": "200",
      page: "1",
      with_genres: String(genreMap[genre] ?? 878),
    };

    if (yearRange !== "不限" && yearFilters[yearRange]) {
      if (yearRange === "2020年后") {
        params_["primary_release_date.gte"] = "2020-01-01";
      } else if (yearRange === "2000-2010") {
        params_["primary_release_date.gte"] = "2000-01-01";
        params_["primary_release_date.lte"] = "2010-12-31";
      } else if (yearRange === "2010-2020") {
        params_["primary_release_date.gte"] = "2010-01-01";
        params_["primary_release_date.lte"] = "2020-12-31";
      } else if (yearRange === "经典(2000前)") {
        params_["primary_release_date.lte"] = "1999-12-31";
      }
    }

    const data = await tmdbFetch("/3/discover/movie", params_, accesses);
    if (!data) return { type: "recommendation", message: "获取推荐失败，请检查 TMDB API 配置" };

    const items = mapResults(data, "movie");
    return {
      type: "media_list",
      items,
      message: items.length > 0
        ? `为你推荐${items.length}部${genre}电影`
        : `没有找到符合条件的${genre}电影`,
    };
  },
};

export const similarMovieSkill: SkillDefinition = {
  id: "similar-movie",
  name: "相似影片",
  description: "根据片名查找风格相似的影片",
  category: "recommend",
  icon: "Sparkles",
  parameters: [
    {
      name: "query",
      type: "string",
      label: "参考影片",
      description: "输入一部你喜欢的电影名称",
      required: true,
    },
  ],
  execute: async (params, accesses) => {
    const query = (params.query as string).trim();
    if (!query) return { type: "recommendation", message: "请输入电影名称" };

    // Step 1: Search for the reference movie
    const searchData = await tmdbFetch("/3/search/movie", { query, page: "1" }, accesses);
    if (!searchData?.results?.length) {
      return { type: "recommendation", message: `没有找到 "${query}" 的信息` };
    }

    const movie = searchData.results[0];
    const movieTitle = movie.title ?? movie.name ?? query;

    // Step 2: Get similar movies
    const similarData = await tmdbFetch(
      `/3/movie/${movie.id}/similar`,
      { page: "1" },
      accesses,
    );
    if (!similarData) {
      return { type: "recommendation", message: `获取与 "${movieTitle}" 相似的影片失败` };
    }

    const items = mapResults(similarData, "movie");
    return {
      type: "media_list",
      items,
      message: items.length > 0
        ? `与 "${movieTitle}" 风格相似的 ${items.length} 部影片`
        : `没有找到与 "${movieTitle}" 相似的影片`,
    };
  },
};

export const actorSearchSkill: SkillDefinition = {
  id: "actor-search",
  name: "演员作品",
  description: "搜索演员/导演的作品列表",
  category: "search",
  icon: "User",
  parameters: [
    {
      name: "personName",
      type: "string",
      label: "人物名称",
      description: "输入演员或导演的名字",
      required: true,
    },
  ],
  execute: async (params, accesses) => {
    const personName = (params.personName as string).trim();
    if (!personName) return { type: "recommendation", message: "请输入人物名称" };

    // Step 1: Search for the person
    const searchData = await tmdbFetch("/3/search/person", { query: personName, page: "1" }, accesses);
    if (!searchData?.results?.length) {
      return { type: "recommendation", message: `没有找到 "${personName}" 的信息` };
    }

    const person = searchData.results[0];
    const personNameFound = person.name ?? personName;

    // Step 2: Get their movie/TV credits
    const creditsData = await tmdbFetch(
      `/3/person/${person.id}/combined_credits`,
      {},
      accesses,
    );
    if (!creditsData) {
      return { type: "recommendation", message: `获取 ${personNameFound} 的作品列表失败` };
    }

    const cast = (creditsData.cast ?? [])
      .filter((item: any) => item.media_type === "movie" || item.media_type === "tv")
      .slice(0, 12)
      .map((item: any) => ({
        tmdbId: item.id,
        mediaType: (item.media_type as "movie" | "tv"),
        title: item.title ?? item.name ?? "",
        year: (item.release_date ?? item.first_air_date ?? "").slice(0, 4),
        posterPath: item.poster_path,
        overview: item.overview ?? "",
      }));

    return {
      type: "media_list",
      items: cast,
      message: cast.length > 0
        ? `${personNameFound} 的 ${cast.length} 部作品`
        : `${personNameFound} 暂无作品信息`,
    };
  },
};

export const multiSearchSkill: SkillDefinition = {
  id: "multi-search",
  name: "综合搜索",
  description: "同时搜索电影和剧集",
  category: "search",
  icon: "Search",
  parameters: [
    {
      name: "keyword",
      type: "string",
      label: "关键词",
      description: "输入影片名、人名或关键词",
      required: true,
    },
    {
      name: "mediaType",
      type: "enum",
      label: "媒体类型",
      description: "选择搜索范围",
      required: false,
      options: ["全部", "仅电影", "仅剧集"],
      default: "全部",
    },
  ],
  execute: async (params, accesses) => {
    const keyword = (params.keyword as string).trim();
    const mediaType = (params.mediaType as string) || "全部";
    if (!keyword) return { type: "recommendation", message: "请输入搜索关键词" };

    const data = await tmdbFetch("/3/search/multi", { query: keyword, page: "1" }, accesses);
    if (!data) return { type: "recommendation", message: "搜索失败，请检查 TMDB API 配置" };

    let results = (data.results ?? []).filter(
      (item: any) => item.media_type === "movie" || item.media_type === "tv",
    );

    if (mediaType === "仅电影") {
      results = results.filter((item: any) => item.media_type === "movie");
    } else if (mediaType === "仅剧集") {
      results = results.filter((item: any) => item.media_type === "tv");
    }

    const items = results.slice(0, 12).map((item: any) => ({
      tmdbId: item.id,
      mediaType: item.media_type as "movie" | "tv",
      title: item.title ?? item.name ?? "",
      year: (item.release_date ?? item.first_air_date ?? "").slice(0, 4),
      posterPath: item.poster_path,
      overview: item.overview ?? "",
    }));

    return {
      type: "media_list",
      items,
      message: items.length > 0
        ? `找到 ${items.length} 个结果`
        : `没有找到与 "${keyword}" 相关的结果`,
    };
  },
};

// ---- Skill Registry ----

const skillRegistry: Map<string, SkillDefinition> = new Map();

[multiSearchSkill, movieRecommendSkill, similarMovieSkill, actorSearchSkill].forEach((skill) => {
  skillRegistry.set(skill.id, skill);
});

export function getAllSkills(): SkillDefinition[] {
  return Array.from(skillRegistry.values());
}

export function getSkillById(id: string): SkillDefinition | undefined {
  return skillRegistry.get(id);
}

export function getSkillsByCategory(category: SkillDefinition["category"]): SkillDefinition[] {
  return Array.from(skillRegistry.values()).filter((s) => s.category === category);
}
