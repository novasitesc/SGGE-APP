export async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? "Error en la solicitud");
  }
  return body as T;
}
