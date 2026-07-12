import os

src_dir = r"c:\Users\pc\Desktop\face bot\backend\src"
bypasses_found = []

patterns = [
    "member-id-123",
    "subscriber-id-123",
    "connection-id-123",
    "expired_or_invalid",
    "hubqa_secure_verify_token_2026",
    "revoked"
]

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(".ts") and not file.endswith(".spec.ts"):
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                for line_idx, line in enumerate(lines):
                    for pattern in patterns:
                        if pattern in line:
                            bypasses_found.append({
                                "file": os.path.relpath(file_path, src_dir),
                                "line": line_idx + 1,
                                "content": line.strip(),
                                "pattern": pattern
                            })
            except Exception as e:
                print(f"Error reading {file_path}: {e}")

print("--- SCAN RESULTS ---")
if bypasses_found:
    for item in bypasses_found:
        print(f"File: {item['file']} (Line {item['line']}) matching pattern '{item['pattern']}':")
        print(f"  {item['content']}")
else:
    print("No bypasses found.")
