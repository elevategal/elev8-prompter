# Elev8 Prompter

טלפרומטר בעברית (RTL) — סינגל־פייג' HTML, PWA להתקנה, סנכרון ענן משותף בלי הרשמה.

## מבנה הפרויקט

```
elev8-prompter/
├── index.html              # האפליקציה — UI, מצב, פרומפטר, שלט
├── remote.html             # שלט מרחוק — פותחים במכשיר שני, שולט מרחוק
├── manifest.webmanifest    # PWA — שם, אייקונים, standalone, רקע שחור
├── sw.js                   # Service Worker — cache-first לשל אפליקציה, network-first ל-/api/*
├── icon.svg                # אייקון וקטורי
├── icon-192.png, icon-512.png
├── netlify.toml            # publish=".", functions=netlify/functions
├── package.json            # תלות: @netlify/blobs
└── netlify/functions/
    ├── sync.js             # GET/PUT /api/sync — סקריפטים/הגדרות/keymap ל-Netlify Blobs
    └── cmd.js              # GET/PUT /api/cmd — פקודות שלט־רחוק (play/pause/speed/...)
```

## איך עובד הסנכרון

**מזהה משותף קבוע** — אין הרשמה, אין קוד. כל מי שפותח את האתר רואה את אותם סקריפטים.
המפתח ב-Netlify Blobs: store `elev8-prompter`, key `shared-v1`.

**מודל הנתונים** (שמור גם ב-localStorage, גם בענן):
- `scripts[]` — כל סקריפט עם `id` (uuid), `name`, `text`, `updatedAt`
- `settings` — `{speed, font, width, startPad, mirrorH, mirrorV, guide, updatedAt}`
- `keymap` — `{map:{...}, updatedAt}`
- `tombstones[]` — `{id, deletedAt}` לסקריפטים שנמחקו (מנוקים אחרי 30 יום)

**זרימה** (index.html, `cloud sync` block):
1. פתיחה: `cloudPull()` נקרא — GET `/api/sync`, ואז `applyRemote()` ממזג ל-state.
2. שינוי כלשהו: `persist()` שומר ל-localStorage וקורא `scheduleCloudPush()` עם debounce של 1s.
3. כל 10 שניות + כשהחלון חוזר לפוקוס + כשחוזרים ל-online: `cloudPull()` שוב.
4. `cloudPush()` שולח PUT — הפונקציה בצד שרת קוראת את הגרסה הנוכחית בענן וממזגת עם מה שהגיע.

**מיזוג חכם** (`mergeDocs` ב-`netlify/functions/sync.js`, `applyRemote` ב-index.html):
- לכל סקריפט: `updatedAt` עדכני יותר מנצח.
- `tombstone.deletedAt > script.updatedAt` → הסקריפט מוסר.
- `settings` ו-`keymap` מנוצחים כבלוק שלם לפי `updatedAt`.

**חיווי בממשק** (`#syncBadge` בכותרת המסך הראשי):
- `ok` (טורקיז) — "מסונכרן"
- `busy` (צהוב) — "מסנכרן..." / "טוען..."
- `err` (אדום) — "אין חיבור"

בלי חלונות קופצים, בלי alert/prompt/confirm.

## שלט־מרחוק (remote.html)

- פתח את `/remote.html` במכשיר שני — טלפון/טאבלט.
- כפתורים גדולים: Play/Pause, מהירות ±, פונט ±, קפיצה, restart, exit, הפעל פרומפטר.
- **קנאל פקודות** — `netlify/functions/cmd.js`, blob key `cmd-v1`. הפורמט: `{ts, cmd, payload}`.
- הראשי (`index.html`) מבצע polling ל-`/api/cmd` כל 700ms (350ms במסך הפרומפטר). כל שינוי ב-`ts` = פקודה חדשה לביצוע.
- **iOS BT camera-remotes** — הראשי גם מפעיל MediaSession + audio שקט (`primeMediaSession()`) בכניסה למסך שלט/פרומפטר, ומתרגם `play/pause/next/prev/seek` ל-`handleKey()`. שלטי Volume-only של iOS Safari לא נקלטים ברמת הדפדפן; במקרה כזה עדיף להשתמש ב-`remote.html`.
- **עריכה מסונכרנת** — טקסט/שם סקריפט נערך ב-`remote.html`, נדחף ל-`/api/sync` עם debounce של 800ms, נקלט בראשי בסקר הבא (עד 10s, או מיידית כשחוזר לפוקוס).

## PWA

- `manifest.webmanifest` — `display: standalone`, רקע `#0A0B0D`, אייקון 192/512.
- `sw.js` נרשם ב-load. אסטרטגיה:
  - **`/api/*` וגופנים** — network-first (fallback לקאש רק אם אין רשת). מוודא שהסנכרון לא נתקע על גרסה ישנה.
  - **App shell** — cache-first עם רענון ברקע.
- שינוי גרסה: לעדכן `VERSION` ב-`sw.js` כדי לנקות קאש ישן.

## דיפלוי

### עדכון קוד רגיל
```bash
git add -A && git commit -m "..." && git push
```
Netlify מזהה את ה-push ומדפלט אוטומטית (build command ריק — סטטי + פונקציות בלבד).

### שרת סטטי לוקאלי (בלי פונקציות)
```bash
python3 -m http.server 8788
```
הבדג' יראה "אין חיבור" — צפוי, אין `/api/sync` מקומית.

### דיפלוי מלא לוקאלי (עם פונקציות)
```bash
npx netlify dev
```

## הערות

- **UI קפוא** — פרומפטר, מצב מראה, שלט, ספריית סקריפטים — לא לגעת בעיצוב/פונקציונליות קיימת. כל שינוי חייב להישאר שקוף ל-UX הקיים.
- **מפתחות סנכרון** — אם צריך "לאפס" את הענן: שנה את `KEY` ב-`sync.js`.
- **הרחבות אפשריות** — הוספת יותר משתמשים = לפצל לפי workspace-id ב-URL query.
