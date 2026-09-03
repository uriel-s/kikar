# תוכנית רפקטור — Kikar v3

מסמך עבודה. נכתב ב-2026-08-04.

המטרה: לקחת פרויקט שהארכיטקטורה שלו כבר טובה ולהביא אותו לסטאק של 2026 —
שירוץ ברשת בחינם, יהיה נוח לפיתוח מקומי, וייראה כמו משהו שנכתב השנה.

הרפקטור הזה הוא גם מסלול לימוד. כל שלב מסביר **מה** הטכנולוגיה, **למה** היא
עדיפה על מה שיש, ו**איך יודעים** שהשלב הסתיים.

---

## החלטות שננעלו

| נושא         | הבחירה                                         | הסיבה בשורה                                                    |
| ------------ | ---------------------------------------------- | -------------------------------------------------------------- |
| שפה          | **TypeScript** בקליינט ובשרת                   | הפער הבולט ביותר; עם Prisma+zod רוב הטיפוסים נגזרים לבד        |
| Build קליינט | **Vite** במקום CRA                             | CRA לא מתוחזק; Vite מהיר פי כמה ומוריד ~2,000 חבילות           |
| API          | **Express 5 נשאר**                             | הארכיטקטורה כאן טובה. לא מחליפים מה שעובד                      |
| מארח קליינט  | **Vercel** (סטטי)                              | חינם, CDN עולמי, אפס cold start                                |
| מארח API     | **Vercel Serverless Function**                 | חינם, Express רץ שם כמעט as-is                                 |
| DB           | **Neon** PostgreSQL                            | חינם, scale-to-zero, התעוררות ~חצי שנייה. אותו Prisma          |
| Auth         | **Firebase Auth** — נשאר, משודרג ל-modular SDK | חינמי; אף משתמש לא מאבד סיסמה                                  |
| קבצים        | **Cloudflare R2** במקום Firebase Storage       | 10GB חינם, אפס egress. Firebase Storage כבר דורש תוכנית בתשלום |
| עיצוב        | **Tailwind v4 + shadcn/ui**                    | מחליף את Bootstrap+tachyons+FontAwesome בבת אחת                |
| State שרת    | **TanStack Query**                             | מוחק את כל ה-boilerplate של loading/error/cache                |
| ניתוב        | **React Router v7**                            | v5 הוא שני מייג'ורים מאחור                                     |
| מבנה         | מונו-רפו + **`packages/shared`**               | סכמות zod משותפות = ההצדקה האמיתית למונו-רפו                   |

### מה נשאר בדיוק כמו שהוא

- שכבות השרת: `routes → middleware → controllers → repositories → prisma`
- הזרקת התלויות (`createApp({ env, auth, bucket, prisma, logger })`)
- keyset pagination, `pg_trgm`, אילוצי ה-DB (`likes` composite PK, `friendships` CHECK)
- 52 הטסטים הקיימים — **הם רשת הביטחון. חייבים להיות ירוקים בסוף כל שלב.**

---

## למה כל בחירה — ההסבר המלא

### Serverless, ולמה לא Edge

יש שלוש דרכים להריץ שרת:

- **VM / Container** — מכונה שרצה תמיד. זה היה ה-EC2. אין cold start, אבל עולה כסף.
- **Serverless** — הפונקציה נטענת כשמגיעה בקשה ומתה אחריה. משלמים לפי בקשה,
  ובנפח פורטפוליו זה $0. המחיר: `cold start` של ~300ms–1s כשהיא ישנה.
- **Edge** (Cloudflare Workers) — רץ ב-300 נקודות בעולם, אפס cold start.
  אבל זה **לא Node.js** — זה runtime מצומצם. רוב ספריות ה-Node לא רצות שם.

בחרנו Serverless. הטיעון המכריע: `firebase-admin` — הספרייה שמאמתת את הטוקנים —
היא ספריית Node ולא רצה על Edge. מעבר ל-Edge היה מחייב לכתוב אימות JWT ידני
מאפס. זה בדיוק סוג הקוד שלא כותבים כשלומדים.

### למה Neon ולא Supabase

שניהם PostgreSQL מנוהל בחינם. ההבדל שמכריע לפרויקט פורטפוליו:

- **Supabase** משהה פרויקט חינמי אחרי ~7 ימי חוסר פעילות. מגייס שלוחץ על הלינק
  אחרי שבועיים מקבל אתר מת.
- **Neon** רק נרדם, ומתעורר תוך פחות משנייה. הלינק תמיד עובד.

### למה מוציאים את Firebase Storage

מאז סוף 2024, פרויקטי Firebase חדשים דורשים תוכנית Blaze (בתשלום) כדי להפעיל
Storage. Firebase **Auth** נשאר חינמי — ולכן הוא נשאר.

הקוד כבר בנוי למעבר הזה: כל הגישה לאחסון מרוכזת ב-`services/storageService.ts`
ומוזרקת פנימה כ-`bucket`. זה בדיוק מה שהזרקת תלויות קונה — החלפת ספק אחסון היא
קובץ אחד.

R2 תואם ל-S3 API, כלומר משתמשים ב-`@aws-sdk/client-s3` — מיומנות שמועברת לכל
ענן אחר.

### למה `packages/shared` הוא העיקר

היום יש `apps/client` ו-`apps/server` בלי שום דבר משותף. זה לא מונו-רפו, זה שתי
תיקיות. הרעיון:

```
packages/shared/src/schemas/post.ts
        ┌──── z.object({ content: z.string().min(1).max(500) })
        │
   ┌────┴────┐
   ↓         ↓
הקליינט      השרת
מוודא        מוודא
בטופס        בבקשה
```

סכמה אחת. אם תשנה את המגבלה ל-1000 תווים, שני הצדדים מתעדכנים ו-TypeScript
יצעק על כל מקום שלא תואם. **זה לא אפשרי בלי TypeScript** — ולכן המעבר ל-TS הוא
תנאי מקדים.

---

## השלבים

כל שלב נגמר במצב שאפשר למזג ל-`main` ולפרוס. אין big-bang.

### שלב 0 — לתקן את הכלים השבורים

**המצב:** `npm run lint` מריץ `eslint .` ואין קובץ הגדרות ESLint בשום מקום ברפו.
הפקודה פשוט נכשלת.

**מה לומדים:** ESLint 9 עבר ל-_flat config_ — `eslint.config.js` שמייצא מערך
במקום `.eslintrc` היררכי. זה השינוי הגדול האחרון ב-lint בעולם ה-JS.

**מה משתנה:**

- `eslint.config.js` בשורש, עם הגדרות נפרדות לקליינט ולשרת
- `tsconfig.base.json` בשורש (עוד לא בשימוש — מכינים קרקע)
- Prettier כבר מוגדר ותקין, רק לוודא שהוא לא מתנגש ב-ESLint

**סיום:** `npm run lint` עובר נקי. `npm test` עדיין ירוק.

---

### שלב 1 — CRA → Vite

**מה זה:** Vite הוא כלי הבנייה שהחליף את CRA כברירת המחדל. הוא לא מהדר את כל
האפליקציה לפני שהוא מתחיל — הוא מגיש קבצים ישירות לדפדפן ומהדר רק את מה שנטען.
לכן `npm run dev` עולה ברגע, ושינוי בקובץ מופיע במסך מיידית.

**למה:** CRA הוכרז כלא-מתוחזק. הוא גורר ~2,300 חבילות ומייצר בילדים איטיים.

**מה משתנה:**

- `apps/client/vite.config.ts`, `index.html` עובר ל-`apps/client/` (Vite דורש אותו בשורש)
- `process.env.REACT_APP_*` → `import.meta.env.VITE_*` — בכל הקבצים
- `.env` של הקליינט: כל המשתנים משנים תחילית
- `react-scripts` יוצא, `vite` + `@vitejs/plugin-react` נכנסים
- `apps/client/Dockerfile` — פקודת ה-build משתנה
- `.github/workflows/ci.yml` — שמות המשתנים בבילד

**סיום:** `npm run dev` מרים קליינט תוך פחות מ-3 שניות; `npm run build` מייצר
`dist/` שעולה; כל המסכים עובדים ידנית.

---

### שלב 2 — לעלות לאוויר (Neon + Vercel)

**למה עכשיו ולא בסוף:** כדי שיהיה לינק חי מהיום הראשון, ושתלמד פריסה בהדרגה
במקום להתמודד איתה בבת אחת בסוף.

**מה לומדים:**

- **Connection pooling** — serverless פותח חיבור DB חדש בכל בקשה. Postgres קורס
  מזה. Neon נותן שתי כתובות: אחת ישירה (למיגרציות) ואחת דרך pooler (לאפליקציה).
  זו טעות הפריסה הכי נפוצה בסטאק הזה.
- **סודות** — `FIREBASE_SERVICE_ACCOUNT_JSON` נכנס ל-Vercel Environment
  Variables, לא לקוד ולא ל-git.
- **Build-time vs runtime env** — משתני קליינט נצרבים ב-bundle בזמן בנייה; משתני
  שרת נקראים בזמן ריצה. זו הבחנה שמבלבלת הרבה אנשים.

**מה משתנה:**

- `apps/server/api/index.ts` — עוטף את `createApp()` כ-Vercel handler
- `vercel.json` — routing בין הקליינט הסטטי ל-`/api`
- `DATABASE_URL` → Neon pooled; `DIRECT_URL` → Neon ישיר, ב-`schema.prisma`
- `CORS_ORIGINS` → הדומיין של Vercel

**סיום:** יש URL ציבורי. אפשר להירשם, לפרסם פוסט, ולעשות לייק.

**⚠️ סוגיה פתוחה:** Vercel מגביל גוף בקשה ל-4.5MB, וההגבלה שלנו לאווטאר היא 5MB.
ראה "סוגיות פתוחות" למטה.

---

### שלב 3 — TypeScript בשרת

**מה לומדים:** גם המעבר מ-CommonJS (`require`) ל-ESM (`import`) — התקן שהעולם
עבר אליו.

**סדר העבודה — מבפנים החוצה.** התלויות זורמות `routes → controllers →
repositories`, אז מטפסים בכיוון ההפוך:

1. `lib/` + `config/` — קטן ובלי תלויות, מקום טוב לטעות בו
2. `schemas/` — zod כבר מייצר טיפוסים דרך `z.infer`, כמעט בחינם
3. `repositories/` — Prisma מייצר את הטיפוסים שלו, גם כאן כמעט בחינם
4. `controllers/` + `middleware/` — כאן מגדירים את `Request` המורחב עם `req.user`
5. `routes/` + `app.ts`
6. הטסטים אחרונים

**מה משתנה:** כל `apps/server/src/**`, `tsconfig.json`, `tsx` לפיתוח במקום
`nodemon`, `jest` עובר ל-`ts-jest` (או ישירות ל-Vitest — נחליט בסשן הטסטים).

**סיום:** `npm run typecheck` נקי; 52 הטסטים ירוקים; הפריסה ב-Vercel עדיין עובדת.

---

### שלב 4 — TypeScript בקליינט

Vite כבר יודע TypeScript, אז אין הגדרות בנייה חדשות.

**סדר:** `lib/apiClient` → `api/*` → `contexts/AuthContext` → `Components/` →
`pages/`. משנים סיומת לקובץ אחד, מתקנים את השגיאות, ממשיכים.

**סיום:** אין `.js` ב-`apps/client/src`; `npm run typecheck` נקי.

---

### שלב 5 — `packages/shared`

**מה משתנה:**

- `apps/server/src/schemas/` עובר ל-`packages/shared/src/schemas/`
- טיפוסי התגובות של ה-API מוגדרים שם (`Post`, `User`, `Paginated<T>`)
- שני ה-apps מוסיפים `@kikar/shared` כתלות

**סיום:** שינוי מגבלת אורך בסכמה בשרת שובר קומפילציה בקליינט. זו המטרה.

---

### שלב 6 — TanStack Query + React Router v7

**מה זה TanStack Query:** ספרייה שמנהלת "מצב שמגיע מהשרת". במקום `useState` +
`useEffect` + `loading` + `error` בכל קומפוננטה, מצהירים _מה_ רוצים והיא מטפלת
בטעינה, בשגיאות, ב-cache, ברענון אוטומטי וב-pagination.

```ts
// לפני — בכל עמוד מחדש
const [posts, setPosts] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
useEffect(() => {
  /* fetch, setState, catch */
}, []);

// אחרי
const { data, isLoading, error } = useQuery({
  queryKey: ["posts"],
  queryFn: getPosts,
});
```

יש לה `useInfiniteQuery` שמתחבר ישירות ל-`nextCursor` שהשרת כבר מחזיר.

**React Router v7:** v5 משתמש ב-`<Switch>` ו-`component=`. v7 משתמש ב-`<Routes>`,
`element=`, ו-hooks (`useNavigate` במקום `history.push`).

**סיום:** אין `useEffect` שקורא ל-API; הפיד נטען אינסופית עם `useInfiniteQuery`.

---

### שלב 7 — Tailwind v4 + shadcn/ui

**מה זה Tailwind:** במקום לכתוב CSS בקובץ נפרד, מרכיבים עיצוב ממחלקות קטנות
ישירות ב-JSX — `class="flex items-center gap-4 rounded-lg p-4"`. הרווח: אין קובץ
CSS שגדל לנצח, ואין חשש למחוק מחלקה שמישהו אחר משתמש בה.

**מה זה shadcn/ui:** לא ספריית קומפוננטות רגילה. אין `npm install` — מריצים
פקודה שמעתיקה את קוד המקור של הקומפוננטה **לפרויקט שלך**. הקוד שלך, לעריכה
חופשית, בלי תלות שתשבור אותך בעדכון הבא.

**מה יוצא:** `bootstrap`, `react-bootstrap`, `tachyons`, `@fortawesome/*`, `App.css`
**מה נכנס:** `tailwindcss` v4, `lucide-react` לאייקונים, קומפוננטות shadcn

**מה נכתב מחדש:** 11 קומפוננטות + 10 עמודים. זה השלב הארוך ביותר — וזה גם השלב
שאנשים באמת רואים.

**כדאי גם:** מצב כהה, ותמיכת RTL לעברית (Tailwind v4 מטפל בזה עם `ps-`/`pe-`
במקום `pl-`/`pr-`).

**סיום:** אין Bootstrap ב-bundle; Lighthouse מעל 90; צילומי מסך חדשים ב-README.

---

### שלב 8 — Firebase: Storage → R2, ו-compat → modular

**חלק א' — אחסון:**
`services/storageService.ts` הוא הקובץ היחיד שנוגע ב-bucket. מחליפים את המימוש
ל-`@aws-sdk/client-s3` מול R2. הזרקת התלויות אומרת שאף קורא לא משתנה, והטסטים
שמזריקים bucket מזויף ממשיכים לעבוד כמו שהם.

**חלק ב' — Firebase modular SDK:**
היום: `firebase/compat/app`, ו-`auth.signInWithEmailAndPassword(...)`.
העתיד: `import { signInWithEmailAndPassword } from "firebase/auth"`.
היתרון האמיתי: tree-shaking — נכנס ל-bundle רק מה שבאמת קראת לו.

**סיום:** אווטאר חדש נשמר ב-R2 ומוצג; אין `firebase/compat` בקוד.

---

### שלב 9 — טסטים _(סשן נפרד)_

הכיוון: Vitest + Testing Library + MSW לקליינט, Playwright ל-E2E, והרחבת השרת
מעבר לאבטחה גם ללוגיקה עסקית. יעד coverage שנאכף ב-CI.

### שלב 10 — CI/CD _(סשן נפרד)_

הכיוון: להוסיף lint, typecheck, coverage ו-E2E ל-CI הקיים; פריסה אוטומטית
ל-Vercel במיזוג ל-`main`; preview deployment לכל PR; Renovate לעדכוני תלויות.

---

### שלב 11 — פיצ'ר, לא רפקטור _(אופציונלי, ומומלץ בחום)_

**רפקטור לבדו בלתי נראה למגייס.** אף אחד לא רואה ש-CRA הפך ל-Vite. מה שכן נראה
זה פיצ'ר.

הבחירה הטבעית — היא כבר רשומה ב-README תחת "Known gaps":
**בקשות חברות עם אישור/דחייה + התראות ב-real-time.**

- טבלת `friend_requests` עם `status`
- טבלת `notifications`
- דחיפה לדפדפן ב-SSE (`Server-Sent Events`) — פשוט בהרבה מ-WebSocket וזורם דרך
  HTTP רגיל

---

## סוגיות פתוחות — להחליט לפני שמגיעים אליהן

### 1. מגבלת 4.5MB של Vercel מול אווטאר של 5MB

Vercel Serverless מגביל גוף בקשה ל-4.5MB. ההגבלה הנוכחית לאווטאר היא 5MB.

| אפשרות                                | יתרון                                                      | חיסרון                                             |
| ------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| להוריד את המגבלה ל-4MB                | שורה אחת                                                   | פתרון עוקף                                         |
| **העלאה ישירה ל-R2 עם presigned URL** | הארכיטקטורה הנכונה; השרת יוצא ממסלול הקובץ; אין מגבלת גודל | בדיקת ה-magic bytes צריכה לעבור לאימות אחרי ההעלאה |

ההעלאה הישירה היא הפתרון הנכון, אבל היא נוגעת בתכונת אבטחה שכבר יש עליה טסט
(`avatarUpload.test.js`). להחליט בשלב 8.

### 2. `jest` או `vitest` בשרת

Vitest מהיר יותר ומבין TypeScript ללא הגדרות. מצד שני `jest` כבר עובד ויש 52
טסטים. ההצעה: לעבור ל-Vitest בשלב 9 — ה-API כמעט זהה.

### 3. Turborepo

מוסיף caching לפקודות מונו-רפו (`build`, `test`, `lint`) — לא בונה מחדש מה שלא
השתנה. תועלת אמיתית ב-CI, ומילת מפתח מוכרת. אבל זה עוד מושג. ההצעה: להוסיף בשלב
10, יחד עם ה-CI.

### 4. הנתונים הישנים

`scripts/importFromFirestore.js` מייבא מ-Firestore. אם עדיין צריך אותו — הוא צריך
לעבור ל-TypeScript בשלב 3. אם הייבוא כבר בוצע — למחוק אותו ולשמור את התיעוד.

---

## מה במפורש _לא_ עושים

- **Kubernetes / Terraform / microservices** — רעש בפרויקט של 6,300 שורות.
  ל-README כבר יש הסבר טוב למה אין IaC; זה נשאר נכון.
- **החלפת Express** — הארכיטקטורה כאן היא הצד החזק של הפרויקט.
- **מעבר ל-GraphQL / tRPC** — ה-REST כאן נקי, מתועד, ועם keyset pagination
  אמיתית. `packages/shared` נותן את בטיחות הטיפוסים שבשבילה אנשים הולכים ל-tRPC.
- **Storybook** — לא מצדיק את עצמו ב-21 קומפוננטות.

---

## דברים שאינם קוד ומשנים יותר ממנו

לפי סדר החזר-על-מאמץ:

1. **חשבון דמו + כפתור "Try demo"** — מגייס לא ירשם. שווה יותר מכל טסט.
2. **Seed data** — אתר ריק נראה כמו אתר שבור. סקריפט שמייצר משתמשים ופוסטים.
3. **צילומי מסך / GIF ב-README** — מה שבאמת מסתכלים עליו.
4. **דומיין משלך** (~$10/שנה) — `kikar.dev` נראה אחרת מ-`kikar-x7f2.vercel.app`.
5. **ציון Lighthouse 95+** כ-badge.
6. **פוסט LinkedIn על ה-_מעבר_, לא על הפרויקט** — "לקחתי אפליקציה מ-2021 בלי שום
   אימות, ובניתי אותה מחדש" זה סיפור. `docs/SECURITY-REMEDIATION.md` וסעיף
   "What changed in v2" הם כבר החומר הגולמי.

---

## סיכום זמנים

| שלב | תוכן                       | הערכה                             |
| --- | -------------------------- | --------------------------------- |
| 0   | ESLint + tsconfig          | קצר                               |
| 1   | Vite                       | קצר                               |
| 2   | Neon + Vercel              | בינוני — הרבה מושגים חדשים        |
| 3   | TS בשרת                    | בינוני                            |
| 4   | TS בקליינט                 | בינוני                            |
| 5   | packages/shared            | קצר                               |
| 6   | TanStack Query + Router v7 | בינוני                            |
| 7   | Tailwind + shadcn          | **ארוך** — כתיבה מחדש של 21 קבצים |
| 8   | R2 + Firebase modular      | בינוני                            |
| 9   | טסטים                      | סשן נפרד                          |
| 10  | CI/CD                      | סשן נפרד                          |
| 11  | פיצ'ר חברות + התראות       | אופציונלי                         |

**כלל אחד לאורך כל הדרך:** בסוף כל שלב, 52 הטסטים ירוקים והאתר עולה. אם שלב
מתחיל להתפרש על שניים — לפצל אותו, לא להאריך אותו.
