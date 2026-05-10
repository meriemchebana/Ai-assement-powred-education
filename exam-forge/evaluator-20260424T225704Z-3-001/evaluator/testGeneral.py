import os
import json

folder = r"D:\Meriem\final_unified"

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

for root, dirs, filenames in os.walk(folder):
    if "exam" in os.path.basename(root).lower():
        for filename in filenames:
            if filename.lower().endswith(".json"):
                filepath = os.path.join(root, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                        f.seek(0)
                        data = json.load(f)
                    filepath_printed = [False]
                    find_questions(data.get("exercises", []), lines, filepath_printed, filepath)
                except Exception as e:
                    print(f"ERROR reading {filepath}: {e}")