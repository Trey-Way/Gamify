import { useUi, MONO } from "../theme.js";
import { Panel, Hint, SectionLabel } from "../ui.jsx";
import { STORAGE_KEY, STORAGE_BACKUP_KEY } from "../../lib/storage.js";

// `stats` is a list of [label, value] pairs; `payload` is the (already
// secret-redacted) save object to show raw.
export default function DeveloperSettings({ stats, payload }) {
    const { colors } = useUi();
    return (
        <Panel>
            <Hint style={{ marginBottom: 14 }}>Raw diagnostics for debugging - not needed for normal use.</Hint>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                {stats.map(([label, val]) => (
                    <div key={label} style={{ background: colors.panel2, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 10.5, color: colors.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                        <div style={{ fontSize: 14, fontFamily: MONO, color: colors.text }}>{String(val)}</div>
                    </div>
                ))}
            </div>
            <SectionLabel style={{ marginBottom: 6 }}>Storage keys</SectionLabel>
            <div style={{ fontSize: 11.5, fontFamily: MONO, color: colors.textDim, marginBottom: 16, lineHeight: 1.7 }}>
                {STORAGE_KEY} (primary)<br />{STORAGE_BACKUP_KEY} (backup)
            </div>
            <SectionLabel style={{ marginBottom: 6 }}>Raw save payload</SectionLabel>
            <pre className="ql-scroll" style={{ maxHeight: 240, overflow: "auto", background: colors.panel2, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 10, fontSize: 10.5, color: colors.textDim, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {JSON.stringify(payload, null, 2)}
            </pre>
        </Panel>
    );
}
