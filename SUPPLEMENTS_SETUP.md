# Supplements Inventory - Supabase Setup Guide

## Prerequisites

Before using the supplements inventory system, you need to set up the database and storage in Supabase.

## Step 1: Run Database Migration

Apply the migration to create the necessary tables:

```bash
# If using Supabase CLI
supabase db push

# Or apply the migration file directly in Supabase Dashboard
# Go to SQL Editor and run: supabase/migrations/019_create_supplements_inventory.sql
```

## Step 2: Create Storage Bucket

**IMPORTANT**: The storage bucket must be created manually in the Supabase Dashboard.

### Instructions:

1. **Go to Supabase Dashboard**

   - Navigate to your project at https://supabase.com/dashboard

2. **Open Storage Section**

   - Click on "Storage" in the left sidebar

3. **Create New Bucket**

   - Click "Create bucket" or "New bucket"
   - **Bucket name**: `supplement-images`
   - **Public bucket**: ✅ YES (check this box)
   - **File size limit**: 2 MB
   - **Allowed MIME types**:
     - image/png
     - image/jpeg
     - image/jpg
     - image/webp

4. **Save the Bucket**
   - Click "Create bucket" or "Save"

### Verify Bucket Creation

After creating the bucket, you should see it listed in the Storage section with:

- Name: `supplement-images`
- Status: Public
- Files: 0

## Step 3: Apply Storage Policies

The storage policies should be automatically applied when you run the migration (Step 1). These policies allow:

- ✅ Authenticated users to upload images
- ✅ Authenticated users to update their images
- ✅ Authenticated users to delete their images
- ✅ Public read access to all images

If the policies weren't applied automatically, you can run them manually from the SQL Editor in Supabase Dashboard (see the policies section in `019_create_supplements_inventory.sql`).

## Step 4: Test the System

1. **Navigate to Inventory**

   - Go to Trainer Dashboard → Inventario de Suplementos

2. **Add a Test Supplement**

   - Click "Añadir Suplemento"
   - Fill in the details:
     - Nombre: "Creatina Monohidrato"
     - Descripción: "Creatina micronizada de alta calidad"
     - Cantidad: 100
     - Unidad: cápsulas
   - Click or drag images to upload
   - Click "Añadir al Inventario"

3. **Verify Upload**
   - Check that the supplement appears in the inventory
   - Click on it to verify images are displayed
   - Go to Supabase Dashboard → Storage → supplement-images to see uploaded files

## Troubleshooting

### Images Not Uploading

**Error**: "Error al subir el archivo"

**Solution**:

- Verify the `supplement-images` bucket exists and is public
- Check that storage policies are applied
- Ensure images are under 2MB and in supported formats (PNG, JPG, WebP)

### Bucket Not Found

**Error**: "Bucket not found"

**Solution**:

- The bucket must be created manually (see Step 2 above)
- Bucket name must be exactly: `supplement-images` (no spaces, all lowercase)

### Storage Policies Error

**Error**: Policy violations when uploading

**Solution**:

- Run the storage policies from the migration file manually
- Make sure you're authenticated as a trainer when uploading
- Check browser console for specific error messages

## Database Schema

### Tables Created:

1. **supplement_inventory**

   - Stores the trainer's supplement catalog
   - Fields: id, name, description, quantity, unit, images[], is_archived

2. **client_supplement_assignments**
   - Links supplements to clients with dosage/timing
   - Fields: id, client_id, supplement_id, dosage, frequency, timing, notes

### Storage Structure:

```
supplement-images/
├── {trainer_id}/
│   ├── {supplement_id}/
│   │   ├── {timestamp}.png
│   │   ├── {timestamp}.jpg
│   │   └── ...
```

## Support

If you encounter any issues:

1. Check the browser console for error messages
2. Verify all setup steps were completed
3. Check Supabase Dashboard logs for storage/database errors
