import os
import re

search_dir = r"c:\Users\pc\Desktop\face bot\backend\src"
pattern = re.compile(r"subscriber\.create|subscribersService|createSubscriber", re.IGNORECASE)

for root, dirs, files in os.walk(search_dir):
    for file in files:
        if file.endswith(".ts"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                for line_num, line in enumerate(f, 1):
                    if pattern.search(line):
                        print(f"{os.path.relpath(path, search_dir)}:{line_num}: {line.strip()}")
