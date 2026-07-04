import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

let _adminClient: ReturnType<typeof createClient> | null = null

export function getAdminClient(): ReturnType<typeof createClient> {
  if (!_adminClient) {
    _adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
  }
  return _adminClient
}
