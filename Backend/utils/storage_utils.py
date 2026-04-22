import os
import asyncio
from typing import AsyncGenerator

async def throttled_file_reader(path: str, chunk_size: int = 1024 * 64, speed_limit_kbps: int = 0) -> AsyncGenerator[bytes, None]:
    """
    Reads a file and yields chunks. The speed limit parameter is kept for compatibility
    but the throttling logic is removed to allow maximum speed.
    """
    with open(path, "rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            yield chunk

def get_user_storage_path(base_path: str, user_id: str, sub_path: str = ""):
    """
    Constructs and validates the user storage path to prevent directory traversal.
    """
    user_root = os.path.join(base_path, user_id)
    # Sanitize sub_path
    sub_path = sub_path.lstrip("/")
    target_path = os.path.abspath(os.path.join(user_root, sub_path))
    
    # Check if target_path is within user_root
    if not target_path.startswith(os.path.abspath(user_root)):
        raise ValueError("Invalid path access")
        
    return target_path
