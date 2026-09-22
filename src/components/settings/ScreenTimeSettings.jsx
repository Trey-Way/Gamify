import { useState } from "react";
import { useUi, MONO } from "../theme.js";
import { Panel, Hint } from "../ui.jsx";
import { fmtDateTime } from "../../lib/dates.js";

export default function ScreenTimeSettings({ screenTimeLog, onLog }) {
    const { colors } = useUi();
    const [minutes, setMinutes] = useState("");
    function submit() {
        const mins = parseInt(minutes, 10);
        if (!mins || mins <= 0) return;
        onLog(mins);
        setMinutes("");
    }
    return (
        <Panel>
            <Hint>
                Browsers can't read iPhone or Android screen-time data directly — there's no web API for it, and a
                future native companion app would be needed to pull it automatically. For now, log your social
                media minutes yourself below and it'll dock XP for time over 30 minutes a day (1 XP per 2 minutes
                over).
            </Hint>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input value={minutes} onChange={(e) => setMinutes(e.target.value)} type="number" inputMode="numeric" placeholder="Minutes on social media today"
                    style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.panel2, color: colors.text, fontSize: 13.5 }} />
                <button className="ql-btn" onClick={submit} style={{ padding: "0 16px", borderRadius: 8, border: "none", background: colors.danger, color: "#fff", fontWeight: 600, fontSize: 13 }}>Log</button>
            </div>
            {screenTimeLog.length === 0 && <div style={{ color: colors.textDim, fontSize: 13 }}>No screen time logged yet.</div>}
            {screenTimeLog.map((l) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${colors.border}` }}>
                    <span style={{ color: colors.textDim }}>{fmtDateTime(l.at)} · {l.minutes} min</span>
                    <span style={{ color: colors.danger, fontFamily: MONO }}>{l.penalty > 0 ? `-${l.penalty}` : "0"}</span>
                </div>
            ))}
        </Panel>
    );
}
