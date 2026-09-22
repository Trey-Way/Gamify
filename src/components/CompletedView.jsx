import { useUi, MONO } from "./theme.js";
import { fmtClock, fmtDateTime } from "../lib/dates.js";
import { deadlineOf } from "../lib/outcomes.js";

export default function CompletedView({ tasks }) {
    const { colors, catColor } = useUi();
    return (
        <div>
            {tasks.length === 0 && <div style={{ color: colors.textDim, fontSize: 13.5 }}>Nothing completed yet.</div>}
            {tasks.map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, marginBottom: 8 }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: colors.textDim, textDecoration: "line-through", overflowWrap: "anywhere" }}>{t.text}</div>
                        <div style={{ fontSize: 11, color: colors.textDim, marginTop: 3 }}>
                            Added {fmtDateTime(t.createdAt)} &middot; Completed {fmtDateTime(t.completedAt)}
                            {t.dueAt && <> &middot; Due {fmtDateTime(t.dueAt)}</>}
                            {t.completedAt > deadlineOf(t) && <span style={{ color: colors.danger }}> &middot; late</span>}
                            {t.timeBonus > 0 && <> &middot; ⏱ {fmtClock(t.timedSeconds)} focused</>}
                        </div>
                    </div>
                    <span style={{ fontFamily: MONO, color: catColor(t.category), fontSize: 13, whiteSpace: "nowrap" }}>
                        +{t.exp}{t.timeBonus > 0 && <span style={{ color: colors.accent }}> ({t.timeBonus} timed)</span>}
                    </span>
                </div>
            ))}
        </div>
    );
}
