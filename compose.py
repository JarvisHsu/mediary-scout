"""
管理远端 docker compose 服务。
用法:
  python compose.py restart [service]   # 重启服务
  python compose.py rebuild             # 重新构建并启动
  python compose.py down                # 停止所有服务
  python compose.py up                  # 启动所有服务
  python compose.py pull                # 拉取最新镜像
"""
import argparse
import shlex
from ssh_client import SSHClient, REMOTE_PROJECT_PATH, safe_print

PROJECT_Q = shlex.quote(REMOTE_PROJECT_PATH)


def compose_cmd(action, service=None):
    """生成 docker compose 命令"""
    if service:
        return f"docker compose --project-directory {PROJECT_Q} {action} {service}"
    return f"docker compose --project-directory {PROJECT_Q} {action}"


def main():
    parser = argparse.ArgumentParser(description="管理远端 Docker Compose 服务")
    parser.add_argument("action", choices=["restart", "rebuild", "down", "up", "pull"])
    parser.add_argument("service", nargs="?", help="指定服务名(可选)")
    args = parser.parse_args()

    with SSHClient() as c:
        if args.action == "rebuild":
            cmd = f"cd {PROJECT_Q} && docker compose up -d --build"
        elif args.action == "restart":
            if args.service:
                container = f"mediary-scout-{args.service}-1"
                cmd = f"docker restart {container}"
            else:
                cmd = f"cd {PROJECT_Q} && docker compose restart"
        else:
            cmd = compose_cmd(args.action, args.service)

        safe_print(f"执行: {cmd}")
        out, err, code = c.exec(cmd)
        if out:
            safe_print(out)
        if err:
            safe_print(f"[STDERR] {err}")
        if code != 0:
            safe_print(f"[ERROR] 命令失败，退出码: {code}")
        else:
            safe_print("完成。")


if __name__ == "__main__":
    main()
