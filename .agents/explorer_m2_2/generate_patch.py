import difflib
import sys

def main():
    original_path = "backend/prisma/schema.prisma"
    proposed_path = ".agents/explorer_m2_2/proposed_schema.prisma"
    patch_path = ".agents/explorer_m2_2/schema.patch"

    try:
        with open(original_path, "r", encoding="utf-8") as f:
            original_lines = f.readlines()
        with open(proposed_path, "r", encoding="utf-8") as f:
            proposed_lines = f.readlines()
    except Exception as e:
        print(f"Error reading files: {e}")
        sys.exit(1)

    diff = difflib.unified_diff(
        original_lines,
        proposed_lines,
        fromfile=original_path,
        tofile=proposed_path,
        lineterm=""
    )

    try:
        with open(patch_path, "w", encoding="utf-8") as f:
            f.write("\n".join(diff) + "\n")
        print("Patch successfully generated at .agents/explorer_m2_2/schema.patch")
    except Exception as e:
        print(f"Error writing patch file: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
