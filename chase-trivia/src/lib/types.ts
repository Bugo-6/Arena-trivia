export type Mode = 'ffa' | 'chase' | 'team'
export type Status = 'lobby' | 'question' | 'reveal' | 'board' | 'final_intro' | 'final' | 'finished'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type ChaseStatus = 'alive' | 'caught' | 'qualified'

export interface Settings {
  categories: string[]
  difficulty: Difficulty | 'mixed'
  rounds: number
  time_limit: number
}

export interface QuestionState {
  idx: number
  kind: 'ffa' | 'team' | 'build' | 'chase'
  text: string
  answers: string[]
  cat: string
  diff: Difficulty
  limit: number
  started_at: string
  deadline: string
}

export interface RevealResult {
  player_id: string
  choice: number | null
  correct: boolean
  points: number
  ms: number | null
}

export interface Reveal {
  idx: number
  kind: string
  correct_idx: number
  results: RevealResult[]
  chaser: { correct: boolean; choice: number } | null
  caught: string[]
  qualified: string[]
  team_bonus: number[]
}

export interface RankRow {
  player_id: string
  name: string
  avatar: number
  team: number | null
  score: number
  rank: number
  correct_count: number
  chase_status: ChaseStatus
  bank: number
  final_correct: number
  final_wrong: number
}

export interface FinalResults {
  ranking: RankRow[]
  winner_team: number | null
  team_scores: Record<string, number>
  chase: { qualified: number; team_total: number; chaser_final: number; team_won: boolean } | null
}

export interface RoomState {
  phase?: string
  total?: number
  board_len?: number
  q?: QuestionState
  answered?: string[]
  reveal?: Reveal
  reveal_at?: string
  chaser_pos?: number
  team_scores?: Record<string, number>
  final_started_at?: string
  final_seconds?: number
  final_deadline?: string
  results?: FinalResults
}

export interface Room {
  id: string
  code: string
  host_player_id: string | null
  mode: Mode
  status: Status
  settings: Settings
  state: RoomState
  round: number
  step: number
  created_at: string
  updated_at: string
}

export interface FinalQuestion {
  n: number
  text: string
  answers: string[]
  cat: string
  diff: Difficulty
}

export interface Player {
  id: string
  room_id: string
  user_id: string
  name: string
  avatar: number
  team: number | null
  score: number
  correct_count: number
  bank: number
  position: number
  chase_status: ChaseStatus
  final_correct: number
  final_wrong: number
  final_n: number
  final_q: FinalQuestion | null
  final_locked_until: string | null
  last_seen: string
  joined_at: string
}

export interface GameResult {
  id: number
  room_code: string
  mode: Mode
  player_name: string
  rank: number
  score: number
  correct_count: number
  answered: number
  players_count: number
  won: boolean
  played_at: string
}
