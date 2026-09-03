#!/usr/bin/env node
/**
 * Fills a local database with demo data so the application can be looked at.
 *
 *   npm run db:seed -- --dry-run    report what would be written
 *   npm run db:seed                 write it
 *   npm run db:seed -- --clean      remove every row this script created
 *   npm run db:seed -- --yes        allow a non-local DATABASE_URL
 *
 * It writes to whatever DATABASE_URL holds, so it prints the target host first
 * and refuses a non-local one without --yes. That is not paranoia: this
 * repository's .env has pointed at a hosted database, and eight invented people
 * in a live feed have to be undoable, which is what --clean is for.
 *
 * This is developer tooling, not product code. An empty database renders an
 * empty wall, and a design cannot be judged against nothing: the redesign needs
 * a feed with long posts and short ones, cards with a crowd of likes and cards
 * with none, and timestamps that actually exercise the relative formatter.
 *
 * Idempotent in the same way `db:import` is — every write is an upsert or a
 * `skipDuplicates` insert keyed on a deterministic id, so a second run updates
 * the rows the first one wrote instead of duplicating them.
 *
 * Nothing here touches real accounts: seed rows carry a `seed-` id prefix and a
 * `.test` email domain (reserved by RFC 2606, so it can never resolve), which
 * makes them recognizable at a glance and impossible to confuse with a Firebase
 * UID.
 */
const { createHash } = require("node:crypto");
const { parse } = require("../src/config/env");
const { createPrismaClient } = require("../src/lib/prisma");
const { canonicalPair } = require("../src/repositories/userRepository");

const dryRun = process.argv.includes("--dry-run");
const cleanOnly = process.argv.includes("--clean");
const allowRemote =
  process.argv.includes("--yes") || process.env.SEED_ALLOW_REMOTE === "1";

const stats = {
  users: 0,
  posts: 0,
  likes: 0,
  comments: 0,
  friendships: 0,
  skipped: [],
};

const skip = (kind, reason) => stats.skipped.push(`${kind}: ${reason}`);

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Captured once, so every row in a run shares one reference point instead of
// drifting by however long the run takes.
const now = Date.now();

const ago = ({ d = 0, h = 0, m = 0 }) => new Date(now - d * DAY - h * HOUR - m * MINUTE);

const after = (date, { d = 0, h = 0, m = 0 }) =>
  new Date(date.getTime() + d * DAY + h * HOUR + m * MINUTE);

const SEED_NAMESPACE = "9b2f5a44-7d31-4b6e-8c0a-1f3d5e7a9c11";

/**
 * A stable UUID for a human-readable key.
 *
 * `Post.id` and `Comment.id` are real `uuid` columns, so a readable
 * "seed-post-shelves" cannot be the id — Postgres rejects it. Deriving one
 * instead (RFC 4122 v5: a fixed namespace plus the key) is what lets the upserts
 * below address the same row on every run without persisting a slug-to-uuid
 * table anywhere.
 */
const uuidFor = (key) => {
  const namespace = Buffer.from(SEED_NAMESPACE.replace(/-/g, ""), "hex");
  const digest = createHash("sha1")
    .update(Buffer.concat([namespace, Buffer.from(key, "utf8")]))
    .digest();

  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
};

/**
 * The cast. Keyed by first name so the posts below can name an author in one
 * word; `id` is what actually reaches the database.
 *
 * `avatarUrl` is left null on all eight, deliberately. The new avatar component
 * derives initials and a colour from the id, and a set of real photographs would
 * hide exactly the thing being designed.
 *
 * The ids are also TUNED, which is not obvious and is easy to undo. The client
 * hashes a hue out of the id, so these eight strings decide the eight colours
 * the demo wall shows; the current set lands on 4, 52, 107, 161, 180, 230, 272
 * and 314, a minimum separation of 19 degrees. Two earlier ids fell 2 degrees
 * apart and rendered as the same colour, which is precisely the failure the hue
 * rule exists to prevent. Rename anyone here and re-check the spread against
 * `avatarHue` in apps/client/src/lib/avatarColor.js.
 */
const USERS = {
  dana: { id: "seed-dana-levi", email: "dana.levi@kikar.test", name: "Dana Levi" },
  noam: { id: "seed-noam-barak", email: "noam.barak@kikar.test", name: "Noam Barak" },
  maya: { id: "seed-maya-vardi", email: "maya.vardi@kikar.test", name: "Maya Vardi" },
  itai: { id: "seed-itai-shalev", email: "itai.shalev@kikar.test", name: "Itai Shalev" },
  rotem: {
    id: "seed-rotem-azulay",
    email: "rotem.azulay@kikar.test",
    name: "Rotem Azulay",
  },
  yonatan: {
    id: "seed-yonatan-mizrahi",
    email: "yonatan.mizrahi@kikar.test",
    name: "Yonatan Mizrahi",
  },
  shira: {
    id: "seed-shira-ben-ami",
    email: "shira.ben-ami@kikar.test",
    name: "Shira Ben-Ami",
  },
  omer: { id: "seed-omer-katz", email: "omer.katz@kikar.test", name: "Omer Katz" },
};

/**
 * The feed, newest first.
 *
 * `at` is an age rather than a date, so the whole timeline re-anchors to the
 * moment of the run. Fixed timestamps would read as "minutes ago" on the day
 * they were written and "last spring" a month later, which is no use for
 * reviewing a relative-time component. The spread is intentional — several posts
 * within the hour, then hours, then days, then weeks — and so are the gaps:
 * `late-shift` has no likes and no comments because the emptiest card is the one
 * most likely to look broken.
 *
 * A comment's `at` is relative to its post, since a comment predating the post
 * it answers is nonsense.
 */
const POSTS = [
  {
    slug: "coffee-count",
    author: "maya",
    at: { m: 6 },
    content:
      "Third coffee of the day and it is not even eleven. I have made a series of decisions.",
    likes: ["itai", "dana", "omer"],
    comments: [
      {
        author: "omer",
        at: { m: 3 },
        content: "There is no third coffee. There is one coffee that simply keeps going.",
      },
      { author: "rotem", at: { m: 4 }, content: "Water. Have one water. For me." },
    ],
  },
  {
    slug: "bus-doors",
    author: "itai",
    at: { m: 24 },
    content:
      "The 18 went past my stop with the doors open. Not slowing, not stopping. Just a bus, living its life.",
    likes: ["maya", "rotem"],
    comments: [
      { author: "noam", at: { m: 6 }, content: "Same driver, I think. He waved at me." },
    ],
  },
  {
    slug: "shelves-done",
    author: "dana",
    at: { m: 52 },
    content:
      "The balcony shelves are finally up. Two weekends, four trips to the hardware store, and I now own a drill I will use again in roughly nine years.",
    likes: ["noam", "shira", "maya", "yonatan", "omer"],
    comments: [
      {
        author: "shira",
        at: { m: 9 },
        content: "Nine years is optimistic. Mine has been in a cupboard since 2019.",
      },
      {
        author: "yonatan",
        at: { m: 15 },
        content: "Can I borrow it for the new flat? I have exactly one thing to hang.",
      },
      {
        author: "dana",
        at: { m: 21 },
        content: "It is yours. Bring it back with the bits this time.",
      },
    ],
  },
  {
    slug: "dentist-ask",
    author: "rotem",
    at: { h: 1, m: 25 },
    content:
      "Does anyone have a dentist to recommend near the market? Ideally one who does not open with a speech about flossing.",
    likes: ["shira"],
    comments: [
      {
        author: "maya",
        at: { m: 12 },
        content:
          "Mine has never once mentioned floss and I have been going for years. Sending you the number.",
      },
      { author: "rotem", at: { m: 18 }, content: "You have saved my entire week." },
    ],
  },
  {
    slug: "trumpet",
    author: "yonatan",
    at: { h: 3, m: 30 },
    content:
      "My upstairs neighbour has taken up the trumpet. Please think of me at around seven every evening.",
    likes: ["dana", "maya", "itai", "omer", "shira", "noam"],
    comments: [
      {
        author: "omer",
        at: { m: 11 },
        content: "Congratulations on the free concert series.",
      },
      {
        author: "dana",
        at: { m: 25 },
        content: "Give it three weeks. It gets strangely nice.",
      },
      {
        author: "itai",
        at: { m: 40 },
        content: "Buy him a music stand and you are the good neighbour forever.",
      },
    ],
  },
  {
    slug: "burnt-toast",
    author: "omer",
    at: { h: 5, m: 10 },
    content: "Made shakshuka, burned the bread, ate both. Breakfast is a spectrum.",
    likes: ["maya", "rotem"],
    comments: [],
  },
  {
    slug: "book-fifty-pages",
    author: "shira",
    at: { h: 7, m: 40 },
    content:
      "Fifty pages into the book everyone kept telling me to read and I still cannot name a single character. Giving it twenty more.",
    likes: ["dana", "noam", "yonatan"],
    comments: [
      {
        author: "noam",
        at: { m: 35 },
        content: "It clicks around page ninety. Or it does not and we all pretend.",
      },
      {
        author: "shira",
        at: { m: 52 },
        content: "Twenty more pages of blind faith it is.",
      },
    ],
  },
  {
    slug: "walked-home",
    author: "noam",
    at: { h: 10 },
    content:
      "Skipped the train and walked the whole way home. Ninety minutes, and the entire city smelled like rain. No regrets, terrible shoes.",
    likes: ["shira", "dana", "maya", "itai"],
    comments: [
      {
        author: "shira",
        at: { h: 1, m: 5 },
        content: "The shoes were always going to be the problem.",
      },
    ],
  },
  {
    slug: "lost-keys",
    author: "maya",
    at: { h: 14 },
    content:
      "Spent twenty minutes looking for my keys. They were in the door. On the outside. All night.",
    likes: ["itai", "omer", "rotem", "dana", "yonatan"],
    comments: [
      {
        author: "itai",
        at: { m: 40 },
        content: "Your building is either very safe or very unobservant.",
      },
      { author: "maya", at: { h: 1 }, content: "I have decided that it is trust." },
    ],
  },
  {
    slug: "late-shift",
    author: "itai",
    at: { h: 19 },
    content:
      "Closing shift again. The only good part is the walk back, when the streets are completely empty.",
    likes: [],
    comments: [],
  },
  {
    slug: "first-run",
    author: "dana",
    at: { d: 1, h: 3 },
    content:
      "First run in about a year. Managed four kilometres and then lay down on the grass in the park like a Victorian widow.",
    likes: ["maya", "shira", "noam", "omer", "rotem", "yonatan", "itai"],
    comments: [
      {
        author: "rotem",
        at: { h: 2 },
        content:
          "Four kilometres after a year is not nothing. The grass part is tradition.",
      },
      {
        author: "omer",
        at: { h: 3, m: 10 },
        content: "Was there a dramatic hand on the forehead?",
      },
      {
        author: "dana",
        at: { h: 4 },
        content: "There was. A jogger stopped to ask whether I was alright.",
      },
    ],
  },
  {
    slug: "plant-status",
    author: "rotem",
    at: { d: 1, h: 9 },
    content:
      "The basil is thriving, the mint has taken over the windowsill, and the rosemary has been dead since March and I refuse to admit it.",
    likes: ["dana", "shira"],
    comments: [
      {
        author: "shira",
        at: { h: 5 },
        content: "Let the rosemary go. It has been letting you go since March.",
      },
    ],
  },
  {
    slug: "new-flat",
    author: "yonatan",
    at: { d: 2, h: 2 },
    content:
      "Moved into the new place today. Boxes everywhere, nothing in the fridge, but the kettle is unpacked so it is officially home.",
    likes: ["dana", "maya", "itai", "shira", "omer", "noam", "rotem"],
    comments: [
      {
        author: "maya",
        at: { h: 1, m: 30 },
        content: "Kettle first is the correct order. Welcome to the neighbourhood.",
      },
      {
        author: "noam",
        at: { h: 6 },
        content: "Say the word and I will come and carry boxes on Friday.",
      },
      {
        author: "yonatan",
        at: { h: 8 },
        content: "Friday at ten, then. There will be pastries.",
      },
    ],
  },
  {
    slug: "bad-film",
    author: "omer",
    at: { d: 2, h: 20 },
    content:
      "Watched a film with a 94% rating and understood none of it. Am I the problem here? Genuine question.",
    likes: ["itai", "noam"],
    comments: [
      {
        author: "itai",
        at: { h: 2 },
        content:
          "You are not the problem. It is two hours of people staring out of windows.",
      },
    ],
  },
  {
    slug: "market-tomatoes",
    author: "shira",
    at: { d: 3, h: 6 },
    content:
      "Bought far too many tomatoes because the man at the market was nice to me. This is a recurring vulnerability.",
    likes: ["rotem", "dana", "maya"],
    comments: [
      {
        author: "rotem",
        at: { h: 3 },
        content: "Bring them over. I have basil I cannot get rid of.",
      },
    ],
  },
  {
    slug: "replacement-bus",
    author: "noam",
    at: { d: 4 },
    content:
      "Trains are down again, so it is the replacement bus and a very slow tour of every industrial estate on the line.",
    likes: ["itai"],
    comments: [],
  },
  {
    slug: "job-news",
    author: "maya",
    at: { d: 5, h: 8 },
    content:
      "Starting the new job on Sunday. Nervous in the specific way where you keep rereading the same email.",
    likes: ["dana", "shira", "rotem", "yonatan", "itai", "omer", "noam"],
    comments: [
      {
        author: "dana",
        at: { m: 45 },
        content:
          "You are going to be excellent, and you are allowed to be nervous anyway.",
      },
      {
        author: "shira",
        at: { h: 2 },
        content: "Rereading the email is part of the job. Congratulations.",
      },
      { author: "yonatan", at: { h: 9 }, content: "Coffee on Sunday before you go in?" },
    ],
  },
  {
    slug: "grandmother-soup",
    author: "dana",
    at: { d: 8 },
    content:
      "Tried to make my grandmother's soup from memory. It is not her soup. It is a soup. She would have had opinions.",
    likes: ["shira", "maya", "omer"],
    comments: [
      {
        author: "shira",
        at: { h: 4 },
        content: "It never is. Mine tastes like a rumour of the original.",
      },
    ],
  },
  {
    slug: "bike-fixed",
    author: "itai",
    at: { d: 12 },
    content:
      "Fixed the bike myself instead of paying someone. It makes a new noise now, but it is my noise.",
    likes: ["noam", "yonatan"],
    comments: [],
  },
  {
    slug: "sea-swim",
    author: "shira",
    at: { d: 19 },
    content:
      "Went for a swim before work. The water was freezing, the sky was pink, the whole thing lasted eleven minutes and fixed my entire week.",
    likes: ["maya", "dana", "rotem", "noam"],
    comments: [
      {
        author: "maya",
        at: { h: 6 },
        content: "Eleven minutes is a whole personality. I am coming next time.",
      },
    ],
  },
];

/** Written in either direction; canonicalPair decides which id goes in which column. */
const FRIENDSHIPS = [
  ["dana", "noam"],
  ["dana", "maya"],
  ["dana", "shira"],
  ["dana", "yonatan"],
  ["dana", "omer"],
  ["maya", "itai"],
  ["maya", "shira"],
  ["maya", "yonatan"],
  ["maya", "rotem"],
  ["noam", "shira"],
  ["noam", "itai"],
  ["rotem", "shira"],
  ["rotem", "omer"],
  ["itai", "omer"],
  ["yonatan", "omer"],
];

const seedUsers = async (prisma) => {
  for (const user of Object.values(USERS)) {
    const row = { ...user, avatarUrl: null };

    if (!dryRun) {
      await prisma.user.upsert({ where: { id: user.id }, create: row, update: row });
    }
    stats.users += 1;
  }
};

const seedLikes = async (prisma, post, postId) => {
  const likers = post.likes.filter((key) => {
    if (!USERS[key]) {
      skip("like", `on post ${post.slug} by unknown seed user ${key}`);
      return false;
    }
    return true;
  });

  const rows = [...new Set(likers)].map((key) => ({ postId, userId: USERS[key].id }));

  if (rows.length > 0 && !dryRun) {
    // createMany counts rows actually inserted, so a second run reports zero
    // likes. That is the idempotency showing, not a failure.
    const result = await prisma.like.createMany({ data: rows, skipDuplicates: true });
    stats.likes += result.count;
  } else {
    stats.likes += rows.length;
  }
};

const seedComments = async (prisma, post, postId, postedAt) => {
  for (const [index, comment] of post.comments.entries()) {
    const author = USERS[comment.author];
    if (!author) {
      skip("comment", `on post ${post.slug} by unknown seed user ${comment.author}`);
      continue;
    }

    const createdAt = after(postedAt, comment.at);
    if (createdAt.getTime() > now) {
      skip("comment", `on post ${post.slug} is offset further than the post is old`);
      continue;
    }

    // Position in the list, not content: two identical replies on one post are
    // plausible, and hashing the text would silently collapse them into one row.
    const id = uuidFor(`comment:${post.slug}:${index}`);
    const row = { id, postId, authorId: author.id, content: comment.content, createdAt };

    if (!dryRun) {
      await prisma.comment.upsert({ where: { id }, create: row, update: row });
    }
    stats.comments += 1;
  }
};

const seedPosts = async (prisma) => {
  for (const post of POSTS) {
    const author = USERS[post.author];
    if (!author) {
      skip("post", `${post.slug} authored by unknown seed user ${post.author}`);
      continue;
    }

    const id = uuidFor(`post:${post.slug}`);
    const createdAt = ago(post.at);
    // createdAt is in the update as well as the create: re-running the seed is
    // how a demo timeline that has drifted into last month gets pulled back to
    // the present.
    const row = { id, authorId: author.id, content: post.content, createdAt };

    if (!dryRun) {
      await prisma.post.upsert({ where: { id }, create: row, update: row });
    }
    stats.posts += 1;

    await seedLikes(prisma, post, id);
    await seedComments(prisma, post, id, createdAt);
  }
};

const seedFriendships = async (prisma) => {
  const pairs = new Set();

  for (const [a, b] of FRIENDSHIPS) {
    if (!USERS[a] || !USERS[b]) {
      skip("friendship", `${a} -> ${b} (unknown seed user)`);
      continue;
    }
    // canonicalPair satisfies the userAId < userBId CHECK constraint and, as a
    // side effect, collapses a pair listed twice in opposite directions. NUL as
    // the separator for the same reason db:import uses it: it cannot occur
    // inside an id, so the join is unambiguous.
    pairs.add(canonicalPair(USERS[a].id, USERS[b].id).join("\0"));
  }

  const rows = [...pairs].map((key) => {
    const [userAId, userBId] = key.split("\0");
    return { userAId, userBId };
  });

  if (rows.length > 0 && !dryRun) {
    const result = await prisma.friendship.createMany({
      data: rows,
      skipDuplicates: true,
    });
    stats.friendships += result.count;
  } else {
    stats.friendships += rows.length;
  }
};

/**
 * Where DATABASE_URL actually points, for printing. Credentials never come back
 * out — the point is to name the host, not to echo the secret.
 */
const describeTarget = (url) => {
  try {
    const { hostname, port, pathname } = new URL(url);
    return { hostname, label: `${hostname}${port ? `:${port}` : ""}${pathname}` };
  } catch {
    return { hostname: "", label: "(unparseable DATABASE_URL)" };
  }
};

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "db",
  "postgres",
]);

/**
 * Deletes only what this script created.
 *
 * Users are enough: Post, Like, Comment and Friendship all declare
 * `onDelete: Cascade` on their user relations, so removing the eight seed rows
 * takes their posts and everything hanging off them with it. Nothing outside
 * the `seed-` prefix is matched, so a database holding real accounts loses
 * nothing.
 */
const clean = async (prisma) => {
  const { count } = await prisma.user.deleteMany({
    where: { id: { startsWith: "seed-" } },
  });
  console.log(
    `removed ${count} seed user(s); their posts, likes, comments and friendships cascaded.`
  );
};

const main = async () => {
  const env = parse();
  const target = describeTarget(env.DATABASE_URL);
  const writing = !dryRun;

  // Say where before doing anything. This script writes fake people into a
  // product, and DATABASE_URL is whatever the environment happens to hold — in
  // this repository that has pointed at a hosted database more than once. A
  // seed run that never names its target is one `.env` away from putting eight
  // invented users in front of real ones.
  console.log(`target: ${target.label}`);

  if (writing && !LOCAL_HOSTS.has(target.hostname) && !allowRemote) {
    console.error(
      `\nRefusing to write to a non-local database.\n` +
        `Pass --yes (or set SEED_ALLOW_REMOTE=1) if that is genuinely what you want,\n` +
        `and remember there is an undo: npm run db:seed -- --clean\n`
    );
    process.exit(1);
  }

  const prisma = createPrismaClient(env);

  if (cleanOnly) {
    await clean(prisma);
    await prisma.$disconnect();
    return;
  }

  console.log(dryRun ? "\nDRY RUN - nothing will be written\n" : "\nSeeding...\n");

  // Users first: posts, likes, comments and friendships all reference them, and
  // the reference is checked against the table above rather than the database,
  // so a typo in a one-word author key is reported instead of raising a foreign
  // key error halfway through the run.
  await seedUsers(prisma);
  await seedPosts(prisma);
  await seedFriendships(prisma);

  console.log(`users:       ${stats.users}`);
  console.log(`posts:       ${stats.posts}`);
  console.log(`likes:       ${stats.likes}`);
  console.log(`comments:    ${stats.comments}`);
  console.log(`friendships: ${stats.friendships}`);

  if (stats.skipped.length > 0) {
    console.log(`\nskipped ${stats.skipped.length} record(s):`);
    for (const line of stats.skipped) console.log(`  - ${line}`);
  }

  await prisma.$disconnect();
};

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
