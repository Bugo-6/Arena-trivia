import { Link } from 'react-router-dom'
import { Shell } from '../components/Shell'

export function SetupNotice() {
  return (
    <div className="glass pad setup stack">
      <div className="title-md">⚙️ צריך לחבר שרת כדי לשחק</div>
      <p className="muted" style={{ margin: 0 }}>
        המולטיפלייר רץ על Supabase (מסד נתונים + Realtime + אימות אנונימי). עוד לא הוגדרו פרטי חיבור, אז אי אפשר ליצור חדר.
      </p>
      <Link className="btn primary" to="/setup">
        הוראות חיבור
      </Link>
    </div>
  )
}

export default function Setup() {
  return (
    <Shell>
      <main className="page narrow stack setup">
        <h1 className="title-lg">חיבור השרת – 5 דקות</h1>
        <div className="glass pad">
          <ol>
            <li>
              פותחים פרויקט חינמי ב-<code>supabase.com</code>.
            </li>
            <li>
              ב-<code>Authentication → Sign In / Providers</code> מפעילים <code>Allow anonymous sign-ins</code>.
            </li>
            <li>
              ב-<code>SQL Editor</code> מריצים את הקובץ <code>supabase/schema.sql</code> ואז את <code>supabase/seed.sql</code>.
            </li>
            <li>
              ב-<code>Database → Replication</code> מוודאים שהטבלאות <code>rooms</code> ו-<code>players</code> מופעלות ל-Realtime (הסכימה כבר עושה את זה).
            </li>
            <li>
              יוצרים קובץ <code>.env</code> בשורש הפרויקט עם הערכים מ-<code>Project Settings → API</code>:
              <pre>{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}</pre>
            </li>
            <li>
              מריצים מחדש: <code>npm run dev</code>
            </li>
          </ol>
        </div>
        <div className="glass pad">
          <div className="title-md">רוצים לנסות בלי Supabase?</div>
          <p className="muted">
            <code>npm run dev:local</code> מפעיל אותו שרת בדיוק (אותו SQL, על Postgres מוטמע) על המחשב שלכם. אפשר לפתוח כמה לשוניות או לשחק מכמה מכשירים ברשת הביתית.
          </p>
        </div>
        <Link to="/" className="btn ghost">
          חזרה
        </Link>
      </main>
    </Shell>
  )
}
