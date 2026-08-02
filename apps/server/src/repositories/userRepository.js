const PUBLIC_FIELDS = {
  id: true,
  name: true,
  avatarUrl: true,
  createdAt: true,
};

// Address, birth date, and email are only ever returned to the account owner.
// The old search endpoint had a "Remove sensitive information" comment directly
// above the line that returned all three to anyone who asked.
const PRIVATE_FIELDS = {
  ...PUBLIC_FIELDS,
  email: true,
  birthDate: true,
  address: true,
  updatedAt: true,
};

/** Orders a pair so a friendship has exactly one representation. */
const canonicalPair = (x, y) => (x < y ? [x, y] : [y, x]);

const createUserRepository = (prisma) => ({
  fieldsFor: (isSelf) => (isSelf ? PRIVATE_FIELDS : PUBLIC_FIELDS),

  findById: (id, { includePrivate = false } = {}) =>
    prisma.user.findUnique({
      where: { id },
      select: includePrivate ? PRIVATE_FIELDS : PUBLIC_FIELDS,
    }),

  create: (data) => prisma.user.create({ data, select: PRIVATE_FIELDS }),

  update: (id, data) =>
    prisma.user.update({ where: { id }, data, select: PRIVATE_FIELDS }),

  setAvatarUrl: (id, avatarUrl) =>
    prisma.user.update({ where: { id }, data: { avatarUrl }, select: PUBLIC_FIELDS }),

  list: async ({ limit, cursor }) => {
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
  search: async ({ query, limit }) => {
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

  areFriends: async (a, b) => {
    const [userAId, userBId] = canonicalPair(a, b);
    const row = await prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });
    return row !== null;
  },

  addFriend: async (a, b) => {
    const [userAId, userBId] = canonicalPair(a, b);
    // The composite primary key rejects a duplicate, so there is no
    // check-then-insert window for a double-add to slip through.
    await prisma.friendship.create({ data: { userAId, userBId } });
  },

  removeFriend: async (a, b) => {
    const [userAId, userBId] = canonicalPair(a, b);
    await prisma.friendship.delete({
      where: { userAId_userBId: { userAId, userBId } },
    });
  },

  listFriends: async (id) => {
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
const page = (rows, limit, cursorOf) => {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    nextCursor: hasMore ? cursorOf(items.at(-1)) : null,
  };
};

module.exports = { createUserRepository, PUBLIC_FIELDS, PRIVATE_FIELDS, canonicalPair, page };
