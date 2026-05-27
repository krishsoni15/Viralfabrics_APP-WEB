import dbConnect from "@/lib/dbConnect";
import Fabric from "@/models/Fabric";
import { type NextRequest } from "next/server";
import { sanitizeString } from "@/lib/sanitize";
import { invalidateAllFabricCaches, waitForDatabaseCommit, verifyFabricsInDatabase, NO_CACHE_HEADERS } from "../cacheUtils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    // Validate session first (security check)
    const { getSession } = await import('@/lib/session');
    const session = await getSession(req);
    if (!session) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Unauthorized" 
      }), { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const clearCache = searchParams.get('clearCache') === 'true';
    const cacheBust = searchParams.get('_nocache') || searchParams.get('t');
    
    // Always get fresh data from database - no cache to prevent stale data
    
    await dbConnect();
    
    // Get the fabric to find its quality code
    const fabric = await Fabric.findById(id)
      .lean()
      .select('qualityCode qualityName')
      .maxTimeMS(3000);
      
    if (!fabric) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Fabric not found" 
      }), { status: 404 });
    }
    
    // Get ALL fabrics with the same quality code (trim to handle any whitespace issues)
    const qualityCodeToMatch = String(fabric.qualityCode || '').trim();
    const allItems = await Fabric.find({ 
      qualityCode: qualityCodeToMatch 
    })
      .lean()
      .sort({ createdAt: 1 }) // Sort by creation date to maintain order
      .maxTimeMS(3000);
    
    // Log for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[GET /api/fabrics/${id}] Found ${allItems.length} fabric(s) with qualityCode: "${qualityCodeToMatch}"`);
    }
    
    // Use shared cache headers
    return new Response(JSON.stringify({ 
      success: true, 
      data: allItems,
      totalItems: allItems.length,
      qualityCode: fabric.qualityCode
    }), { 
      status: 200,
      headers: NO_CACHE_HEADERS
    });
    
  } catch (error) {
    console.error('Error fetching fabric:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to fetch fabric" 
    }), { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;
  
  try {
    // Validate session first (security check)
    const { getSession } = await import('@/lib/session');
    const session = await getSession(req);
    if (!session) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Unauthorized" 
      }), { status: 401 });
    }
    
    await dbConnect();
    
    const requestData = await req.json();
    
    // Sanitize all string inputs to prevent XSS and NoSQL injection
    const qualityCode = sanitizeString(requestData.qualityCode || '', { maxLength: 50 });
    const qualityName = sanitizeString(requestData.qualityName || '', { maxLength: 100 });
    const type = sanitizeString(requestData.type || '', { maxLength: 50 });
    const weaver = sanitizeString(requestData.weaver || '', { maxLength: 100 });
    const weaverQualityName = sanitizeString(requestData.weaverQualityName || '', { maxLength: 100 });
    const rack = sanitizeString(requestData.rack || '', { maxLength: 100 });
    const content = sanitizeString(requestData.content || '', { maxLength: 200 });
    const danier = sanitizeString(requestData.danier || '', { maxLength: 100 });
    const originalQualityCode = requestData.originalQualityCode ? sanitizeString(requestData.originalQualityCode, { maxLength: 50 }) : undefined;
    
    // Numeric fields (already validated as numbers)
    const { greighWidth, finishWidth, weight, gsm, count, reed, pick, greighRate } = requestData;
    
    // Arrays and booleans (safe)
    const { images, updateAllItems, allItems, updateAllWithQualityCode, deletedItemIds } = requestData;
    
    // Basic validation for required fields
    const errors: string[] = [];
    
    if (!qualityCode?.trim()) {
      errors.push("Quality code is required");
    }
    
    if (!qualityName?.trim()) {
      errors.push("Quality name is required");
    }
    
    if (!weaver?.trim()) {
      errors.push("Weaver is required");
    }
    
    if (!weaverQualityName?.trim()) {
      errors.push("Weaver quality name is required");
    }
    
    if (errors.length > 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: errors.join(", ") 
      }), { status: 400 });
    }
    
    const currentFabric = await Fabric.findById(id);
    if (!currentFabric) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Fabric not found" 
      }), { status: 404 });
    }
    
         // Handle quality code change updates
     if (updateAllWithQualityCode && originalQualityCode) {
       // First, update quality code, quality name, and type for all fabrics with original quality code
       const updateResult = await Fabric.updateMany(
         { qualityCode: originalQualityCode },
         { 
           qualityCode: qualityCode.trim(),
           qualityName: qualityName.trim(),
           type: type?.trim() || ''
         }
       );
       
       // If allItems is provided, also update individual weaver data
       if (updateAllItems && allItems && Array.isArray(allItems)) {
         // Get all existing fabrics with the NEW quality code (after update)
         const existingFabrics = await Fabric.find({ 
           qualityCode: qualityCode.trim()
         }).sort({ createdAt: 1 }).lean().maxTimeMS(2000);
         
         const updatedFabrics = [];
         const createdFabrics = [];
         
         // Update existing fabrics with individual weaver data
         for (let i = 0; i < existingFabrics.length && i < allItems.length; i++) {
           const existingFabric = existingFabrics[i];
           const newData = allItems[i];
           
           if (newData) {
             const updated = await Fabric.findByIdAndUpdate(
               existingFabric._id,
               {
                 qualityCode: newData.qualityCode?.trim() || qualityCode.trim(),
                 qualityName: newData.qualityName?.trim() || qualityName.trim(),
                 type: newData.type?.trim() || type?.trim() || '',
                 weaver: newData.weaver?.trim() || '',
                 weaverQualityName: newData.weaverQualityName?.trim() || '',
                 rack: newData.rack?.trim() || '',
                 greighWidth: newData.greighWidth || 0,
                 finishWidth: newData.finishWidth || 0,
                 weight: newData.weight || 0,
                 gsm: newData.gsm || 0,
                 content: newData.content?.trim() || '',
                 danier: newData.danier?.trim() || '',
                 count: newData.count || 0,
                 reed: newData.reed || 0,
                 pick: newData.pick || 0,
                 greighRate: newData.greighRate || 0,
                 images: newData.images || []
               },
               { new: true, runValidators: true, maxTimeMS: 2000 }
             );
             
             if (updated) {
               updatedFabrics.push(updated);
             }
           }
         }
         
         // Create new fabrics for items beyond existing count
         if (allItems.length > existingFabrics.length) {
           const newItems = allItems.slice(existingFabrics.length);
           
           for (const newData of newItems) {
             if (newData && newData.weaver?.trim() && newData.weaverQualityName?.trim()) {
               const newFabric = new Fabric({
                 qualityCode: newData.qualityCode?.trim() || qualityCode.trim(),
                 qualityName: newData.qualityName?.trim() || qualityName.trim(),
                 type: newData.type?.trim() || type?.trim() || '',
                 weaver: newData.weaver.trim(),
                 weaverQualityName: newData.weaverQualityName.trim(),
                 rack: newData.rack?.trim() || '',
                 greighWidth: newData.greighWidth || 0,
                 finishWidth: newData.finishWidth || 0,
                 weight: newData.weight || 0,
                 gsm: newData.gsm || 0,
                 content: newData.content?.trim() || '',
                 danier: newData.danier?.trim() || '',
                 count: newData.count || 0,
                 reed: newData.reed || 0,
                 pick: newData.pick || 0,
                 greighRate: newData.greighRate || 0,
                 images: newData.images || []
               });
               
               const saved = await newFabric.save();
               createdFabrics.push(saved);
             }
           }
         }
         
         // Wait for database commit
         await waitForDatabaseCommit(200);
         
         // Verify fabrics exist
         const verifiedFabrics = await verifyFabricsInDatabase([...updatedFabrics, ...createdFabrics]);
         
         // Invalidate caches
         const allFabricIds = [
           id,
           ...updatedFabrics.map(f => f?._id?.toString()).filter((id): id is string => Boolean(id)),
           ...createdFabrics.map(f => f?._id?.toString()).filter((id): id is string => Boolean(id))
         ];
         await invalidateAllFabricCaches(allFabricIds);
         
         const totalUpdated = updatedFabrics.length;
         const totalCreated = createdFabrics.length;
         const message = totalCreated > 0 
           ? `Successfully updated ${totalUpdated} fabric(s) and created ${totalCreated} new fabric(s)`
           : `Successfully updated ${totalUpdated} fabric(s)`;
         
         // ⚡ FIX: Return verified fabrics from database (not from save response)
         const allFabrics = verifiedFabrics.length > 0 
           ? verifiedFabrics 
           : [
               ...updatedFabrics.map(f => f && f.toObject ? f.toObject() : f).filter(Boolean),
               ...createdFabrics.map(f => f && f.toObject ? f.toObject() : f).filter(Boolean)
             ];
         
         return new Response(JSON.stringify({ 
           success: true, 
           message,
           updatedCount: totalUpdated,
           createdCount: totalCreated,
           data: allFabrics.length > 0 ? allFabrics : (currentFabric && currentFabric.toObject ? currentFabric.toObject() : currentFabric)
         }), { 
           status: 200,
           headers: {
             'Content-Type': 'application/json',
             'Cache-Control': 'no-cache, no-store, must-revalidate',
             'Pragma': 'no-cache'
           }
         });
       }
       
        // ⚡ FIX: Invalidate all cache layers
        await invalidateAllFabricCaches([id]);
        
        // Return success if only quality code was updated
       return new Response(JSON.stringify({ 
         success: true, 
         message: `Successfully updated ${updateResult.modifiedCount} fabric(s) with new quality code`,
         updatedCount: updateResult.modifiedCount
       }), { 
         status: 200,
         headers: {
           'Content-Type': 'application/json',
           'Cache-Control': 'no-cache, no-store, must-revalidate',
           'Pragma': 'no-cache'
         }
       });
     }
    
    // Handle updating all items in a quality code group (when quality code hasn't changed)
    if (updateAllItems && allItems && Array.isArray(allItems)) {
      // ⚡ CRITICAL: First, delete any items that were removed from the form
      // This must happen BEFORE fetching existing fabrics to ensure deleted items are gone
      let deletedCount = 0;
      if (deletedItemIds && Array.isArray(deletedItemIds) && deletedItemIds.length > 0) {
        console.log('🗑️ Processing deletions:', {
          receivedIds: deletedItemIds,
          receivedCount: deletedItemIds.length,
          qualityCode: currentFabric.qualityCode
        });
        
        // ⚡ FIX: Validate that all IDs are valid MongoDB ObjectIds before deleting
        const validIds = deletedItemIds
          .map(id => String(id).trim())
          .filter(id => {
            // Check if it's a valid MongoDB ObjectId format (24 hex characters)
            const isValid = id && typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
            if (!isValid) {
              console.warn('⚠️ Invalid ObjectId format:', id);
            }
            return isValid;
          });
        
        console.log('🗑️ Valid IDs for deletion:', {
          validCount: validIds.length,
          validIds: validIds,
          invalidCount: deletedItemIds.length - validIds.length
        });
        
        if (validIds.length > 0) {
          try {
            const deleteResult = await Fabric.deleteMany({
              _id: { $in: validIds },
              qualityCode: currentFabric.qualityCode // Safety check: only delete items with same quality code
            });
            deletedCount = deleteResult.deletedCount || 0;
            console.log(`✅ Successfully deleted ${deletedCount} fabric(s) with IDs:`, validIds);
            
            if (deletedCount !== validIds.length) {
              console.warn(`⚠️ Expected to delete ${validIds.length} fabric(s), but only deleted ${deletedCount}`);
            }
            
            // ⚡ CRITICAL: Wait for deletion to be committed to database
            await waitForDatabaseCommit(200);
            
            // ⚡ CRITICAL: Invalidate cache for deleted items immediately
            await invalidateAllFabricCaches(validIds);
          } catch (deleteError) {
            console.error('❌ Error deleting fabrics:', deleteError);
            throw deleteError;
          }
        } else {
          console.warn('⚠️ No valid IDs to delete. Received:', deletedItemIds);
        }
      } else {
        console.log('ℹ️ No items to delete (deletedItemIds is empty or invalid)');
      }
      
      // Get all existing fabrics with this quality code (after deletions)
      // This will NOT include the deleted items
      const existingFabrics = await Fabric.find({ 
        qualityCode: currentFabric.qualityCode 
      }).sort({ createdAt: 1 }).lean().maxTimeMS(2000);
      
      const updatedFabrics = [];
      const createdFabrics = [];
      
      // ⚡ FIX: Update existing fabrics by matching _id, not by index
      // This prevents duplicates when items are reordered or new items are added
      for (const existingFabric of existingFabrics) {
        const existingId = String(existingFabric._id);
        
        // Find matching item in allItems by _id
        const matchingItem = allItems.find((item: any) => 
          item._id && String(item._id) === existingId
        );
        
        if (matchingItem) {
          const newData = matchingItem;
          const updated = await Fabric.findByIdAndUpdate(
            existingFabric._id,
            {
              qualityCode: newData.qualityCode?.trim() || currentFabric.qualityCode,
              qualityName: newData.qualityName?.trim() || currentFabric.qualityName,
              type: newData.type?.trim() || '',
              weaver: newData.weaver?.trim() || '',
              weaverQualityName: newData.weaverQualityName?.trim() || '',
              rack: newData.rack?.trim() || '',
              greighWidth: newData.greighWidth || 0,
              finishWidth: newData.finishWidth || 0,
              weight: newData.weight || 0,
              gsm: newData.gsm || 0,
              content: newData.content?.trim() || '',
              danier: newData.danier?.trim() || '',
              count: newData.count || 0,
              reed: newData.reed || 0,
              pick: newData.pick || 0,
              greighRate: newData.greighRate || 0,
              images: newData.images || []
            },
            { new: true, runValidators: true, maxTimeMS: 2000 }
          );
          
          if (updated) {
            updatedFabrics.push(updated);
          }
        }
      }
      
      // ⚡ FIX: Create new fabrics for items that don't have matching IDs in existing fabrics
      // This prevents duplicates when adding new weavers
      const existingFabricIds = new Set(existingFabrics.map(f => String(f._id)));
      const updatedFabricIds = new Set(updatedFabrics.map(f => String(f._id)));
      
      for (const newData of allItems) {
        // ⚡ CRITICAL: Only create if:
        // 1. Item has no _id (new item) OR _id doesn't match any existing fabric
        // 2. Item has weaver and weaverQualityName filled
        // 3. Item was NOT already updated (to prevent processing same item twice)
        const itemId = newData._id ? String(newData._id) : null;
        const isNewItem = !itemId || (!existingFabricIds.has(itemId) && !updatedFabricIds.has(itemId));
        
        if (isNewItem && newData && newData.weaver?.trim() && newData.weaverQualityName?.trim()) {
          // ⚡ DUPLICATE CHECK: Check if a fabric with same weaver + weaverQualityName already exists
          // Also check in updatedFabrics to prevent duplicates in the same request
          const existingDuplicate = existingFabrics.find(f => 
            f.weaver?.trim() === newData.weaver.trim() && 
            f.weaverQualityName?.trim() === newData.weaverQualityName.trim()
          );
          
          const updatedDuplicate = updatedFabrics.find(f => 
            f.weaver?.trim() === newData.weaver.trim() && 
            f.weaverQualityName?.trim() === newData.weaverQualityName.trim()
          );
          
          if (existingDuplicate || updatedDuplicate) {
            const duplicateId = existingDuplicate?._id || updatedDuplicate?._id;
            console.log('⚠️ Skipping duplicate fabric:', {
              weaver: newData.weaver.trim(),
              weaverQualityName: newData.weaverQualityName.trim(),
              existingId: duplicateId
            });
            // Skip - this weaver already exists (either in database or was just updated)
            continue;
          }
          
          // ⚡ ADDITIONAL CHECK: Query database one more time to be absolutely sure
          const dbDuplicateCheck = await Fabric.findOne({
            qualityCode: currentFabric.qualityCode,
            weaver: newData.weaver.trim(),
            weaverQualityName: newData.weaverQualityName.trim()
          }).lean().maxTimeMS(1000);
          
          if (dbDuplicateCheck) {
            console.log('⚠️ Database duplicate found, skipping:', {
              weaver: newData.weaver.trim(),
              weaverQualityName: newData.weaverQualityName.trim(),
              existingId: dbDuplicateCheck._id
            });
            // Update the existing duplicate instead of creating a new one
            const updated = await Fabric.findByIdAndUpdate(
              dbDuplicateCheck._id,
              {
                qualityCode: newData.qualityCode?.trim() || currentFabric.qualityCode,
                qualityName: newData.qualityName?.trim() || currentFabric.qualityName,
                type: newData.type?.trim() || '',
                weaver: newData.weaver.trim(),
                weaverQualityName: newData.weaverQualityName.trim(),
                rack: newData.rack?.trim() || '',
                greighWidth: newData.greighWidth || 0,
                finishWidth: newData.finishWidth || 0,
                weight: newData.weight || 0,
                gsm: newData.gsm || 0,
                content: newData.content?.trim() || '',
                danier: newData.danier?.trim() || '',
                count: newData.count || 0,
                reed: newData.reed || 0,
                pick: newData.pick || 0,
                greighRate: newData.greighRate || 0,
                images: newData.images || []
              },
              { new: true, runValidators: true, maxTimeMS: 2000 }
            );
            
            if (updated) {
              updatedFabrics.push(updated);
            }
            continue; // Skip creating a duplicate
          }
          
          try {
            const newFabric = new Fabric({
              qualityCode: newData.qualityCode?.trim() || currentFabric.qualityCode,
              qualityName: newData.qualityName?.trim() || currentFabric.qualityName,
              type: newData.type?.trim() || '',
              weaver: newData.weaver.trim(),
              weaverQualityName: newData.weaverQualityName.trim(),
              rack: newData.rack?.trim() || '',
              greighWidth: newData.greighWidth || 0,
              finishWidth: newData.finishWidth || 0,
              weight: newData.weight || 0,
              gsm: newData.gsm || 0,
              content: newData.content?.trim() || '',
              danier: newData.danier?.trim() || '',
              count: newData.count || 0,
              reed: newData.reed || 0,
              pick: newData.pick || 0,
              greighRate: newData.greighRate || 0,
              images: newData.images || []
            });
            
            const saved = await newFabric.save();
            // ⚡ FIX: Verify the fabric was actually saved by fetching it
            const verified = await Fabric.findById(saved._id).lean();
            if (verified) {
              createdFabrics.push(saved);
            } else {
              console.error('⚠️ Fabric save verification failed for:', saved._id);
            }
          } catch (saveError) {
            console.error('❌ Error saving new fabric:', saveError);
            // Continue with other fabrics even if one fails
          }
        }
      }
      
      // Wait for database commit
      await waitForDatabaseCommit(200);
      
      // Verify fabrics exist
      const verifiedFabrics = await verifyFabricsInDatabase([...updatedFabrics, ...createdFabrics]);
      
      // Invalidate caches
      const allFabricIds = [
        id,
        ...updatedFabrics.map(f => f?._id?.toString()).filter((id): id is string => Boolean(id)),
        ...createdFabrics.map(f => f?._id?.toString()).filter((id): id is string => Boolean(id))
      ];
      await invalidateAllFabricCaches(allFabricIds);
      
      const totalUpdated = updatedFabrics.length;
      const totalCreated = createdFabrics.length;
      const message = deletedCount > 0
        ? (totalCreated > 0 
          ? `Successfully deleted ${deletedCount} fabric(s), updated ${totalUpdated} fabric(s), and created ${totalCreated} new fabric(s)`
          : `Successfully deleted ${deletedCount} fabric(s) and updated ${totalUpdated} fabric(s)`)
        : (totalCreated > 0 
          ? `Successfully updated ${totalUpdated} fabric(s) and created ${totalCreated} new fabric(s)`
          : `Successfully updated ${totalUpdated} fabric(s)`);
      
      // ⚡ CRITICAL: Return verified fabrics from database (not from save response)
      // This ensures we return exactly what's in the database (deleted items are already gone)
      const allFabrics = verifiedFabrics.length > 0 
        ? verifiedFabrics 
        : [
            ...updatedFabrics.map(f => f && f.toObject ? f.toObject() : f).filter(Boolean),
            ...createdFabrics.map(f => f && f.toObject ? f.toObject() : f).filter(Boolean)
          ];
      
      // ⚡ CRITICAL: Return only fabrics that still exist (deleted items are excluded)
      return new Response(JSON.stringify({ 
        success: true, 
        message,
        updatedCount: totalUpdated,
        createdCount: totalCreated,
        deletedCount: deletedCount,
        originalItemCount: existingFabrics.length,
        data: allFabrics.length > 0 ? allFabrics : (currentFabric && currentFabric.toObject ? currentFabric.toObject() : currentFabric)
      }), { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
    }
    
    // Check if this is a quality code/name change
    const isQualityChange = currentFabric.qualityCode !== qualityCode.trim() || 
                           currentFabric.qualityName !== qualityName.trim();
    
    if (isQualityChange) {
      // This is a quality code/name change - always allow it
      // Check if other fabrics use the new quality code (for warning purposes only)
      const otherFabricsWithSameQuality = await Fabric.find({
        qualityCode: qualityCode.trim(),
        _id: { $ne: id }
      }).select('qualityName weaver weaverQualityName');
      
      if (otherFabricsWithSameQuality.length > 0) {
        // Show warning but proceed with update
        const warningMessage = `Quality code "${qualityCode.trim()}" is already used by ${otherFabricsWithSameQuality.length} other fabric(s). Proceeding with update.`;
        // Update the fabric
        const fabric = await Fabric.findByIdAndUpdate(
          id,
          {
            qualityCode: qualityCode.trim(),
            qualityName: qualityName.trim(),
            type: type?.trim() || '',
            weaver: weaver.trim(),
            weaverQualityName: weaverQualityName.trim(),
            rack: rack?.trim() || '',
            greighWidth: greighWidth || 0,
            finishWidth: finishWidth || 0,
            weight: weight || 0,
            gsm: gsm || 0,
            danier: danier?.trim() || '',
            reed: reed || 0,
            pick: pick || 0,
            greighRate: greighRate || 0,
            images: images || []
          },
          { new: true, runValidators: true }
        );
        
        // ⚡ FIX: Invalidate all cache layers
        await invalidateAllFabricCaches([id]);
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: warningMessage,
          warning: true,
          existingFabrics: otherFabricsWithSameQuality,
          data: fabric && fabric.toObject ? fabric.toObject() : fabric
        }), { 
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
      }
    } else {
      // No quality change - proceed with update (duplicates allowed)
    }
    
    // Proceed with the update
    // This handles cases where:
    // 1. Quality change with no conflicts
    // 2. No quality change and no duplicates
    // Update fabric with flexible validation
    const fabric = await Fabric.findByIdAndUpdate(
      id,
      {
        qualityCode: qualityCode.trim(),
        qualityName: qualityName.trim(),
        weaver: weaver.trim(),
        weaverQualityName: weaverQualityName.trim(),
        rack: rack?.trim() || '',
        greighWidth: greighWidth || 0,
        finishWidth: finishWidth || 0,
        weight: weight || 0,
        gsm: gsm || 0,
        content: content?.trim() || '',
        danier: danier?.trim() || '',
        count: count || 0,
        reed: reed || 0,
        pick: pick || 0,
        greighRate: greighRate || 0,
        images: images || []
      },
      { new: true, runValidators: true }
    );
    
    if (!fabric) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Fabric not found" 
      }), { status: 404 });
    }
    
    // ⚡ FIX: Invalidate all cache layers
    await invalidateAllFabricCaches([id]);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Fabric updated successfully",
      data: fabric && fabric.toObject ? fabric.toObject() : fabric
    }), { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('Error updating fabric:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to update fabric" 
    }), { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Validate session first (security check)
    const { getSession } = await import('@/lib/session');
    const session = await getSession(req);
    if (!session) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Unauthorized" 
      }), { status: 401 });
    }
    
    await dbConnect();
    
    const fabric = await Fabric.findByIdAndDelete(id);
    
    if (!fabric) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Fabric not found" 
      }), { status: 404 });
    }
    
    // ⚡ FIX: Invalidate all cache layers
    await invalidateAllFabricCaches([id]);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Fabric deleted successfully" 
    }), { status: 200 });
    
  } catch (error) {
    console.error('Error deleting fabric:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : "Failed to delete fabric" 
    }), { status: 500 });
  }
}
