# Phase 7: Advanced UX Features (Refined)

Based on your feedback, I am refining the plan to focus on account-wide search and a high-density list view.

## User Review Required

> [!IMPORTANT]
> **Account-Wide Search**: I will implement a new backend endpoint `/search` that allows you to find any file in your entire storage account, regardless of which folder you currently are in. This will be an "instant search" (real-time).
> **List View**: As requested, the list view will use generic icons instead of thumbnails to maintain high density and focus on details (size, date).

## Proposed Changes

### Backend Enhancements

#### [MODIFY] [main.py](file:///d:/MgaDrive/backend/main.py)
- **New Endpoint `/search`**:
    - Takes a `q` (query) parameter and optional `type` filter.
    - Walks the user's root storage directory recursively.
    - Returns a list of matching file objects including their relative path.

---

### Dashboard UX Updates

#### [MODIFY] [Dashboard.jsx](file:///d:/MgaDrive/Frontend/src/pages/Dashboard.jsx)
- **Search Integration**:
    - Add a search input that triggers the `/search` endpoint (with debouncing for performance).
    - When searching, the usual folder grid/list is replaced by "Search Results".
    - Clicking a search result will open that file (preview) or navigate to its parent folder.
- **View Toggle & List View**:
    - Implement the toggle between 'grid' and 'list'.
    - **List View**: A professional table layout.
        - Columns: Icon, Name, Size, Modified Date, Actions.
        - No thumbnails in list view (as requested).
- **Filter Implementation**:
    - Filters (Images, Videos, Docs) will work globally during search or locally within the current folder.

## Open Questions

- Should we allow "Go to folder" from search results? (Useful for finding context).
- For the "instant search", I will use a 300ms debounce. Is that responsive enough?

## Verification Plan

### Manual Verification
- **Global Search**: Search for a file known to be in a subfolder from the root and verify it appears.
- **List Mode**: Switch to list mode and verify it looks clean and high-density with icons.
- **Filtering**: Verify filters correctly narrow down both the current folder items and global search results.
