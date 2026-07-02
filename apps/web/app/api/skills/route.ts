import { NextRequest, NextResponse } from "next/server";
import {
  getAccountScopedSettings,
  getCurrentAccountId,
  getTmdbAccesses,
} from "../../lib/workflow-runtime";
import { getAllSkills, getSkillById } from "../../lib/skills";

/**
 * GET /api/skills — list all available skills
 * POST /api/skills — execute a skill
 *
 * POST body:
 * {
 *   "skillId": "movie-recommend",
 *   "params": { "genre": "动作", "yearRange": "2020年后" }
 * }
 */
export async function GET() {
  const skills = getAllSkills().map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    icon: s.icon,
    parameters: s.parameters,
  }));
  return NextResponse.json({ skills });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      skillId?: string;
      params?: Record<string, string | number>;
    };

    const skillId = body.skillId;
    if (!skillId) {
      return NextResponse.json({ error: "缺少 skillId" }, { status: 400 });
    }

    const skill = getSkillById(skillId);
    if (!skill) {
      return NextResponse.json({ error: `未知技能: ${skillId}` }, { status: 404 });
    }

    // Validate required parameters
    for (const param of skill.parameters) {
      if (param.required && !body.params?.[param.name]) {
        return NextResponse.json(
          { error: `缺少必要参数: ${param.label}` },
          { status: 400 },
        );
      }
    }

    const accesses = await getTmdbAccesses(
      getAccountScopedSettings(await getCurrentAccountId()),
    );

    const result = await skill.execute(body.params ?? {}, accesses);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Skill execution error:", err);
    return NextResponse.json(
      { error: "执行技能时发生错误" },
      { status: 500 },
    );
  }
}
