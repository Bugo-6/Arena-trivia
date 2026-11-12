import type { Mode } from './types'

export const CATEGORIES = [
  { id: 'general', label: 'ידע כללי', icon: '🧠' },
  { id: 'science', label: 'מדע', icon: '🔬' },
  { id: 'geography', label: 'גיאוגרפיה', icon: '🌍' },
  { id: 'history', label: 'היסטוריה', icon: '🏛️' },
  { id: 'sports', label: 'ספורט', icon: '⚽' },
  { id: 'entertainment', label: 'קולנוע וטלוויזיה', icon: '🎬' },
  { id: 'technology', label: 'טכנולוגיה', icon: '💻' },
  { id: 'music', label: 'מוזיקה', icon: '🎵' },
  { id: 'israel', label: 'ישראל', icon: '🇮🇱' },
  { id: 'food', label: 'אוכל ותרבות', icon: '🍕' },
] as const

export const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id
export const catIcon = (id: string) => CATEGORIES.find((c) => c.id === id)?.icon ?? '❓'

export const DIFFICULTIES = [
  { id: 'mixed', label: 'מעורב' },
  { id: 'easy', label: 'קל' },
  { id: 'medium', label: 'בינוני' },
  { id: 'hard', label: 'קשה' },
] as const

export const diffLabel = (id: string) => ({ easy: 'קל', medium: 'בינוני', hard: 'קשה', mixed: 'מעורב' })[id] ?? id

export const MODES: { id: Mode; name: string; tag: string; desc: string; icon: string; min: number }[] = [
  {
    id: 'chase',
    name: 'המרדף',
    tag: 'המצב הראשי',
    desc: 'בונים צבר, בורחים מהרודף על הלוח, ומי ששורד נכנס לסיבוב הגמר מול השעון.',
    icon: '🏃',
    min: 2,
  },
  {
    id: 'ffa',
    name: 'כולם נגד כולם',
    tag: 'מהירות קובעת',
    desc: 'אותה שאלה לכולם. תשובה נכונה ומהירה שווה יותר נקודות, ולוח התוצאות זז בזמן אמת.',
    icon: '⚡',
    min: 2,
  },
  {
    id: 'team',
    name: 'קרב קבוצות',
    tag: 'שתי קבוצות',
    desc: 'שתי קבוצות, ניקוד משותף ובונוס כשכל הקבוצה צודקת. הקבוצה עם הכי הרבה נקודות מנצחת.',
    icon: '🛡️',
    min: 2,
  },
]

export const modeName = (id: string) => MODES.find((m) => m.id === id)?.name ?? id

export const AVATARS = ['🦊', '🐼', '🦁', '🐯', '🐸', '🐙', '🦄', '🐲', '🦉', '🐺', '🐧', '🦈']
export const AVATAR_HUES = [24, 200, 38, 12, 140, 330, 280, 160, 48, 220, 190, 250]

export const TEAM_NAMES = ['הלהבות', 'הברקים']

export const ERRORS: Record<string, string> = {
  not_authenticated: 'ההתחברות נכשלה. נסו לרענן את הדף.',
  auth_failed: 'ההתחברות לשרת נכשלה. בדקו שהתחברות אנונימית מופעלת ב-Supabase.',
  invalid_name: 'השם צריך להיות באורך 1 עד 16 תווים.',
  room_not_found: 'לא מצאנו חדר עם הקוד הזה.',
  room_full: 'החדר מלא (עד 8 שחקנים).',
  game_started: 'המשחק בחדר הזה כבר התחיל.',
  name_taken: 'השם הזה כבר תפוס בחדר, תבחרו אחר.',
  not_host: 'רק המארח יכול לעשות את זה.',
  not_member: 'אתם לא חלק מהחדר הזה.',
  need_players: 'צריך לפחות 2 שחקנים כדי להתחיל.',
  teams_unbalanced: 'בקרב קבוצות צריך לפחות שחקן אחד בכל קבוצה.',
  invalid_state: 'הפעולה לא זמינה כרגע.',
  invalid_settings: 'ההגדרות לא תקינות.',
  too_many_rooms: 'פתחתם יותר מדי חדרים. תסיימו משחק קיים קודם.',
  already_answered: 'כבר ענית על השאלה הזו.',
  too_late: 'הזמן נגמר.',
  too_early: 'עוד לא אפשר.',
  stale_question: 'השאלה כבר התחלפה.',
  network: 'אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.',
}

export const errText = (e: unknown): string => {
  const msg = e instanceof Error ? e.message : String(e)
  const key = Object.keys(ERRORS).find((k) => msg.includes(k))
  return key ? ERRORS[key] : 'משהו השתבש. נסו שוב.'
}
