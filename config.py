"""
查看/编辑远端服务器上的 .env 配置文件。
用法:
  python config.py              # 查看当前 .env
  python config.py set KEY VAL  # 设置环境变量
  python config.py get KEY      # 获取单个变量
"""
import argparse
import re
import shlex
from ssh_client import SSHClient, REMOTE_PROJECT_PATH, safe_print

ENV_FILE = f"{REMOTE_PROJECT_PATH}/.env"
ENV_FILE_Q = shlex.quote(ENV_FILE)


def _escape_regex(key):
    """转义正则特殊字符，防止 grep 匹配错误"""
    return re.escape(key)


def _sed_escape(s):
    """转义 sed 替换字符串中的特殊字符 / & 和反斜杠"""
    return s.replace("\\", "\\\\").replace("/", "\\/").replace("&", "\\&")


def show_config(c):
    """显示远端 .env 内容"""
    out, err, _ = c.exec(f"cat {ENV_FILE_Q} 2>/dev/null")
    if not out.strip():
        safe_print("远端 .env 文件不存在或为空。")
        safe_print(f"示例文件: {REMOTE_PROJECT_PATH}/.env.example")
        return
    safe_print(out)


def set_config(c, key, value):
    """设置或更新远端 .env 中的变量"""
    c.exec(f"touch {ENV_FILE_Q}")
    escaped_key = _escape_regex(key)

    # 检查 key 是否已存在
    out, _, _ = c.exec(f"grep -n '^{escaped_key}=' {ENV_FILE_Q} 2>/dev/null")
    if out.strip():
        line_no = out.strip().split(":")[0]
        # sed s 替换整行，转义 value 中的 / & \
        new_line = _sed_escape(f"{key}={value}")
        cmd = f"sed -i \"{line_no}s/.*/{new_line}/\" {ENV_FILE_Q}"
    else:
        # printf 安全追加
        cmd = f"printf '%s=%s\\n' {shlex.quote(key)} {shlex.quote(value)} >> {ENV_FILE_Q}"
    out, err, code = c.exec(cmd)
    if code != 0 or err:
        safe_print(f"设置失败: {err}")
    else:
        safe_print(f"已设置 {key}={value}")


def get_config(c, key):
    """获取单个远端变量"""
    escaped_key = _escape_regex(key)
    out, _, _ = c.exec(f"grep '^{escaped_key}=' {ENV_FILE_Q} 2>/dev/null")
    if out.strip():
        safe_print(out.strip())
    else:
        safe_print(f"{key} 未设置")


def main():
    parser = argparse.ArgumentParser(description="管理远端 .env 配置")
    sub = parser.add_subparsers(dest="cmd")

    sub.add_parser("show", help="查看远端 .env")

    p_set = sub.add_parser("set", help="设置环境变量")
    p_set.add_argument("key")
    p_set.add_argument("value")

    p_get = sub.add_parser("get", help="获取环境变量")
    p_get.add_argument("key")

    args = parser.parse_args()

    with SSHClient() as c:
        if args.cmd == "show" or args.cmd is None:
            show_config(c)
        elif args.cmd == "set":
            set_config(c, args.key, args.value)
        elif args.cmd == "get":
            get_config(c, args.key)


if __name__ == "__main__":
    main()
