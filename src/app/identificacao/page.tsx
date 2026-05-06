import { createClient } from '@/lib/supabase/server'
import IdentificacaoClient from './IdentificacaoClient'

export default async function IdentificacaoPage() {
  const supabase = await createClient()
  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('*')
    .eq('perfil', 'usuario')
    .eq('ativo', true)
    .order('nome')

  return <IdentificacaoClient usuarios={usuarios ?? []} />
}
