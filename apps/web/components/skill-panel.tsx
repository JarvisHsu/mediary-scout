"use client";

import {
  Film,
  LoaderCircle,
  Search,
  Sparkles,
  User,
  ChevronDown,
  Link,
  Tv,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { SkillDefinition, SkillMediaItem, SkillParameter, SkillResult } from "../lib/skills";

// Icon name → component mapping
const iconMap: Record<string, React.ElementType> = {
  Film,
  Search,
  Sparkles,
  User,
};

/**
 * Interactive skill panel shown on the search page.
 * Loads available skills from /api/skills and lets the user execute them.
 */
export function SkillPanel({ basePath }: { basePath: string }) {
  const [skills, setSkills] = useState<SkillDefinition[] | null>(null);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string | number>>({});
  const [result, setResult] = useState<SkillResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  // Lazy load skills
  const loadSkills = useCallback(async () => {
    if (skills) return;
    try {
      const res = await fetch("/api/skills");
      const data = await res.json();
      setSkills(data.skills ?? []);
    } catch {
      // Silently fail
    }
  }, [skills]);

  const handleToggle = () => {
    setExpanded((p) => !p);
    if (!expanded) loadSkills();
  };

  const handleSelectSkill = (skillId: string) => {
    setActiveSkillId(skillId);
    setParamValues({});
    setResult(null);
    setError(null);
  };

  const handleParamChange = (name: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleExecute = async () => {
    if (!activeSkillId) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId: activeSkillId, params: paramValues }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error ?? "执行失败");
      }
    } catch {
      setError("网络请求失败");
    } finally {
      setLoading(false);
    }
  };

  const activeSkill = skills?.find((s) => s.id === activeSkillId);
  const ActiveIcon = activeSkill ? iconMap[activeSkill.icon] ?? Search : Search;

  return (
    <section className="skill-panel">
      <button
        className="skill-toggle"
        onClick={handleToggle}
        aria-expanded={expanded}
      >
        <span className="skill-toggle-inner">
          <Sparkles size={16} aria-hidden />
          <span>智能助手</span>
        </span>
        <ChevronDown
          size={16}
          className={`skill-chevron ${expanded ? "is-open" : ""}`}
        />
      </button>

      {expanded && (
        <div className="skill-body">
          {!skills ? (
            <div className="skill-loading">
              <LoaderCircle size={16} className="spin" />
              <span>加载技能...</span>
            </div>
          ) : activeSkill ? (
            <>
              <button
                className="skill-back"
                onClick={() => {
                  setActiveSkillId(null);
                  setResult(null);
                  setError(null);
                }}
              >
                ← 返回列表
              </button>

              <div className="skill-active">
                <div className="skill-active-head">
                  <ActiveIcon size={18} />
                  <div>
                    <strong>{activeSkill.name}</strong>
                    <span>{activeSkill.description}</span>
                  </div>
                </div>

                <div className="skill-form">
                  {activeSkill.parameters.map((param) => (
                    <ParamInput
                      key={param.name}
                      param={param}
                      value={paramValues[param.name] ?? param.default ?? ""}
                      onChange={(v) => handleParamChange(param.name, v)}
                    />
                  ))}
                </div>

                <button
                  className="primary-button skill-execute"
                  onClick={handleExecute}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <LoaderCircle size={14} className="spin" />
                      执行中...
                    </>
                  ) : (
                    "执行"
                  )}
                </button>

                {error && <p className="skill-error">{error}</p>}

                {result && (
                  <SkillResultView
                    result={result}
                    basePath={basePath}
                    router={router}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="skill-list">
              <p className="skill-hint">选择一个技能开始使用</p>
              {skills.map((skill) => {
                const Icon = iconMap[skill.icon] ?? Search;
                return (
                  <button
                    key={skill.id}
                    className="skill-card"
                    onClick={() => handleSelectSkill(skill.id)}
                  >
                    <span className="skill-card-icon">
                      <Icon size={16} />
                    </span>
                    <span className="skill-card-body">
                      <strong>{skill.name}</strong>
                      <small>{skill.description}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ParamInput({
  param,
  value,
  onChange,
}: {
  param: SkillParameter;
  value: string | number;
  onChange: (value: string) => void;
}) {
  if (param.type === "enum" && param.options) {
    return (
      <label className="skill-label">
        <span>{param.label}</span>
        <select
          className="setting-control skill-select"
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        >
          {param.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="skill-label">
      <span>{param.label}</span>
      <input
        className="push-input skill-input"
        type="text"
        placeholder={param.description}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SkillResultView({
  result,
  basePath,
  router,
}: {
  result: SkillResult;
  basePath: string;
  router: ReturnType<typeof useRouter>;
}) {
  if (result.message && !result.items?.length) {
    return <p className="skill-message">{result.message}</p>;
  }

  return (
    <div className="skill-results">
      {result.message && (
        <p className="skill-message">{result.message}</p>
      )}
      {result.items && result.items.length > 0 && (
        <div className="skill-result-grid">
          {result.items.map((item) => (
            <button
              key={`${item.mediaType}_${item.tmdbId}`}
              className="skill-result-card"
              onClick={() => {
                router.push(
                  `${basePath}?tab=search&q=${encodeURIComponent(item.title)}`,
                );
              }}
            >
              <span className="skill-result-poster">
                {item.posterPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://image.tmdb.org/t/p/w185${item.posterPath}`}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <span className="skill-result-fallback">
                    {item.mediaType === "movie" ? (
                      <Film size={16} />
                    ) : (
                      <Tv size={16} />
                    )}
                  </span>
                )}
              </span>
              <span className="skill-result-body">
                <strong>{item.title}</strong>
                <small>
                  {item.year && `${item.year} · `}
                  {item.mediaType === "movie" ? "电影" : "剧集"}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
