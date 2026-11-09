import os
import zipfile

builder_dir = r"C:\Users\Nicholas\.gemini\antigravity\scratch\Gravrust\builder"
zip_out = r"C:\Users\Nicholas\.gemini\antigravity\scratch\Gravrust\Gravrust-Builder-Windows.zip"

if os.path.exists(zip_out):
    os.remove(zip_out)

print(f"Creating {zip_out}...")
with zipfile.ZipFile(zip_out, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(builder_dir):
        # Do not include output/, work/, or __pycache__ in the release archive
        rel_root = os.path.relpath(root, builder_dir)
        parts = rel_root.split(os.sep)
        if any(p in ('output', 'work', '__pycache__') for p in parts):
            continue
        for file in files:
            if file.endswith('.pyc'):
                continue
            full_path = os.path.join(root, file)
            rel = os.path.relpath(full_path, builder_dir).replace('\\', '/')
            archive_path = f"Gravrust-Builder/{rel}"
            z.write(full_path, archive_path)

size = os.path.getsize(zip_out)
print(f"Successfully created Gravrust-Builder-Windows.zip ({round(size / 1024, 1)} KB, {round(size / (1024*1024), 2)} MB)")
