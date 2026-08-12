import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { logger, mapError } from '../_shared/logger.ts'
import { getEnabledAppCategories } from '../_shared/app-categories-cache.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const adminClient = getAdminClient()
    const { packages, categories } = await getEnabledAppCategories(adminClient)

    const rows = Array.from(packages)
      .map((package_name) => ({
        package_name,
        category: categories.get(package_name) ?? null,
      }))
      .sort((a, b) => {
        const c = a.category.localeCompare(b.category)
        return c !== 0 ? c : a.package_name.localeCompare(b.package_name)
      })

    return new Response(
      JSON.stringify({ data: rows, count: rows.length }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
        status: 200,
      },
    )
  } catch (error) {
    const { status, error: safeMsg } = mapError(error)
    logger.error('get-app-categories', safeMsg, error instanceof Error ? error.message : error)
    return new Response(
      JSON.stringify({ error: safeMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
