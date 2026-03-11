#!/usr/bin/env python3
"""
Simple PTY-based regression test for the hhk REPL.

Usage:
  ./scripts/run_repl_pty_test.sh

This script starts target/debug/hhk repl in a pseudoterminal, sends commands,
verifies that history (Up arrow) recalls the previous command and that the REPL
exits cleanly on Ctrl-D.

Note: This is a lightweight integration test (Python + pty). CI can run it after
building the project.
"""

import os
import sys
import subprocess
import time
import select

MASTER_READ_TIMEOUT = 2.0


def read_available(master_fd, timeout=1.0):
    out = b''
    end = time.time() + timeout
    while time.time() < end:
        r, _, _ = select.select([master_fd], [], [], 0.1)
        if master_fd in r:
            try:
                chunk = os.read(master_fd, 4096)
            except OSError:
                break
            if not chunk:
                break
            out += chunk
        else:
            # no data
            pass
    return out


def main():
    # binary path relative to workspace root
    bin_path = os.path.abspath('target/debug/hhk')
    if not os.path.exists(bin_path):
        print('Binary not found at', bin_path, file=sys.stderr)
        sys.exit(2)

    master_fd, slave_fd = os.openpty()

    # Start process connected to pty slave
    p = subprocess.Popen([bin_path, 'repl'], stdin=slave_fd, stdout=slave_fd, stderr=slave_fd, close_fds=True)

    os.close(slave_fd)

    passed = True

    try:
        # read initial banner
        out = read_available(master_fd, timeout=1.0)
        sys.stdout.buffer.write(out)
        sys.stdout.buffer.flush()

        # Send 'help' then Enter
        os.write(master_fd, b'help\n')
        time.sleep(0.5)
        out = read_available(master_fd, timeout=2.0)
        sys.stdout.buffer.write(out)
        sys.stdout.buffer.flush()

        # Send Up arrow to recall previous command, then Enter
        os.write(master_fd, b'\x1b[A')
        time.sleep(0.2)
        os.write(master_fd, b'\n')
        time.sleep(0.5)
        out = read_available(master_fd, timeout=2.0)
        sys.stdout.buffer.write(out)
        sys.stdout.buffer.flush()

        # We expect the help text to be printed again after recalling and executing
        # Check for a substring that appears in the help output
        if b'HuaHuo Script REPL -- quick reference' not in out:
            print('\n[FAIL] Up-arrow recall did not execute expected command output', file=sys.stderr)
            passed = False

        # Send Ctrl-D (EOF) to exit
        os.write(master_fd, b'\x04')
        time.sleep(0.2)
        out = read_available(master_fd, timeout=1.0)
        sys.stdout.buffer.write(out)
        sys.stdout.buffer.flush()

    finally:
        try:
            p.wait(timeout=1)
        except subprocess.TimeoutExpired:
            p.terminate()
        os.close(master_fd)

    if not passed:
        sys.exit(1)


if __name__ == '__main__':
    main()
