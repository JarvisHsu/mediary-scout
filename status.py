"""
查看远端服务器状态：Docker 容器、系统资源、Git 状态。
用法: python status.py
"""
from ssh_client import SSHClient, SSH_HOST, REMOTE_PROJECT_PATH, safe_print


def main():
    with SSHClient() as c:
        safe_print("=" * 60)
        safe_print(f"  服务器 {SSH_HOST}")
        safe_print("=" * 60)

        # 系统资源
        out, err, _ = c.exec("free -h && echo && df -h /")
        if out:
            safe_print(out)
        if err:
            safe_print(f"[STDERR] {err}")

        # Docker 容器
        out, err, _ = c.exec(
            "docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
        )
        if out:
            safe_print(out)
        if err:
            safe_print(f"[STDERR] {err}")

        # Docker 镜像
        out, err, _ = c.exec(
            "docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'"
        )
        if out:
            safe_print(out)
        if err:
            safe_print(f"[STDERR] {err}")

        # Git 状态
        out, err, _ = c.exec(
            f"cd {REMOTE_PROJECT_PATH} && "
            "git status --short && echo && "
            "git log --oneline -3"
        )
        if out:
            safe_print(out)
        if err:
            safe_print(f"[STDERR] {err}")


if __name__ == "__main__":
    main()
