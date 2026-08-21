export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'etoj-salt-v1')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const candidate = await hashPassword(password)
  return candidate === hash
}

export async function generateToken(payload: object, secret: string): Promise<string> {
  const { sign } = await import('hono/jwt')
  return sign(
    { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 },
    secret
  )
}
