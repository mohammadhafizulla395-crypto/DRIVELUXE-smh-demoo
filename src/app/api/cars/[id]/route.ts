import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { carUpdateSchema } from '@/lib/validations'
import { FLEET } from '@/data/fleet'
import {
  ok,
  handleError,
  notFound,
  unauthorized,
  forbidden,
} from '@/lib/api-response'

export const runtime = 'nodejs'

/**
 * The database is only probed once per process (mirrors GET /api/cars).
 * When it is unreachable (serverless SQLite) every request would otherwise
 * pay the same failing round-trip, so the first failure latches the
 * fallback on for the rest of the process lifetime.
 */
let dbAvailable = true

/**
 * Resolve a car from the bundled fallback fleet by id, along with related
 * cars of the same type. Used when the id is a `static-XXX` id (served by
 * GET /api/cars when the DB is down) or when the database is unreachable.
 */
function staticCarById(id: string) {
  const car = FLEET.find((c) => c.id === id)
  if (!car) return null
  const related = FLEET.filter(
    (c) => c.type === car.type && c.id !== car.id && c.available,
  ).slice(0, 4)
  return { car, related }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Bundled static cars (served when the DB is unreachable) resolve
    // straight from the in-memory fleet — no database needed.
    if (id.startsWith('static-')) {
      const found = staticCarById(id)
      if (!found) return notFound('Car not found.')
      return ok({ car: found.car, related: found.related })
    }

    if (dbAvailable) {
      try {
        const car = await db.car.findUnique({ where: { id } })
        if (car) {
          // related cars (same type, excluding current)
          const related = await db.car.findMany({
            where: { type: car.type, id: { not: car.id }, available: true },
            take: 4,
            orderBy: { createdAt: 'desc' },
          })
          return ok({ car, related })
        }
        return notFound('Car not found.')
      } catch (dbErr) {
        // No reachable database (SQLite cannot be opened in a serverless
        // deployment). Stop retrying the database for the rest of this
        // process, then fall through to the bundled fallback below.
        dbAvailable = false
        console.warn(
          '[api/cars/[id]] database unavailable, falling back to bundled fleet:',
          dbErr instanceof Error ? dbErr.message : dbErr,
        )
      }
    }

    // Database unreachable — a real cuid cannot be resolved without it, so
    // return a clean 404 rather than an unexpected 500.
    return notFound('Car not found.')
  } catch (err) {
    return handleError(err)
  }
}

/** PUT /api/cars/[id] — admin only (partial update) */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUserFromRequest()
    if (!user) return unauthorized()
    if (user.role !== 'admin') return forbidden()

    const { id } = await params
    const existing = await db.car.findUnique({ where: { id } })
    if (!existing) return notFound('Car not found.')

    const body = await req.json()
    const data = carUpdateSchema.parse(body)

    const car = await db.car.update({ where: { id }, data })
    return ok({ car })
  } catch (err) {
    return handleError(err)
  }
}

/** DELETE /api/cars/[id] — admin only */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUserFromRequest()
    if (!user) return unauthorized()
    if (user.role !== 'admin') return forbidden()

    const { id } = await params
    const existing = await db.car.findUnique({ where: { id } })
    if (!existing) return notFound('Car not found.')

    await db.car.delete({ where: { id } })
    return ok({ message: 'Car deleted.' })
  } catch (err) {
    return handleError(err)
  }
}
