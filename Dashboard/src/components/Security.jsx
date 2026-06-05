import { useState, useEffect } from "react";
import { listenTo, resetAlarm } from "../firebase";

export default function Security() {
    const [security, setSecurity] = useState({});
    const [logs,     setLogs]     = useState([]);
    const [resetting,setResetting]= useState(false);
    const [msg,      setMsg]      = useState("");

    useEffect(() => {
        const u1 = listenTo("/rfid/security", snap => setSecurity(snap.val() || {}));
        const u2 = listenTo("/rfid/logs",     snap => {
            const d = snap.val();
            if (!d) return;
            const denied = Object.values(d)
                .filter(l => l.status === "DENIED")
                .sort((a,b) => Number(b._key||0) - Number(a._key||0))
                .slice(0, 20);
            setLogs(denied);
        });
        return () => { u1(); u2(); };
    }, []);

    const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

    const handleReset = async () => {
        setResetting(true);
        await resetAlarm();
        setResetting(false);
        flash("✅ Alarm reset successfully");
    };

    const alarm   = security.alarmActive   || false;
    const wrong   = security.wrongAttempts || 0;
    const maxTry  = 3;
    const pct     = Math.min((wrong / maxTry) * 100, 100);

    const panel = {
        background: "#040f18", border: "1px solid #0d2d45",
        borderRadius: 6, overflow: "hidden",
    };
    const ph = {
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 18px", borderBottom: "1px solid #0d2d45",
        background: "rgba(0,212,255,.03)",
    };

    return (
        <div>

            {msg && (
                <div style={{
                    background: "rgba(57,255,20,.1)", border: "1px solid rgba(57,255,20,.3)",
                    color: "#39ff14", padding: "10px 18px", borderRadius: 4,
                    marginBottom: 16, fontFamily: "monospace", fontSize: 13,
                }}>{msg}</div>
            )}

            {alarm && (
                <div style={{
                    background: "rgba(255,68,68,.12)", border: "2px solid #ff4444",
                    borderRadius: 6, padding: "20px 24px", marginBottom: 20,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: 14,
                    animation: "fadeIn .3s ease",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ fontSize: 36 }}>🚨</div>
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#ff4444", letterSpacing: 2 }}>
                                SECURITY ALARM ACTIVE
                            </div>
                            <div style={{ fontSize: 13, color: "#ff8888", marginTop: 4 }}>
                                Multiple failed access attempts detected!
                                {security.lastDeniedUID && ` Last UID: ${security.lastDeniedUID}`}
                            </div>
                        </div>
                    </div>
                    <button onClick={handleReset} disabled={resetting} style={{
                        background: "rgba(255,68,68,.2)", border: "1px solid #ff4444",
                        color: "#ff4444", padding: "10px 22px", borderRadius: 4,
                        cursor: resetting ? "not-allowed" : "pointer",
                        fontFamily: "monospace", fontSize: 13, fontWeight: 700, letterSpacing: 1,
                    }}>
                        {resetting ? "RESETTING..." : "🔓 RESET ALARM"}
                    </button>
                </div>
            )}


            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                {[
                    {
                        label: "WRONG ATTEMPTS",
                        value: wrong,
                        color: wrong >= maxTry ? "#ff4444" : wrong > 0 ? "#ff9800" : "#39ff14",
                    },
                    {
                        label: "ALARM STATUS",
                        value: alarm ? "ACTIVE" : "CLEAR",
                        color: alarm ? "#ff4444" : "#39ff14",
                    },
                    {
                        label: "LAST DENIED UID",
                        value: security.lastDeniedUID || "—",
                        color: "#ff9800",
                        small: true,
                    },
                ].map(s => (
                    <div key={s.label} style={{
                        background: "#040f18", border: "1px solid #0d2d45",
                        borderRadius: 6, padding: "16px 20px",
                    }}>
                        <div style={{ fontSize: 10, color: "#3a7a9a", letterSpacing: 3, marginBottom: 8 }}>
                            {s.label}
                        </div>
                        <div style={{
                            fontSize: s.small ? 14 : 30, fontWeight: 700, color: s.color,
                            fontFamily: "monospace", wordBreak: "break-all",
                        }}>
                            {s.value}
                        </div>
                    </div>
                ))}
            </div>


            <div style={{ ...panel, marginBottom: 20 }}>
                <div style={ph}>
          <span style={{ fontSize: 11, color: "#ff4444", letterSpacing: 3, fontWeight: 700 }}>
            ⚠️ WRONG ATTEMPT COUNTER
          </span>
                    {!alarm && wrong > 0 && (
                        <button onClick={handleReset} style={{
                            background: "rgba(255,149,0,.1)", border: "1px solid #ff980040",
                            color: "#ff9800", padding: "4px 12px", borderRadius: 3,
                            cursor: "pointer", fontFamily: "monospace", fontSize: 10, letterSpacing: 1,
                        }}>RESET</button>
                    )}
                </div>
                <div style={{ padding: "20px 24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: "#cde8f5", fontFamily: "monospace" }}>
              Failed Attempts
            </span>
                        <span style={{
                            fontSize: 13, fontWeight: 700, fontFamily: "monospace",
                            color: wrong >= maxTry ? "#ff4444" : wrong > 0 ? "#ff9800" : "#39ff14",
                        }}>
              {wrong} / {maxTry}
            </span>
                    </div>

                    <div style={{ height: 12, background: "#050e17", borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
                        <div style={{
                            height: "100%", borderRadius: 6,
                            width: `${pct}%`,
                            background: pct >= 100
                                ? "#ff4444"
                                : pct > 50
                                    ? "linear-gradient(90deg,#ff9800,#ff4444)"
                                    : "#ff9800",
                            transition: "width .5s ease",
                            boxShadow: pct >= 100 ? "0 0 12px rgba(255,68,68,.6)" : "none",
                        }} />
                    </div>

                    <div style={{ fontSize: 12, color: "#3a7a9a", fontFamily: "monospace" }}>
                        {wrong === 0
                            ? "✅ No suspicious activity"
                            : wrong >= maxTry
                                ? "🚨 Threshold reached — alarm triggered!"
                                : `⚠️ ${maxTry - wrong} more attempt(s) before alarm`}
                    </div>

                    {security.lastDeniedTime && (
                        <div style={{ fontSize: 11, color: "#2a5a7a", fontFamily: "monospace", marginTop: 8 }}>
                            Last attempt: {security.lastDeniedTime}
                        </div>
                    )}
                </div>
            </div>


            <div style={panel}>
                <div style={ph}>
          <span style={{ fontSize: 11, color: "#ff4444", letterSpacing: 3, fontWeight: 700 }}>
            ❌ DENIED ACCESS LOG ({logs.length})
          </span>
                </div>
                {logs.length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", color: "#3a7a9a", fontSize: 13 }}>
                        No denied attempts yet — all clear! ✅
                    </div>
                ) : (
                    <div style={{ maxHeight: 400, overflowY: "auto" }}>
                        {logs.map((log, i) => (
                            <div key={i} style={{
                                display: "flex", alignItems: "center", gap: 14,
                                padding: "12px 18px", borderBottom: "1px solid #050e17",
                            }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 4, flexShrink: 0,
                                    background: "rgba(255,68,68,.12)", border: "1px solid rgba(255,68,68,.3)",
                                    color: "#ff4444", display: "flex", alignItems: "center",
                                    justifyContent: "center", fontSize: 16,
                                }}>✗</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, color: "#e0f0f8", fontWeight: 600, marginBottom: 2 }}>
                                        {log.name || "Unknown Card"}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#3a7a9a", fontFamily: "monospace" }}>
                                        {log.uid || "—"}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    <div style={{
                                        fontSize: 10, color: "#ff9800", background: "rgba(255,152,0,.1)",
                                        border: "1px solid rgba(255,152,0,.3)", padding: "2px 8px",
                                        borderRadius: 2, marginBottom: 4, fontFamily: "monospace",
                                    }}>
                                        {log.reason || "Denied"}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#2a5a7a", fontFamily: "monospace" }}>
                                        {log.time} {log.date}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
