import type { MediaType } from "../domain.js";

/**
 * The fine-grained search profile a title falls into — finer than `MediaType`
 * because PanSou keyword strategy differs sharply by region (a US series needs
 * 英文名+Complete; a 国漫 needs +国漫; a movie wants the bare 中文名 and dies on
 * +4K). Derived from `type` + TMDB `origin_country`. See the 2026-06-16 design
 * spec for the per-profile recipes.
 */
export type SearchProfile =
  | "movie"
  | "cn-tv"
  | "us-tv"
  | "kr-tv"
  | "jp-tv"
  | "generic-tv"
  | "jp-anime"
  | "cn-anime"
  | "us-anime"
  | "generic-anime";

// Co-productions list multiple origins; resolve by a fixed precedence and take
// the first match. tv → the 国产/合拍 circle first; anime is JP-centric.
const TV_ORIGIN_PRECEDENCE: Array<[string, SearchProfile]> = [
  ["CN", "cn-tv"],
  ["US", "us-tv"],
  ["KR", "kr-tv"],
  ["JP", "jp-tv"],
];
const ANIME_ORIGIN_PRECEDENCE: Array<[string, SearchProfile]> = [
  ["JP", "jp-anime"],
  ["CN", "cn-anime"],
  ["US", "us-anime"],
];

export function searchProfile(input: {
  type: MediaType;
  originCountries: string[];
}): SearchProfile {
  if (input.type === "movie") {
    return "movie";
  }
  const table = input.type === "anime" ? ANIME_ORIGIN_PRECEDENCE : TV_ORIGIN_PRECEDENCE;
  for (const [country, profile] of table) {
    if (input.originCountries.includes(country)) {
      return profile;
    }
  }
  return input.type === "anime" ? "generic-anime" : "generic-tv";
}

export const SEARCH_PROFILES: readonly SearchProfile[] = [
  "movie",
  "cn-tv",
  "us-tv",
  "kr-tv",
  "jp-tv",
  "generic-tv",
  "jp-anime",
  "cn-anime",
  "us-anime",
  "generic-anime",
];

// Cross-type laws (from real PanSou research) — ride along on EVERY recipe.
const UNIVERSAL_LAWS = [
  "单次返回 0 不代表无资源:PanSou 跨次抖动,先原样复搜一次再判。",
  "画质不是搜索词:把 4K/1080P 拼进关键词会过滤掉标题匹配、还跑偏到同画质的错作品。画质只在召回后读标题判,要画质用 +1080P/蓝光(剧集),绝不用 +4K。",
  "count ≠ 相关性:读 top 标题判命中,别只看数量。+年份(纯数字)是通用安全降噪/破重名键。",
].join("\n");

// Per-profile lead strategy (实证, see 2026-06-16 design spec).
const PROFILE_RECIPES: Record<SearchProfile, string> = {
  movie:
    "电影:首搜【裸中文名】(最高产、目标多 #1)。弱时按序加:复搜→+年份→英文裸名→+REMUX/合集。" +
    "避免:中文名+画质(热辣滚烫 4K/1080P/蓝光全 0)、英文名+年份(清零)。别名是后门(YOLO/「第N部」);格式敏感(沙丘2 有货、沙丘 2 空格 0)。",
  "cn-tv":
    "国产剧:首搜【裸中文名】。弱时加:+年份(破歧义,名含常用字如『三体』必加)、+集数/第一季。" +
    "避免:裸英文(全 0)、+全集(资源用『全N集』)、+电视剧/国产剧(跑偏分类噪声)。整季『全N集打包』普遍,但少跨季合集。",
  "us-tv":
    "美剧:别裸搜!裸中文名常撞 relevance gate→0。首搜【中文名+一个 token】(中文名+1080P / 中文名+美剧)。" +
    "弱时加:要全系列合集→【英文名+Complete/Season】(合集王,一锅端多季)、+蓝光/BD、+第N季。避免:裸中文(0)、裸英文(除非极独特如 The Last of Us)、+年份(首播年常对不上)。经典完结剧合集包极普遍;新剧无合集→逐季中文名+第N季。",
  "kr-tv":
    "韩剧:首搜【裸中文译名】(译名基本统一)。弱时加:+年份、英文名(冷门韩剧英文名常有更高画质)。" +
    "避免:+全集、中文第X季、画质词。韩文原名只用于找生肉(无中字)。",
  "jp-tv":
    "日剧:首搜【裸中文通用正名】——译名多版不统一是最大坑(Silent=静雪、Legal High=胜者即是正义,用错直接被同名英美剧/AV 淹没)。" +
    "弱时加:英文罗马音名(Hanzawa Naoki 干净)、+年份。避免:单词型英文名(Silent 被淹)、片假名(AV 污染)、+全集。",
  "generic-tv":
    "电视剧(地区未定):首搜【裸中文名/译名】。弱时加:+年份、若像美剧再试英文名+Complete。避免:+全集、中文第X季、画质词当搜索键。先确认通用译名再搜。",
  "jp-anime":
    "日漫:首搜【裸中文译名】(命中率高 @0)。弱时按序加:+1080P(不是 4K!番真 4K 极少)、+第N季、原名(Spy×Family 带×号)、字幕组/压制组(LoliHouse=WebRip 合集 / DBD-Raws=BDRip,质量过滤器但量小)。" +
    "避免:+全集、+4K(直接归 0)、罗马音+任何词(死)。英文名量大但画质杂(720p/双音轨),只兜底。",
  "cn-anime":
    "国漫:裸中文名不稳(凡人/一人有量,斗罗/斗破裸名→0)。首搜直接【名 +国漫】或【名 +年份】更稳。" +
    "弱时加:+国漫(万能键)、+年份、+GM-Team(国漫顶级压制组)、长篇补季 +第N季。避免:+动画/+番剧(更差)、英文名(废)。一人之下是污染重灾区(裸名混神雕侠侣,只能裸名+人工排序挑)。",
  "us-anime":
    "美漫:首搜【裸中文译名】(干净小集)。弱时按序加要量:【英文名+画质/年份】(Rick and Morty 1080P→975,扩量王炸)、中文名+动画(美漫有效!与国漫相反)、中文名+年份。" +
    "避免:裸英文不配画质(→0,除 Invincible/BoJack)、冷门片中文名+任何词(马男+全集/合集/1080P/第六季 全 0,只能裸中文名或英文名两条路)。",
  "generic-anime":
    "动画(地区未定):首搜【裸中文译名】。弱时加:+1080P(非 4K)、+年份、+第N季、原名。避免:+全集、+4K(归 0)。字幕组/压制组是质量过滤器。",
};

/** The search-strategy hint injected per title (and mirrored in skill.ts). */
export function getSearchRecipe(profile: SearchProfile): string {
  return `${PROFILE_RECIPES[profile]}\n\n通用铁律:\n${UNIVERSAL_LAWS}`;
}

/** Profiles where real 4K genuinely exists (research 证据 2). Everything else
 *  tops out at 1080p — telling the agent so prevents over-searching for 4K that
 *  isn't there (the original "机械逼 4K→过度搜索→撞限" incident). */
const HI_REACHABLE: ReadonlySet<SearchProfile> = new Set([
  "movie",
  "cn-tv",
  "us-tv",
  "kr-tv",
  "generic-tv",
]);

const QUALITY_KEYWORD_LAW =
  "画质只在召回后读标题判,绝不进搜索关键词(进了会过滤掉标题匹配、还跑偏到同画质的错作品)。";

/**
 * The per-profile quality-preference guidance injected into the system prompt as
 * a 召回后选片优先级 (NOT a search term). "" when the user has no preference
 * (不限/undefined). The guidance always subordinates quality to coverage, and —
 * for profiles where 4K is scarce — actively tells the agent NOT to over-search
 * for it (1080p is the realistic ceiling there).
 */
export function getQualityGuidance(
  profile: SearchProfile,
  preference: "high" | "medium" | undefined,
): string {
  if (preference === undefined) {
    return "";
  }
  if (preference === "medium") {
    return (
      "画质偏好:中(≈1080P)。召回后优先选 1080P / 蓝光(BluRay/BDRip)的版本,有 1080P 时别选 720p/枪版。" +
      "1080P 几乎各类都有,正常都能满足。但覆盖永远优先:实在只有更低画质,也照样取下来,绝不为画质留缺。" +
      QUALITY_KEYWORD_LAW
    );
  }
  // high
  const head =
    "画质偏好:高(≈4K)。召回后优先选 2160p / 4K / UHD / REMUX 的【可播放视频文件】(mkv/mp4,带 HDR/杜比视界更佳)。" +
    "⚠️ 避免蓝光原盘 / ISO / BDMV 整盘镜像:它动辄上百GB、多数设备无法直接播放,且不是单个视频文件——宁取 4K REMUX 视频,退一步取更低画质的视频版本,也不要整盘镜像。";
  const tail =
    "覆盖永远优先于画质:找不到 4K 就退取 1080P/蓝光视频,绝不为画质放弃任何一集/这部片。" + QUALITY_KEYWORD_LAW;
  if (HI_REACHABLE.has(profile)) {
    return head + "这类内容真 4K 通常存在,值得在已召回候选里挑高的。" + tail;
  }
  return (
    head +
    "但这一类真 4K 极少甚至没有,1080P/蓝光通常就是现实天花板——不要为追 4K 反复改词搜索或加搜,那只会过度消耗预算/撞限。" +
    "已召回候选里有 4K 就取、没有就直接取最佳 1080P。" +
    tail
  );
}
