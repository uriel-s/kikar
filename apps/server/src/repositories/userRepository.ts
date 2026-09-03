import type { Prisma, PrismaClient } from "../generated/prisma";

// `as const` is load-bearing: without it every member widens from `true` to
// `boolean`, and Prisma stops being able to tell which columns a `select`
// actually asked for — every row would come back as "some subset of User",
// which is precisely the guarantee this file exists to make. `satisfies` then
// checks the names against the model without throwing that precision away.
const PUBLIC_FIELDS = {
  id: true,
  name: true,
  avatarUrl: true,
  createdAt: true,
} as const satisfies Prisma.UserSelect;

// Address, birth date, and email are only ever returned to the account owner.
// The old search endpoint had a "Remove sensitive information" comment directly
// above the line that returned all three to anyone who asked.
const PRIVATE_FIELDS = {
  ...PUBLIC_FIELDS,
  email: true,
  birthDate: true,
  address: true,
  updatedAt: true,
} as const satisfies Prisma.UserSelect;

export interface ListOptions {
  limit: number;
  cursor?: string;
}

export interface SearchOptions {
  query: string;
  limit: number;
}

/** Orders a pair so a friendship has exactly one representation. */
const canonicalPair = (x: string, y: string): [string, string] =>
  x < y ? [x, y] : [y, x];

const createUserRepository = (prisma: PrismaClient) => ({
  fieldsFor: (isSelf: boolean) => (isSelf ? PRIVATE_FIELDS : PUBLIC_FIELDS),

  findById: (id: string, { includePrivate = false }: { includePrivate?: boolean } = {}) =>
    prisma.user.findUnique({
      where: { id },
      select: includePrivate ? PRIVATE_FIELDS : PUBLIC_FIELDS,
    }),

  create: (data: Prisma.UserCreateInput) =>
    prisma.user.create({ data, select: PRIVATE_FIELDS }),

  update: (id: string, data: Prisma.UserUpdateInput) =>
    prisma.user.update({ where: { id }, data, select: PRIVATE_FIELDS }),

  setAvatarUrl: (id: string, avatarUrl: string) =>
    prisma.user.update({ where: { id }, data: { avatarUrl }, select: PUBLIC_FIELDS }),

  list: async ({ limit, cursor }: ListOptions) => {
    const rows = await prisma.user.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      select: PUBLIC_FIELDS,
    });
    return page(rows, limit, (row) => row.id);
  },

  /**
   * Case-insensitive substring match on name and email.
   *
   * Firestore cannot express this, so the old endpoint downloaded the entire
   * users collection on every keystroke and filtered it in Node.
   */
  search: async ({ query, limit }: SearchOptions) => {
    const rows = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { name: "asc" },
      select: PUBLIC_FIELDS,
    });
    return { items: rows };
  },

  areFriends: async (a: string, b: string) => {
    const [userAId, userBId] = canonicalPair(a, b);
    const row = await prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });
    return row !== null;
  },

  addFriend: async (a: string, b: string) => {
    const [userAId, userBId] = canonicalPair(a, b);
    // The composite primary key rejects a duplicate, so there is no
    // check-then-insert window for a double-add to slip through.
    await prisma.friendship.create({ data: { userAId, userBId } });
  },

  removeFriend: async (a: string, b: string) => {
    const [userAId, userBId] = canonicalPair(a, b);
    await prisma.friendship.delete({
      where: { userAId_userBId: { userAId, userBId } },
    });
  },

  listFriends: async (id: string) => {
    const rows = await prisma.friendship.findMany({
      where: { OR: [{ userAId: id }, { userBId: id }] },
      select: {
        userA: { select: PUBLIC_FIELDS },
        userB: { select: PUBLIC_FIELDS },
      },
      orderBy: { createdAt: "desc" },
    });
    // Exactly one side of each row is the caller; return the other one.
    return rows.map((row) => (row.userA.id === id ? row.userB : row.userA));
  },
});

/** Splits an over-fetched result into a page plus the cursor for the next one. */
const page = <T>(
  rows: T[],
  limit: number,
  cursorOf: (row: T) => string
): { items: T[]; nextCursor: string | null } => {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  // `.at(-1)` is honestly `T | undefined`. The extra test can never decide the
  // outcome — hasMore means rows.length exceeded a limit the pagination schema
  // floors at 1, so the slice is never empty — but it is what lets the last row
  // be used without asserting away a possibility the type system is right about.
  const last = items.at(-1);
  return {
    items,
    nextCursor: hasMore && last !== undefined ? cursorOf(last) : null,
  };
};

export { createUserRepository, PUBLIC_FIELDS, PRIVATE_FIELDS, canonicalPair, page };
