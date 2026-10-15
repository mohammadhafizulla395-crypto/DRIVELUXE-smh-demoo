import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { db } from './db'
import type { UserRole, AuthEmployee as AuthEmployeeType } from '@/types'

const COOKIE_NAME = 'driveluxe_token'
const EMPLOYEE_COOKIE_NAME = 'driveluxe_employee_token'
const TOKEN_TTL_DAYS = 7

// In production, a missing JWT_SECRET must fail loudly. In dev, fall back.
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
  role: UserRole
}

// Employee JWT payload — separate session, separate cookie
export interface EmployeeJwtPayload {
  employeeId: string // internal db id
  employeeCode: string // EMP-XXXX
  role: string // support | fleet | customer_care
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  phone: string | null
  points: number
}

export type AuthEmployee = AuthEmployeeType

/* ------------------------------ password ------------------------------ */

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/* --------------------------------- jwt -------------------------------- */

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${TOKEN_TTL_DAYS}d` })
}

export function signEmployeeToken(payload: EmployeeJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${TOKEN_TTL_DAYS}d` })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & { employeeId?: string }
    // Employee tokens must not be accepted as user tokens
    if (decoded.employeeId) return null
    return decoded
  } catch {
    return null
  }
}

export function verifyEmployeeToken(token: string): EmployeeJwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as EmployeeJwtPayload & { userId?: string }
    if (!decoded.employeeId) return null
    return decoded
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

export async function setEmployeeCookie(token: string) {
  const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
  const store = await cookies()
  store.set(EMPLOYEE_COOKIE_NAME, token, {
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

export async function clearEmployeeCookie() {
  const store = await cookies()
  store.delete(EMPLOYEE_COOKIE_NAME)
}

export async function getTokenFromCookie(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value
}

export async function getEmployeeTokenFromCookie(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(EMPLOYEE_COOKIE_NAME)?.value
}

/* ------------------------- request helpers ---------------------------- */

/**
 * Reads the JWT from the httpOnly cookie, verifies it, and returns the user.
 * Returns null when unauthenticated / token invalid.
 */
export async function getUserFromRequest(): Promise<AuthUser | null> {
  const token = await getTokenFromCookie()
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      points: true,
    },
  })
  return user as AuthUser | null
}

/**
 * Reads the employee JWT from its separate cookie, verifies it, returns the employee.
 * Returns null when unauthenticated / token invalid / employee suspended.
 */
export async function getEmployeeFromRequest(): Promise<AuthEmployee | null> {
  const token = await getEmployeeTokenFromCookie()
  if (!token) return null
  const payload = verifyEmployeeToken(token)
  if (!payload) return null
  const emp = await db.employee.findUnique({
    where: { id: payload.employeeId },
    select: {
      id: true,
      employeeId: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      ticketsResolved: true,
      avgResponseMin: true,
      customerRating: true,
    },
  })
  if (!emp) return null
  // Suspended employees cannot use the portal
  if (emp.status === 'suspended') return null
  return emp as unknown as AuthEmployee
}
