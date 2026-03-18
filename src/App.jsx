import { initializeApp } from "firebase/app"; 
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, onSnapshot, updateDoc, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { useState, useEffect, useRef } from “react”;

// ─── FONTS & GLOBAL STYLES ───────────────────────────────────────────────────
const GlobalStyles = () => (

  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    html, body { background: #050508; overflow-x: hidden; }
    input, button { font-family: 'Space Grotesk', sans-serif; }
    input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
    ::-webkit-scrollbar { width: 0px; }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 #ff3b5c44; }
      50%       { box-shadow: 0 0 0 12px #ff3b5c00; }
    }
    @keyframes shimmer {
      0%   { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes countUp {
      from { opacity: 0; transform: scale(0.7); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0); opacity: 1; }
    }
    .fade-up { animation: fadeUp 0.5s ease both; }
    .pulse-btn { animation: pulse 2s infinite; }
  `}</style>

);

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const APPS = [“TikTok”,“Instagram”,“YouTube”,“Twitter/X”,“Snapchat”,“Reddit”,“BeReal”,“Twitch”];
const SCORE_TIERS = [
{ max: 30,  score: 100, label: “Fokus-Held 🧠”,     color: “#00e5a0” },
{ max: 60,  score: 70,  label: “Gut dabei ✌️”,       color: “#ffe14d” },
{ max: 120, score: 30,  label: “Aufs Limit ⚠️”,      color: “#ff8c42” },
{ max: Infinity, score: 0, label: “Abgestürzt 💀”,   color: “#ff3b5c” },
];

function getTier(minutes) {
return SCORE_TIERS.find(t => minutes < t.max) || SCORE_TIERS[3];
}

function fmt(m) {
if (m < 60) return `${m}m`;
const h = Math.floor(m / 60), min = m % 60;
return min ? `${h}h ${min}m` : `${h}h`;
}

function rankEmoji(r) {
return r === 1 ? “🥇” : r === 2 ? “🥈” : r === 3 ? “🥉” : `#${r}`;
}

// ─── INITIAL MOCK STATE ──────────────────────────────────────────────────────
const MOCK_FRIENDS = [
{ id:“f1”, name:“Leon”,  username:“leon_k”,  avatar:“L”, minutes:42,  streak:5, badges:[“👑”,“🔥”] },
{ id:“f2”, name:“Emir”,  username:“emir_x”,  avatar:“E”, minutes:55,  streak:3, badges:[“🔥”] },
{ id:“f3”, name:“Lena”,  username:“lena_v”,  avatar:“V”, minutes:88,  streak:1, badges:[] },
{ id:“f4”, name:“Finn”,  username:“finn_b”,  avatar:“F”, minutes:134, streak:0, badges:[“💀”] },
];

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────

function Av({ letter, size=42, glow=false, color=”#ff3b5c” }) {
return (
<div style={{
width: size, height: size, borderRadius: “50%”, flexShrink: 0,
background: glow ? `linear-gradient(135deg, ${color}, #ff8c42)` : “#111122”,
border: `2px solid ${glow ? color : "#1e1e35"}`,
display:“flex”, alignItems:“center”, justifyContent:“center”,
fontSize: size*0.38, fontWeight:800, color: glow?”#fff”:”#666”,
fontFamily:”‘Syne’,sans-serif”,
boxShadow: glow ? `0 0 16px ${color}66` : “none”,
}}>{letter}</div>
);
}

function Btn({ children, onClick, variant=“primary”, style={}, disabled=false }) {
const base = {
border:“none”, borderRadius:14, fontFamily:”‘Space Grotesk’,sans-serif”,
fontWeight:700, cursor: disabled?“not-allowed”:“pointer”,
transition:“all 0.18s ease”, opacity: disabled?0.4:1,
display:“flex”, alignItems:“center”, justifyContent:“center”, gap:8,
…style,
};
const variants = {
primary:  { background:“linear-gradient(135deg,#ff3b5c,#ff6b35)”, color:”#fff”, padding:“15px 24px”, fontSize:15 },
ghost:    { background:”#0d0d1a”, border:“1px solid #1e1e35”, color:”#aaa”, padding:“13px 20px”, fontSize:14 },
small:    { background:”#111122”, border:“1px solid #1e1e35”, color:”#888”, padding:“8px 14px”, fontSize:12 },
danger:   { background:“linear-gradient(135deg,#ff3b5c22,#ff3b5c11)”, border:“1px solid #ff3b5c44”, color:”#ff3b5c”, padding:“12px 20px”, fontSize:14 },
};
return (
<button onClick={disabled ? undefined : onClick} style={{…base, …variants[variant]}}>
{children}
</button>
);
}

function Input({ value, onChange, placeholder, type=“text”, style={} }) {
return (
<input
type={type} value={value} onChange={e=>onChange(e.target.value)}
placeholder={placeholder}
style={{
width:“100%”, background:”#0a0a18”, border:“1px solid #1e1e35”,
borderRadius:12, padding:“14px 16px”, color:”#fff”,
fontFamily:”‘Space Grotesk’,sans-serif”, fontSize:15,
outline:“none”, transition:“border 0.2s”,
…style,
}}
onFocus={e=>e.target.style.borderColor=”#ff3b5c66”}
onBlur={e=>e.target.style.borderColor=”#1e1e35”}
/>
);
}

function ScoreBar({ minutes }) {
const pct = Math.min(100, (minutes/180)*100);
const { color } = getTier(minutes);
return (
<div style={{ height:3, background:”#111122”, borderRadius:2, overflow:“hidden”, width:“100%” }}>
<div style={{
height:“100%”, width:`${pct}%`, background:color,
boxShadow:`0 0 6px ${color}88`, borderRadius:2,
transition:“width 1.2s cubic-bezier(.4,0,.2,1)”,
}}/>
</div>
);
}

function Badge({ text }) {
return (
<span style={{
background:”#111122”, border:“1px solid #1e1e35”,
borderRadius:6, padding:“3px 8px”,
fontSize:11, color:”#666”,
fontFamily:”‘Space Grotesk’,sans-serif”,
}}>{text}</span>
);
}

// ─── SCREEN: SPLASH ──────────────────────────────────────────────────────────
function SplashScreen({ onDone }) {
useEffect(() => { setTimeout(onDone, 2200); }, []);
return (
<div style={{
minHeight:“100vh”, background:”#050508”,
display:“flex”, flexDirection:“column”,
alignItems:“center”, justifyContent:“center”, gap:16,
}}>
<div style={{ animation:“countUp 0.6s ease both” }}>
<div style={{
fontFamily:”‘Syne’,sans-serif”, fontWeight:800, fontSize:48, color:”#fff”,
letterSpacing:”-2px”, lineHeight:1,
}}>
scroll<span style={{
background:“linear-gradient(135deg,#ff3b5c,#ff6b35)”,
WebkitBackgroundClip:“text”, WebkitTextFillColor:“transparent”,
}}>less</span>
</div>
</div>
<div style={{ animation:“fadeUp 0.6s 0.4s ease both”, opacity:0 }}>
<p style={{ fontFamily:”‘Space Grotesk’,sans-serif”, color:”#333”, fontSize:14 }}>
Weniger scrollen. Besser ranken.
</p>
</div>
<div style={{ animation:“fadeUp 0.6s 1s ease both”, opacity:0, marginTop:24 }}>
<div style={{
width:32, height:32, borderRadius:“50%”,
border:“2px solid #ff3b5c”, borderTopColor:“transparent”,
animation:“spin 0.8s linear infinite”,
}}/>
</div>
</div>
);
}

// ─── SCREEN: ONBOARDING ──────────────────────────────────────────────────────
function OnboardingScreen({ onComplete }) {
const [step, setStep] = useState(0);
const [name, setName] = useState(””);
const [username, setUsername] = useState(””);
const [selectedApps, setSelectedApps] = useState([]);

const steps = [
{
emoji:“👋”, title:“Hey, wie heißt du?”,
subtitle:“Dein Name im Leaderboard”,
content: (
<div style={{ display:“flex”, flexDirection:“column”, gap:12 }}>
<Input value={name} onChange={setName} placeholder="z.B. Leon" />
<Input value={username} onChange={setUsername} placeholder="Username (z.B. leon_k)" />
</div>
),
valid: name.trim().length > 0 && username.trim().length > 0,
},
{
emoji:“📱”, title:“Welche Apps nerven dich?”,
subtitle:“Wähle 3–5 Problem-Apps”,
content: (
<div style={{ display:“flex”, flexWrap:“wrap”, gap:10 }}>
{APPS.map(app => {
const sel = selectedApps.includes(app);
return (
<button key={app} onClick={() => {
setSelectedApps(prev =>
prev.includes(app) ? prev.filter(a=>a!==app)
: prev.length < 5 ? […prev, app] : prev
);
}} style={{
padding:“10px 16px”, borderRadius:12, border:“none”,
background: sel ? “linear-gradient(135deg,#ff3b5c,#ff6b35)” : “#0d0d1a”,
border: sel ? “none” : “1px solid #1e1e35”,
color: sel ? “#fff” : “#666”,
fontFamily:”‘Space Grotesk’,sans-serif”,
fontWeight:600, fontSize:13, cursor:“pointer”,
transform: sel ? “scale(1.04)” : “scale(1)”,
transition:“all 0.15s ease”,
}}>{app}</button>
);
})}
</div>
),
valid: selectedApps.length >= 3,
},
{
emoji:“🏆”, title:“Du bist bereit.”,
subtitle:“Tritt deiner ersten Gruppe bei oder erstelle eine”,
content: (
<div style={{ display:“flex”, flexDirection:“column”, gap:12 }}>
<div style={{
background:”#0a0a18”, border:“1px solid #1e1e35”,
borderRadius:14, padding:16,
}}>
<div style={{ fontFamily:”‘Syne’,sans-serif”, fontWeight:800, color:”#fff”, fontSize:16, marginBottom:4 }}>
Berlin Crew 🔥
</div>
<div style={{ fontFamily:”‘Space Grotesk’,sans-serif”, color:”#555”, fontSize:13, marginBottom:12 }}>
4 Mitglieder · aktiv heute
</div>
<Btn variant=“primary” style={{ width:“100%”, borderRadius:10 }}
onClick={() => onComplete({ name, username, selectedApps, groupCode:“berlin” })}>
Beitreten
</Btn>
</div>
<Btn variant=“ghost” style={{ width:“100%”, borderRadius:12 }}
onClick={() => onComplete({ name, username, selectedApps, groupCode:“new” })}>
+ Neue Gruppe erstellen
</Btn>
</div>
),
valid: true,
},
];

const cur = steps[step];

return (
<div style={{
minHeight:“100vh”, background:”#050508”,
display:“flex”, flexDirection:“column”,
padding:“60px 24px 40px”,
}}>
{/* Progress dots */}
<div style={{ display:“flex”, gap:6, marginBottom:40 }}>
{steps.map((_,i) => (
<div key={i} style={{
height:3, flex:1, borderRadius:2,
background: i <= step ? “linear-gradient(90deg,#ff3b5c,#ff6b35)” : “#111122”,
transition:“background 0.3s ease”,
}}/>
))}
</div>

```
  <div style={{ flex:1 }}>
    <div style={{ animation:"fadeUp 0.4s ease both", marginBottom:32 }}>
      <div style={{ fontSize:42, marginBottom:12 }}>{cur.emoji}</div>
      <h1 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:28, color:"#fff", marginBottom:6, lineHeight:1.2 }}>
        {cur.title}
      </h1>
      <p style={{ fontFamily:"'Space Grotesk',sans-serif", color:"#444", fontSize:14 }}>
        {cur.subtitle}
      </p>
    </div>

    <div style={{ animation:"fadeUp 0.4s 0.1s ease both", opacity:0 }}>
      {cur.content}
    </div>
  </div>

  <div style={{ display:"flex", gap:12 }}>
    {step > 0 && (
      <Btn variant="ghost" onClick={() => setStep(s=>s-1)} style={{ flex:1, borderRadius:14 }}>
        ←
      </Btn>
    )}
    {step < steps.length - 1 && (
      <Btn variant="primary" onClick={() => setStep(s=>s+1)} disabled={!cur.valid} style={{ flex:1, borderRadius:14 }}>
        Weiter →
      </Btn>
    )}
  </div>
</div>
```

);
}

// ─── SCREEN: HOME (Leaderboard) ──────────────────────────────────────────────
function HomeScreen({ user, friends, onUpdateMinutes, isPremium, onUpgrade }) {
const [tab, setTab] = useState(“day”);
const [showInput, setShowInput] = useState(false);
const [inputVal, setInputVal] = useState(String(user.minutes));
const [toast, setToast] = useState(null);

const allUsers = [
{ …user, id:“me” },
…friends,
].sort((a,b) => a.minutes - b.minutes);

const myRank = allUsers.findIndex(u=>u.id===“me”) + 1;
const above = myRank > 1 ? allUsers[myRank-2] : null;
const myTier = getTier(user.minutes);

function showToast(msg) {
setToast(msg);
setTimeout(() => setToast(null), 2500);
}

function handleSave() {
const m = parseInt(inputVal);
if (isNaN(m) || m < 0) return;
onUpdateMinutes(m);
setShowInput(false);
showToast(“✓ Gespeichert! Leaderboard aktualisiert.”);
}

return (
<div style={{ minHeight:“100vh”, background:”#050508”, paddingBottom:100 }}>

```
  {/* Toast */}
  {toast && (
    <div style={{
      position:"fixed", top:20, left:"50%", transform:"translateX(-50%)",
      background:"#111122", border:"1px solid #1e1e35",
      borderRadius:12, padding:"12px 20px",
      fontFamily:"'Space Grotesk',sans-serif", fontSize:13, color:"#fff",
      zIndex:999, animation:"slideIn 0.3s ease",
      whiteSpace:"nowrap",
    }}>{toast}</div>
  )}

  {/* Header */}
  <div style={{
    padding:"52px 20px 20px",
    background:"linear-gradient(180deg, #0a0a18 0%, #050508 100%)",
  }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <div>
        <div style={{
          fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:26,
          color:"#fff", letterSpacing:"-1px",
        }}>
          scroll<span style={{
            background:"linear-gradient(135deg,#ff3b5c,#ff6b35)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          }}>less</span>
        </div>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", color:"#333", fontSize:12, marginTop:2 }}>
          Berlin Crew · {allUsers.length} Mitglieder
        </div>
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        {!isPremium && (
          <button onClick={onUpgrade} style={{
            background:"linear-gradient(135deg,#ffe14d22,#ffe14d11)",
            border:"1px solid #ffe14d44", borderRadius:10,
            padding:"7px 12px", color:"#ffe14d",
            fontFamily:"'Space Grotesk',sans-serif",
            fontSize:11, fontWeight:700, cursor:"pointer",
          }}>⭐ Pro</button>
        )}
        {isPremium && (
          <Badge text="⭐ Pro" />
        )}
      </div>
    </div>
  </div>

  <div style={{ padding:"0 16px" }}>

    {/* My Card */}
    <div style={{
      background:"linear-gradient(135deg,#0f0f1e,#1a0a0f)",
      border:"1px solid #ff3b5c22",
      borderRadius:18, padding:18, marginBottom:12,
      boxShadow:"0 4px 40px #ff3b5c10",
      animation:"fadeUp 0.4s ease both",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <Av letter={user.name[0]} size={54} glow />
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16, color:"#fff", marginBottom:2 }}>
            {user.name}
          </div>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:13, color:myTier.color, marginBottom:6 }}>
            {myTier.label}
          </div>
          {user.streak > 0 && (
            <span style={{
              background:"#1a1500", border:"1px solid #ffe14d33",
              borderRadius:6, padding:"3px 8px",
              fontSize:11, color:"#ffe14d",
              fontFamily:"'Space Grotesk',sans-serif",
            }}>🔥 {user.streak} Tage Streak</span>
          )}
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:36, color:myTier.color, lineHeight:1 }}>
            {fmt(user.minutes)}
          </div>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:11, color:"#333", marginTop:4 }}>
            Platz {myRank} von {allUsers.length}
          </div>
        </div>
      </div>

      <div style={{ marginTop:14 }}>
        <ScoreBar minutes={user.minutes} />
      </div>

      <button onClick={() => setShowInput(!showInput)} style={{
        marginTop:12, width:"100%", padding:"10px",
        background:"#ffffff08", border:"1px solid #ffffff0a",
        borderRadius:10, color:"#555",
        fontFamily:"'Space Grotesk',sans-serif", fontSize:12, cursor:"pointer",
      }}>
        {showInput ? "↑ Schließen" : "✏️ Minuten eintragen"}
      </button>

      {showInput && (
        <div style={{ marginTop:10, display:"flex", gap:8, animation:"fadeUp 0.2s ease" }}>
          <Input
            type="number" value={inputVal} onChange={setInputVal}
            placeholder="Minuten heute"
            style={{ fontSize:14, padding:"10px 14px" }}
          />
          <Btn variant="primary" onClick={handleSave} style={{ borderRadius:10, padding:"10px 18px", fontSize:13, flexShrink:0 }}>
            ✓
          </Btn>
        </div>
      )}
    </div>

    {/* Nudge */}
    {above && (
      <div style={{
        background:"#050f1a", border:"1px solid #4d9fff22",
        borderRadius:12, padding:"12px 16px",
        display:"flex", alignItems:"center", gap:10,
        marginBottom:12, animation:"fadeUp 0.4s 0.1s ease both", opacity:0,
      }}>
        <span style={{ fontSize:18 }}>⚡</span>
        <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:13, color:"#4d9fff" }}>
          Nur <strong style={{color:"#fff"}}>{user.minutes - above.minutes} Min</strong> hinter <strong style={{color:"#fff"}}>{above.name}</strong> — leg dein Handy weg!
        </span>
      </div>
    )}

    {/* Tabs */}
    <div style={{
      display:"flex", gap:4, background:"#080810",
      border:"1px solid #111122", borderRadius:12, padding:4, marginBottom:14,
      animation:"fadeUp 0.4s 0.15s ease both", opacity:0,
    }}>
      {["day","week","group"].map(t => (
        <button key={t} onClick={() => {
          if (t === "group" && !isPremium) { onUpgrade(); return; }
          setTab(t);
        }} style={{
          flex:1, padding:"9px 0", borderRadius:9, border:"none",
          background: tab===t ? "linear-gradient(135deg,#ff3b5c,#ff6b35)" : "transparent",
          color: tab===t ? "#fff" : "#333",
          fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:12,
          cursor:"pointer", transition:"all 0.2s ease",
          display:"flex", alignItems:"center", justifyContent:"center", gap:4,
        }}>
          {t==="day" ? "Heute" : t==="week" ? "Woche" : "🔒 Gruppen"}
        </button>
      ))}
    </div>

    {/* Leaderboard rows */}
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {allUsers.map((u, i) => {
        const isMe = u.id === "me";
        const tier = getTier(u.minutes);
        return (
          <div key={u.id} style={{
            display:"flex", alignItems:"center", gap:12,
            padding:"14px 14px",
            background: isMe ? "#0f0f1e" : "#080810",
            border: isMe ? "1px solid #ff3b5c33" : "1px solid #0d0d1a",
            borderRadius:14,
            animation:`fadeUp 0.4s ${i*60}ms ease both`, opacity:0,
            position:"relative", overflow:"hidden",
          }}>
            {isMe && (
              <div style={{
                position:"absolute", left:0, top:0, bottom:0, width:3,
                background:"linear-gradient(180deg,#ff3b5c,#ff6b35)",
              }}/>
            )}
            <div style={{
              width:30, textAlign:"center", flexShrink:0,
              fontFamily:"'Syne',sans-serif", fontSize: i<3?18:13,
              color: i<3 ? tier.color : "#222", fontWeight:800,
            }}>
              {rankEmoji(i+1)}
            </div>
            <Av letter={u.name[0]} size={36} glow={isMe} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                <span style={{
                  fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:14,
                  color: isMe ? "#fff" : "#bbb",
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                }}>{u.name}</span>
                {isMe && <span style={{
                  fontSize:9, color:"#ff3b5c", background:"#ff3b5c22",
                  padding:"2px 6px", borderRadius:4,
                  fontFamily:"'Space Grotesk',sans-serif", fontWeight:700,
                }}>DU</span>}
                {u.badges?.map((b,j) => <span key={j} style={{fontSize:12}}>{b}</span>)}
              </div>
              <ScoreBar minutes={u.minutes} />
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15, color:tier.color }}>
                {fmt(u.minutes)}
              </div>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:10, color:"#222", marginTop:1 }}>
                {tier.score} Pkt
              </div>
            </div>
          </div>
        );
      })}
    </div>

    {/* Peinliche Message für Letzten */}
    {allUsers[allUsers.length-1] && (
      <div style={{
        marginTop:12, background:"#100508", border:"1px solid #ff3b5c22",
        borderRadius:12, padding:"12px 16px",
        fontFamily:"'Space Grotesk',sans-serif", fontSize:13, color:"#ff3b5c88",
        textAlign:"center",
      }}>
        💀 <strong style={{color:"#ff3b5c"}}>{allUsers[allUsers.length-1].name}</strong> hat heute sein Handy nicht weglegen können 🫠
      </div>
    )}
  </div>
</div>
```

);
}

// ─── SCREEN: CHALLENGES ──────────────────────────────────────────────────────
function ChallengesScreen({ isPremium, onUpgrade, streak }) {
const [joined, setJoined] = useState({});

const challenges = [
{ id:“c1”, emoji:“📵”, title:“5h Woche”, desc:“Diese Woche unter 5h Social Media”, members:3, premium:false },
{ id:“c2”, emoji:“🌅”, title:“Morgen-Frei”, desc:“Erste Stunde nach dem Aufwachen kein Handy”, members:7, premium:false },
{ id:“c3”, emoji:“🎯”, title:“30-Tage-Streak”, desc:“30 Tage unter 60 Min täglich”, members:2, premium:true },
{ id:“c4”, emoji:“👥”, title:“Gruppen-Battle”, desc:“Wessen Gruppe ist diese Woche besser?”, members:12, premium:true },
];

return (
<div style={{ minHeight:“100vh”, background:”#050508”, padding:“52px 16px 100px” }}>
<div style={{ animation:“fadeUp 0.4s ease both” }}>
<h1 style={{ fontFamily:”‘Syne’,sans-serif”, fontWeight:800, fontSize:26, color:”#fff”, marginBottom:4 }}>
Challenges
</h1>
<p style={{ fontFamily:”‘Space Grotesk’,sans-serif”, color:”#333”, fontSize:13, marginBottom:24 }}>
Beweise deiner Gruppe was du drauf hast
</p>
</div>

```
  {streak > 0 && (
    <div style={{
      background:"#100f00", border:"1px solid #ffe14d33",
      borderRadius:14, padding:16, marginBottom:16,
      display:"flex", alignItems:"center", gap:12,
      animation:"fadeUp 0.4s 0.1s ease both", opacity:0,
    }}>
      <span style={{fontSize:32}}>🔥</span>
      <div>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:"#ffe14d"}}>
          {streak} Tage Streak!
        </div>
        <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:12,color:"#555"}}>
          Mach weiter so – du bist auf dem richtigen Weg
        </div>
      </div>
    </div>
  )}

  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
    {challenges.map((c, i) => {
      const locked = c.premium && !isPremium;
      const isJoined = joined[c.id];
      return (
        <div key={c.id} style={{
          background: locked ? "#08080f" : "#0a0a18",
          border: `1px solid ${isJoined ? "#ff3b5c44" : locked ? "#0d0d1a" : "#111122"}`,
          borderRadius:16, padding:16, opacity: locked ? 0.6 : 1,
          animation:`fadeUp 0.4s ${i*80}ms ease both`, opacity:0,
        }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
            <span style={{fontSize:28}}>{c.emoji}</span>
            <div style={{flex:1}}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16, color: locked?"#333":"#fff" }}>
                  {c.title}
                </span>
                {c.premium && <span style={{
                  fontSize:9, color:"#ffe14d", background:"#ffe14d22",
                  padding:"2px 6px", borderRadius:4,
                  fontFamily:"'Space Grotesk',sans-serif", fontWeight:700,
                }}>PRO</span>}
              </div>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:13, color:"#444", marginBottom:10 }}>
                {c.desc}
              </p>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:11, color:"#333" }}>
                  {c.members} Mitglieder dabei
                </span>
                {locked ? (
                  <button onClick={onUpgrade} style={{
                    background:"#ffe14d22", border:"1px solid #ffe14d44",
                    borderRadius:8, padding:"7px 12px", color:"#ffe14d",
                    fontFamily:"'Space Grotesk',sans-serif", fontSize:11, fontWeight:700, cursor:"pointer",
                  }}>🔓 Pro holen</button>
                ) : (
                  <button onClick={() => setJoined(j=>({...j,[c.id]:!j[c.id]}))} style={{
                    background: isJoined ? "#ff3b5c22" : "linear-gradient(135deg,#ff3b5c,#ff6b35)",
                    border: isJoined ? "1px solid #ff3b5c44" : "none",
                    borderRadius:8, padding:"7px 14px",
                    color: isJoined ? "#ff3b5c" : "#fff",
                    fontFamily:"'Space Grotesk',sans-serif", fontSize:11, fontWeight:700, cursor:"pointer",
                  }}>{isJoined ? "✓ Dabei" : "Mitmachen"}</button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    })}
  </div>
</div>
```

);
}

// ─── SCREEN: STATS ───────────────────────────────────────────────────────────
function StatsScreen({ user, isPremium, onUpgrade }) {
const weekData = [88, 112, 55, 42, 134, 60, user.minutes];
const days = [“Mo”,“Di”,“Mi”,“Do”,“Fr”,“Sa”,“So”];
const maxVal = Math.max(…weekData, 1);

return (
<div style={{ minHeight:“100vh”, background:”#050508”, padding:“52px 16px 100px” }}>
<div style={{ animation:“fadeUp 0.4s ease both”, marginBottom:24 }}>
<h1 style={{ fontFamily:”‘Syne’,sans-serif”, fontWeight:800, fontSize:26, color:”#fff”, marginBottom:4 }}>
Deine Stats
</h1>
<p style={{ fontFamily:”‘Space Grotesk’,sans-serif”, color:”#333”, fontSize:13 }}>
Diese Woche im Überblick
</p>
</div>

```
  {/* Weekly chart */}
  <div style={{
    background:"#080810", border:"1px solid #111122",
    borderRadius:18, padding:20, marginBottom:16,
    animation:"fadeUp 0.4s 0.1s ease both", opacity:0,
  }}>
    <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, color:"#fff", fontSize:14, marginBottom:16 }}>
      7 Tage Verlauf
    </div>
    <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:100 }}>
      {weekData.map((val, i) => {
        const tier = getTier(val);
        const h = (val / maxVal) * 100;
        const isToday = i === 6;
        return (
          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <div style={{
              width:"100%", height:`${h}%`, minHeight:4,
              background: isToday ? `linear-gradient(180deg,${tier.color},${tier.color}88)` : tier.color+"44",
              borderRadius:"4px 4px 0 0",
              transition:"height 1s ease",
              boxShadow: isToday ? `0 0 10px ${tier.color}66` : "none",
            }}/>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:10, color: isToday?"#fff":"#333" }}>
              {days[i]}
            </span>
          </div>
        );
      })}
    </div>
  </div>

  {/* Summary cards */}
  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
    {[
      { label:"Heute", value:fmt(user.minutes), color:getTier(user.minutes).color },
      { label:"Ø diese Woche", value:fmt(Math.round(weekData.reduce((a,b)=>a+b,0)/7)), color:"#4d9fff" },
      { label:"Bester Tag", value:fmt(Math.min(...weekData)), color:"#00e5a0" },
      { label:"Score heute", value:`${getTier(user.minutes).score} Pkt`, color:"#ffe14d" },
    ].map((s,i) => (
      <div key={i} style={{
        background:"#080810", border:"1px solid #111122",
        borderRadius:14, padding:14,
        animation:`fadeUp 0.4s ${i*60+200}ms ease both`, opacity:0,
      }}>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:11, color:"#333", marginBottom:6 }}>
          {s.label}
        </div>
        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color:s.color }}>
          {s.value}
        </div>
      </div>
    ))}
  </div>

  {/* Premium upsell */}
  {!isPremium && (
    <div style={{
      background:"linear-gradient(135deg,#100f00,#0a0a00)",
      border:"1px solid #ffe14d33", borderRadius:18, padding:20,
      animation:"fadeUp 0.4s 0.4s ease both", opacity:0,
    }}>
      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:18, color:"#ffe14d", marginBottom:6 }}>
        ⭐ Pro für 0,99€/Monat
      </div>
      <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:13, color:"#555", marginBottom:14 }}>
        Mehrere Gruppen · mehr Apps · detaillierte Stats · alle Challenges
      </p>
      <Btn variant="primary" onClick={onUpgrade} style={{ width:"100%", borderRadius:12, background:"linear-gradient(135deg,#ffe14d,#ff8c42)", color:"#000" }}>
        Jetzt upgraden
      </Btn>
    </div>
  )}
</div>
```

);
}

// ─── SCREEN: PREMIUM MODAL ───────────────────────────────────────────────────
function PremiumModal({ onClose, onPurchase }) {
const features = [
[“✓”,“Mehrere Gruppen gleichzeitig”],
[“✓”,“Alle Apps tracken (unbegrenzt)”],
[“✓”,“Erweiterte Wochenstatistiken”],
[“✓”,“Alle Challenges freischalten”],
[“✓”,“Custom Badges & Profil”],
[“✓”,“Kein Werbebanner”],
];
return (
<div style={{
position:“fixed”, inset:0, background:”#000000cc”,
display:“flex”, alignItems:“flex-end”, justifyContent:“center”,
zIndex:1000, backdropFilter:“blur(4px)”,
}} onClick={onClose}>
<div onClick={e=>e.stopPropagation()} style={{
width:“100%”, maxWidth:480,
background:”#0a0a18”, borderRadius:“24px 24px 0 0”,
padding:“32px 24px 48px”,
border:“1px solid #1e1e35”,
animation:“fadeUp 0.3s ease”,
}}>
<div style={{ textAlign:“center”, marginBottom:24 }}>
<div style={{ fontSize:48, marginBottom:8 }}>⭐</div>
<h2 style={{ fontFamily:”‘Syne’,sans-serif”, fontWeight:800, fontSize:26, color:”#fff”, marginBottom:6 }}>
scrollless Pro
</h2>
<p style={{ fontFamily:”‘Space Grotesk’,sans-serif”, color:”#444”, fontSize:14 }}>
Für ernsthafte Leaderboard-Spieler
</p>
</div>

```
    <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
      {features.map(([icon, text], i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ color:"#00e5a0", fontWeight:700, fontSize:14 }}>{icon}</span>
          <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, color:"#bbb" }}>{text}</span>
        </div>
      ))}
    </div>

    <div style={{ display:"flex", gap:10 }}>
      <Btn variant="ghost" onClick={onClose} style={{ flex:1, borderRadius:14 }}>Abbrechen</Btn>
      <Btn variant="primary" onClick={onPurchase} style={{
        flex:2, borderRadius:14,
        background:"linear-gradient(135deg,#ffe14d,#ff8c42)", color:"#000",
      }}>
        0,99€ / Monat
      </Btn>
    </div>
    <p style={{ textAlign:"center", fontFamily:"'Space Grotesk',sans-serif", fontSize:10, color:"#222", marginTop:12 }}>
      Jederzeit kündbar · Zahlung via Stripe
    </p>
  </div>
</div>
```

);
}

// ─── BOTTOM NAV ──────────────────────────────────────────────────────────────
function BottomNav({ active, onChange }) {
const tabs = [
{ id:“home”,       emoji:“🏆”, label:“Ranking” },
{ id:“challenges”, emoji:“🎯”, label:“Challenges” },
{ id:“stats”,      emoji:“📊”, label:“Stats” },
];
return (
<div style={{
position:“fixed”, bottom:0, left:“50%”, transform:“translateX(-50%)”,
width:“100%”, maxWidth:480,
background:”#080810”, borderTop:“1px solid #111122”,
display:“flex”, padding:“10px 0 24px”,
zIndex:100,
}}>
{tabs.map(t => (
<button key={t.id} onClick={() => onChange(t.id)} style={{
flex:1, display:“flex”, flexDirection:“column”,
alignItems:“center”, gap:4, border:“none”,
background:“transparent”, cursor:“pointer”, padding:“4px 0”,
opacity: active === t.id ? 1 : 0.35,
transition:“opacity 0.2s ease”,
}}>
<span style={{ fontSize:20 }}>{t.emoji}</span>
<span style={{
fontFamily:”‘Space Grotesk’,sans-serif”, fontWeight:700,
fontSize:10, color: active===t.id?”#ff3b5c”:”#fff”,
}}>{t.label}</span>
</button>
))}
</div>
);
}

// ─── ROOT APP ────────────────────────────────────────────────────────────────
export default function App() {
const [screen, setScreen] = useState(“splash”);
const [nav, setNav] = useState(“home”);
const [user, setUser] = useState(null);
const [friends] = useState(MOCK_FRIENDS);
const [isPremium, setIsPremium] = useState(false);
const [showPremium, setShowPremium] = useState(false);

function handleOnboardingComplete(data) {
setUser({
name: data.name,
username: data.username,
avatar: data.name[0].toUpperCase(),
minutes: 72,
streak: 2,
badges: [],
trackedApps: data.selectedApps,
});
setScreen(“app”);
}

function handleUpdateMinutes(m) {
setUser(u => ({ …u, minutes: m }));
}

return (
<div style={{ maxWidth:480, margin:“0 auto”, position:“relative”, minHeight:“100vh” }}>
<GlobalStyles />

```
  {screen === "splash" && <SplashScreen onDone={() => setScreen("onboarding")} />}
  {screen === "onboarding" && <OnboardingScreen onComplete={handleOnboardingComplete} />}

  {screen === "app" && user && (
    <>
      {nav === "home" && (
        <HomeScreen
          user={user}
          friends={friends}
          onUpdateMinutes={handleUpdateMinutes}
          isPremium={isPremium}
          onUpgrade={() => setShowPremium(true)}
        />
      )}
      {nav === "challenges" && (
        <ChallengesScreen
          isPremium={isPremium}
          onUpgrade={() => setShowPremium(true)}
          streak={user.streak}
        />
      )}
      {nav === "stats" && (
        <StatsScreen
          user={user}
          isPremium={isPremium}
          onUpgrade={() => setShowPremium(true)}
        />
      )}

      <BottomNav active={nav} onChange={setNav} />

      {showPremium && (
        <PremiumModal
          onClose={() => setShowPremium(false)}
          onPurchase={() => { setIsPremium(true); setShowPremium(false); }}
        />
      )}
    </>
  )}
</div>
```

);
}
