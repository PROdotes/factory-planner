import json
import os

filepath = r"c:\Users\prodo\Antigrav projects\DSP\dsp-planner\public\packs\dsp.json"
mappings = {
    "grating-crystal": 11
}

with open(filepath, 'r', encoding='utf-8') as f:
    data = json.load(f)

updated_count = 0
for item in data.get("items", []):
    item_id = item.get("id")
    if item_id in mappings:
        item["iconIndex"] = mappings[item_id]
        updated_count += 1

with open(filepath, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=4)

print(f"Successfully updated {updated_count} items in dsp.json")
