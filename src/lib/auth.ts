// Hardcoded authentication - no database dependency
// 5 pre-defined user accounts: 1 admin, 2 users, 2 sellers
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'driveluxe_token'
const TOKEN_TTL_DAYS = 7

export const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'JWT_SECRET environment variable is required in production.',
      )
    }
    return 'driveluxe-dev-secret-change-in-production'
  }
  return secret
})()

export interface JwtPayload {
  userId: string
  role: 'admin' | 'user' | 'seller'
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'user' | 'seller'
  phone: string | null
  points: number
}

// Hardcoded 5 user accounts - no database needed
const HARDCODED_USERS: AuthUser[] = [
  {
    id: '1',
    email: 'admin@driveluxe.com',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin',
    phone: null,
    points: 0,
  },
  {
    id: '2',
    email: 'user1@driveluxe.com',
    password: 'user1234',
    name: 'User One',
    role: 'user',
    phone: null,
    points: 0,
  },
  {
    id: '3',
    email: 'user2@driveluxe.com',
    password: '5678',
    name: 'User Two',
    role: 'user',
    phone: null,
    points: 0,
  },
  {
    id: '4',
    email: 'seller1@driveluxe.com',
    password: 'seller123',
    name: 'Seller One',
    role: 'seller',
    phone: null,
    points: 0,
  },
  {
    id: '5',
    email: 'seller2@driveluxe.com',
    password: 'sel456',
    name: 'Seller Two',
    role: 'seller',
    phone: null,
    points: 0,
  },
]

/* ------------------------------ password ------------------------------ */

export async function hashPassword(plain: string): Promise<string> {
  return plain // No hashing needed for hardcoded accounts
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return plain === hash
}

/* --------------------------------- jwt -------------------------------- */

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${TOKEN_TTL_DAYS}d` })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return null
  }
}

/* ------------------------------ cookies ------------------------------- */

export async function setAuthCookie(token: string) {
  const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  })
}

export async function clearAuthCookie() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export async function getTokenFromCookie(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value
}

/* ------------------------- request helpers ---------------------------- */

export async function authenticateUser(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const user = HARDCODED_USERS.find(
    (u) => u.email === email && u.password === password,
  )
  if (!user) return null
  return user
}

export async function getUserFromRequest(): Promise<AuthUser | null> {
  const token = await getTokenFromCookie()
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  const user = HARDCODED_USERS.find((u) => u.id === payload.userId)
  return user ?? null
}