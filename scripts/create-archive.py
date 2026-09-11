import os
import zipfile
import sys

def make_archive():
    project_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    output_zip = os.path.abspath(os.path.join(project_dir, '..', 'abyss-project.zip'))

    exclude_dirs = {
        'node_modules',
        '.next',
        '.vinext',
        '.wrangler',
        'dist',
        'dist-static',
        'outputs',
        'work',
    }
    exclude_files = {
        'abyss-project.zip',
        'tsconfig.tsbuildinfo',
    }

    print(f"Archiving from: {project_dir}")
    print(f"Creating zip at: {output_zip}")

    total_files = 0
    with zipfile.ZipFile(output_zip, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for root, dirs, files in os.walk(project_dir):
            # Exclude specified directories in-place so os.walk does not descend into them
            dirs[:] = [d for d in dirs if d not in exclude_dirs]

            for file in files:
                if file in exclude_files or file.endswith('.tsbuildinfo'):
                    continue

                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, project_dir)

                # Normalize to forward slashes inside the zip
                zip_path = rel_path.replace(os.sep, '/')
                zf.write(abs_path, zip_path)
                total_files += 1

    size_mb = os.path.getsize(output_zip) / (1024 * 1024)
    print(f"Archive successfully created: {output_zip}")
    print(f"Total files archived: {total_files}")
    print(f"Archive size: {size_mb:.2f} MB")

if __name__ == '__main__':
    make_archive()
