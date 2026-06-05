import { useState, useEffect, useRef } from "react";
import { listenTo } from "../firebase";

const ago = (ts) => {
    if (!ts) return "";
    const s = Math.floor(Date.now() / 1000) - Number(ts.replace(":", "").slice(0,6));
    if (isNaN(s) || s < 0) return "just now";
    if (s < 60)   return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    return `${Math.floor(s/3600)}h ago`;
};

const roleCol = (r) => ({ Admin:"#00d4ff", Staff:"#39ff14", Guest:"#ff9800" }[r] || "#888");

function StatCard({ label, value, color }) {
    return (
        <div style={{ background:"#040f18", border:"1px solid #0d2d45", borderRadius:6,
            padding:"18px 20px", position:"relative", overflow:"hidden" }}>
            <div style={{ fontSize:10, color:"#3a7a9a", letterSpacing:3, marginBottom:10 }}>{label}</div>
            <div style={{ fontSize:34, fontWeight:700, color }}>{value}</div>
            <div style={{ position:"absolute", bottom:0, left:0, height:3, width:"100%",
                background:color, opacity:.4 }} />
        </div>
    );
}

export default function Overview() {
    const [logs,   setLogs]   = useState([]);
    const [latest, setLatest] = useState(null);
    const [filter, setFilter] = useState("ALL");
    const [newKey, setNewKey] = useState(null);
    const prevLen = useRef(0);

    useEffect(() => {
        const u1 = listenTo("/rfid/logs", snap => {
            const d = snap.val();
            if (!d) return;
            const arr = Object.entries(d)
                .map(([k,v]) => ({_key:k,...v}))
                .sort((a,b) => Number(b._key)-Number(a._key));
            if (arr.length > prevLen.current && prevLen.current > 0) {
                setNewKey(arr[0]._key);
                setTimeout(()=>setNewKey(null), 2000);
            }
            prevLen.current = arr.length;
            setLogs(arr);
        });
        const u2 = listenTo("/rfid/latest", snap => setLatest(snap.val()));
        return () => { u1(); u2(); };
    }, []);

    const granted = logs.filter(l=>l.status==="GRANTED").length;
    const denied  = logs.filter(l=>l.status==="DENIED").length;
    const unique  = new Set(logs.map(l=>l.uid).filter(Boolean)).size;
    const filtered = filter==="ALL" ? logs : logs.filter(l=>l.status===filter);

    const panel = { background:"#040f18", border:"1px solid #0d2d45", borderRadius:6, overflow:"hidden" };
    const ph    = { display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"12px 18px", borderBottom:"1px solid #0d2d45", background:"rgba(0,212,255,.03)" };

    return (
        <div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
                <StatCard label="TOTAL SCANS"    value={logs.length} color="#00d4ff" />
                <StatCard label="ACCESS GRANTED" value={granted}     color="#39ff14" />
                <StatCard label="ACCESS DENIED"  value={denied}      color="#ff4444" />
                <StatCard label="UNIQUE CARDS"   value={unique}      color="#ff9800" />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:16 }}>

                <div style={panel}>
                    <div style={ph}>
                        <span style={{ fontSize:11, color:"#00d4ff", letterSpacing:3, fontWeight:700 }}>◈ LIVE LOG</span>
                        <div style={{ display:"flex", gap:8 }}>
                            {["ALL","GRANTED","DENIED"].map(f => {
                                const c = f==="GRANTED"?"#39ff14":f==="DENIED"?"#ff4444":"#00d4ff";
                                const on = filter===f;
                                return <button key={f} onClick={()=>setFilter(f)} style={{
                                    fontSize:10, padding:"3px 10px", borderRadius:2, cursor:"pointer",
                                    fontFamily:"monospace", letterSpacing:1,
                                    border:`1px solid ${on?c:"#0d2d45"}`,
                                    background:on?`${c}18`:"transparent",
                                    color:on?c:"#3a7a9a",
                                }}>{f}</button>;
                            })}
                        </div>
                    </div>
                    <div style={{ maxHeight:420, overflowY:"auto" }}>
                        {filtered.length === 0
                            ? <div style={{ padding:40, textAlign:"center", color:"#3a7a9a", fontSize:13 }}>
                                No logs yet — scan a card!
                            </div>
                            : filtered.map(log => {
                                const ok = log.status==="GRANTED";
                                const isNew = log._key===newKey;
                                return (
                                    <div key={log._key} style={{
                                        display:"flex", alignItems:"center", gap:14,
                                        padding:"11px 18px", borderBottom:"1px solid #050e17",
                                        background:isNew?"rgba(0,212,255,.05)":"transparent",
                                        borderLeft:isNew?"2px solid #00d4ff":"2px solid transparent",
                                        animation:isNew?"slideIn .4s ease":"none",
                                    }}>
                                        <div style={{ width:36,height:36,borderRadius:4,flexShrink:0,
                                            background:`${roleCol(log.role)}18`,border:`1px solid ${roleCol(log.role)}40`,
                                            color:roleCol(log.role),display:"flex",alignItems:"center",
                                            justifyContent:"center",fontSize:12,fontWeight:700 }}>
                                            {log.name?log.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase():"??"}
                                        </div>
                                        <div style={{ flex:1, minWidth:0 }}>
                                            <div style={{ fontSize:14, fontWeight:600, color:"#e0f0f8", marginBottom:2 }}>
                                                {log.name||"Unknown"}
                                            </div>
                                            <div style={{ fontSize:11, color:"#3a7a9a" }}>{log.uid}</div>
                                        </div>
                                        <div style={{ textAlign:"right", flexShrink:0 }}>
                                            <div style={{ display:"inline-block", fontSize:10, padding:"3px 10px",
                                                borderRadius:2, fontWeight:700, letterSpacing:1, marginBottom:4,
                                                background:ok?"rgba(57,255,20,.12)":"rgba(255,68,68,.12)",
                                                border:`1px solid ${ok?"#39ff14":"#ff4444"}40`,
                                                color:ok?"#39ff14":"#ff4444" }}>
                                                {ok?"✓ GRANTED":"✗ DENIED"}
                                            </div>
                                            <div style={{ fontSize:10, color:"#3a7a9a" }}>{log.role}</div>
                                            <div style={{ fontSize:10, color:"#2a5a7a" }}>{log.time}</div>
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>


                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

                    <div style={panel}>
                        <div style={ph}><span style={{ fontSize:11,color:"#00d4ff",letterSpacing:3,fontWeight:700 }}>⚡ LATEST</span></div>
                        <div style={{ padding:16 }}>
                            {latest ? [
                                ["uid",    latest.uid,    "#ffd700"],
                                ["name",   latest.name,   "#e0f0f8"],
                                ["status", latest.status, latest.status==="GRANTED"?"#39ff14":"#ff4444"],
                                ["time",   latest.time,   "#00d4ff"],
                            ].map(([k,v,c])=>(
                                <div key={k} style={{ display:"flex",justifyContent:"space-between",
                                    marginBottom:8, fontSize:12, fontFamily:"monospace" }}>
                                    <span style={{ color:"#00d4ff" }}>"{k}"</span>
                                    <span style={{ color:c, maxWidth:150, textAlign:"right", wordBreak:"break-all" }}>"{v}"</span>
                                </div>
                            )) : <div style={{ color:"#3a7a9a", fontSize:13, textAlign:"center", padding:"20px 0" }}>Waiting...</div>}
                        </div>
                    </div>


                    <div style={panel}>
                        <div style={ph}><span style={{ fontSize:11,color:"#00d4ff",letterSpacing:3,fontWeight:700 }}>📊 GRANT RATE</span></div>
                        <div style={{ padding:"20px 18px 16px" }}>
                            <div style={{ textAlign:"center", marginBottom:14 }}>
                                <div style={{ fontSize:38,fontWeight:700,color:"#39ff14" }}>
                                    {logs.length?Math.round(granted/logs.length*100):0}%
                                </div>
                                <div style={{ fontSize:10,color:"#3a7a9a",letterSpacing:2,marginTop:4 }}>ACCESS GRANTED</div>
                            </div>
                            <div style={{ height:8,background:"#050e17",borderRadius:4,overflow:"hidden",marginBottom:8 }}>
                                <div style={{ height:"100%",borderRadius:4,transition:"width 1s ease",
                                    width:`${logs.length?Math.round(granted/logs.length*100):0}%`,
                                    background:"linear-gradient(90deg,#39ff14,#00d4ff)" }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
