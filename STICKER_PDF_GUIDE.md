# Sticker PDF Generation & Download Guide

This document provides a detailed technical analysis of the sample sticker label PDF generation and download mechanism implemented in the Viral Fabrics dashboard.

---

## 1. Physical Specifications & Dimensions

The sticker layout is optimized for industrial barcode/label printers using standard 2:1 aspect ratio landscape sticker rolls.

- **Physical Width:** `100 mm`
- **Physical Height:** `50 mm`
- **Orientation:** `landscape`
- **Aspect Ratio:** `2:1`

### Border & Margins

- **Outer Boundary Offset (Margin):** `1.5 mm` on all sides.
- **Border Line Width:** `0.6 mm` thick black border.
- **Corner Styling:** Utilizes rounded corners for professional packaging aesthetics, implemented using jsPDF's canvas parameters:
  ```typescript
  doc.setLineJoin('round');
  doc.setLineCap('round');
  doc.rect(margin, margin, widthMM - margin * 2, heightMM - margin * 2, 'S');
  ```

---

## 2. Header & Slogan Typography (Dynamic Scaling)

To prevent text clipping or horizontal overflow on longer translations/titles, the generator implements a dynamic font-scaling loop using text width measurement.

### Brand Name Header (`VIRAL FABRICS`)

- **Default Size:** `10.5 pt` (bold Helvetica, black color)
- **Max Width Constraint:** Must not exceed **85%** of the available printable width.
- **Scaling Logic:** Decrements font size by `0.5 pt` down to a minimum threshold of `6 pt` until it fits.
- **Vertical Position:** Placed at `yPos = margin + 4.0 mm` (aligned at `5.5 mm`).

### Slogan Text (`MFG & SUPPLIER OF ALL TYPES OF EXPORT FABRICS`)

- **Default Size:** `4.2 pt` (bold Helvetica, black color)
- **Max Width Constraint:** Must not exceed **95%** of the available printable width.
- **Scaling Logic:** Decrements font size by `0.2 pt` down to a minimum threshold of `3 pt` until it fits.
- **Vertical Position:** Offset by `2.0 mm` below the brand name (placed at `7.5 mm`).

---

## 3. Grid Partitioning & Layout Structure

The remainder of the sticker height is divided into a grid table. The vertical space is dynamically budgeted.

### Vertical Row Budget

- **Table Area Start:** `yPos = 9.5 mm` (after brand header, slogan, and padding).
- **Remaining Vertical Space:** Calculated as:
  $$\text{availableHeight} = \text{heightMM} - \text{currentY} - \text{margin} - 1.5\text{ mm} \approx 37.5\text{ mm}$$
- **Total Grid Rows:** Exactly `6` rows.
- **Row Height:** Each row is allocated an equal portion of the remaining height:
  $$\text{rowHeight} = \frac{\text{availableHeight}}{6} \approx 6.25\text{ mm per row}$$

### Horizontal Column Partitioning

The grid uses a 4-column layout split across the center:

1.  **Left Label Column:** Width of `28 mm` (contains field titles).
2.  **Left Value Column:** Width of `32 mm` (contains primary field values).
3.  **Right Label Column:** Width of `16 mm` (contains auxiliary field titles).
4.  **Right Value Column:** Width of `18 mm` (contains auxiliary field values).

```
|<--------------------------------- 100 mm Width --------------------------------->|
+----------------------------------------------------------------------------------+
|                                  VIRAL FABRICS                                   |
|                  MFG & SUPPLIER OF ALL TYPES OF EXPORT FABRICS                   |
+------------------------------+--------------------+--------------+---------------+
| Quality Name (28mm)          | Value (32mm)       |              |               |
+------------------------------+--------------------+--------------+---------------+
| Weaver (28mm)                | Value (32mm)       |              |               |
+------------------------------+--------------------+--------------+---------------+
| Width (Inch) (28mm)          | Value (32mm)       | Count (16mm) | Value (18mm)  |
+------------------------------+--------------------+--------------+---------------+
| GSM (28mm)                   | Value (32mm)       | R x P (16mm) | Value (18mm)  |
+------------------------------+--------------------+--------------+---------------+
| Content (28mm)               | Value (32mm)       | MOQ (16mm)   | Value (18mm)  |
+------------------------------+--------------------+--------------+---------------+
| Remarks (28mm)               | (Empty) (32mm)     |              |               |
+------------------------------+--------------------+--------------+---------------+
```

### Vertical Text Centering Offset

To ensure text is visually centered vertically within each row, a manual adjustment offset of `+1.5 mm` is added. The text drawing baseline calculation is:
$$\text{textY} = \text{currentY} + \frac{\text{rowHeight}}{2} + 1.5\text{ mm}$$

- **Font Style:** Bold Helvetica at `7.5 pt` for both labels and value text.

---

## 4. Field Mapping & Data Sources

Data from the `Sample` database records maps directly to the grid coordinates:

| Grid Row  | Left Label   | Left Value Mapping                | Right Label | Right Value Mapping                |
| :-------- | :----------- | :-------------------------------- | :---------- | :--------------------------------- |
| **Row 1** | Quality Name | `sample.qualityName`              | —           | —                                  |
| **Row 2** | Weaver       | `sample.weaverId.name`            | —           | —                                  |
| **Row 3** | Width (Inch) | `sample.finishWidth` + `"` suffix | Count       | `sample.count` or `sample.danier`  |
| **Row 4** | GSM          | `sample.gsm`                      | R x P       | `${sample.reed}/${sample.pick}`    |
| **Row 5** | Content      | `sample.content`                  | MOQ         | `sample.moq` (Configured as empty) |
| **Row 6** | Remarks      | _Always left empty for notes_     | —           | —                                  |

_Note: If specific values are null or undefined, they default to a hyphen character (`-`) for clean visual symmetry._

---

## 5. Dual-Mode Preview & Downloading Strategy

To provide a seamless experience on both desktop and mobile devices, the dashboard implements a dual-mode strategy in [useStickerDownload.ts](<file:///home/krish/Downloads/ViralFabrics-main/app/(pages)/(dashboard)/weaver/hooks/useStickerDownload.ts>).

### Mobile Flow (Direct Download)

Mobile web browsers often block iframe previews or modal popups. The system triggers direct downloads without opening a preview:

1.  Calls `downloadSampleStickerPDFDirect(stickerData)`.
2.  Generates a binary `Blob` directly using jsPDF's client-side API.
3.  Creates a hidden anchor element `<a>` and binds it to a temporary object URL.
4.  Appends it to the DOM, triggers `click()`, and disposes of the element.
5.  Revokes the object URL after `100ms` using `URL.revokeObjectURL(url)` to prevent memory leaks.

### Desktop Flow (Preview Modal & CSP Bypass)

On desktop screens, a modal preview is rendered so users can view the layout before committing to print:

1.  Calls `generateSampleStickerPDF(stickerData)` which returns a Base64 data URI string.
2.  To circumvent strict browser Content Security Policies (CSP) that block direct Base64 embedding in iframes, the system converts the Base64 data URI into a native `Blob`:
    ```typescript
    const base64Data = pdfDataUrl.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    ```
3.  Renders the PDF stream inside an inline `<iframe src={blobUrl} />` inside a preview dialog.
4.  When the user clicks "Download", the direct blob download is triggered and the active object URL is cleaned up.

---

## 6. Location & Codebase References

- **PDF Generation Logic:** [pdfGenerator.ts](file:///home/krish/Downloads/ViralFabrics-main/lib/pdfGenerator.ts#L2512-L2910)
  - `generateSampleStickerPDF`: Lines 2526–2703
  - `downloadSampleStickerPDFDirect`: Lines 2706–2910
- **UI Trigger Hook:** [useStickerDownload.ts](<file:///home/krish/Downloads/ViralFabrics-main/app/(pages)/(dashboard)/weaver/hooks/useStickerDownload.ts>)
- **Dashboard Weaver Listing:** [weaver/page.tsx](<file:///home/krish/Downloads/ViralFabrics-main/app/(pages)/(dashboard)/weaver/page.tsx>)
- **Weaver Profile View:** [weaver/view/[weaverId]/page.tsx](<file:///home/krish/Downloads/ViralFabrics-main/app/(pages)/(dashboard)/weaver/view/%5BweaverId%5D/page.tsx>)
