import { useState, useEffect } from "react";
import { listenTo } from "../firebase";

const today = () => new Date().toISOString().split("T")[0];

export default function Attendance() {
    const [date,    setDate]    = useState(today());
    const [records, setRecords] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const unsub = listenTo(`/rfid/attendance/${date}`, snap => {
            setRecords(snap.val() || {});
            setLoading(false);
        });
        return () => unsub();
    }, [date]);

    const rows = Object.entries(records);
    const present = rows.filter(([,v]) => v.entry).length;
    const out     = rows.filter(([,v]) => v.exit).length;

    const panel = { background:"#040f18", border:"1px solid #0d2d45", borderRadius:6, overflow:"hidden" };
    const ph    = { display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"12px 18px", borderBottom:"1px solid #0d2d45", background:"rgba(0,212,255,.03)" };

    return (
        <div>

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                marginBottom:20, flexWrap:"wrap", gap:12 }}>
                <div>
                    <div style={{ fontSize:11, color:"#3a7a9a", letterSpacing:3, marginBottom:4 }}>ATTENDANCE RECORD</div>
                    <div style={{ fontSize:22, fontWeight:800, color:"#fff" }}>{date}</div>
                </div>

                <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                       max={today()}
                       style={{ background:"#040f18", border:"1px solid #0d2d45", color:"#00d4ff",
                           padding:"8px 14px", borderRadius:4, fontFamily:"monospace", fontSize:13,
                           cursor:"pointer" }} />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
                {[
                    { label:"TOTAL RECORDS", value:rows.length,  color:"#00d4ff" },
                    { label:"CURRENTLY IN",  value:present - out, color:"#39ff14" },
                    { label:"EXITED",        value:out,           color:"#ff9800" },
                ].map(s => (
                    <div key={s.label} style={{ background:"#040f18", border:"1px solid #0d2d45",
                        borderRadius:6, padding:"16px 20px" }}>
                        <div style={{ fontSize:10, color:"#3a7a9a", letterSpacing:3, marginBottom:8 }}>{s.label}</div>
                        <div style={{ fontSize:30, fontWeight:700, color:s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>

            <div style={panel}>
                <div style={ph}>
          <span style={{ fontSize:11, color:"#00d4ff", letterSpacing:3, fontWeight:700 }}>
            📋 DAILY RECORDS
          </span>
                    <span style={{ fontSize:11, color:"#3a7a9a", fontFamily:"monospace" }}>
            {rows.length} entries
          </span>
                </div>

                {loading ? (
                    <div style={{ padding:40, textAlign:"center", color:"#3a7a9a" }}>Loading...</div>
                ) : rows.length === 0 ? (
                    <div style={{ padding:40, textAlign:"center", color:"#3a7a9a" }}>
                        No attendance records for {date}
                    </div>
                ) : (
                    <div style={{ overflowX:"auto" }}>
                        <table style={{ width:"100%", borderCollapse:"collapse",
                            fontFamily:"monospace", fontSize:13 }}>
                            <thead>
                            <tr style={{ background:"rgba(0,212,255,.06)" }}>
                                {["NAME","ROLE","ENTRY","EXIT","DURATION","STATUS"].map(h => (
                                    <th key={h} style={{ padding:"10px 16px", textAlign:"left",
                                        color:"#00d4ff", fontSize:10, letterSpacing:2,
                                        borderBottom:"1px solid #0d2d45" }}>{h}</th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {rows.map(([key, r]) => {
                                const isIn  = r.entry && !r.exit;
                                const isDone = r.entry && r.exit;
                                return (
                                    <tr key={key} style={{ borderBottom:"1px solid #050e17" }}>
                                        <td style={{ padding:"11px 16px", color:"#e0f0f8", fontWeight:600 }}>
                                            {r.name || "—"}
                                        </td>
                                        <td style={{ padding:"11px 16px", color:"#5a9fb8" }}>{r.role || "—"}</td>
                                        <td style={{ padding:"11px 16px", color:"#39ff14" }}>{r.entry || "—"}</td>
                                        <td style={{ padding:"11px 16px", color:"#ff9800" }}>{r.exit  || "—"}</td>
                                        <td style={{ padding:"11px 16px", color:"#ffd700" }}>
                                            {r.duration || (isIn ? "In progress" : "—")}
                                        </td>
                                        <td style={{ padding:"11px 16px" }}>
                        <span style={{
                            fontSize:10, padding:"3px 10px", borderRadius:2, fontWeight:700,
                            letterSpacing:1,
                            background: isIn?"rgba(57,255,20,.12)":isDone?"rgba(255,149,0,.12)":"rgba(136,136,136,.1)",
                            border:`1px solid ${isIn?"#39ff1440":isDone?"#ff980040":"#88888840"}`,
                            color: isIn?"#39ff14":isDone?"#ff9800":"#888",
                        }}>
                          {isIn ? "● IN" : isDone ? "✓ OUT" : "—"}
                        </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
