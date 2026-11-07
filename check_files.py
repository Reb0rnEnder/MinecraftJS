#!/usr/bin/env python3
import os
import subprocess

os.chdir(r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust")

# Get all JS files tracked by git
result = subprocess.run(["git", "ls-files", "*.js"], capture_output=True, text=True)
js_files = result.stdout.strip().split("\n")
print(f"Total JS files in git: {len([f for f in js_files if f])}")

# Count Rust files
rust_result = subprocess.run(["git", "ls-files", "rust"], capture_output=True, text=True)
rust_files = rust_result.stdout.strip().split("\n")
print(f"Rust files in git: {len([f for f in rust_files if f])}")

# Count JS files
js_files = [f for f in js_files if f]
print(f"Total JS files in git: {len(js_files)}")

# List them
for f in sorted(js_files):
    print(f)