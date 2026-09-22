import { useUi, MONO } from "../theme.js";
import { Panel, Hint } from "../ui.jsx";
import { CATS } from "../../lib/grading.js";

export default function GuidedHandSettings({ tasks }) {
    const { colors, catColor } = useUi();
    const graded = tasks.filter((t) => !t.pending);
    return (
        <Panel>
            <Hint>Every task the AI has judged so far — see exactly how it categorized and scored each one.</Hint>
            {graded.length === 0 && <div style={{ color: colors.textDim, fontSize: 13 }}>No tasks graded yet.</div>}
            <div className="ql-scroll" style={{ maxHeight: 340, overflowY: "auto" }}>
                {graded.map((t) => (
                    <div key={t.id} style={{ padding: "9px 0", borderBottom: `1px solid ${colors.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5 }}>
                            <span style={{ overflowWrap: "anywhere" }}>{t.text}</span>
                            <span style={{ fontFamily: MONO, color: colors.amber }}>+{t.exp}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: catColor(t.category), marginTop: 2 }}>
                            {CATS[t.category]?.label} · {t.reason}{t.timeBonus > 0 && ` · +${t.timeBonus} timed bonus`}
                        </div>
                    </div>
                ))}
            </div>
        </Panel>
    );
}
