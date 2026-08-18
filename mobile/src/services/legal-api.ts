import { supabase } from '@/lib/supabase';

export type LegalKey = 'privacy' | 'terms' | 'licenses';

export interface LegalDocument {
  key: LegalKey;
  title: string;
  content: string;
  updated_at: string;
}

export async function getLegalDocument(key: LegalKey): Promise<LegalDocument> {
  const { data, error } = await supabase
    .from('legal_documents')
    .select('key, title, content, updated_at')
    .eq('key', key)
    .single();
  if (error || !data) throw new Error('Document not found');
  return data as LegalDocument;
}
