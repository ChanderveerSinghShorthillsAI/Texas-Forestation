import pandas as pd
import os

# Path to your indexed CSV
csv_path = '/home/shtlp_0078/Desktop/Texas-Forestation/frontend/src/data/texas_grid_cells.csv'  # Should have columns: index, min_lng, min_lat, max_lng, max_lat
img_dir = '/home/shtlp_0078/Desktop/Texas-Forestation/backend/Texas_satellite_images'

# 1. Read the CSV, create a mapping: (center_lat, center_lng) -> index
df = pd.read_csv(csv_path)
latlng_to_idx = {}
for _, row in df.iterrows():
    # Calculate grid center and round to 5 decimals (like your filenames)
    center_lat = round((row['min_lat'] + row['max_lat']) / 2, 5)
    center_lng = round((row['min_lng'] + row['max_lng']) / 2, 5)
    latlng_to_idx[(center_lat, center_lng)] = int(row['index'])

# 2. Rename files in the sat_images/ folder
for fname in os.listdir(img_dir):
    if fname.startswith("grid_") and fname.endswith(".png"):
        try:
            parts = fname.replace(".png", "").split("_")
            lat = round(float(parts[1]), 5)
            lng = round(float(parts[2]), 5)
            idx = latlng_to_idx.get((lat, lng))
            if idx is not None:
                src = os.path.join(img_dir, fname)
                dst = os.path.join(img_dir, f"grid_{idx}.png")
                os.rename(src, dst)
                print(f"Renamed {fname} --> grid_{idx}.png")
            else:
                print(f"WARNING: No index found for {fname} ({lat}, {lng})")
        except Exception as e:
            print(f"Error renaming {fname}: {e}")