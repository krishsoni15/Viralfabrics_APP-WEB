# PURCHASE ORDER SYSTEM SPECIFICATION (VIRAL FABRICS & VIRAL ENTERPRISE)

This document contains the complete technical specification, data models, UI design requirements, PDF generation layout, and role-based permissions for the **Purchase Order (PO) System**.

---

## 1. Company Headers & Auto-Fill Information

The purchase order page features a **Company Header Dropdown** that allows selecting between two hardcoded legal entity headers:

### Header Option 1: VIRAL FABRICS
- **Company Name**: VIRAL FABRICS
- **Address**: PLOT NO.37-38, KRISHNA IND.SOC., OPP.UMIYA RESI. BAMROLI, PANDESARA, SURAT 394210
- **Phone**: 094279 88999
- **GSTIN**: 24AXYPP4119J1ZW
- **PO ID Format**: Independent sequence per Financial Year starting at `001` (e.g. `001`, `002`, `003`...).

### Header Option 2: VIRAL ENTERPRISE
- **Company Name**: VIRAL ENTERPRISE
- **Address**: Plot 37,38 , Krishna Industrial. Society, Opposite Umiya Residency ,Near Milan Point,Bamroli - Vadod Road, Bamroli, Pandesara, Surat. Pin : 394210
- **Location Link**: https://maps.app.goo.gl/Q1FkRLFxuZeUbNPp6?g_st=iw
- **Contact Person**: Viral Patel (Surat) : +91-9427988999
- **Email ID**: viralfabrics@yahoo.com
- **Website**: www.viralfabrics.com
- **GST IN**: 24AAJHV2286E1Z0
- **PO ID Format**: Independent sequence per Financial Year starting at `001` (e.g. `001`, `002`, `003`...).

---

## 2. Purchase Order Form Fields & Smart Autocomplete Memory

When creating a Purchase Order, the form provides the following fields:

| Field Name | Type | Description / Behavior |
| :--- | :--- | :--- |
| **Company Header** | Dropdown | Options: `Viral Fabrics` / `Viral Enterprise`. Selecting auto-fills company header details and fetches the next available sequential PO ID for that company. |
| **PO Number** | Auto / Editable | Auto-generated sequential ID (`001`, `002`, `003`...) based on selected company & active Financial Year. |
| **PO Date** | Date Picker | Defaults to today's date (`DD/MM/YYYY`). Can be modified using a date picker. |
| **Broker Name** | Text / Autocomplete | Type to search previously saved Brokers. Selecting a suggestion auto-fills **Broker Mobile No**. |
| **Broker Mobile No** | Text / Tel | Phone number associated with the broker. Saved to memory DB on form submission. |
| **Supplier Name** | Text / Autocomplete | Type to search previously saved Suppliers. Selecting a suggestion auto-fills **Supplier Address** and **GSTIN**. |
| **Supplier Address** | Textarea | Supplier's street address & city. |
| **Supplier GSTIN** | Text | GST Identification Number of the supplier. |
| **Quality** | Text / Select | Fabric quality specification (e.g. `GREY 20% RECYCLE POLY SATIN`). |
| **Pcs / Mtr** | Text / Number | Quantity of pieces or meters (e.g. `3606.00`). |
| **Delivery** | Text | Delivery location or terms (e.g. `office`). |
| **Rate** | Text | Purchase rate entered manually (e.g. `79.50`). |
| **Payment Terms** | Text | Agreed payment timeframe (e.g. `30 Days`). |
| **Finish GSM** | Text / Number | Specifications table item 1. |
| **Grey Width** | Text / Number | Specifications table item 2. |
| **Finish Width** | Text / Number | Specifications table item 3. |
| **Weight** | Text / Number | Specifications table item 4. |
| **Notes** | Multiline Text | Additional order instructions or remarks. |

---

## 3. Sequential PO ID Generation & Financial Year Reset

1. **Independent Company Counters**:
   - `po_counter_viral_fabrics_FY2526`
   - `po_counter_viral_enterprise_FY2526`
2. **Financial Year Auto-Reset**:
   - Sequence resets to `001` **automatically** when a new Indian Financial Year (April 1 – March 31) begins.
   - Uses the same `getCurrentFinancialYear()` logic as the existing Order system.
   - No manual reset needed — the counter key includes the FY code, so each new FY creates a fresh counter starting at `001`.
3. **FY Filter on PO List Page**:
   - Users can filter Purchase Orders by Financial Year (e.g. `FY 25-26`, `FY 26-27`) just like the Order page.

---

## 4. Role & Permission Matrix

| Role | Access PO Page | Create PO | Edit PO | Download PDF | Delete PO |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **master** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **superadmin** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **admin** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **user** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **party** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |

---

## 5. PDF Generation Layout

The generated PDF matches the design shown in the reference image:

```
+-------------------------------------------------------------------+
|                           VIRAL FABRICS                           |
|  PLOT NO.37-38, KRISHNA IND.SOC., OPP.UMIYA RESI. BAMROLI, SURAT  |
|                         Phone: 094279 88999                       |
|  GSTIN : 24AXYPP4119J1ZW                  PURCHASE ORDER          |
+-------------------------------------------------------------------+
| PO No. : 001                                   Date : 06/11/2025  |
| Broker Name : Standard Traders                                    |
| Mobile No.  : 09876543210                                         |
+-------------------------------------------------------------------+
| Supplier Name : WOVEN AND KNIT                                    |
| Address       : A-50 SECTOR-2, DISTT-GAUTAM BUDDHA NAGAR NOIDA    |
| GSTIN         : 09AACFW3350K1ZY                                  |
+-------------------------------------------------------------------+
| Quality   : GREY 20% RECYCLE POLY SATIN                           |
| Pcs/Mtr   : 3606.00                    Delivery : office          |
| Rate      : 79.50 + GST                                           |
| Payment Terms : 30 Days                                           |
+-------------------------------------------------------------------+
| +--------------+----------+                                       |
| | Finish GSM   | 167      |                                       |
| | Grey Width   | 62       |                                       |
| | Finish Width |          |                                       |
| | Weight       |          |                                       |
| +--------------+----------+                                       |
| Notes : ...                                                       |
+-------------------------------------------------------------------+
```

---

## 6. Search, Filter & Responsive UI/UX Specifications

- **Search Engine**: Fuzzy search across PO No., Supplier Name, Broker Name, Mobile, Quality, and Notes.
- **Filters**:
  - Filter by Company Header (`Viral Fabrics`, `Viral Enterprise`, or `All`).
  - Date Range Filter (`startDate` to `endDate`).
  - Financial Year Filter (`FY 25-26`, `FY 24-25`, `Legacy`).
- **Web Layout**: High-density table with sticky header, quick actions (PDF Download, Edit, Delete), and pagination (10/25/50 items).
- **Mobile Layout**: Card-based interface with touch-friendly 5-item batch loading, pull-down modals, skeleton loaders, and dark/light mode optimization.
