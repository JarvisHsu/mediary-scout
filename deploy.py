"""
部署流水线: 本地开发 → 推送 fork → 远端 pull + 重建。

用法:
  python deploy.py                         # 推送本地到 fork → 远端 pull + rebuild
  python deploy.py --no-push               # 远端直接 pull + rebuild（本地已推送）
  python deploy.py --no-build              # 仅推送 + 远端 pull，不重建
  python deploy.py --sync-upstream         # 同步主线(upstream/main) → 推送 fork → 远端部署
  python deploy.py --sync-upstream --no-build  # 仅同步主线 + 推送，不部署

环境变量(.env):
  SSH_HOST          远端服务器 IP (默认 43.134.191.43)
  SSH_USER          SSH 用户 (默认 root)
  SSH_PASSWORD      SSH 密码
  SSH_PORT          SSH 端口 (默认 22)
  REMOTE_PROJECT_PATH  远端项目路径 (默认 /root/mediary-scout)
"""
import argparse
import subprocess
import sys
import time
from ssh_client import SSHClient, REMOTE_PROJECT_PATH, safe_print


def local_cmd(cmd, capture=True):
    """执行本地命令"""
    if capture:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return r.stdout, r.stderr, r.returncode
    else:
        r = subprocess.run(cmd, shell=True)
        return "", "", r.returncode


def sync_upstream():
    """
    从主线仓库(upstream)同步最新代码:
      git fetch upstream
      git merge upstream/main
      git push origin main
    """
    safe_print("=" * 60)
    safe_print("  同步主线 (upstream/main)")
    safe_print("=" * 60)

    # 1. fetch upstream
    out, err, code = local_cmd("git fetch upstream")
    if err:
        safe_print(f"[STDERR] {err}")
    if code != 0:
        safe_print(f"[ERROR] git fetch upstream 失败 (退出码 {code})")
        sys.exit(1)
    safe_print("已拉取 upstream 最新提交。")

    # 2. 检查是否有新内容
    out, err, code = local_cmd(
        "git log --oneline HEAD..upstream/main"
    )
    if not out.strip():
        safe_print("本地已是最新，无需合并。")
        return False
    safe_print(f"待合并的 upstream 提交:\n{out}")

    # 3. merge upstream/main
    out, err, code = local_cmd("git merge upstream/main")
    safe_print(out)
    if err:
        safe_print(f"[STDERR] {err}")
    if code != 0:
        safe_print("[ERROR] git merge upstream/main 失败，请手动处理冲突。")
        sys.exit(1)
    safe_print("合并成功。")
    return True


def push_to_fork():
    """推送本地 main 到 fork (origin)"""
    safe_print("=" * 60)
    safe_print("  推送到 Fork (origin/main)")
    safe_print("=" * 60)

    out, err, code = local_cmd("git push origin main")
    safe_print(out)
    if err:
        safe_print(f"[STDERR] {err}")
    if code != 0:
        safe_print(f"[ERROR] git push origin main 失败 (退出码 {code})")
        sys.exit(1)
    safe_print("推送成功。")


def deploy_remote(c, no_build=False):
    """远端: git pull + rebuild"""
    safe_print("=" * 60)
    safe_print("  远端部署")
    safe_print("=" * 60)

    # 1. 远端拉取
    out, err, code = c.exec(
        f"cd {REMOTE_PROJECT_PATH} && git pull origin main"
    )
    safe_print(out)
    if err:
        safe_print(f"[STDERR] {err}")
    if code != 0:
        safe_print("[WARN] git pull 返回非零退出码。")

    if no_build:
        safe_print("\n跳过重建。如需重启: python compose.py restart")
        return

    # 2. Docker rebuild
    out, err, code = c.exec(
        f"cd {REMOTE_PROJECT_PATH} && docker compose up -d --build"
    )
    safe_print(out)
    if err:
        safe_print(f"[STDERR] {err}")
    if code != 0:
        safe_print("[WARN] docker compose 返回非零退出码。")

    # 3. 健康检查
    safe_print("等待服务启动...")
    max_wait = 30
    interval = 2
    elapsed = 0
    while elapsed < max_wait:
        time.sleep(interval)
        elapsed += interval
        out, _, _ = c.exec(
            "docker ps --format '{{.Names}} {{.Status}}' "
            "--filter name=mediary-scout 2>/dev/null"
        )
        if not out.strip():
            continue
        lines = out.strip().split("\n")
        all_ready = all(
            "restarting" not in line.lower() and "removing" not in line.lower()
            for line in lines
        )
        if all_ready:
            safe_print(f"服务已就绪 (耗时 {elapsed}s)")
            break
    else:
        safe_print(f"[WARN] 等待 {max_wait}s 后服务可能尚未完全就绪")

    # 显示最终状态
    out, _, _ = c.exec(
        "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' "
        "--filter name=mediary-scout"
    )
    safe_print(out)


def main():
    parser = argparse.ArgumentParser(
        description="部署流水线: 本地 → fork → 远端",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python deploy.py                         # 完整部署: push fork + 远端 rebuild
  python deploy.py --no-push               # 远端直接 pull + rebuild
  python deploy.py --no-build              # 仅推送 + 远端 pull
  python deploy.py --sync-upstream         # 同步主线 + 推送 fork + 远端部署
  python deploy.py --sync-upstream --no-build  # 仅同步主线
        """,
    )
    parser.add_argument(
        "--no-build", action="store_true",
        help="仅推送/同步代码，不触发远端 Docker 重建"
    )
    parser.add_argument(
        "--no-push", action="store_true",
        help="跳过本地推送（假设已手动推送）"
    )
    parser.add_argument(
        "--sync-upstream", action="store_true",
        help="同步主线仓库 (upstream/main) 到 fork"
    )
    args = parser.parse_args()

    # Step 1: 同步主线（可选）
    if args.sync_upstream:
        sync_upstream()

    # Step 2: 推送到 fork
    if not args.no_push:
        push_to_fork()

    # Step 3: 远端部署
    with SSHClient() as c:
        deploy_remote(c, no_build=args.no_build)

    safe_print("\n部署完成。")


if __name__ == "__main__":
    main()
