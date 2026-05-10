import os
import json

folder = r"D:\Meriem\final_unified"

def get_exercises(data):
    if "exercises" in data:
        return data["exercises"]
    for value in data.values():
        if isinstance(value, dict):
            result = get_exercises(value)
            if result:
                return result
    return []

def find_questions(obj, lines, filepath_printed, filepath):
    if isinstance(obj, list):
        for item in obj:
            find_questions(item, lines, filepath_printed, filepath)
    elif isinstance(obj, dict):
        if "question_text" in obj:
            if not obj.get("level"):
                if not filepath_printed[0]:
                    print(f"FILE: {filepath}")
                    filepath_printed[0] = True
                qid = str(obj.get("id", "unknown"))
                qtext = obj.get("question_text", "")[:80]
                line_num = None
                for i, line in enumerate(lines, 1):
                    if f'"id": "{qid}"' in line:
                        line_num = i
                        break
                print(f"  question id : {qid}")
                print(f"  line        : {line_num}")
                print(f"  text        : {qtext}")
                print()
        for value in obj.values():
            if isinstance(value, (dict, list)):
                find_questions(value, lines, filepath_printed, filepath)

total = 0
processed = 0
skipped_no_exercises = []
skipped_error = []

for root, dirs, filenames in os.walk(folder):
    if "exam" in os.path.basename(root).lower():
        for filename in filenames:
            if filename.lower().endswith(".json"):
                total += 1
                filepath = os.path.join(root, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                        f.seek(0)
                        data = json.load(f)
                    exercises = get_exercises(data)
                    if not exercises:
                        skipped_no_exercises.append(filepath)
                    else:
                        processed += 1
                        filepath_printed = [False]
                        find_questions(exercises, lines, filepath_printed, filepath)
                except Exception as e:
                    skipped_error.append((filepath, str(e)))

print("=" * 60)
print(f"Total files found          : {total}")
print(f"Processed                  : {processed}")
print(f"Skipped (no exercises)     : {len(skipped_no_exercises)}")
for f in skipped_no_exercises:
    print(f"  - {f}")
print(f"Skipped (error)            : {len(skipped_error)}")
for f, e in skipped_error:
    print(f"  - {f} --> {e}")