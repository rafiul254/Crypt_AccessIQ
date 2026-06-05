import { useState, useEffect } from "react";
import { listenTo } from "../firebase";
import {
    BarChart, Bar, LineChart, Line,
    XAxis, YAxis, Tooltip, ResponsiveContainer,
    Cell, PieChart, Pie, Legend
} from "recharts";

const CHART_TOOLTIP = {
    contentStyle: { background:"#040f18", border:"1px solid #0d2d45",
        borderRadius:4, fontFamily:"monospace", fontSize:12 },
    labelStyle:  { color:"#00d4ff" },
    itemStyle:   { color:"#cde8f5" },
};

const byHour = (logs) => {
    const counts = Array.from({length:24}, (_,h) => ({ hour:`${h}:00`, count:0 }));
    logs.forEach(l => {
        if (!l.time) return;
        const h = parseInt(l.time.split(":")[0]);
        if (!isNaN(h)) counts[h].count++;
    });
    return counts;
};

const byDay = (logs) => {
    const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const counts = days.map(d => ({ day:d, granted:0, denied:0 }));
    logs.forEach(l => {
        if (!l.date) return;
        const d = new Date(l.date).getDay();   // 0=Sun
        const idx = d===0 ? 6 : d-1;
        if (l.status==="GRANTED") counts[idx].granted++;
        else counts[idx].denied++;
    });
    return counts;
};

const topUsers = (logs, n=8) => {
    const map = {};
    logs.forEach(l => {
        if (!l.name || l.name==="Unknown") return;
        map[l.name] = (map[l.name]||0) + 1;
    });
    return Object.entries(map)
        .sort((a,b)=>b[1]-a[1])
        .slice(0,n)
        .map(([name,count]) => ({ name:name.split(" ")[0], count }));
};

const roleColors = { Admin:"#00d4ff", Staff:"#39ff14", Guest:"#ff9800", NONE:"#ff4444" };

export default function Analytics() {
    const [logs, setLogs] = useState([]);
    const [view, setView] = useState("hourly");

    useEffect(() => {
        const unsub = listenTo("/rfid/logs", snap => {
            const d = snap.val();
            if (!d) return;
            setLogs(Object.values(d));
        });
        return () => unsub();
    }, []);

    const granted = logs.filter(l=>l.status==="GRANTED").length;
    const denied  = logs.filter(l=>l.status==="DENIED").length;
    const pieData = [
        { name:"Granted", value:granted, color:"#39ff14" },
        { name:"Denied",  value:denied,  color:"#ff4444" },
    ];

    const panel = { background:"#040f18", border:"1px solid #0d2d45", borderRadius:6, overflow:"hidden" };
    const ph    = { padding:"12px 18px", borderBottom:"1px solid #0d2d45",
        background:"rgba(0,212,255,.03)", display:"flex", alignItems:"center",
        justifyContent:"space-between" };

    const viewBtns = [
        { id:"hourly",   label:"Hourly Activity" },
        { id:"weekly",   label:"Weekly Trend"    },
        { id:"topUsers", label:"Top Users"        },
        { id:"grantDeny",label:"Grant vs Deny"    },
    ];

    return (
        <div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
                {[
                    { label:"TOTAL LOGS",    value:logs.length,    color:"#00d4ff" },
                    { label:"GRANTED",       value:granted,         color:"#39ff14" },
                    { label:"DENIED",        value:denied,          color:"#ff4444" },
                    { label:"GRANT RATE",    value:logs.length?`${Math.round(granted/logs.length*100)}%`:"—", color:"#ff9800" },
                ].map(s => (
                    <div key={s.label} style={{ background:"#040f18", border:"1px solid #0d2d45",
                        borderRadius:6, padding:"16px 20px" }}>
                        <div style={{ fontSize:10, color:"#3a7a9a", letterSpacing:3, marginBottom:8 }}>{s.label}</div>
                        <div style={{ fontSize:28, fontWeight:700, color:s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>

            <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
                {viewBtns.map(b => (
                    <button key={b.id} onClick={()=>setView(b.id)} style={{
                        background: view===b.id?"rgba(0,212,255,.12)":"transparent",
                        border:`1px solid ${view===b.id?"#00d4ff":"#0d2d45"}`,
                        color: view===b.id?"#00d4ff":"#3a7a9a",
                        padding:"7px 16px", borderRadius:4, cursor:"pointer",
                        fontFamily:"monospace", fontSize:12, letterSpacing:1,
                        transition:"all .2s",
                    }}>{b.label}</button>
                ))}
            </div>

            <div style={panel}>
                <div style={ph}>
          <span style={{ fontSize:11, color:"#00d4ff", letterSpacing:3, fontWeight:700 }}>
            📈 {viewBtns.find(b=>b.id===view)?.label.toUpperCase()}
          </span>
                    <span style={{ fontSize:11, color:"#3a7a9a", fontFamily:"monospace" }}>
            {logs.length} total scans
          </span>
                </div>

                <div style={{ padding:"20px 10px 10px" }}>
                    {logs.length === 0 ? (
                        <div style={{ padding:60, textAlign:"center", color:"#3a7a9a" }}>
                            No data yet — scan some cards first!
                        </div>
                    ) : (
                        <>

                            {view === "hourly" && (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={byHour(logs)} barSize={14}>
                                        <XAxis dataKey="hour" tick={{ fill:"#3a7a9a", fontSize:9, fontFamily:"monospace" }}
                                               axisLine={false} tickLine={false} interval={2} />
                                        <YAxis tick={{ fill:"#3a7a9a", fontSize:10 }} axisLine={false} tickLine={false}
                                               allowDecimals={false} />
                                        <Tooltip {...CHART_TOOLTIP} />
                                        <Bar dataKey="count" fill="#00d4ff" radius={[3,3,0,0]} opacity={.85} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}


                            {view === "weekly" && (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={byDay(logs)} barSize={20}>
                                        <XAxis dataKey="day" tick={{ fill:"#3a7a9a", fontSize:11, fontFamily:"monospace" }}
                                               axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill:"#3a7a9a", fontSize:10 }} axisLine={false} tickLine={false}
                                               allowDecimals={false} />
                                        <Tooltip {...CHART_TOOLTIP} />
                                        <Legend wrapperStyle={{ fontFamily:"monospace", fontSize:11 }} />
                                        <Bar dataKey="granted" name="Granted" fill="#39ff14" radius={[3,3,0,0]} opacity={.85} />
                                        <Bar dataKey="denied"  name="Denied"  fill="#ff4444" radius={[3,3,0,0]} opacity={.85} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}

                            {view === "topUsers" && (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={topUsers(logs)} layout="vertical" barSize={18}>
                                        <XAxis type="number" tick={{ fill:"#3a7a9a", fontSize:10 }} axisLine={false} tickLine={false} />
                                        <YAxis type="category" dataKey="name" tick={{ fill:"#cde8f5", fontSize:12, fontFamily:"monospace" }}
                                               axisLine={false} tickLine={false} width={70} />
                                        <Tooltip {...CHART_TOOLTIP} />
                                        <Bar dataKey="count" name="Scans" radius={[0,3,3,0]}>
                                            {topUsers(logs).map((_, i) => (
                                                <Cell key={i} fill={["#00d4ff","#39ff14","#ff9800","#bf80ff","#ff4444","#ffd700","#4fc3f7","#ff6b6b"][i%8]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}


                            {view === "grantDeny" && (
                                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:40 }}>
                                    <ResponsiveContainer width={260} height={260}>
                                        <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={110}
                                                 dataKey="value" paddingAngle={3}>
                                                {pieData.map(d => <Cell key={d.name} fill={d.color} opacity={.9} />)}
                                            </Pie>
                                            <Tooltip {...CHART_TOOLTIP} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                                        {pieData.map(d => (
                                            <div key={d.name} style={{ display:"flex", alignItems:"center", gap:12 }}>
                                                <div style={{ width:12, height:12, borderRadius:2, background:d.color }} />
                                                <div>
                                                    <div style={{ fontSize:12, color:"#cde8f5", fontFamily:"monospace" }}>{d.name}</div>
                                                    <div style={{ fontSize:20, fontWeight:700, color:d.color }}>{d.value}</div>
                                                    <div style={{ fontSize:11, color:"#3a7a9a" }}>
                                                        {logs.length?`${Math.round(d.value/logs.length*100)}%`:"0%"}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
