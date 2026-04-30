from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status


def _safe_relative_upload_path(subdir: str, filename: str) -> str:
    """Generate safe relative path - prevents path traversal attacks."""
    # Remove any path separators and parent directory references from subdir
    safe_subdir = (
        subdir.strip("/\\").replace("..", "").replace("/", "").replace("\\", "")
    )
    if not safe_subdir or safe_subdir in (".", ".."):
        raise ValueError(f"Invalid subdirectory: {subdir}")

    # Ensure filename is just the filename (no paths)
    safe_filename = Path(filename).name
    if not safe_filename or safe_filename in (".", ".."):
        raise ValueError(f"Invalid filename: {filename}")

    return f"/uploads/{safe_subdir}/{safe_filename}"


async def save_upload_file(
    *,
    file: UploadFile,
    upload_root: str,
    subdir: str,
    allowed_content_types: set[str],
    ext_map: dict[str, str],
    max_size_mb: int,
) -> str:
    if file.content_type not in allowed_content_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is required.",
        )

    max_bytes = max_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {max_size_mb} MB size limit.",
        )

    ext = ext_map[file.content_type]
    filename = f"{uuid.uuid4().hex}{ext}"

    target_dir = Path(upload_root) / subdir
    target_dir.mkdir(parents=True, exist_ok=True)
    (target_dir / filename).write_bytes(content)

    return _safe_relative_upload_path(subdir, filename)


def delete_uploaded_file(*, upload_root: str, public_path: str) -> None:
    """Delete uploaded file with path traversal protection."""
    if not public_path or not public_path.startswith("/uploads/"):
        return

    try:
        relative = public_path.removeprefix("/uploads/")
        # Prevent traversal with ".."
        if ".." in relative or relative.startswith("/"):
            return

        file_path = (Path(upload_root) / relative).resolve()
        root = Path(upload_root).resolve()

        # Verify file is within upload directory
        if not str(file_path).startswith(str(root)):
            return

        if file_path.exists() and file_path.is_file():
            file_path.unlink(missing_ok=True)
    except (ValueError, OSError):
        # Silently ignore invalid paths
        pass
