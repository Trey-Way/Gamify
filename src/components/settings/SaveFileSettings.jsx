import { useRef } from "react";
import { useUi } from "../theme.js";
import { Panel, Hint, SectionLabel, PrimaryButton, SecondaryButton } from "../ui.jsx";

export default function SaveFileSettings({ onExport, onImportFile, onReset, status }) {
    const { colors } = useUi();
    const fileInputRef = useRef(null);
    return (
        <Panel>
            <Hint style={{ marginBottom: 16 }}>
                Everything - quests, completed history, badge progress, screen time log, theme, and
                AI settings - lives in one save file. Export it to back it up or move it to another
                device; import to restore it. Progress also autosaves to this browser continuously,
                with a redundant backup copy in case one write gets interrupted.
            </Hint>

            <SectionLabel>Export</SectionLabel>
            <PrimaryButton onClick={onExport} style={{ marginBottom: 20 }}>⬇ Download save file</PrimaryButton>

            <SectionLabel>Import</SectionLabel>
            <input ref={fileInputRef} type="file" accept="application/json,.json" style={{ display: "none" }}
                onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) onImportFile(file); }} />
            <SecondaryButton onClick={() => fileInputRef.current?.click()} style={{ marginBottom: 8 }}>⬆ Choose save file to import</SecondaryButton>
            <div style={{ fontSize: 11, color: colors.textDim, marginBottom: 20, lineHeight: 1.5 }}>
                Importing replaces everything currently in the app - export a backup first if you want to keep it.
            </div>

            <SectionLabel color={colors.danger}>Reset</SectionLabel>
            <button className="ql-btn" onClick={onReset}
                style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: `1px solid ${colors.danger}`, background: "transparent", color: colors.danger, fontWeight: 600, fontSize: 13.5 }}>
                🗑 Reset all data
            </button>
            <div style={{ fontSize: 11, color: colors.textDim, marginTop: 8, lineHeight: 1.5 }}>
                Wipes every quest, badge, and setting on this device. Asks for confirmation first and can't be undone.
            </div>

            {status && (
                <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: status.ok ? colors.panel2 : "transparent", border: `1px solid ${status.ok ? colors.accent : colors.danger}`, color: status.ok ? colors.accent : colors.danger, fontSize: 12.5 }}>
                    {status.msg}
                </div>
            )}
        </Panel>
    );
}
