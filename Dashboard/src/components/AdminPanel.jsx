import { useState, useEffect } from "react";
import { listenTo, saveUser, deleteUser, toggleUserActive, uidToKey, keyToUid } from "../firebase";

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const ROLES = ["Admin","Staff","Guest","Student"];

const emptyForm = {
    uid:"", name:"", role:"Staff", active:true,
    startHour:0, startMin:0, endHour:23, endMin:59,
    days:[true,true,true,true,true,false,false],
};

export default function AdminPanel() {
    const [users,   setUsers]   = useState({});
    const [form,    setForm]    = useState(emptyForm);
    const [editing, setEditing] = useState(null);
    const [showAdd, setShowAdd] = useState(false);
    const [saving,  setSaving]  = useState(false);
    const [msg,     setMsg]     = useState("");

    useEffect(() => {
        const unsub = listenTo("/rfid/users", snap => setUsers(snap.val() || {}));
        return () => unsub();
    }, []);

    const flash = (m) => { setMsg(m); setTimeout(()=>setMsg(""),3000); };

    const handleSave = async () => {
        if (!form.uid.trim() || !form.name.trim()) {
            flash("❌ UID and Name are required!"); return;
        }

        let uid = form.uid.trim().toUpperCase().replace(/\s/g,"");
        if (uid.includes(":")) uid = uid.replace(/:/g,"");
        if (uid.length !== 8) { flash("❌ UID must be 8 hex chars (e.g. A3B2C1D0)"); return; }

        setSaving(true);
        await saveUser(uid, {
            name:      form.name.trim(),
            role:      form.role,
            active:    form.active,
            startHour: Number(form.startHour),
            startMin:  Number(form.startMin),
            endHour:   Number(form.endHour),
            endMin:    Number(form.endMin),
            days:      form.days,
        });
        setSaving(false);
        setForm(emptyForm);
        setEditing(null);
        setShowAdd(false);
        flash("✅ User saved!");
    };

    const handleEdit = (key) => {
        const u = users[key];
        setForm({
            uid:       keyToUid(key),
            name:      u.name  || "",
            role:      u.role  || "Staff",
            active:    u.active !== false,
            startHour: u.startHour || 0,
            startMin:  u.startMin  || 0,
            endHour:   u.endHour   || 23,
            endMin:    u.endMin    || 59,
            days:      u.days      || [true,true,true,true,true,false,false],
        });
        setEditing(key);
        setShowAdd(true);
        window.scrollTo({ top:0, behavior:"smooth" });
    };

    const handleDelete = async (key) => {
        if (!window.confirm(`Delete user ${users[key]?.name}?`)) return;
        await deleteUser(key);
        flash("🗑️ User deleted");
    };

    const handleToggle = async (key, current) => {
        await toggleUserActive(key, !current);
        flash(`${!current?"✅ Activated":"⛔ Deactivated"}: ${users[key]?.name}`);
    };

    const roleColor = (r) => ({ Admin:"#00d4ff", Staff:"#39ff14", Guest:"#ff9800" }[r] || "#888");

    const inp = (extra={}) => ({
        background:"#020810", border:"1px solid #0d2d45", color:"#cde8f5",
        padding:"8px 12px", borderRadius:4, fontFamily:"monospace", fontSize:13,
        outline:"none", ...extra,
    });

    const panel = { background:"#040f18", border:"1px solid #0d2d45", borderRadius:6, overflow:"hidden" };
    const ph    = { display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"12px 18px", borderBottom:"1px solid #0d2d45", background:"rgba(0,212,255,.03)" };

    return (
        <div>

            {msg && (
                <div style={{ background:"rgba(57,255,20,.1)", border:"1px solid rgba(57,255,20,.3)",
                    color:"#39ff14", padding:"10px 18px", borderRadius:4, marginBottom:16,
                    fontFamily:"monospace", fontSize:13 }}>
                    {msg}
                </div>
            )}


            {showAdd && (
                <div style={{ ...panel, marginBottom:20, borderColor:"rgba(0,212,255,.35)" }}>
                    <div style={ph}>
            <span style={{ fontSize:11, color:"#00d4ff", letterSpacing:3, fontWeight:700 }}>
              {editing ? "✏️ EDIT USER" : "➕ ADD NEW USER"}
            </span>
                        <button onClick={()=>{ setShowAdd(false); setEditing(null); setForm(emptyForm); }}
                                style={{ background:"none", border:"1px solid #0d2d45", color:"#3a7a9a",
                                    padding:"4px 12px", borderRadius:3, cursor:"pointer", fontFamily:"monospace", fontSize:11 }}>
                            CANCEL
                        </button>
                    </div>
                    <div style={{ padding:20, display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>


                        <div>
                            <label style={{ fontSize:10, color:"#3a7a9a", letterSpacing:2, display:"block", marginBottom:6 }}>
                                CARD UID *
                            </label>
                            <input value={form.uid} onChange={e=>setForm({...form,uid:e.target.value})}
                                   placeholder="A3B2C1D0 (Take from Serial Monitor)"
                                   disabled={!!editing}
                                   style={{ ...inp(), width:"100%", opacity:editing?.5:1 }} />
                            {!editing && <div style={{ fontSize:11, color:"#3a7a9a", marginTop:4 }}>
                                You will see the UID in the serial monitor when you scan the card
                            </div>}
                        </div>


                        <div>
                            <label style={{ fontSize:10, color:"#3a7a9a", letterSpacing:2, display:"block", marginBottom:6 }}>
                                FULL NAME *
                            </label>
                            <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}
                                   placeholder="Rahim Ahmed"
                                   style={{ ...inp(), width:"100%" }} />
                        </div>


                        <div>
                            <label style={{ fontSize:10, color:"#3a7a9a", letterSpacing:2, display:"block", marginBottom:6 }}>
                                ROLE
                            </label>
                            <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}
                                    style={{ ...inp(), width:"100%" }}>
                                {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>


                        <div>
                            <label style={{ fontSize:10, color:"#3a7a9a", letterSpacing:2, display:"block", marginBottom:6 }}>
                                STATUS
                            </label>
                            <div style={{ display:"flex", gap:10, marginTop:4 }}>
                                {[true,false].map(v => (
                                    <label key={String(v)} style={{ display:"flex", alignItems:"center", gap:8,
                                        cursor:"pointer", color: form.active===v?(v?"#39ff14":"#ff4444"):"#3a7a9a",
                                        fontSize:13, fontFamily:"monospace" }}>
                                        <input type="radio" checked={form.active===v}
                                               onChange={()=>setForm({...form,active:v})}
                                               style={{ accentColor: v?"#39ff14":"#ff4444" }} />
                                        {v?"Active":"Inactive"}
                                    </label>
                                ))}
                            </div>
                        </div>


                        <div>
                            <label style={{ fontSize:10, color:"#3a7a9a", letterSpacing:2, display:"block", marginBottom:6 }}>
                                ALLOWED FROM (TIME)
                            </label>
                            <div style={{ display:"flex", gap:8 }}>
                                <input type="number" min={0} max={23} value={form.startHour}
                                       onChange={e=>setForm({...form,startHour:e.target.value})}
                                       style={{ ...inp(), width:70 }} placeholder="HH" />
                                <span style={{ color:"#3a7a9a", alignSelf:"center" }}>:</span>
                                <input type="number" min={0} max={59} value={form.startMin}
                                       onChange={e=>setForm({...form,startMin:e.target.value})}
                                       style={{ ...inp(), width:70 }} placeholder="MM" />
                            </div>
                        </div>


                        <div>
                            <label style={{ fontSize:10, color:"#3a7a9a", letterSpacing:2, display:"block", marginBottom:6 }}>
                                ALLOWED UNTIL (TIME)
                            </label>
                            <div style={{ display:"flex", gap:8 }}>
                                <input type="number" min={0} max={23} value={form.endHour}
                                       onChange={e=>setForm({...form,endHour:e.target.value})}
                                       style={{ ...inp(), width:70 }} placeholder="HH" />
                                <span style={{ color:"#3a7a9a", alignSelf:"center" }}>:</span>
                                <input type="number" min={0} max={59} value={form.endMin}
                                       onChange={e=>setForm({...form,endMin:e.target.value})}
                                       style={{ ...inp(), width:70 }} placeholder="MM" />
                            </div>
                        </div>

                        <div style={{ gridColumn:"1/-1" }}>
                            <label style={{ fontSize:10, color:"#3a7a9a", letterSpacing:2, display:"block", marginBottom:10 }}>
                                ALLOWED DAYS
                            </label>
                            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                                {DAYS.map((d,i) => (
                                    <label key={d} style={{ display:"flex", flexDirection:"column", alignItems:"center",
                                        gap:6, cursor:"pointer" }}>
                                        <div style={{
                                            width:40, height:40, borderRadius:4, display:"flex", alignItems:"center",
                                            justifyContent:"center", fontSize:12, fontFamily:"monospace", fontWeight:700,
                                            cursor:"pointer", transition:"all .15s",
                                            background: form.days[i]?"rgba(0,212,255,.15)":"transparent",
                                            border:`1px solid ${form.days[i]?"#00d4ff":"#0d2d45"}`,
                                            color: form.days[i]?"#00d4ff":"#3a7a9a",
                                        }}
                                             onClick={()=>{
                                                 const nd = [...form.days]; nd[i]=!nd[i];
                                                 setForm({...form,days:nd});
                                             }}>{d}</div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={{ gridColumn:"1/-1", display:"flex", justifyContent:"flex-end" }}>
                            <button onClick={handleSave} disabled={saving} style={{
                                background: saving?"#0a2a3a":"rgba(0,212,255,.15)",
                                border:"1px solid #00d4ff", color:"#00d4ff",
                                padding:"10px 28px", borderRadius:4, cursor:saving?"not-allowed":"pointer",
                                fontFamily:"monospace", fontSize:13, fontWeight:700, letterSpacing:2,
                                transition:"all .2s",
                            }}>
                                {saving ? "SAVING..." : editing ? "UPDATE USER" : "ADD USER"}
                            </button>
                        </div>
                    </div>
                </div>
            )}


            <div style={panel}>
                <div style={ph}>
          <span style={{ fontSize:11, color:"#00d4ff", letterSpacing:3, fontWeight:700 }}>
            👤 REGISTERED USERS ({Object.keys(users).length})
          </span>
                    {!showAdd && (
                        <button onClick={()=>{ setShowAdd(true); setEditing(null); setForm(emptyForm); }}
                                style={{ background:"rgba(57,255,20,.12)", border:"1px solid #39ff14",
                                    color:"#39ff14", padding:"5px 16px", borderRadius:3, cursor:"pointer",
                                    fontFamily:"monospace", fontSize:11, letterSpacing:1, fontWeight:700 }}>
                            + ADD USER
                        </button>
                    )}
                </div>

                {Object.keys(users).length === 0 ? (
                    <div style={{ padding:40, textAlign:"center", color:"#3a7a9a", fontSize:13 }}>
                        No users yet. Add your first user!
                    </div>
                ) : (
                    Object.entries(users).map(([key, u]) => (
                        <div key={key} style={{
                            display:"flex", alignItems:"center", gap:16, padding:"14px 18px",
                            borderBottom:"1px solid #050e17", flexWrap:"wrap",
                        }}>

                            <div style={{ width:42, height:42, borderRadius:4, flexShrink:0,
                                background:`${roleColor(u.role)}18`, border:`1px solid ${roleColor(u.role)}40`,
                                color:roleColor(u.role), display:"flex", alignItems:"center",
                                justifyContent:"center", fontSize:13, fontWeight:700 }}>
                                {u.name?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                            </div>

                            <div style={{ flex:1, minWidth:160 }}>
                                <div style={{ fontSize:15, fontWeight:700, color:"#e0f0f8", marginBottom:3 }}>
                                    {u.name}
                                </div>
                                <div style={{ fontSize:11, color:"#3a7a9a", fontFamily:"monospace", marginBottom:4 }}>
                                    {keyToUid(key)}
                                </div>
                                <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:2, fontWeight:700,
                      background:`${roleColor(u.role)}18`, border:`1px solid ${roleColor(u.role)}40`,
                      color:roleColor(u.role) }}>{u.role}</span>
                                    <span style={{ fontSize:10, color:"#3a7a9a" }}>
                    {String(u.startHour||0).padStart(2,"0")}:{String(u.startMin||0).padStart(2,"0")} –
                                        {String(u.endHour||23).padStart(2,"0")}:{String(u.endMin||59).padStart(2,"0")}
                  </span>
                                    <span style={{ fontSize:10, color:"#3a7a9a" }}>
                    {Array.isArray(u.days) ? DAYS.filter((_,i)=>u.days[i]).join(", ") : "All days"}
                  </span>
                                </div>
                            </div>


                            <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>

                                <button onClick={()=>handleToggle(key, u.active!==false)} style={{
                                    background: u.active!==false?"rgba(57,255,20,.1)":"rgba(255,68,68,.1)",
                                    border:`1px solid ${u.active!==false?"#39ff1440":"#ff444440"}`,
                                    color: u.active!==false?"#39ff14":"#ff4444",
                                    padding:"5px 12px", borderRadius:3, cursor:"pointer",
                                    fontFamily:"monospace", fontSize:10, fontWeight:700, letterSpacing:1,
                                }}>
                                    {u.active!==false ? "● ACTIVE" : "● INACTIVE"}
                                </button>


                                <button onClick={()=>handleEdit(key)} style={{
                                    background:"rgba(0,212,255,.1)", border:"1px solid #00d4ff40",
                                    color:"#00d4ff", padding:"5px 12px", borderRadius:3, cursor:"pointer",
                                    fontFamily:"monospace", fontSize:10, letterSpacing:1,
                                }}>EDIT</button>

                                <button onClick={()=>handleDelete(key)} style={{
                                    background:"rgba(255,68,68,.08)", border:"1px solid #ff444440",
                                    color:"#ff4444", padding:"5px 12px", borderRadius:3, cursor:"pointer",
                                    fontFamily:"monospace", fontSize:10, letterSpacing:1,
                                }}>DEL</button>
                            </div>
                        </div>
                    ))
                )}
            </div>

        </div>
    );
}
