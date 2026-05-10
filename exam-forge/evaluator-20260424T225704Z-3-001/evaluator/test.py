import os
import json

folder = r"D:\Meriem\final_unified"

VALID_LEVELS = {"Factual", "Conceptual", "Procedural", "Metacognitive"}

def recurse_reset(node, file_changed):
    if isinstance(node, dict):
        if "question_text" in node and node["question_text"]:
            if node.get("level") in VALID_LEVELS:
                node["level"] = ""
                file_changed = True
        for value in node.values():
            if isinstance(value, (dict, list)):
                file_changed = recurse_reset(value, file_changed)
    elif isinstance(node, list):
        for item in node:
            file_changed = recurse_reset(item, file_changed)
    return file_changed

total = 0
updated = 0
skipped_error = []

for root, dirs, filenames in os.walk(folder):
    if "exam" in os.path.basename(root).lower():
        for filename in filenames:
            if filename.lower().endswith(".json"):
                total += 1
                filepath = os.path.join(root, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        data = json.load(f)

                    language = data.get("metadata", {}).get("language", "").lower()
                    if language != "arabic":
                        continue

                    file_changed = recurse_reset(data, False)

                    if file_changed:
                        with open(filepath, "w", encoding="utf-8") as f:
                            json.dump(data, f, ensure_ascii=False, indent=2)
                        updated += 1
                        print(f"RESET: {filepath}")
                    else:
                        print(f"NO CHANGE (already empty): {filepath}")

                except Exception as e:
                    skipped_error.append((filepath, str(e)))

print("=" * 60)
print(f"Total files scanned : {total}")
print(f"Arabic files reset  : {updated}")
print(f"Errors              : {len(skipped_error)}")
for f, e in skipped_error:
    print(f"  - {f} --> {e}")