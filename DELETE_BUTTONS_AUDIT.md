# 🗑️ ViralFabrics — Delete Buttons Audit

> **Generated:** 2026-06-08  
> **Scope:** All pages, modules, sub-modules, modals, and forms across the entire app  
> **Purpose:** Complete inventory of every delete/remove button in the application

---

## Table of Contents

1. [Orders Module](#1-orders-module)
2. [Fabrics Module](#2-fabrics-module)
3. [Sampling Module](#3-sampling-module)
4. [Users Module](#4-users-module)
5. [API Delete Routes](#5-api-delete-routes)
6. [Summary Table](#6-summary-table)

---

## 1. Orders Module

**Page:** `app/(pages)/(dashboard)/orders/`

### 1.1 OrdersClient.tsx (Orders List Page)

| # | Button | Handler | Location | Description |
|---|--------|---------|----------|-------------|
| 1 | **Delete Order** | `handleDeleteClick(order)` | Each order row/card — Desktop view (line ~7422) | Opens delete confirmation modal to soft-delete a single order |
| 2 | **Delete Order** | `handleDeleteClick(order)` | Each order row/card — Mobile view (line ~8005) | Same as above, mobile responsive layout |
| 3 | **Delete Order Item** | `handleDeleteItemClick(orderId, index, itemName)` | Each item row inside an order — Desktop view (line ~7191) | Deletes a single item from an order |
| 4 | **Delete Order Item** | `handleDeleteItemClick(orderId, index, itemName)` | Each item row inside an order — Mobile view (line ~7793) | Same as above, mobile responsive layout |
| 5 | **Delete All Orders** | `handleDeleteAllOrders()` | Header toolbar (line ~4004) | Bulk deletes ALL orders (admin-level action) |
| 6 | **Confirm Delete** | `handleDeleteConfirm()` | Delete confirmation modal (line ~9157) | Confirms and executes the delete action |
| 7 | **Cancel Delete** | `handleDeleteCancel()` | Delete confirmation modal (line ~9109) | Cancels the delete action |

### 1.2 OrderForm.tsx (Create/Edit Order Form)

| # | Button | Handler | Location | Description |
|---|--------|---------|----------|-------------|
| 1 | **Remove Item** | `removeItem(index)` | Each order item section (line ~3643) | Removes an item row from the order form |
| 2 | **Remove Image** | `removeImage(itemIndex, imageIndex)` | Image thumbnail in item section (line ~877 via `onRemoveImage`) | Removes an uploaded/pending image from an order item |
| 3 | **Delete Party** | `handleDeleteParty(party)` | Party dropdown — delete icon on each option (line ~3007 via `onDelete`) | Deletes a party from the database directly from the dropdown |
| 4 | **Delete Quality** | `handleDeleteQuality(quality)` | Quality dropdown — delete icon on each option (line ~3249 via `onDelete`) | Deletes a quality from the database directly from the dropdown |

### 1.3 MillInputForm.tsx (Mill Input Modal)

| # | Button | Handler | Location | Description |
|---|--------|---------|----------|-------------|
| 1 | **Delete All Mill Inputs** | `handleDeleteClick()` | Modal header/footer — Delete button (line ~4052) | Opens confirmation to delete all mill input data for the order |
| 2 | **Confirm Delete All** | `handleDelete()` | Delete confirmation dialog (line ~4217) | Executes bulk delete of all mill inputs |
| 3 | **Delete Mill** | `handleDeleteMillClick(mill)` | Mill dropdown — delete icon on each option (line ~3357 via `onDelete`) | Deletes a mill from the database directly from the dropdown |
| 4 | **Remove Additional Meters** | `removeAdditionalMeters(itemId, index)` | Additional meters row — × button (line ~3970) | Removes an additional meter entry from an item |

### 1.4 MillOutputForm.tsx (Mill Output Modal)

| # | Button | Handler | Location | Description |
|---|--------|---------|----------|-------------|
| 1 | **Delete All Mill Outputs** | `handleDeleteClick()` | Modal header/footer — Delete button (line ~2490) | Opens confirmation to delete all mill output data for the order |
| 2 | **Confirm Delete All** | `handleDelete()` | Delete confirmation dialog (line ~2578) | Executes bulk delete of all mill outputs |
| 3 | **Remove Additional Finished Meters** | `removeAdditionalFinishedMtr(itemId, index)` | Additional finished meters row — × button (line ~2408) | Removes an additional finished meter entry from an item |

### 1.5 DispatchForm.tsx (Dispatch Modal)

| # | Button | Handler | Location | Description |
|---|--------|---------|----------|-------------|
| 1 | **Delete All Dispatches** | `handleDeleteClick()` | Modal header/footer — Delete button (line ~2635) | Opens confirmation to delete all dispatch data for the order |
| 2 | **Confirm Delete All** | `handleDelete()` | Delete confirmation dialog (line ~2723) | Executes bulk delete of all dispatches |
| 3 | **Remove Sub-Item** | `removeSubItem(itemId, subItemId)` | Sub-item row — × button (line ~2536) | Removes a sub-item from a dispatch entry |

### 1.6 LabDataModal.tsx (Lab Data Modal)

| # | Button | Handler | Location | Description |
|---|--------|---------|----------|-------------|
| 1 | **Delete Lab Data Item** | `handleDeleteClick(itemId)` | Each lab data row (line ~1247) | Opens confirmation to delete a single lab data item |
| 2 | **Confirm Delete Item** | `handleDelete()` | Delete confirmation dialog (line ~1433) | Executes the single lab data item delete |
| 3 | **Delete All Lab Data** | `handleDeleteAllClick()` | Modal header — Delete All button (line ~1144) | Opens confirmation to delete ALL lab data for the order |
| 4 | **Confirm Delete All** | `handleDeleteAll()` | Delete All confirmation dialog (line ~1538) | Executes bulk delete of all lab data |

### 1.7 GreyInformationModal.tsx (Grey Information Modal)

| # | Button | Handler | Location | Description |
|---|--------|---------|----------|-------------|
| 1 | **Remove Entry** | `handleRemoveEntry(entryId)` | Each grey info row — × button (line ~1730) | Removes a grey information entry from the form (local only, before save) |
| 2 | **Delete All Grey Info** | `handleDeleteAll()` | Modal header — Delete All button (line ~2025) | Deletes ALL grey information entries for the order from the database |

---

## 2. Fabrics Module

**Page:** `app/(pages)/(dashboard)/fabrics/`

### 2.1 Fabrics List Page (page.tsx)

| # | Button | Handler | Location | Description |
|---|--------|---------|----------|-------------|
| 1 | **Delete Fabric** | `handleDelete(fabric)` | Each fabric card — Desktop view (line ~4451) | Opens delete confirmation to soft-delete a single fabric |
| 2 | **Delete Fabric** | `handleDelete(fabric)` | Each fabric card — Mobile/list view (line ~5214) | Same as above, mobile layout |
| 3 | **Delete All (Quality Group)** | `handleDeleteQualityGroup(mainFabric, fabrics)` | Quality group header — Desktop view (line ~4671) | Deletes ALL fabrics in a quality group |
| 4 | **Delete All (Quality Group)** | `handleDeleteQualityGroup(mainFabric, fabrics)` | Quality group header — Mobile view (line ~5275) | Same as above, mobile layout |
| 5 | **Confirm Delete** | `confirmDelete()` | `<DeleteConfirmation>` modal (line ~5403) | Executes the delete action |
| 6 | **Delete from Details** | `handleDelete(fabric)` via `onDelete` | `<FabricDetails>` component — (line ~5381) | Delete button inside the fabric detail view |

### 2.2 FabricDetails.tsx (Fabric Detail Side Panel)

| # | Button | Handler | Location | Description |
|---|--------|---------|----------|-------------|
| 1 | **Delete Fabric** | `onDelete(item)` | Detail panel — TrashIcon button (line ~390) | Calls parent `onDelete` to trigger delete confirmation |

### 2.3 CreateFabric.tsx (Create/Edit Fabric Form)

| # | Button | Handler | Location | Description |
|---|--------|---------|----------|-------------|
| 1 | **Remove Weaver/Item** | `removeItem(index)` | Each weaver item row — × button (line ~2404) | Removes a weaver item from the fabric form |
| 2 | **Remove Image** | `removeImage(imageIndex)` | Uploaded image thumbnail — × button (line ~2298) | Removes an uploaded image |
| 3 | **Remove Image (Pending)** | `removeImage(displayIndex)` | Pending image thumbnail — × button (line ~2358) | Removes a pending (not yet uploaded) image |

### 2.4 DeleteConfirmation.tsx (Reusable Delete Confirmation Modal)

| # | Button | Handler | Location | Description |
|---|--------|---------|----------|-------------|
| 1 | **Confirm Delete** | `onConfirm()` | Modal footer — Delete button with TrashIcon (line ~280) | Confirms and triggers the actual delete operation |
| 2 | **Cancel** | `onCancel()` | Modal footer — Cancel button | Cancels the delete |

---

## 3. Sampling Module

**Page:** `app/(pages)/(dashboard)/sampling/`

### 3.1 Sampling List Page (page.tsx)

| # | Button | Handler | Location | Description |
|---|--------|---------|----------|-------------|
| 1 | **Delete Weaver** | `handleDeleteWeaver(id, name)` | Weaver card — Delete button — Desktop (line ~2649) | Opens confirmation to delete a weaver and all its samples |
| 2 | **Delete Weaver** | `handleDeleteWeaver(id, name)` | Weaver card — Delete button — Mobile (line ~2904) | Same as above, mobile layout |
| 3 | **Confirm Delete Weaver** | `confirmDeleteWeaver()` | Delete confirmation modal (line ~3354) | Executes the weaver delete (+ all samples via atomic transaction) |
| 4 | **Delete Sample** | `handleDeleteSample(id, name)` | Sample detail view — Delete button (line ~3226) | Opens confirmation to delete a single sample |
| 5 | **Delete Sample (from form)** | `handleDeleteSample(sampleId)` | `<SampleForm>` `onDelete` callback (line ~2962) | Triggered from within the SampleForm edit modal |
| 6 | **Confirm Delete Sample** | `confirmDeleteSample()` | Delete confirmation modal (line ~3356) | Executes the sample delete |
| 7 | **Delete All (Weaver group)** | Click triggers `handleDeleteWeaver` | Weaver card — "Delete All" label — Desktop (line ~2659) | Same as weaver delete, deletes weaver + all samples |
| 8 | **Delete All (Weaver group)** | Click triggers `handleDeleteWeaver` | Weaver card — "Delete All" label — Mobile (line ~2914) | Same as above, mobile layout |

### 3.2 Weaver Samples View (view/[weaverId]/page.tsx)

| # | Button | Handler | Location | Description |
|---|--------|---------|----------|-------------|
| 1 | **Delete Sample** | `handleDeleteSample(id, name)` | Sample card — TrashIcon button — Desktop (line ~1502) | Opens confirmation to delete a single sample |
| 2 | **Delete Sample** | `handleDeleteSample(id, name)` | Sample card — TrashIcon button — Mobile (line ~1582) | Same as above, mobile responsive |
| 3 | **Confirm Delete Sample** | `confirmDeleteSample()` | Delete confirmation modal (line ~2270) | Executes the single sample delete |
| 4 | **Delete All Samples** | `handleDeleteAllSamples()` | Header — Delete All button — Desktop (≥400px) (line ~1237) | Opens confirmation to delete ALL samples for a weaver |
| 5 | **Delete All Samples** | `handleDeleteAllSamples()` | Header — Delete All button — Mobile (<400px) (line ~1295) | Same as above, small screen layout |
| 6 | **Confirm Delete All Samples** | `confirmDeleteAllSamples()` | Delete All confirmation modal (line ~2370) | Executes the bulk delete of all samples |
| 7 | **Delete from SampleForm** | `handleDeleteSample(sampleId)` via `onDelete` | `<SampleForm>` `onDelete` callback (line ~2209) | Triggered from within the SampleForm edit modal |

### 3.3 SampleForm.tsx (Create/Edit Sample Form)

| # | Button | Handler | Location | Description |
|---|--------|---------|----------|-------------|
| 1 | **Delete Sample** | `onDelete(sample._id)` | Form footer — Delete button (line ~1254) | Calls parent `onDelete` to trigger delete confirmation |
| 2 | **Remove Image** | `removeImage(idx)` | Uploaded image thumbnail — × button (line ~911) | Removes an uploaded image from the sample |
| 3 | **Remove Image (Pending)** | `removeImage(imageIndex)` | Pending image thumbnail — × button (line ~938) | Removes a pending image from the sample |

---

## 4. Users Module

**Page:** `app/(pages)/(dashboard)/users/`

### 4.1 Users List Page (page.tsx)

| # | Button | Handler | Location | Description |
|---|--------|---------|----------|-------------|
| 1 | **Delete User** | Opens delete confirmation modal | User row — TrashIcon button — Desktop (line ~1565) | Opens confirmation to delete a user |
| 2 | **Delete User** | Opens delete confirmation modal | User row — TrashIcon button — Mobile (line ~1577) | Same as above, mobile layout |
| 3 | **Confirm Delete User** | `handleDeleteUser()` | Delete confirmation modal (line ~2676) | Executes the user delete |
| 4 | **Delete User (from card)** | `onDeleteUser(user)` via prop | `<UserCardView>` component (line ~1939) | Triggered from user card, opens delete modal |

### 4.2 UserCardView.tsx (User Card Component)

| # | Button | Handler | Location | Description |
|---|--------|---------|----------|-------------|
| 1 | **Delete User** | `onDeleteUser(user)` | Card action — TrashIcon button (line ~163) | Calls parent handler to initiate user deletion |

---

## 5. API Delete Routes

All backend API endpoints that handle `DELETE` HTTP method:

| # | Endpoint | File | Type | Description |
|---|----------|------|------|-------------|
| 1 | `DELETE /api/fabrics/[id]` | `app/api/fabrics/[id]/route.ts` | Soft Delete | Soft-deletes a fabric (sets `softDeleted: true`) |
| 2 | `DELETE /api/orders/[id]` | (via OrdersClient) | Soft Delete | Soft-deletes an order |
| 3 | `DELETE /api/parties/[id]` | `app/api/parties/[id]/route.ts` | Hard Delete | Permanently deletes a party |
| 4 | `DELETE /api/qualities/[id]` | `app/api/qualities/[id]/route.ts` | Hard Delete | Permanently deletes a quality |
| 5 | `DELETE /api/mills/[id]` | `app/api/mills/[id]/route.ts` | Hard Delete | Permanently deletes a mill |
| 6 | `DELETE /api/processes/[id]` | `app/api/processes/[id]/route.ts` | Soft Delete | Soft-deletes a process (sets `isActive: false`) |
| 7 | `DELETE /api/users/[id]` | `app/api/users/[id]/route.ts` | Hard Delete | Permanently deletes a user |
| 8 | `DELETE /api/mill-inputs/[id]` | `app/api/mill-inputs/[id]/route.ts` | Hard Delete | Permanently deletes a single mill input |
| 9 | `DELETE /api/mill-inputs` | `app/api/mill-inputs/route.ts` | Bulk Delete | Deletes ALL mill inputs for an order (`deleteMany`) |
| 10 | `DELETE /api/mill-outputs/[id]` | `app/api/mill-outputs/[id]/route.ts` | Hard Delete | Permanently deletes a single mill output |
| 11 | `DELETE /api/dispatch/[id]` | `app/api/dispatch/[id]/route.ts` | Hard Delete | Permanently deletes a single dispatch |
| 12 | `DELETE /api/dispatch` | `app/api/dispatch/route.ts` | Bulk Delete | Deletes ALL dispatches for an order (`deleteMany`) |
| 13 | `DELETE /api/grey-info/[id]` | `app/api/grey-info/[id]/route.ts` | Hard Delete | Permanently deletes a single grey info entry |
| 14 | `DELETE /api/grey-info` | `app/api/grey-info/route.ts` | Bulk Delete | Deletes ALL grey info for an order (`deleteMany`) |
| 15 | `DELETE /api/sampling/samples/[id]` | `app/api/sampling/samples/[id]/route.ts` | Hard Delete | Permanently deletes a sample |
| 16 | `DELETE /api/sampling/weavers/[id]` | (via weaverService) | Atomic Delete | Deletes weaver + all samples (transactional) |

---

## 6. Summary Table

| Module | Page/Component | Delete Buttons | Remove Buttons | Total |
|--------|---------------|:--------------:|:--------------:|:-----:|
| **Orders** | OrdersClient.tsx | 7 | 0 | **7** |
| **Orders** | OrderForm.tsx | 2 | 2 | **4** |
| **Orders** | MillInputForm.tsx | 3 | 1 | **4** |
| **Orders** | MillOutputForm.tsx | 2 | 1 | **3** |
| **Orders** | DispatchForm.tsx | 2 | 1 | **3** |
| **Orders** | LabDataModal.tsx | 4 | 0 | **4** |
| **Orders** | GreyInformationModal.tsx | 1 | 1 | **2** |
| **Fabrics** | page.tsx (List) | 6 | 0 | **6** |
| **Fabrics** | FabricDetails.tsx | 1 | 0 | **1** |
| **Fabrics** | CreateFabric.tsx | 0 | 3 | **3** |
| **Fabrics** | DeleteConfirmation.tsx | 2 | 0 | **2** |
| **Sampling** | page.tsx (List) | 8 | 0 | **8** |
| **Sampling** | view/[weaverId] | 7 | 0 | **7** |
| **Sampling** | SampleForm.tsx | 1 | 2 | **3** |
| **Users** | page.tsx | 4 | 0 | **4** |
| **Users** | UserCardView.tsx | 1 | 0 | **1** |
| | | | | |
| **TOTAL** | | **51** | **11** | **62** |

---

### Legend

- **Delete** = Permanently removes or soft-deletes data from the database
- **Remove** = Removes an item from the form/UI locally (e.g., remove image, remove form row) — may or may not persist until saved
- **Soft Delete** = Sets a flag (`softDeleted`, `isActive`) instead of actually removing the record
- **Hard Delete** = Permanently removes the record from the database
- **Bulk Delete** = Deletes multiple records at once (`deleteMany`)
- **Atomic Delete** = Deletes related records in a single transaction (e.g., weaver + all its samples)
