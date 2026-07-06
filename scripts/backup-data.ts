// Backup do dado atual ANTES de rodar a migration multi-tenant.
// Roda (com as envs do Vercel/Supabase):
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx --yes tsx scripts/backup-data.ts
// Alternativa sem script: Supabase → Table Editor → finance_data → Export.
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.')
  process.exit(1)
}

const db = createClient(url, key)
const { data, error } = await db.from('finance_data').select('*')
if (error) {
  console.error('Erro ao ler:', error.message)
  process.exit(1)
}
const file = `backup-finance-${new Date().toISOString().slice(0, 10)}.json`
writeFileSync(file, JSON.stringify(data, null, 2))
console.log(`OK — backup salvo em ${file} (${data?.length ?? 0} linha(s)). Guarde antes de migrar.`)
