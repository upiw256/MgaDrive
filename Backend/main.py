from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
import os
import shutil
from datetime import datetime
from database import users_collection, files_collection
from models import UserCreate, Token
from auth import get_password_hash, verify_password, create_access_token, get_current_user
from utils.storage_utils import throttled_file_reader, get_user_storage_path
import logging
from time import time
from typing import Optional
import mimetypes

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
async def upload_file(
    path: str = Form(""),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])
    try:
        target_dir = get_user_storage_path(STORAGE_PATH, user_id, path)
    except ValueError:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    target_file_path = os.path.join(target_dir, file.filename)
    
    with open(target_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"message": "File uploaded successfully", "filename": file.filename}

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
    from bson import ObjectId
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
    from bson import ObjectId
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
