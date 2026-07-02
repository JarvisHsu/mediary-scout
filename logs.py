"""
查看远端服务日志。
用法:
  python logs.py              # web 容器最近 50 行
  python logs.py -n 100       # 最近 100 行
  python logs.py -f           # 实时跟踪（Ctrl+C 退出）
  python logs.py postgres     # 指定容器
"""
import argparse
from ssh_client import SSHClient, safe_print


def main():
    parser = argparse.ArgumentParser(description="查看远端 Docker 日志")
    parser.add_argument("service", nargs="?", default="web",
                        help="容器名(不含 mediary-scout- 前缀)")
    parser.add_argument("-n", "--lines", type=int, default=50, help="行数")
    parser.add_argument("-f", "--follow", action="store_true", help="实时跟踪")
    parser.add_argument("-t", "--timeout", type=int, default=120,
                        help="实时跟踪超时秒数(默认120)")
    args = parser.parse_args()

    container = f"mediary-scout-{args.service}-1"

    with SSHClient() as c:
        if args.follow:
            # 流式输出: 用 timeout 命令限制运行时长，逐行读取
            cmd = f"timeout {args.timeout} docker logs --tail {args.lines} -f {container}"
            safe_print(f"[{container}] 实时跟踪 (Ctrl+C 退出, {args.timeout}s 超时)")
            safe_print("-" * 60)
            try:
                for stream, text in c.exec_stream(cmd, timeout=args.timeout + 10):
                    if stream == "exit":
                        if text != 0:
                            safe_print(f"\n[进程退出码: {text}]")
                    elif text:
                        safe_print(text)
            except KeyboardInterrupt:
                safe_print("\n已停止跟踪。")
        else:
            cmd = f"docker logs --tail {args.lines} {container}"
            safe_print(f"[{container}] 最近 {args.lines} 行")
            safe_print("-" * 60)
            out, err, code = c.exec(cmd, timeout=30)
            if out:
                safe_print(out)
            if err:
                safe_print(f"[STDERR] {err}")
            if code != 0:
                safe_print(f"[WARN] docker logs 退出码: {code}")


if __name__ == "__main__":
    main()
