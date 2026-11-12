import { motion } from 'framer-motion'

type StageSceneProps = {
  mode?: 'opening' | 'winner'
  title?: string
  subtitle?: string
}

export default function StageScene({
  mode = 'opening',
  title = 'ARENA TRIVIA',
  subtitle = 'הבמה שלכם. המשחק שלכם.',
}: StageSceneProps) {
  const isWinner = mode === 'winner'

  return (
    <section className={`arena-stage ${isWinner ? 'arena-stage-winner' : ''}`} aria-label="במת Arena Trivia">
      <div className="stage-stars" aria-hidden="true" />
      <div className="stage-beam beam-one" aria-hidden="true" />
      <div className="stage-beam beam-two" aria-hidden="true" />
      <div className="stage-beam beam-three" aria-hidden="true" />
      <div className="stage-topline">
        <span className="stage-live-dot" />
        {isWinner ? 'THE SHOWDOWN' : 'LIVE GAME SHOW'}
      </div>
      <motion.div
        className="stage-title-wrap"
        initial={{ opacity: 0, y: 22, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div className="stage-kicker">{isWinner ? 'AND THE WINNER IS…' : 'WELCOME TO THE ARENA'}</div>
        <h2 className="stage-title">{title}</h2>
        <p className="stage-subtitle">{subtitle}</p>
      </motion.div>

      <div className="stage-panels" aria-hidden="true">
        <div className="stage-panel panel-left"><span>★</span><i /><i /><i /></div>
        <div className="stage-panel panel-right"><span>★</span><i /><i /><i /></div>
      </div>

      <motion.div
        className="stage-host-placeholder"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: [0, -7, 0], opacity: 1 }}
        transition={{ opacity: { duration: 0.7, delay: 0.25 }, y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } }}
        aria-label="המקום של גיא, מנחה המשחק"
      >
        <div className="host-aura" />
        <div className="host-head"><span className="host-hair" /><span className="host-eye eye-left" /><span className="host-eye eye-right" /><span className="host-smile" /></div>
        <div className="host-neck" />
        <div className="host-body"><span className="host-shirt" /><span className="host-tie" /><span className="host-lapel lapel-left" /><span className="host-lapel lapel-right" /></div>
        <div className="host-mic"><i /></div>
        <span className="host-name">גיא · המנחה</span>
      </motion.div>

      <div className="stage-platform" aria-hidden="true">
        <div className="platform-ring ring-outer" />
        <div className="platform-ring ring-middle" />
        <div className="platform-ring ring-inner" />
        <div className="platform-core" />
      </div>
      <div className="stage-floor-glow" aria-hidden="true" />
      <div className="stage-bottom-label"><span>✦</span> LET THE GAME BEGIN <span>✦</span></div>

      <style>{`
        .arena-stage{--stage-blue:#3987ff;--stage-purple:#a855f7;position:relative;isolation:isolate;min-height:440px;margin:28px 0 34px;padding:34px 22px 22px;overflow:hidden;border:1px solid rgba(148,163,255,.25);border-radius:30px;background:radial-gradient(ellipse at 50% 70%,rgba(80,42,180,.48),transparent 48%),radial-gradient(ellipse at 50% 0%,rgba(33,104,220,.36),transparent 55%),linear-gradient(180deg,#080d27 0%,#09091b 62%,#050611 100%);box-shadow:0 28px 90px rgba(20,30,100,.32),inset 0 1px rgba(255,255,255,.12)}
        .arena-stage:before{content:"";position:absolute;inset:10px;border:1px solid rgba(255,255,255,.08);border-radius:23px;pointer-events:none}
        .stage-stars{position:absolute;inset:0;opacity:.45;background-image:radial-gradient(2px 2px at 12% 22%,#fff 50%,transparent 60%),radial-gradient(1px 1px at 78% 18%,#fff 50%,transparent 60%),radial-gradient(2px 2px at 88% 52%,#9bdcff 50%,transparent 60%),radial-gradient(1px 1px at 24% 62%,#fff 50%,transparent 60%),radial-gradient(1px 1px at 65% 38%,#fff 50%,transparent 60%);background-size:220px 180px}
        .stage-topline{position:relative;z-index:4;display:flex;align-items:center;justify-content:center;gap:9px;color:#b8c9ff;font-size:10px;font-weight:900;letter-spacing:.28em}
        .stage-live-dot{width:7px;height:7px;border-radius:50%;background:#fbbf24;box-shadow:0 0 14px #fbbf24;animation:stagePulse 1.3s infinite}
        .stage-title-wrap{position:relative;z-index:3;text-align:center;margin:24px auto 0;max-width:760px}
        .stage-kicker{color:#f5c96b;font-size:11px;font-weight:900;letter-spacing:.3em;text-shadow:0 0 18px rgba(251,191,36,.6)}
        .stage-title{margin:8px 0 4px;font-family:var(--font-display,system-ui);font-size:clamp(34px,7vw,72px);line-height:1;font-weight:1000;letter-spacing:.04em;direction:ltr;background:linear-gradient(180deg,#fff 5%,#dbeafe 45%,#9c8bff 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 5px 22px rgba(88,117,255,.55))}
        .stage-subtitle{margin:12px 0 0;color:#d5dcff;font-weight:700;font-size:clamp(14px,2vw,18px)}
        .stage-panels{position:absolute;z-index:1;top:34%;left:0;right:0;display:flex;justify-content:space-between;padding:0 3%;pointer-events:none}
        .stage-panel{width:19%;height:155px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;border:1px solid rgba(123,153,255,.5);border-radius:12px;background:linear-gradient(145deg,rgba(32,89,190,.42),rgba(92,39,171,.35));box-shadow:0 0 32px rgba(69,112,255,.24),inset 0 0 26px rgba(119,100,255,.15);transform:perspective(300px) rotateY(12deg)}
        .panel-right{transform:perspective(300px) rotateY(-12deg)}
        .stage-panel span{color:#f8d77a;font-size:28px;text-shadow:0 0 20px #fbbf24}
        .stage-panel i{display:block;width:68%;height:4px;border-radius:8px;background:linear-gradient(90deg,transparent,#73c9ff,transparent);box-shadow:0 0 12px #3b82f6}
        .stage-beam{position:absolute;z-index:1;top:0;width:28%;height:75%;transform-origin:top center;filter:blur(9px);opacity:.24;pointer-events:none}
        .beam-one{left:10%;transform:rotate(24deg);background:linear-gradient(180deg,rgba(70,150,255,.85),transparent)}
        .beam-two{right:10%;transform:rotate(-24deg);background:linear-gradient(180deg,rgba(180,85,255,.85),transparent)}
        .beam-three{left:37%;width:26%;transform:rotate(0);background:linear-gradient(180deg,rgba(255,211,110,.55),transparent);opacity:.13}
        .stage-host-placeholder{position:absolute;z-index:3;left:50%;bottom:76px;transform:translateX(-50%);width:112px;height:190px;filter:drop-shadow(0 0 24px rgba(113,133,255,.5))}
        .host-aura{position:absolute;inset:10px -28px 0;border-radius:50%;background:radial-gradient(ellipse,rgba(89,105,255,.34),transparent 70%);filter:blur(12px)}
        .host-head{position:absolute;top:4px;left:33px;width:48px;height:56px;border-radius:43% 43% 46% 46%;background:linear-gradient(135deg,#ffdbb5,#c98261);box-shadow:inset -7px -4px 0 rgba(125,55,42,.12);z-index:2}
        .host-hair{position:absolute;top:-5px;left:-2px;width:52px;height:23px;border-radius:50% 50% 25% 25%;background:linear-gradient(130deg,#29233a,#090d20)}
        .host-eye{position:absolute;top:28px;width:5px;height:7px;border-radius:50%;background:#17182a}
        .eye-left{left:13px}.eye-right{right:13px}
        .host-smile{position:absolute;bottom:8px;left:18px;width:14px;height:7px;border-bottom:2px solid #8e3f4c;border-radius:50%}
        .host-neck{position:absolute;top:54px;left:49px;width:17px;height:20px;background:#c98261;z-index:1}
        .host-body{position:absolute;top:66px;left:15px;width:82px;height:104px;border-radius:25px 25px 8px 8px;background:linear-gradient(110deg,#17244c,#344c85 48%,#10172f);clip-path:polygon(20% 0,80% 0,100% 100%,0 100%);border-top:3px solid #91b9ff}
        .host-shirt{position:absolute;top:0;left:29px;width:26px;height:54px;background:#f4f5ff;clip-path:polygon(0 0,100% 0,65% 100%,35% 100%)}
        .host-tie{position:absolute;top:4px;left:39px;width:8px;height:48px;background:linear-gradient(#f6cf72,#a86c23);clip-path:polygon(50% 0,100% 14%,70% 100%,30% 100%,0 14%)}
        .host-lapel{position:absolute;top:3px;width:23px;height:55px;background:#263b70}
        .lapel-left{left:17px;clip-path:polygon(0 0,100% 28%,75% 100%,25% 48%)}
        .lapel-right{right:17px;clip-path:polygon(100% 0,0 28%,25% 100%,75% 48%)}
        .host-mic{position:absolute;z-index:4;right:0;top:77px;width:10px;height:48px;border-radius:8px;background:linear-gradient(90deg,#aeb7d2,#333d5d);transform:rotate(-18deg);box-shadow:0 0 12px rgba(255,255,255,.35)}
        .host-mic i{position:absolute;top:-5px;left:-2px;width:14px;height:13px;border-radius:50%;background:#d9e4ff;border:2px solid #7b8bb5}
        .host-name{position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);white-space:nowrap;color:#f4d88c;font-size:11px;font-weight:900;text-shadow:0 2px 10px #000}
        .stage-platform{position:absolute;z-index:2;left:50%;bottom:25px;width:min(64%,480px);height:90px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(ellipse,rgba(115,94,255,.45),rgba(28,44,112,.6) 48%,rgba(5,8,25,.9) 72%);border:1px solid rgba(131,156,255,.5);box-shadow:0 0 40px rgba(80,105,255,.45),inset 0 0 30px rgba(105,126,255,.35)}
        .platform-ring{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:50%;border:2px solid rgba(109,195,255,.75);box-shadow:0 0 18px rgba(75,160,255,.65)}
        .ring-outer{width:92%;height:72%;border-color:rgba(184,126,255,.75)}
        .ring-middle{width:72%;height:55%;border-color:rgba(87,204,255,.8)}
        .ring-inner{width:48%;height:36%;border-color:rgba(255,215,125,.8)}
        .platform-core{position:absolute;left:50%;top:50%;width:12px;height:12px;border-radius:50%;transform:translate(-50%,-50%);background:#fff;box-shadow:0 0 24px 9px rgba(128,155,255,.85)}
        .stage-floor-glow{position:absolute;z-index:1;bottom:0;left:0;right:0;height:110px;background:radial-gradient(ellipse at 50% 100%,rgba(79,89,255,.32),transparent 70%);pointer-events:none}
        .stage-bottom-label{position:absolute;z-index:4;bottom:13px;left:0;right:0;text-align:center;color:#8f9fcf;font-size:9px;font-weight:900;letter-spacing:.28em;direction:ltr}
        .stage-bottom-label span{color:#f5cf73;margin:0 7px}
        .arena-stage-winner{min-height:490px;border-color:rgba(251,191,36,.32);background:radial-gradient(ellipse at 50% 70%,rgba(168,85,247,.48),transparent 48%),radial-gradient(ellipse at 50% 0%,rgba(37,99,235,.4),transparent 55%),linear-gradient(180deg,#080d27,#100a23 70%,#080611)}
        .arena-stage-winner .stage-platform{box-shadow:0 0 55px rgba(251,191,36,.5),inset 0 0 35px rgba(251,191,36,.18)}
        @keyframes stagePulse{50%{opacity:.45;box-shadow:0 0 4px #fbbf24}}
        @media(max-width:600px){.arena-stage{min-height:390px;padding-inline:12px}.stage-panels{top:40%;padding-inline:1%}.stage-panel{width:22%;height:105px}.stage-host-placeholder{transform:translateX(-50%) scale(.82);transform-origin:bottom center;bottom:67px}.stage-platform{width:82%;height:72px;bottom:24px}.stage-bottom-label{font-size:8px;letter-spacing:.16em}.stage-title{font-size:clamp(30px,9vw,48px)}}
        @media(prefers-reduced-motion:reduce){.stage-live-dot{animation:none}}
      `}</style>
    </section>
  )
}
