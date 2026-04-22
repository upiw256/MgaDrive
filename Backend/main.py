from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
import os
import shutil
import secrets
from datetime import datetime, timezone
from database import users_collection, files_collection, shared_links_collection
from models import UserCreate, Token, ShareCreate, ShareResponse
from auth import get_password_hash, verify_password, create_access_token, get_current_user
from utils.storage_utils import throttled_file_reader, get_user_storage_path
import logging
from time import time
from typing import Optional
import mimetypes
from bson import ObjectId

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("app.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("mgadrive")

app = FastAPI(title="Custom Drive API")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time()
    response = await call_next(request)
    process_time = time() - start_time
    logger.info(f"{request.method} {request.url.path} - Status: {response.status_code} - Time: {process_time:.4f}s")
    return response

# Base storage path
STORAGE_PATH = os.path.abspath("data")
if not os.path.exists(STORAGE_PATH):
    os.makedirs(STORAGE_PATH)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Inisialisasi Admin Default jika belum ada
    admin_user = await users_collection.find_one({"username": "admin"})
    if not admin_user:
        hashed_password = get_password_hash("admin123456")
        admin_data = {
            "username": "admin",
            "email": "admin@admin.com",
            "hashed_password": hashed_password,
            "is_admin": True,
            "quota_gb": 100.0,
            "used_bytes": 0,
            "download_limit_kbps": 10000, # 10MB/s for admin
            "upload_limit_kbps": 10000,
            "created_at": datetime.utcnow()
        }
        result = await users_collection.insert_one(admin_data)
        os.makedirs(os.path.join(STORAGE_PATH, str(result.inserted_id)), exist_ok=True)
        print("Default admin created: admin / admin123456")

@app.get("/health")
async def health_check():
    try:
        from database import client
        await client.admin.command('ping')
        return {"status": "online", "database": "connected"}
    except Exception as e:
        return {"status": "online", "database": "disconnected", "error": str(e)}

async def check_admin(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

@app.post("/register", response_model=Token)
async def register(user: UserCreate, admin: dict = Depends(check_admin)):
    try:
        existing_user = await users_collection.find_one({"username": user.username})
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already registered")
        
        hashed_password = get_password_hash(user.password)
        user_dict = user.dict()
        user_dict["hashed_password"] = hashed_password
        del user_dict["password"]
        user_dict["is_admin"] = False
        user_dict["quota_gb"] = 5.0
        user_dict["used_bytes"] = 0
        user_dict["download_limit_kbps"] = 500
        user_dict["upload_limit_kbps"] = 500
        user_dict["created_at"] = datetime.utcnow()
        
        result = await users_collection.insert_one(user_dict)
        user_id = str(result.inserted_id)
        
        user_storage = os.path.join(STORAGE_PATH, user_id)
        if not os.path.exists(user_storage):
            os.makedirs(user_storage)
        
        access_token = create_access_token(data={"sub": user.username})
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection error: {str(e)}")

@app.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await users_collection.find_one({"username": form_data.username})
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    user_data = current_user.copy()
    user_data["_id"] = str(user_data["_id"])
    del user_data["hashed_password"]
    return user_data

@app.get("/files")
async def list_files(path: str = "", current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    try:
        target_path = get_user_storage_path(STORAGE_PATH, user_id, path)
    except ValueError:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Path not found")
    
    items = []
    for entry in os.scandir(target_path):
        items.append({
            "name": entry.name,
            "is_dir": entry.is_dir(),
            "size": entry.stat().st_size if entry.is_file() else 0,
            "modified": datetime.fromtimestamp(entry.stat().st_mtime).isoformat()
        })
    
    return {"path": path, "items": items}

@app.post("/upload")
async def upload_files(
    path: str = Form(""),
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    try:
        target_dir = get_user_storage_path(STORAGE_PATH, user_id, path)
    except ValueError:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    uploaded_filenames = []
    for file in files:
        target_file_path = os.path.join(target_dir, file.filename)
        with open(target_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        uploaded_filenames.append(file.filename)
    
    return {"message": f"{len(uploaded_filenames)} files uploaded successfully", "filenames": uploaded_filenames}

@app.post("/folder")
async def create_folder(path: str = Form(""), name: str = Form(...), current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    try:
        parent_path = get_user_storage_path(STORAGE_PATH, user_id, path)
    except ValueError:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    new_folder_path = os.path.join(parent_path, name)
    if os.path.exists(new_folder_path):
        raise HTTPException(status_code=400, detail="Folder already exists")
    
    os.makedirs(new_folder_path)
    return {"message": "Folder created"}

@app.get("/download")
async def download_file(path: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    try:
        file_path = get_user_storage_path(STORAGE_PATH, user_id, path)
    except ValueError:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    if not os.path.exists(file_path) or os.path.isdir(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Speed limit dari database user
    speed_limit = current_user.get("download_limit_kbps", 500)
    
    # Detect MIME type
    mime_type, _ = mimetypes.guess_type(file_path)
    
    # Manual overrides for better browser compatibility
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.mov':
        mime_type = 'video/quicktime'
    elif ext == '.mp4':
        mime_type = 'video/mp4'
    
    if not mime_type:
        mime_type = "application/octet-stream"
    
    # Set disposition based on type (inline for media to allow browser preview)
    disposition = "inline" if mime_type.startswith(("image/", "video/", "audio/", "text/")) else "attachment"
    
    return StreamingResponse(
        throttled_file_reader(file_path, speed_limit_kbps=speed_limit),
        media_type=mime_type,
        headers={"Content-Disposition": f"{disposition}; filename={os.path.basename(file_path)}"}
    )

@app.delete("/files")
async def delete_item(path: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    try:
        target_path = get_user_storage_path(STORAGE_PATH, user_id, path)
    except ValueError:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Not found")
    
    if os.path.isdir(target_path):
        shutil.rmtree(target_path)
    else:
        os.remove(target_path)
    
    return {"message": "Deleted successfully"}
    
@app.get("/search")
async def search_files(q: str = "", file_type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    user_storage = os.path.join(STORAGE_PATH, user_id)
    
    if not q and not file_type:
        return {"query": q, "items": []}
        
    results = []
    
    # Define extensions for filtering
    type_map = {
        "image": {".jpg", ".jpeg", ".png", ".gif", ".webp"},
        "video": {".mp4", ".webm", ".mov", ".ogg"},
        "document": {".pdf", ".doc", ".docx", ".txt", ".xls", ".xlsx", ".ppt", ".pptx"}
    }
    
    # Walk the user's directory recursively
    for root, dirs, files in os.walk(user_storage):
        for name in files + dirs:
            # Match query if present
            match_query = q.lower() in name.lower() if q else True
            
            # Match type if present
            match_type = True
            if file_type and file_type in type_map:
                ext = os.path.splitext(name)[1].lower()
                match_type = ext in type_map[file_type]
            elif file_type == "folder":
                match_type = os.path.isdir(os.path.join(root, name))
            
            if match_query and match_type:
                full_path = os.path.join(root, name)
                # Calculate relative path from user root
                rel_path = os.path.relpath(full_path, user_storage).replace('\\', '/')
                is_dir = os.path.isdir(full_path)
                
                results.append({
                    "name": name,
                    "path": rel_path,
                    "is_dir": is_dir,
                    "size": os.path.getsize(full_path) if not is_dir else 0,
                    "modified": datetime.fromtimestamp(os.path.getmtime(full_path)).isoformat()
                })
                
                # Limit results to 100 for performance
                if len(results) >= 100:
                    break
        if len(results) >= 100:
            break
            
    return {"query": q, "type": file_type, "items": results}

# Sharing Endpoints
@app.post("/shares", response_model=ShareResponse)
async def create_share(share: ShareCreate, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    
    # Check if a link already exists for this path
    existing = await shared_links_collection.find_one({"owner_id": user_id, "target_path": share.path})
    
    if existing:
        link_id = existing["link_id"]
        update_data = {
            "allowed_users": share.allowed_users,
            "expires_at": share.expires_at,
            "title": share.title,
            "description": share.description,
            "updated_at": datetime.utcnow()
        }
        await shared_links_collection.update_one({"_id": existing["_id"]}, {"$set": update_data})
        # Refresh document
        doc = await shared_links_collection.find_one({"_id": existing["_id"]})
    else:
        link_id = secrets.token_urlsafe(16)
        doc = {
            "link_id": link_id,
            "owner_id": user_id,
            "target_path": share.path,
            "allowed_users": share.allowed_users,
            "created_at": datetime.utcnow(),
            "expires_at": share.expires_at,
            "title": share.title,
            "description": share.description
        }
        await shared_links_collection.insert_one(doc)
    
    return doc

@app.get("/shares/me")
async def list_my_shares(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    shares = await shared_links_collection.find({"owner_id": user_id}).to_list(100)
    for s in shares:
        s["_id"] = str(s["_id"])
    return shares

@app.delete("/shares/{link_id}")
async def delete_share(link_id: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    result = await shared_links_collection.delete_one({"link_id": link_id, "owner_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Link not found or permission denied")
    return {"message": "Share link revoked"}

# Public/Shared access endpoints (No get_current_user requirement, will check inside)
async def get_share_and_verify(link_id: str, request: Request):
    share = await shared_links_collection.find_one({"link_id": link_id})
    if not share:
        logger.warning(f"Shared link not found: {link_id}")
        raise HTTPException(status_code=404, detail="Share link not found")
    
    # Check expiration
    if share.get("expires_at"):
        if datetime.utcnow() > share["expires_at"]:
            logger.warning(f"Shared link expired: {link_id}")
            raise HTTPException(status_code=410, detail="Share link has expired")
            
    # Check permissions
    allowed_users = share.get("allowed_users")
    if allowed_users: # It's a private share
        logger.info(f"Checking access for private share: {link_id}, Allowed: {allowed_users}")
        # Try to get user from token
        try:
            current_user = await get_current_user(
                token_header=request.headers.get("Authorization"),
                token=request.query_params.get("token")
            )
            # Check if user is in allowed_users (check username and email)
            user_id_vals = [current_user["username"], current_user["email"]]
            if not any(u in allowed_users for u in user_id_vals):
                logger.warning(f"Access denied for user {current_user['username']} on share {link_id}")
                raise HTTPException(status_code=403, detail="You do not have permission to access this share")
            logger.info(f"Access granted to user {current_user['username']} for share {link_id}")
        except HTTPException as e:
            # Re-raise HTTP exceptions (like 403)
            raise e
        except Exception as e:
            logger.error(f"Authentication failed for share {link_id}: {str(e)}")
            raise HTTPException(status_code=401, detail="Authentication required for this share")
            
    return share

@app.get("/s/{link_id}", response_class=HTMLResponse)
async def share_preview_page(link_id: str, request: Request):
    share = await get_share_and_verify(link_id, request)
    
    title = share.get("title") or f"Shared Folder: {os.path.basename(share['target_path'])}"
    description = share.get("description") or "Check out this shared folder on MyCloud Storage."
    
    # We point back to the frontend URL for the actual app
    # In a real scenario, this would be your production domain
    # Use environment variable for frontend URL if available
    frontend_env = os.getenv("FRONTEND_URL")
    if frontend_env:
        frontend_url = f"{frontend_env.rstrip('/')}/s/{link_id}"
    else:
        # Fallback to dynamic detection
        host = request.base_url.hostname
        # If it's a domain name (contains dots and not an IP), don't add port 9001
        if "." in host and not host.replace(".", "").isdigit():
            frontend_url = f"{request.base_url.scheme}://{host}/s/{link_id}"
        else:
            frontend_url = f"{request.base_url.scheme}://{host}:9001/s/{link_id}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>{title}</title>
        <meta property="og:title" content="{title}" />
        <meta property="og:description" content="{description}" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="{frontend_url}" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta http-equiv="refresh" content="0; url={frontend_url}" />
    </head>
    <body>
        <p>Redirecting to share... <a href="{frontend_url}">Click here</a> if you are not redirected.</p>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@app.get("/s/{link_id}/files")
async def list_shared_files(link_id: str, request: Request, path: str = ""):
    share = await get_share_and_verify(link_id, request)
    owner_id = share["owner_id"]
    base_shared_path = share["target_path"]
    
    # Combine share target and requested sub-path
    full_sub_path = os.path.join(base_shared_path, path).replace('\\', '/').strip('/')
    
    try:
        target_path = get_user_storage_path(STORAGE_PATH, owner_id, full_sub_path)
    except ValueError:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Path not found")
        
    items = []
    for entry in os.scandir(target_path):
        items.append({
            "name": entry.name,
            "is_dir": entry.is_dir(),
            "size": entry.stat().st_size if entry.is_file() else 0,
            "modified": datetime.fromtimestamp(entry.stat().st_mtime).isoformat()
        })
        
    return {"name": os.path.basename(base_shared_path), "path": path, "items": items}

@app.get("/s/{link_id}/download")
async def download_shared_file(link_id: str, request: Request, path: str):
    share = await get_share_and_verify(link_id, request)
    owner_id = share["owner_id"]
    base_shared_path = share["target_path"]
    
    # Combine share target and requested sub-path
    full_sub_path = os.path.join(base_shared_path, path).replace('\\', '/').strip('/')
    
    try:
        file_path = get_user_storage_path(STORAGE_PATH, owner_id, full_sub_path)
    except ValueError:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    if not os.path.exists(file_path) or os.path.isdir(file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    # Get owner's speed limit, but cap it at 1024 Kbps (1 Mbps) for shared links
    owner = await users_collection.find_one({"_id": ObjectId(owner_id)})
    owner_speed_limit = owner.get("download_limit_kbps", 500) if owner else 500
    speed_limit = min(owner_speed_limit, 1024)
    
    mime_type, _ = mimetypes.guess_type(file_path)
    if not mime_type:
        mime_type = "application/octet-stream"
        
    disposition = "inline" if mime_type.startswith(("image/", "video/", "audio/", "text/")) else "attachment"
    
    return StreamingResponse(
        throttled_file_reader(file_path, speed_limit_kbps=speed_limit),
        media_type=mime_type,
        headers={"Content-Disposition": f"{disposition}; filename={os.path.basename(file_path)}"}
    )

async def check_admin(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Admin Routes
@app.get("/admin/users", dependencies=[Depends(check_admin)])
async def list_users():
    users = await users_collection.find().to_list(1000)
    for user in users:
        user["_id"] = str(user["_id"])
        if "hashed_password" in user:
            del user["hashed_password"]
    return users

@app.patch("/admin/users/{user_id}", dependencies=[Depends(check_admin)])
async def update_user(user_id: str, data: dict):
    try:
        # Filter allowed fields
        allowed_fields = ["quota_gb", "download_limit_kbps", "upload_limit_kbps", "is_admin"]
        update_data = {k: v for k, v in data.items() if k in allowed_fields}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid fields to update")
            
        await users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})
        return {"message": "User updated"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/admin/users/{user_id}", dependencies=[Depends(check_admin)])
async def delete_user(user_id: str):
    try:
        # Delete user files first
        user_path = os.path.join(STORAGE_PATH, user_id)
        if os.path.exists(user_path):
            shutil.rmtree(user_path)
            
        await users_collection.delete_one({"_id": ObjectId(user_id)})
        return {"message": "User deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/admin/logs", dependencies=[Depends(check_admin)])
async def get_logs():
    try:
        if not os.path.exists("app.log"):
            return {"logs": []}
        with open("app.log", "r") as f:
            # Ambil 100 baris terakhir
            lines = f.readlines()
            return {"logs": lines[-100:]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "Cloud Storage API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
