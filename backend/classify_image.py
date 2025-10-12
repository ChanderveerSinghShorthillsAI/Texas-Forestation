from ultralytics import YOLO
import os
import glob
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ==== CONFIG ====
IMAGE_DIR = os.getenv("YOLO_IMAGE_DIR", "/home/shtlp_0078/Desktop/Texas-Forestation/backend/Texas_satellite_images")  # Folder with images
OUT_DIR = os.getenv("YOLO_OUT_DIR", "/home/shtlp_0078/Desktop/Texas-Forestation/backend/yolo_results")  # Output folder
MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "/home/shtlp_0078/Desktop/Texas-Forestation/backend/runs/classify/train/weights/best.pt")  # Trained model

# ==== SETUP ====
os.makedirs(OUT_DIR, exist_ok=True)
model = YOLO(MODEL_PATH)  # Load trained model

output_csv_path = os.path.join(OUT_DIR, "grid_results.csv")

# ==== RUN INFERENCE ====
with open(output_csv_path, 'w') as results_csv:
    results_csv.write("index,cultivable,predicted_class,conf\n")  # Header

    # Support multiple image formats
    for image_path in glob.glob(f"{IMAGE_DIR}/*.*"):
        if image_path.lower().endswith(('.png', '.jpg', '.jpeg')):
            img_name = Path(image_path).name
            # Example: if filename = img_1234.png, index = 1234
            try:
                index = img_name.split('_')[1].split('.')[0]
            except IndexError:
                index = img_name  # fallback if unexpected naming

            # Perform classification
            pred = model(image_path, task="classify")[0]
            pred_label = pred.names[pred.probs.top1]
            conf = float(pred.probs.top1conf)

            # Binary cultivable flag
            cultivable = 1 if pred_label.lower() == "cultivable" else 0

            # Save to CSV
            results_csv.write(f"{index},{cultivable},{pred_label},{conf:.3f}\n")
            print(f"{img_name}: cultivable={cultivable}, class={pred_label}, conf={conf:.3f}")

print(f"✅ All predictions saved to {output_csv_path}")
