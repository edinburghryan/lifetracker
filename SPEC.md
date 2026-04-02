# LifeTracker — Product Specification v1

## 1. Product Overview

A minimalist shared task management web app for Ryan (RC) and Ly (LC) Crawford.
Inspired by Wunderlist. Focused on effortless capture, visual organisation via colour-coded groups, and simple prioritisation via starring and deadline auto-promotion.

**Design principle:** *"Do not make users think."*

### 1.1 Technical Summary

| Concern     | Choice                                                 |
| ----------- | ------------------------------------------------------ |
| Frontend    | Static HTML / CSS / JS — no framework (v1)             |
| Hosting     | GitHub Pages (`edinburghryan.github.io/lifetracker`) |
| Database    | Firebase Firestore (Spark / free plan)                 |
| Auth        | Per-user PIN (RC and LC each have their own)           |
| Drag & Drop | SortableJS (lightweight, no dependencies)              |
| Dark Mode   | Toggle, persisted per-device in localStorage           |

---

## 2. Access & Identity

### 2.1 PIN Gate + Identity
- Each user has their own PIN. Entering a PIN both authenticates and identifies the user.
- Two PINs stored in Firestore (as hashes): one mapped to **RC**, one mapped to **LC**.
- On first visit (or after session expiry), user enters their PIN → app resolves identity automatically.
- Session (identity) persisted in localStorage so users don't re-enter the PIN on every visit.
- Both users have identical permissions — PINs exist for attribution, not access control.

---

## 3. Core Concepts

### 3.1 Groups

User-defined containers for tasks. Colour-coded for quick visual identification.

**Properties:**

| Field | Type | Notes |
|-------|------|-------|
| id | string | Firestore document ID |
| name | string | User-defined label |
| color | string | Hex colour, chosen from pastel palette |
| order_index | number | Position in the group list |
| is_collapsed | boolean | Expand/collapse state |
| created_at | timestamp | |

**Behaviour:**
- Can be created, renamed, recoloured, reordered (drag-and-drop), and deleted.
- Cannot be moved above the Top Priority system group.
- Expand/collapse toggle persists.

---

### 3.2 Tasks

Tasks belong to exactly one group.

**Properties:**

| Field | Type | Notes |
|-------|------|-------|
| id | string | Firestore document ID |
| title | string | Required |
| description | string | Optional free text |
| due_date | date \| null | Optional deadline |
| is_starred | boolean | Manual priority flag |
| group_id | string | FK to parent group |
| order_index | number | Position within group |
| created_by | string | `"RC"` or `"LC"` |
| created_at | timestamp | |
| completed | boolean | Default `false` |
| completed_at | timestamp \| null | Set when marked done |
| deleted | boolean | Default `false` |
| deleted_at | timestamp \| null | Set when soft-deleted |

---

### 3.3 Top Priority Group (System Group)

A system-generated, non-editable group pinned to the top of the UI.

**Includes (union of):**
- All tasks where `is_starred = true`
- All tasks where `due_date` is within the next 7 days (inclusive) and `due_date` is not in the past

**Behaviour:**
- This is a **view-layer projection** — tasks are not moved out of their original group.
- Tasks appear in Top Priority AND in their original group simultaneously.
- Default sort: tasks with a due date first (soonest at top), then by creation date (newest first).
- Manual drag-and-drop reordering is supported within Top Priority (overrides default sort for that session/until list changes).

**Auto-promotion (due-soon) rules:**
- Auto-promoted tasks cannot be manually dismissed from Top Priority — they remain until completed, or until their due date passes.
- Manually starred tasks can be un-starred to remove them from Top Priority.
- This ensures deadlines act as non-ignorable reminders.

---

### 3.4 Completed Section

A collapsible section at the bottom of the UI showing all completed tasks.

**Behaviour:**
- Tasks marked as done move here, displayed greyed out.
- Grouped by completion date (most recent first).
- A task can be restored (un-completed) — it returns to its original group.
- Retains the colour indicator of its origin group.

---

### 3.5 Recycle Bin

A separate view/section for soft-deleted tasks.

**Behaviour:**
- Deleted tasks are soft-deleted (`deleted = true`, `deleted_at = now`).
- Visible in the Recycle Bin for 30 days.
- Can be restored (un-deleted) within that window — returns to original group.
- After 30 days, permanently removed (Firestore TTL or scheduled cleanup).

---

## 4. Key Interactions

### 4.1 Task Creation
- Inline text input at the bottom of each group.
- Press **Enter** to create task and auto-focus a new input for rapid entry.
- New task attributed to the current identity (RC/LC).

### 4.2 Task Completion
- Checkbox on the **left** side of the task.
- Clicking it marks the task as `completed = true` and moves it to the Completed section.

### 4.3 Star / Promote
- Star icon on the **right** side of the task.
- Clicking toggles `is_starred`.
- Starred tasks immediately appear in the Top Priority group.

### 4.4 Drag & Drop
- **Reorder tasks** within a group.
- **Move tasks** between groups (updates `group_id`).
- **Reorder groups** (cannot move above Top Priority).
- **Reorder tasks** within Top Priority (overrides default sort).

### 4.5 Task Detail View
- Click/tap a task to open a detail panel (slide-in or modal).
- Editable fields:
  - **Title** (inline)
  - **Description** (free text area)
  - **Due date** (date picker)
- Shows created-by badge (RC/LC) and creation date.
- Delete button (sends to Recycle Bin).

### 4.6 Group Management
- Add new group: button/input at the bottom of the group list.
- Edit group: click group header to rename; colour picker to change colour.
- Delete group: confirmation prompt → all tasks in group move to Recycle Bin.

---

## 5. Visual Design

### 5.1 Colour Palette (Pastel)

Groups choose from a curated palette of soft, pastel colours with good text contrast. Example palette:

| Name | Header (solid) | Task tint (light) |
|------|----------------|-------------------|
| Rose | `#E8A0A0` | `#FDF0F0` |
| Peach | `#E8C4A0` | `#FDF5F0` |
| Sand | `#E8D8A0` | `#FDFAF0` |
| Sage | `#A0D8A0` | `#F0FDF0` |
| Sky | `#A0C4E8` | `#F0F5FD` |
| Lavender | `#C4A0E8` | `#F5F0FD` |
| Slate | `#A0B8C8` | `#F0F4F8` |
| Blush | `#E8A0C4` | `#FDF0F5` |

### 5.2 Group Styling
- **Group header:** Solid colour from palette, white text, group name.
- **Tasks within group:** Light tinted background matching group colour.

### 5.3 Top Priority Styling
- **Task background:** Neutral white/light grey.
- **Origin indicator:** Small colour square (matching origin group colour) next to the star icon.

### 5.4 Task Row Layout

```
[✓] Task title                        [RC] [■] [★]
 ^                                      ^    ^   ^
 checkbox                          creator  group star
                                   badge  colour
```

### 5.5 Dark Mode
- Toggle switch in the header/settings area.
- Inverted colour scheme: dark backgrounds, lighter text.
- Group colours adjust to muted/darker variants for dark mode.
- Preference stored in localStorage (per device).

### 5.6 Responsive Design
- Mobile-first layout — works on phone screens.
- Single-column layout on narrow screens.
- Touch-friendly tap targets (minimum 44px).
- Drag-and-drop works on touch devices (SortableJS supports this).

---

## 6. Data Architecture (Firestore)

### 6.1 Collections

```
/config
  /app          → { pins: { rc_hash: string, lc_hash: string } }

/groups
  /{groupId}    → { name, color, order_index, is_collapsed, created_at }

/tasks
  /{taskId}     → { title, description, due_date, is_starred, group_id,
                     order_index, created_by, created_at, completed,
                     completed_at, deleted, deleted_at }
```

### 6.2 Firestore Security Rules (v1 — simple)

- Read/write allowed only when request contains a valid session token (or we rely on the PIN gate being client-side only for v1, with Firestore rules open to authenticated-ish requests).
- **Pragmatic v1 approach:** Since there's no sensitive data and only two users, we can use moderately open rules with the PIN as a social gate. We'll tighten this if needed.

---

## 7. Out of Scope (v1)

- Subtasks
- Recurring tasks
- Tags / filters / custom views
- Notifications / push alerts
- Offline support (beyond localStorage session)
- User accounts / OAuth
- Native mobile app

---

## 8. Future Considerations (v2+)

- Subtasks and checklists within tasks
- Recurring task templates ("Take bins out every Tuesday")
- Smart lists (Today, This Week)
- Undo/redo for recent actions
- Richer Firestore security rules
- PWA for mobile home-screen install
