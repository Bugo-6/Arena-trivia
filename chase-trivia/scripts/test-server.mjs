// End-to-end test of the multiplayer server logic (schema.sql + seed.sql) on an in-process Postgres (PGlite).
// Simulates real clients: each call runs as a different auth.uid(). Run: npm run test:server
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = new PGlite();
let failures = 0;
const ok = (cond, msg) => { if (cond) console.log("  ✓", msg); else { failures++; console.log("  ✗ FAIL:", msg); } };

await db.exec(`
  create role anon; create role authenticated;
  create schema auth; grant usage on schema auth to authenticated, anon;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
`);
await db.exec(fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8"));
await db.exec(fs.readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));
const qcount = (await db.query("select count(*)::int n from questions")).rows[0].n;
console.log(`schema + seed loaded (${qcount} questions)`);

const U = { A: "00000000-0000-0000-0000-00000000000a", B: "00000000-0000-0000-0000-00000000000b", C: "00000000-0000-0000-0000-00000000000c", D: "00000000-0000-0000-0000-00000000000d" };
const as = async (u) => { await db.query("select set_config('app.uid', $1, false)", [u ?? ""]); };
const rpc = async (u, fn, ...args) => {
  await as(u);
  const ph = args.map((_, i) => `$${i + 1}`).join(",");
  const typed = args.map((a) => (a !== null && typeof a === "object" ? JSON.stringify(a) : a));
  const res = await db.query(`select public.${fn}(${args.map((a, i) => (a !== null && typeof a === "object" ? `$${i + 1}::jsonb` : `$${i + 1}`)).join(",")}) as r`, typed);
  return res.rows[0].r;
};
const tryRpc = async (u, fn, ...args) => { try { return { ok: true, r: await rpc(u, fn, ...args) }; } catch (e) { return { ok: false, err: e.message }; } };
const room = async (id) => (await db.query("select * from rooms where id=$1", [id])).rows[0];
const players = async (id) => (await db.query("select * from players where room_id=$1 order by joined_at", [id])).rows;
const correctIdx = async (roomId, idx) => (await db.query("select correct_idx from room_questions where room_id=$1 and player_id is null and idx=$2", [roomId, idx])).rows[0].correct_idx;

async function newGame(mode, settings = {}) {
  const c = await rpc(U.A, "create_room", "אלון", 1);
  const rid = c.room_id;
  const b = await rpc(U.B, "join_room", c.code.toLowerCase(), "בר", 2);
  const cc = await rpc(U.C, "join_room", c.code, "גל", 3);
  await rpc(U.A, "update_settings", rid, mode, { categories: [], difficulty: "mixed", rounds: 4, time_limit: 12, ...settings });
  return { rid, code: c.code, pid: { A: c.player_id, B: b.player_id, C: cc.player_id } };
}

// answer helper: policy(name, idx) => true correct / false wrong / null skip
async function answerAll(g, policy) {
  await skipLead(g.rid);
  const r = await room(g.rid);
  const idx = r.state.q.idx;
  const cor = await correctIdx(g.rid, idx);
  const ps = await players(g.rid);
  for (const [name, u] of Object.entries(U)) {
    const p = ps.find((x) => x.user_id === u);
    if (!p) continue;
    if (r.state.q.kind === "chase" && p.chase_status !== "alive") continue;
    const pol = policy(name, idx, p);
    if (pol === null) continue;
    await rpc(u, "submit_answer", g.rid, idx, pol ? cor : (cor + 1) % 4);
  }
}
const skipLead = async (rid) => db.query(`update rooms set state = jsonb_set(jsonb_set(state,'{q,started_at}', to_jsonb((state->'q'->>'started_at')::timestamptz - interval '5 seconds')),'{q,deadline}', to_jsonb((state->'q'->>'deadline')::timestamptz - interval '5 seconds')) where id=$1 and status='question'`, [rid]);
const adv = async (g) => { const r = await room(g.rid); await rpc(U.A, "advance", g.rid, r.step); };

// ---------------------------------------------------------------- security
console.log("\n[security]");
{
  await as(U.A);
  await db.exec("set role authenticated");
  for (const t of ["questions", "room_questions", "answers"]) {
    let denied = false; try { await db.query(`select * from ${t} limit 1`); } catch { denied = true; }
    ok(denied, `clients cannot read ${t}`);
  }
  let denied = false; try { await db.query("update rooms set status='finished'"); } catch { denied = true; }
  ok(denied, "clients cannot write rooms directly");
  denied = false; try { await db.query("update players set score=99999"); } catch { denied = true; }
  ok(denied, "clients cannot set their own score");
  denied = false; try { await db.query("select public._reveal(gen_random_uuid())"); } catch { denied = true; }
  ok(denied, "internal helper functions are not callable by clients");
  await db.exec("reset role");
  const anon = await tryRpc(null, "create_room", "x", 0);
  ok(!anon.ok && /not_authenticated/.test(anon.err), "unauthenticated callers are rejected");
  const bad = await tryRpc(U.A, "create_room", "   ", 0);
  ok(!bad.ok && /invalid_name/.test(bad.err), "empty names are rejected");
  const long = await tryRpc(U.A, "create_room", "x".repeat(40), 0);
  ok(!long.ok && /invalid_name/.test(long.err), "over-long names are rejected");
}

// ------------------------------------------------------------------- lobby
console.log("\n[lobby]");
let g = await newGame("ffa");
{
  const ps = await players(g.rid);
  ok(ps.length === 3, "3 players joined (case-insensitive room code worked)");
  ok(/^[A-Z2-9]{5}$/.test(g.code), `room code format ok (${g.code})`);
  const dupName = await tryRpc(U.D, "join_room", g.code, "אלון", 0);
  ok(!dupName.ok && /name_taken/.test(dupName.err), "duplicate display name rejected");
  const nf = await tryRpc(U.D, "join_room", "ZZZZZ", "דני", 0);
  ok(!nf.ok && /room_not_found/.test(nf.err), "unknown room code rejected");
  const notHost = await tryRpc(U.B, "start_game", g.rid);
  ok(!notHost.ok && /not_host/.test(notHost.err), "only the host can start");
  const notHost2 = await tryRpc(U.B, "update_settings", g.rid, "chase", {});
  ok(!notHost2.ok && /not_host/.test(notHost2.err), "only the host can change settings");
  const badSet = await tryRpc(U.A, "update_settings", g.rid, "ffa", { categories: ["hax"], difficulty: "mixed", rounds: 4, time_limit: 12 });
  ok(!badSet.ok && /invalid_settings/.test(badSet.err), "invalid category in settings rejected");
  const rejoin = await rpc(U.B, "join_room", g.code, "בר", 2);
  ok(rejoin.player_id === g.pid.B, "reconnect returns the same player");
  for (const n of ["D", "E", "F", "G", "H"]) {
    const u = `00000000-0000-0000-0000-0000000000${n === "D" ? "dd" : n === "E" ? "ee" : n === "F" ? "ff" : n === "G" ? "g0".replace("g", "1") : "21"}`;
    await rpc(u, "join_room", g.code, "שחקן" + n, 0);
  }
  const ps2 = await players(g.rid);
  ok(ps2.length === 8, "8 players fit");
  const full = await tryRpc("00000000-0000-0000-0000-000000000099", "join_room", g.code, "ט", 0);
  ok(!full.ok && /room_full/.test(full.err), "9th player rejected (room_full)");
  for (const p of ps2.slice(3)) await rpc(p.user_id, "leave_room", g.rid);
  ok((await players(g.rid)).length === 3, "players can leave the lobby");
  const one = await newGame("ffa");
  await rpc(U.B, "leave_room", one.rid); await rpc(U.C, "leave_room", one.rid);
  const tooFew = await tryRpc(U.A, "start_game", one.rid);
  ok(!tooFew.ok && /need_players/.test(tooFew.err), "cannot start with fewer than 2 players");
}

// -------------------------------------------------------------- mode A: ffa
console.log("\n[mode A — everyone against everyone]");
{
  await rpc(U.A, "start_game", g.rid);
  let r = await room(g.rid);
  ok(r.status === "question" && r.state.q.answers.length === 4, "game started, first question served with 4 answers");
  ok(!JSON.stringify(r.state).includes("correct_idx"), "correct answer is NOT in public state before reveal");
  const early = await tryRpc(U.A, "advance", g.rid, r.step);
  ok(!early.ok && /too_early/.test(early.err), "host cannot skip a question before time/all answered");
  const idx0 = r.state.q.idx;
  const cor = await correctIdx(g.rid, idx0);
  const tooSoon = await tryRpc(U.A, "submit_answer", g.rid, idx0, cor);
  ok(!tooSoon.ok && /too_early/.test(tooSoon.err), "answers during the 3-2-1 lead-in are rejected");
  await skipLead(g.rid);
  r = await room(g.rid);
  await rpc(U.A, "submit_answer", g.rid, idx0, cor);
  const dbl = await tryRpc(U.A, "submit_answer", g.rid, idx0, (cor + 1) % 4);
  ok(!dbl.ok && /already_answered/.test(dbl.err), "second answer from same player rejected");
  const stale = await tryRpc(U.B, "submit_answer", g.rid, 7, 0);
  ok(!stale.ok && /stale_question/.test(stale.err), "answer for a different question rejected");
  const badc = await tryRpc(U.B, "submit_answer", g.rid, idx0, 9);
  ok(!badc.ok && /invalid_choice/.test(badc.err), "invalid choice rejected");
  await rpc(U.B, "submit_answer", g.rid, idx0, (cor + 1) % 4);   // wrong
  await rpc(U.C, "submit_answer", g.rid, idx0, cor);             // correct, later
  r = await room(g.rid);
  ok(r.state.answered.length === 3, "answered list tracks who answered (3)");
  await adv(g);
  r = await room(g.rid);
  ok(r.status === "reveal" && r.state.reveal.correct_idx === cor, "reveal shows the correct answer");
  const res = Object.fromEntries(r.state.reveal.results.map((x) => [x.player_id, x]));
  ok(res[g.pid.A].correct && res[g.pid.A].points >= 600, "correct answer scored >= 600");
  ok(!res[g.pid.B].correct && res[g.pid.B].points === 0, "wrong answer scored 0");
  ok(res[g.pid.A].points >= res[g.pid.C].points, "faster correct answer gets >= points than slower one");
  const nonhost = await tryRpc(U.B, "advance", g.rid, r.step);
  ok(!nonhost.ok && /not_host/.test(nonhost.err), "non-host cannot advance");
  const staleAdv = await rpc(U.A, "advance", g.rid, r.step - 1);
  r = await room(g.rid);
  ok(r.status === "reveal", "stale advance is a harmless no-op");
  // finish remaining rounds
  while ((await room(g.rid)).status !== "finished") {
    r = await room(g.rid);
    if (r.status === "reveal") await adv(g);
    else { await answerAll(g, (n) => n === "A" || (n === "B" && Math.random() < 0.5)); await adv(g); }
  }
  r = await room(g.rid);
  const rk = r.state.results.ranking;
  ok(rk.length === 3 && rk[0].rank === 1 && rk[0].name === "אלון", "game finished; host (always correct) wins");
  const seenQ = (await db.query("select count(*)::int n, count(distinct question_id)::int d from room_questions where room_id=$1", [g.rid])).rows[0];
  ok(seenQ.n === seenQ.d && seenQ.n === 4, "4 rounds played with no duplicate questions");
  const hist = (await db.query("select * from game_results where room_code=$1", [g.code])).rows;
  ok(hist.length === 3 && hist.some((h) => h.won && h.player_name === "אלון"), "game history rows written (3, winner flagged)");
  await rpc(U.A, "reset_room", g.rid);
  ok((await room(g.rid)).status === "lobby", "host can reset the room for a rematch");
}

// ------------------------------------------------------------ host handover
console.log("\n[disconnect / reconnect]");
{
  const h = await newGame("ffa");
  const early = await tryRpc(U.B, "claim_host", h.rid);
  ok(!early.ok && /host_active/.test(early.err), "cannot steal host while host is connected");
  await db.query("update players set last_seen = now() - interval '60 seconds' where id=$1", [h.pid.A]);
  await rpc(U.B, "claim_host", h.rid);
  ok((await room(h.rid)).host_player_id === h.pid.B, "a connected player can take over after host disconnects");
  await rpc(U.B, "start_game", h.rid);
  await skipLead(h.rid);
  await db.query("update players set last_seen = now() - interval '60 seconds' where id=$1", [h.pid.C]);
  await answerAll(h, (n) => (n === "C" ? null : true));
  const r = await room(h.rid);
  await rpc(U.B, "advance", h.rid, r.step);
  ok((await room(h.rid)).status === "reveal", "round ends when all CONNECTED players answered (disconnected one does not block)");
  await rpc(U.A, "heartbeat", h.rid);
  const reconn = await rpc(U.A, "join_room", h.code, "אלון", 1);
  ok(reconn.player_id === h.pid.A, "player can rejoin a running game with the same account");
  const late = await tryRpc(U.D, "join_room", h.code, "מאחר", 0);
  ok(!late.ok && /game_started/.test(late.err), "new players cannot join a running game");
  await db.query("update rooms set state = jsonb_set(state,'{reveal_at}', to_jsonb(now() - interval '60 seconds')) where id=$1", [h.rid]);
  const r2 = await room(h.rid);
  await rpc(U.C, "advance", h.rid, r2.step);
  ok((await room(h.rid)).status === "question", "if the host stalls, any player can advance after a timeout");
}

// -------------------------------------------------------------- mode C: team
console.log("\n[mode C — team battle]");
{
  const t = await newGame("team");
  await rpc(U.A, "set_team", t.rid, 0);
  await rpc(U.B, "set_team", t.rid, 1);
  await rpc(U.A, "start_game", t.rid);
  const ps = await players(t.rid);
  ok(ps.every((p) => p.team === 0 || p.team === 1), "all players assigned to a team (auto-balance for unassigned)");
  ok(ps.find((p) => p.user_id === U.C).team === 1 || ps.find((p) => p.user_id === U.C).team === 0, "unassigned player balanced");
  while ((await room(t.rid)).status !== "finished") {
    const r = await room(t.rid);
    if (r.status === "reveal") await adv(t);
    else { await answerAll(t, (n, i, p) => p.team === 0); await adv(t); }
  }
  const r = await room(t.rid);
  const ts = r.state.results.team_scores;
  ok(Number(ts["0"]) > Number(ts["1"]) && r.state.results.winner_team === 0, `team 0 (always correct) wins: ${ts["0"]} vs ${ts["1"]}`);
  const bonus = (await db.query("select count(*)::int n from game_results where room_code=$1 and won", [t.code])).rows[0].n;
  ok(bonus >= 1, "winning team members flagged as winners in history");
}

// ------------------------------------------------------------ mode B: chase
console.log("\n[mode B — the chase]");
{
  const c = await newGame("chase");
  await rpc(U.A, "start_game", c.rid);
  // build phase: A answers all correctly, B half, C none
  for (let i = 0; i < 6; i++) {
    const r = await room(c.rid);
    ok(i > 0 || r.state.q.kind === "build", i === 0 ? "build phase starts" : "", i === 0);
    await answerAll(c, (n, idx) => (n === "A" ? true : n === "B" ? idx % 2 === 0 : false));
    await adv(c); await adv(c);
  }
  let r = await room(c.rid);
  ok(r.status === "board", "after 6 build questions the chase board is shown");
  let ps = await players(c.rid);
  const pos = Object.fromEntries(ps.map((p) => [p.user_id.slice(-1), p.position]));
  ok(pos.a === 7 && pos.b === 4 && pos.c === 1, `start positions follow banked answers (A=${pos.a}, B=${pos.b}, C=${pos.c})`);
  await adv(c);
  r = await room(c.rid);
  ok(r.status === "question" && r.state.q.kind === "chase", "chase phase starts");
  let rounds = 0, sawCaught = false;
  while (true) {
    r = await room(c.rid);
    if (r.status === "final_intro" || r.status === "finished") break;
    if (r.status === "reveal") { if ((r.state.reveal.caught || []).length) sawCaught = true; await adv(c); continue; }
    if (r.status === "board") { await adv(c); continue; }
    rounds++; if (rounds > 40) { ok(false, "chase terminated"); break; }
    await answerAll(c, (n) => (n === "A" ? true : n === "B" ? Math.random() < 0.6 : false));
    await adv(c);
  }
  ps = await players(c.rid);
  const st = Object.fromEntries(ps.map((p) => [p.user_id.slice(-1), p.chase_status]));
  ok(st.c === "caught", `weak player (no answers) was caught by the chaser (status ${st.c})`);
  ok(sawCaught, "reveal reports caught players");
  ok(ps.every((p) => p.chase_status !== "alive"), "chase ends when nobody is still running");
  r = await room(c.rid);
  if (r.status === "final_intro") {
    ok(ps.some((p) => p.chase_status === "qualified"), `chase ended in the final (${ps.filter((p) => p.chase_status === "qualified").length} qualified)`);
    await adv(c);
    r = await room(c.rid);
    ok(r.status === "final" && !!r.state.final_deadline, "final round started with a countdown");
    ps = await players(c.rid);
    const q = ps.find((p) => p.chase_status === "qualified");
    ok(q.final_q && q.final_q.answers.length === 4 && !("correct_idx" in q.final_q), "qualified player has a final question (no answer leaked)");
    const loser = ps.find((p) => p.chase_status === "caught");
    const notElig = await tryRpc(loser.user_id, "final_answer", c.rid, 0, 0);
    ok(!notElig.ok && /not_eligible/.test(notElig.err), "caught players cannot answer in the final");
    // answer rapidly: 5 correct, then one wrong -> lock
    let correct = 0;
    for (let i = 0; i < 5; i++) {
      const me = (await players(c.rid)).find((p) => p.id === q.id);
      const ci = (await db.query("select correct_idx from room_questions where player_id=$1 and idx=$2", [q.id, me.final_n])).rows[0].correct_idx;
      const res = await rpc(q.user_id, "final_answer", c.rid, me.final_n, ci);
      if (res.correct) correct++;
    }
    ok(correct === 5, "5 correct final answers accepted, next question served each time");
    const me = (await players(c.rid)).find((p) => p.id === q.id);
    const ci = (await db.query("select correct_idx from room_questions where player_id=$1 and idx=$2", [q.id, me.final_n])).rows[0].correct_idx;
    const wrong = await rpc(q.user_id, "final_answer", c.rid, me.final_n, (ci + 1) % 4);
    ok(wrong.correct === false && wrong.locked_until, "wrong final answer applies a 2s lock");
    const lockedTry = await tryRpc(q.user_id, "final_answer", c.rid, me.final_n + 1, 0);
    ok(!lockedTry.ok && /locked/.test(lockedTry.err), "cannot answer while locked");
    const replay = await tryRpc(q.user_id, "final_answer", c.rid, me.final_n, 0);
    ok(!replay.ok, "cannot replay an already answered final question");
    const earlyEnd = await tryRpc(U.A, "advance", c.rid, (await room(c.rid)).step);
    ok(!earlyEnd.ok && /too_early/.test(earlyEnd.err), "final cannot be ended before the clock runs out");
    await db.query("update rooms set state = jsonb_set(state,'{final_deadline}', to_jsonb(now() - interval '1 second')) where id=$1", [c.rid]);
    const lateAns = await tryRpc(q.user_id, "final_answer", c.rid, me.final_n + 1, 0);
    ok(!lateAns.ok && /(too_late|locked)/.test(lateAns.err), "answers after the clock are rejected");
    await adv(c);
    r = await room(c.rid);
  }
  ok(r.status === "finished", "chase game finished");
  const res = r.state.results;
  ok(res.chase && typeof res.chase.chaser_final === "number", `chase result computed (team ${res.chase.team_total} vs chaser ${res.chase.chaser_final}, team_won=${res.chase.team_won})`);
  ok(res.ranking[0].rank === 1 && res.ranking.length === 3, `ranking: ${res.ranking.map((x) => x.name + ":" + x.score).join(", ")}`);
  ok(res.ranking.find((x) => x.name === "אלון").score >= res.ranking.find((x) => x.name === "גל").score, "stronger player outranks the caught one");
}

console.log(failures ? `\n${failures} FAILED` : "\nALL SERVER TESTS PASSED");
process.exit(failures ? 1 : 0);
