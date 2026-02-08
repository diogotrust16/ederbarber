-- Create storage bucket for professional avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('professional-avatars', 'professional-avatars', true);

-- Allow anyone to view professional avatars (public bucket)
CREATE POLICY "Public can view professional avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'professional-avatars');

-- Allow authenticated admins to upload avatars
CREATE POLICY "Admins can upload professional avatars"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'professional-avatars');

-- Allow authenticated admins to update avatars
CREATE POLICY "Admins can update professional avatars"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'professional-avatars');

-- Allow authenticated admins to delete avatars
CREATE POLICY "Admins can delete professional avatars"
ON storage.objects
FOR DELETE
USING (bucket_id = 'professional-avatars');