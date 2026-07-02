"""
SSH 客户端封装 —— 连接远端 Linux 服务器。
读取 .env 配置，提供统一的远程命令执行接口。
"""
import os
import sys
import paramiko
from dotenv import load_dotenv

load_dotenv()

SSH_HOST = os.getenv("SSH_HOST", "43.134.191.43")
SSH_USER = os.getenv("SSH_USER", "root")
SSH_PASSWORD = os.getenv("SSH_PASSWORD", "")
SSH_PORT = int(os.getenv("SSH_PORT", "22"))
REMOTE_PROJECT_PATH = os.getenv("REMOTE_PROJECT_PATH", "/root/mediary-scout")


class SSHClient:
    """远端服务器 SSH 客户端"""

    def __init__(self, host=None, user=None, password=None, port=None):
        self.host = host or SSH_HOST
        self.user = user or SSH_USER
        self.password = password or SSH_PASSWORD
        self.port = port or SSH_PORT
        self._ssh = None

    def connect(self):
        """建立连接"""
        self._ssh = paramiko.SSHClient()
        self._ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        self._ssh.connect(
            self.host,
            username=self.user,
            password=self.password,
            port=self.port,
            timeout=15,
        )
        return self

    def exec(self, command, timeout=30):
        """执行远程命令，返回 (stdout, stderr, exit_code)"""
        if not self._ssh:
            self.connect()
        stdin, stdout, stderr = self._ssh.exec_command(command, timeout=timeout)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        exit_code = stdout.channel.recv_exit_status()
        return out, err, exit_code

    def exec_stream(self, command, timeout=30):
        """执行远程命令并流式输出（适用于 docker logs -f 等持续输出命令）。
        逐行 yield stdout，并 yield stderr 内容。"""
        if not self._ssh:
            self.connect()
        stdin, stdout, stderr = self._ssh.exec_command(command, timeout=timeout)
        # 关闭 stdin，避免远程进程等待输入而挂起
        stdin.close()
        # 逐行读取 stdout（paramiko readline 返回 bytes，哨兵用 b""）
        for line in iter(stdout.readline, b""):
            text = line.decode("utf-8", errors="replace").rstrip("\n")
            yield ("stdout", text)
        # 读取残留 stderr
        err_text = stderr.read().decode("utf-8", errors="replace")
        if err_text:
            yield ("stderr", err_text)
        exit_code = stdout.channel.recv_exit_status()
        yield ("exit", exit_code)

    def close(self):
        if self._ssh:
            self._ssh.close()
            self._ssh = None

    def __enter__(self):
        return self.connect()

    def __exit__(self, *args):
        self.close()


def run(cmd):
    """快捷执行一条远程命令，返回 (stdout, stderr, exit_code)"""
    try:
        with SSHClient() as c:
            out, err, code = c.exec(cmd)
            if out:
                safe_print(out.rstrip())
            if err:
                safe_print(f"[STDERR] {err.rstrip()}")
            return out, err, code
    except Exception as e:
        safe_print(f"[ERROR] SSH 连接失败: {e}")
        return "", str(e), -1


def safe_print(*args, **kwargs):
    """跨平台安全打印 —— Windows GBK 终端遇到非 ASCII 字符时自动降级为 UTF-8 二进制输出。"""
    try:
        print(*args, **kwargs)
    except (UnicodeEncodeError, UnicodeDecodeError):
        # 二元写入绕过终端编码限制
        text = " ".join(str(a) for a in args)
        encoded = text.encode("utf-8", errors="replace")
        sys.stdout.buffer.write(encoded + b"\n")
        sys.stdout.buffer.flush()
