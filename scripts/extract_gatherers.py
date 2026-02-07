"""
Extract Gathering recipes from dsp.json and convert to proper gatherers format.
Also removes the Gathering recipes from the recipes array.

Run from the dsp-planner directory:
  python scripts/extract_gatherers.py
"""

import json
from pathlib import Path

def main():
    json_path = Path(__file__).parent.parent / "public" / "packs" / "dsp.json"

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    recipes = data.get("recipes", [])

    # Separate gatherers from regular recipes
    gatherers = []
    remaining_recipes = []

    for recipe in recipes:
        if recipe.get("category") == "Gathering":
            # Convert recipe format to gatherer format
            output = recipe["outputs"][0] if recipe.get("outputs") else {}
            gatherer = {
                "id": recipe["id"],
                "name": recipe["name"],
                "machineId": recipe.get("machineId", ""),
                "outputItemId": output.get("itemId", ""),
                "outputAmount": output.get("amount", 1),
                # extractionRate = amount / craftingTime (items per second per vein/seep)
                "extractionRate": output.get("amount", 1) / recipe.get("craftingTime", 1),
            }
            gatherers.append(gatherer)
            print(f"Extracted: {gatherer['name']} -> {gatherer['extractionRate']:.3f}/s")
        else:
            remaining_recipes.append(recipe)

    print(f"\nExtracted {len(gatherers)} gatherers from {len(recipes)} recipes")
    print(f"Remaining recipes: {len(remaining_recipes)}")

    # Update the data
    data["recipes"] = remaining_recipes
    data["gatherers"] = gatherers

    # Write back
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

    print(f"\nUpdated {json_path}")
    print("\nGatherers added:")
    for g in gatherers:
        print(f"  - {g['id']}: {g['outputItemId']} @ {g['extractionRate']:.3f}/s via {g['machineId']}")

if __name__ == "__main__":
    main()
