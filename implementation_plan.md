# Implementation Plan - Multi-file Download and Speed Limit Removal

This plan addresses the user's request to enable multi-file downloads and remove existing speed limits.

## Proposed Changes

### Backend

#### [MODIFY] [storage_utils.py](file:///d:/MgaDrive/backend/utils/storage_utils.py)
- Simplify `throttled_file_reader` to remove the `asyncio.sleep` delay, effectively removing the speed limit mechanism.

#### [MODIFY] [main.py](file:///d:/MgaDrive/backend/main.py)
- Remove `download_limit_kbps` fetching and usage in `/download` and shared download endpoints.
- [NEW] Add `/download-batch` POST endpoint:
    - Inputs: `paths: List[str]`
    - Action: Zips the requested files (and potentially folders) into a single archive using `zipfile` and `io.BytesIO`.
    - Output: `StreamingResponse` with the ZIP file content.

### Frontend

#### [MODIFY] [Dashboard.jsx](file:///d:/MgaDrive/frontend/src/pages/Dashboard.jsx)
- Add state for `selectedItems` (Set or Array).
- Implement selection logic:
    - Add checkboxes to grid and list items.
    - Add "Select All" functionality.
- Add "Download Selected" button in the actions bar (only visible when items are selected).
- Update UI to show selection state visually.
- Fix mobile overflow issues:
    - Ensure filter bars and action buttons wrap or scroll correctly without exceeding screen width.
    - Add horizontal scrolling to tables or switch to card view for small screens.
    - Adjust padding and container widths for mobile devices.

#### [MODIFY] [SharedFolder.jsx](file:///d:/MgaDrive/frontend/src/pages/SharedFolder.jsx)
- Similar selection and multi-download logic for shared folders.

## Open Questions
- Should we allow downloading entire folders via the batch download? (Zipping folders recursively might take time/CPU).
- Is there a preferred maximum size for the generated ZIP file before we should warn the user?

## Verification Plan

### Automated Tests
- Test `/download-batch` with multiple file paths to ensure ZIP is valid.
- Verify download speed is no longer throttled by comparing download time for a large file before and after.

### Manual Verification
- Select multiple files in the Dashboard and click "Download".
- Verify that a ZIP file is downloaded containing all selected files.
- Verify selection state is cleared after download or via "Cancel" button.
- Check the UI on mobile viewport (or actual mobile device) to ensure no horizontal overflow occurs.
