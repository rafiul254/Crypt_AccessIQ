import { useState } from "react";
import Overview    from "./components/Overview";
import Attendance  from "./components/Attendance";
import Analytics   from "./components/Analytics";
import AdminPanel  from "./components/AdminPanel";
import Security    from "./components/Security";
import "./index.css";

const TABS = [
    { id: "overview",    label: "Dashboard",  icon: "📊" },
    { id: "attendance",  label: "Attendance", icon: "📋" },
    { id: "analytics",  label: "Analytics",  icon: "📈" },
    { id: "admin",      label: "Admin",      icon: "⚙️"  },
    { id: "security",   label: "Security",   icon: "🔒" },
];

export default function App() {
    const [tab, setTab] = useState("overview");

    return (
        <div style={{ minHeight: "100vh", background: "#03080d" }}>
            {/* ── Top Nav ── */}
            <nav style={{
                background: "#040f18",
                borderBottom: "1px solid #0d2d45",
                padding: "0 20px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                position: "sticky",
                top: 0,
                zIndex: 100,
            }}>
                {/* Logo */}
                <div style={{
                    fontFamily: "monospace", fontSize: 14, fontWeight: 700,
                    color: "#00d4ff", letterSpacing: 2, marginRight: 24,
                    padding: "14px 0",
                }}>
                    📡 CryptAccessIQ Dashboard
                </div>

                {/* Tabs */}
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                        background: "none",
                        border: "none",
                        borderBottom: tab === t.id ? "2px solid #00d4ff" : "2px solid transparent",
                        color: tab === t.id ? "#00d4ff" : "#3a7a9a",
                        fontFamily: "monospace",
                        fontSize: 12,
                        padding: "16px 14px 14px",
                        cursor: "pointer",
                        letterSpacing: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "color .2s",
                    }}>
                        <span>{t.icon}</span>
                        <span>{t.label.toUpperCase()}</span>
                    </button>
                ))}
            </nav>

            {/* ── Content ── */}
            <div style={{ padding: "24px 20px", maxWidth: 1160, margin: "0 auto" }}>
                {tab === "overview"   && <Overview   />}
                {tab === "attendance" && <Attendance />}
                {tab === "analytics"  && <Analytics  />}
                {tab === "admin"      && <AdminPanel />}
                {tab === "security"   && <Security   />}
            </div>
        </div>
    );
}
