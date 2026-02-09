import json
import os
from PIL import Image

# Config from ItemIcon.tsx
ICON_SIZE = 64
COLS = 23

# Paths
BASE_DIR = r"c:\Users\prodo\Antigrav projects\DSP\dsp-planner"
JSON_PATH = os.path.join(BASE_DIR, "public", "packs", "dsp.json")
SPRITE_PATH = os.path.join(BASE_DIR, "public", "icons.webp")
OUTPUT_PATH = os.path.join(BASE_DIR, "src", "gamedata", "itemColors.json")

import colorsys

def calculate_average_color(img_crop):
    # Bucket by Hue (36 buckets of 10 degrees)
    buckets = [[] for _ in range(36)]
    greys = []
    total_non_transparent = 0
    
    pixels = img_crop.load()
    width, height = img_crop.size
    
    for y in range(height):
        for x in range(width):
            pixel = pixels[x, y]
            r, g, b, a = pixel if len(pixel) == 4 else (*pixel, 255)
            
            if a < 64: continue # Stick to solid parts
            total_non_transparent += 1
            
            h, l, s = colorsys.rgb_to_hls(r/255, g/255, b/255)
            
            # Skip extreme dark/light
            if l < 0.1 or l > 0.95: continue
            
            if s < 0.20:
                greys.append((r, g, b, l))
            else:
                hue_idx = int(h * 36) % 36
                buckets[hue_idx].append((r, g, b, s, l))
                
    # Find the "Strongest" bucket
    best_bucket = -1
    max_strength = 0
    total_colored_pixels = 0
    
    for i in range(36):
        total_colored_pixels += len(buckets[i])
        # Strength = density * average saturation
        strength = sum(px[3] for px in buckets[i]) 
        if strength > max_strength:
            max_strength = strength
            best_bucket = i
            
    # CRITICAL: If the item is mostly grey (e.g. Gears, Steel), don't pick a "Dominant Hue"
    # If colored pixels are less than 15% of total solid pixels, or max strength is low
    if best_bucket != -1 and (total_colored_pixels > total_non_transparent * 0.15):
        # Average the top bucket
        b_pixels = buckets[best_bucket]
        avg_r = sum(p[0] for p in b_pixels) / len(b_pixels)
        avg_g = sum(p[1] for p in b_pixels) / len(b_pixels)
        avg_b = sum(p[2] for p in b_pixels) / len(b_pixels)
        
        # Boost to "Prime" visibility
        h, l, s = colorsys.rgb_to_hls(avg_r/255, avg_g/255, avg_b/255)
        s = min(1.0, s * 1.5) 
        l = 0.55 
        nr, ng, nb = colorsys.hls_to_rgb(h, l, s)
        return (int(nr*255), int(ng*255), int(nb*255)), total_non_transparent
        
    if greys:
        # Return a clean balanced grey for neutral items (Gears, Steel)
        # We ignore individual pixel tints and just use the average lightness
        avg_l = sum(p[3] for p in greys) / len(greys)
        l = 0.65 # Nice bright silver/grey for belts
        v = int(l * 255)
        return (v, v, v), total_non_transparent
        
    return None, total_non_transparent

def main():
    if not os.path.exists(SPRITE_PATH):
        print(f"Error: Sprite sheet not found at {SPRITE_PATH}")
        return

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    sprite = Image.open(SPRITE_PATH).convert("RGBA")
    log_lines = [f"Image Size: {sprite.width}x{sprite.height}"]
    
    colors = {}
    for item in data["items"]:
        idx = item["iconIndex"]
        sx = (idx % COLS) * ICON_SIZE
        sy = (idx // COLS) * ICON_SIZE
        
        # Check if crop is within bounds
        if sy + ICON_SIZE > sprite.height:
            log_lines.append(f"Error: Icon {idx} (Item: {item['name']}) is outside sprite sheet (Height: {sprite.height})")
            continue

        crop = sprite.crop((sx, sy, sx + ICON_SIZE, sy + ICON_SIZE))
        avg, non_trans = calculate_average_color(crop)
        
        if avg:
            # Convert to hex
            hex_color = "#{:02x}{:02x}{:02x}".format(*avg)
            colors[item["id"]] = hex_color
        else:
            log_lines.append(f"Warning: No valid pixels found for {item['name']} (ID: {item['id']}, Index: {idx}) - Non-trans count: {non_trans}")
            
    with open(OUTPUT_PATH, "w") as f:
        json.dump(colors, f, indent=2)
        
    with open("color_log.txt", "w") as f:
        f.write("\n".join(log_lines))
        f.write(f"\nDone! Calculated colors for {len(colors)} items.\n")
        
    print(f"Done! Check color_log.txt for details.")

if __name__ == "__main__":
    main()
