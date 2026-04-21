# Folder Sharing & Access Control

This plan outlines the steps required to implement an advanced folder sharing feature for MgaDrive. Users will be able to generate unique links for specific folders, control who can access the link (e.g., specific users or anyone with the link), and ensure that viewers only see the contents of that specific folder and not the parent folders.

## User Review Required

> [!IMPORTANT]
> - Do you want users to be identified by their **username** or their **email** when configuring specific access permissions? (e.g. typing a friend's email address to give them access).
> - Should we enforce expiration dates on these links, or can they be permanent unless manually revoked?
> - Let me know if you agree with adding a new generic public route (`/s/:link_id`) in the frontend for people visiting the shared link.

## Proposed Changes

---

### Database Setup

#### [MODIFY] Backend/database.py
- Add `shared_links_collection = db.get_collection("shared_links")` to define the new database collection that holds the share configurations.

#### [MODIFY] Backend/models.py
- Add new Pydantic models: `ShareCreate` (target path, allowed users, visibility preference) and `ShareResponse` (with generated `link_id`).
- Define the schema for database insertion (link ID, owner ID, target path, allowed users list, timestamps).

---

### Backend API Endpoints

#### [MODIFY] Backend/main.py
- **`POST /api/shares`**: Create or update share settings for a folder. Generates a unique, URL-safe `link_id`.
- **`GET /api/shares/me`**: List all links that the currently logged-in user has shared.
- **`DELETE /api/shares/{link_id}`**: Delete/revoke an existing shared link.
- **`GET /api/s/{link_id}/files`**: Used by the generic share link page to fetch the shared folder's contents and subdirectories. This endpoint will:
  - Check if the link exists.
  - If `allowed_users` is specified, verify that the requester is authenticated and is in the allowed list.
  - Safely list files only *within* the original `target_path`.
- **`GET /api/s/{link_id}/download`**: Securely stream files from within the shared folder, using the same permission checks.

---

### Frontend UI Updates

#### [MODIFY] Frontend/src/App.jsx
- Add a new react-router route `/s/:link_id` pointing to the new `SharedFolder` component. 

#### [NEW] Frontend/src/pages/SharedFolder.jsx
- A new standalone page tailored for viewing shared links.
- Will display the contents of the share based on the `link_id` in the URL.
- Handles scenarios where access is denied (asking the user to log in if it's a private share).
- Restricts actions to merely viewing and downloading files (hides upload/delete controls).

#### [MODIFY] Frontend/src/pages/Dashboard.jsx
- Add a "Share" action button next to folders (and optionally files).
- Introduce a "Share Modal" component allowing the folder owner to:
  - Toggle between "Public/Anyone with link" and "Specific People".
  - Input emails/usernames of specific people.
  - Copy the generated `http://.../s/{link_id}` URL directly to the clipboard.
  - Modify or revoke access directly from the same modal.

## Open Questions

1. Do you want to support sharing specific **files** as well, or exclusively limit this feature to **folders** for now?
2. If an anonymous user tries to access a private link, should we redirect them automatically to the `/login` page with a return URL, or just show an "Access Denied, please log in" message?

## Verification Plan

### Automated Tests
- N/A

### Manual Verification
1. Log in as User A and create a new folder "Public Share".
2. Share the folder with the "Anyone with link" setting.
3. Open a completely incognito window (unauthenticated) and navigate to the link. Ensure the contents of "Public Share" are visible.
4. Attempt to navigate *up* the directory tree or request files outside the sub-folder bounds using direct API calls.
5. Change the share setting to "Specific People" and add User B.
6. Verify User B can see the folder contents. Verify all other users (and anonymous users) get an access denied error.
