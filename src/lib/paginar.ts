const TAMANHO_PAGINA = 1000

interface Resposta<T> {
  data: T[] | null
  error: unknown
}

/**
 * O PostgREST corta cada resposta em 1000 linhas, sem avisar. Consultas que podem
 * passar disso precisam paginar — senao o resto simplesmente some da conta, que foi
 * o que fez o saldo da lojinha aparecer errado quando o extrato cruzou 1000 linhas.
 *
 * Use para listas que crescem sem teto. Para saldo, prefira a view saldos_produtos,
 * que ja soma no banco.
 */
export async function buscarTodos<T>(
  consulta: (de: number, ate: number) => PromiseLike<Resposta<T>>
): Promise<T[]> {
  const todas: T[] = []

  for (let pagina = 0; ; pagina++) {
    const de = pagina * TAMANHO_PAGINA
    const { data, error } = await consulta(de, de + TAMANHO_PAGINA - 1)
    if (error || !data) break
    todas.push(...data)
    if (data.length < TAMANHO_PAGINA) break
  }

  return todas
}
