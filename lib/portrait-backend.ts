import { createClient } from '@supabase/supabase-js';
import { portraitPixels } from './portrait-material';

// Publishable browser key. Photo access is enforced by Auth + database/storage RLS.
export const portraitBackend = createClient(
  'https://efezpjzltynkfrqpasju.supabase.co',
  'sb_publishable_TY9OtlfFAUz6J2fNK4Ribg_4z4qKKmK',
  { auth: { storageKey: 'vitani-prvaku.portrait-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } },
);
export type PortraitRow = { id: string; created_at: string; object_path: string };
export type DeviceAccess = { userId: string; canUpload: boolean };
export async function deviceAccess(): Promise<DeviceAccess | null> {
  const { data: { session }, error: authError } = await portraitBackend.auth.getSession();
  if (authError) throw authError;
  if (!session) return null;
  const { data, error } = await portraitBackend.from('portrait_access').select('can_upload').eq('user_id', session.user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Tento účet ještě nemá povolený přístup.');
  return { userId: session.user.id, canUpload: data.can_upload };
}
export async function portraitPng(image: ImageData, size: number): Promise<Blob> {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Fotografii nelze připravit.');
  context.putImageData(portraitPixels(image, size), 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Fotografii nelze uložit.')), 'image/png'));
}
export async function publishPortrait(id: string, blob: Blob, userId: string) {
  const path = `${id}.png`;
  const { error: uploadError } = await portraitBackend.storage.from('portraits').upload(path, blob, { contentType: 'image/png', upsert: false });
  // Retry the same UUID after an interrupted response, without overwriting anything.
  if (uploadError && String(uploadError.statusCode) !== '409') throw uploadError;
  const { error } = await portraitBackend.from('portraits').insert({ id, object_path: path, created_by: userId });
  if (error && error.code !== '23505') throw error;
}

export async function deletePortrait(row: PortraitRow) {
  const { error: fileError } = await portraitBackend.storage.from('portraits').remove([row.object_path]);
  if (fileError) throw fileError;
  const { error, data } = await portraitBackend.from('portraits').delete().eq('id', row.id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Portrét nelze smazat. Ověř oprávnění účtu.');
}
