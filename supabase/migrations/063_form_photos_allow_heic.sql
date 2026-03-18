-- Allow HEIC images in form-photos bucket (iOS gallery format)
UPDATE storage.buckets
SET allowed_mime_types = ARRAY [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/heic'
]
WHERE id = 'form-photos';
