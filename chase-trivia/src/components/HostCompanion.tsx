import { useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'

type HostCompanionProps = {
  kind: 'build' | 'chase' | 'ffa' | 'team'
  answered: boolean
  spectator: boolean
  questionText: string
  questionKey: string
  questionVisible: boolean
}

export default function HostCompanion({ kind, answered, spectator, questionText, questionKey, questionVisible }: HostCompanionProps) {
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'he-IL'
    utterance.rate = 0.92
    utterance.pitch = 1.08
    window.speechSynthesis.speak(utterance)
  }, [])

  useEffect(() => {
    if (!questionVisible || spectator || !('speechSynthesis' in window)) return
    // Each player hears the host locally; no audio is sent through the game server.
    const intro = new SpeechSynthesisUtterance('בואו נראה את השאלה')
    intro.lang = 'he-IL'
    intro.rate = 0.94
    intro.pitch = 1.08
    const question = new SpeechSynthesisUtterance(questionText)
    question.lang = 'he-IL'
    question.rate = 0.9
    question.pitch = 1.08
    window.speechSynthesis?.cancel()
    intro.onend = () => window.speechSynthesis?.speak(question)
    window.speechSynthesis?.speak(intro)
    return () => {
      intro.onend = null
      window.speechSynthesis?.cancel()
    }
  }, [questionKey, questionVisible, questionText, spectator])

  const replay = useCallback(() => speak(questionText), [speak, questionText])
  const line = spectator
    ? 'אל תדאגו, עדיין אפשר לעודד מהיציע!'
    : answered
      ? 'יפה! ננעלת תשובה. עכשיו מחכים לתוצאות…'
      : kind === 'chase'
        ? 'היזהרו! הרודף ממש מאחוריכם!'
        : kind === 'build'
          ? 'כל תשובה נכונה מקרבת אתכם לניצחון!'
          : questionVisible ? 'הקשיבו טוב… זו השאלה שלכם!' : 'בואו נראה את השאלה…'

  return (
    <motion.aside className="guy-companion" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .45 }} aria-label="גיא, מנחה המשחק">
      <div className="guy-mini">
        <div className="guy-mini-glow" />
        <motion.div className="guy-mini-head" animate={{ y: [0, -2, 0], rotate: [0, 1, 0] }} transition={{ duration: 2.8, repeat: Infinity }}>
          <i className="guy-mini-hair" />
          <i className="guy-mini-eye left" /><i className="guy-mini-eye right" />
          <i className="guy-mini-cheek left" /><i className="guy-mini-cheek right" />
          <i className="guy-mini-mouth" />
        </motion.div>
        <div className="guy-mini-neck" />
        <div className="guy-mini-suit"><i className="guy-mini-shirt" /><i className="guy-mini-tie" /><i className="guy-mini-lapel left" /><i className="guy-mini-lapel right" /></div>
        <motion.div className="guy-mini-mic" animate={{ rotate: [-8, -15, -8] }} transition={{ duration: 1.8, repeat: Infinity }} />
      </div>
      <div className="guy-dialog">
        <div className="guy-dialog-name"><span>✦</span> גיא אומר</div>
        <motion.p key={line} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>{line}</motion.p>
        <button type="button" className="guy-replay" onClick={replay} aria-label="השמע את השאלה שוב" title="השמע את השאלה שוב">🔊 השמע שוב</button>
      </div>
      <style>{`
        .guy-companion{direction:rtl;display:flex;align-items:center;justify-content:center;gap:14px;margin:12px auto 18px;max-width:520px;min-height:92px;padding:10px 16px;border:1px solid rgba(137,151,255,.2);border-radius:20px;background:linear-gradient(110deg,rgba(31,42,91,.62),rgba(72,37,119,.35));box-shadow:inset 0 1px rgba(255,255,255,.07),0 12px 32px rgba(8,12,35,.16);overflow:hidden}
        .guy-mini{position:relative;flex:0 0 68px;height:76px;filter:drop-shadow(0 4px 10px rgba(93,115,255,.35))}
        .guy-mini-glow{position:absolute;inset:10px -8px 0;border-radius:50%;background:radial-gradient(ellipse,rgba(100,119,255,.4),transparent 70%)}
        .guy-mini-head{position:absolute;z-index:2;top:1px;left:17px;width:36px;height:39px;border-radius:44% 44% 47% 47%;background:linear-gradient(135deg,#ffe0bf,#c98261);box-shadow:inset -4px -3px rgba(120,55,40,.12)}
        .guy-mini-hair{position:absolute;top:-3px;left:-1px;width:38px;height:16px;border-radius:50% 50% 25% 25%;background:linear-gradient(135deg,#34283a,#10162c)}
        .guy-mini-eye{position:absolute;top:19px;width:3px;height:4px;border-radius:50%;background:#172039}
        .guy-mini-eye.left{left:9px}.guy-mini-eye.right{right:9px}
        .guy-mini-cheek{position:absolute;top:24px;width:6px;height:3px;border-radius:50%;background:rgba(224,104,104,.35)}
        .guy-mini-cheek.left{left:4px}.guy-mini-cheek.right{right:4px}
        .guy-mini-mouth{position:absolute;bottom:5px;left:14px;width:9px;height:5px;border-bottom:2px solid #873d4b;border-radius:50%}
        .guy-mini-neck{position:absolute;z-index:1;top:36px;left:29px;width:12px;height:11px;background:#c98261}
        .guy-mini-suit{position:absolute;top:44px;left:7px;width:54px;height:33px;border-radius:17px 17px 7px 7px;background:linear-gradient(110deg,#15254e,#405b9a 52%,#111a37);clip-path:polygon(18% 0,82% 0,100% 100%,0 100%)}
        .guy-mini-shirt{position:absolute;top:0;left:20px;width:15px;height:26px;background:#f5f5ff;clip-path:polygon(0 0,100% 0,65% 100%,35% 100%)}
        .guy-mini-tie{position:absolute;top:2px;left:25px;width:6px;height:23px;background:#e9bd63;clip-path:polygon(50% 0,100% 15%,70% 100%,30% 100%,0 15%)}
        .guy-mini-lapel{position:absolute;top:2px;width:15px;height:27px;background:#2b4076}
        .guy-mini-lapel.left{left:9px;clip-path:polygon(0 0,100% 28%,72% 100%,25% 48%)}
        .guy-mini-lapel.right{right:9px;clip-path:polygon(100% 0,0 28%,28% 100%,75% 48%)}
        .guy-mini-mic{position:absolute;z-index:3;right:0;top:43px;width:6px;height:26px;border-radius:5px;background:linear-gradient(90deg,#e0e7ff,#64748b);transform-origin:top}
        .guy-mini-mic:before{content:"";position:absolute;top:-4px;left:-2px;width:10px;height:9px;border-radius:50%;background:#dce7ff;border:1px solid #8495c4}
        .guy-dialog{flex:1;min-width:0;text-align:right}
        .guy-dialog-name{font-size:11px;font-weight:950;color:#f3ce7c;letter-spacing:.04em}
        .guy-dialog-name span{color:#9caeff;margin-left:4px}
        .guy-dialog p{margin:5px 0 0;color:#f0f2ff;font-size:14px;font-weight:750;line-height:1.45}\n        .guy-replay{margin-top:6px;padding:4px 9px;border:1px solid rgba(160,174,255,.28);border-radius:999px;background:rgba(10,15,42,.48);color:#cdd8ff;font:700 10px inherit;cursor:pointer;transition:background .2s,transform .2s}.guy-replay:hover{background:rgba(88,105,220,.35);transform:translateY(-1px)}
        @media(max-width:520px){.guy-companion{gap:8px;padding:8px 10px;min-height:82px}.guy-mini{transform:scale(.88);transform-origin:center}.guy-dialog p{font-size:12px}}
        @media(prefers-reduced-motion:reduce){.guy-mini-head,.guy-mini-mic{animation:none!important}}
      `}</style>
    </motion.aside>
  )
}
