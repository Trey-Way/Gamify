import { useUi, MONO, SERIF } from "./theme.js";

export default function LevelCard({ totalXp, level, into, need, rank, nRank }) {
    const { colors } = useUi();
    const pct = Math.min(100, Math.round((into / need) * 100));
    return (
        <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 14, padding: "18px 20px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: colors.amber }}>Lv {level}</div>
                    <div style={{ fontSize: 12.5, color: colors.textDim, fontFamily: MONO }}>{into} / {need} xp</div>
                </div>
                <div style={{ fontSize: 12, color: colors.textDim }}>{totalXp} total xp</div>
            </div>
            <div style={{ height: 10, borderRadius: 6, background: colors.panel2, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${colors.accentDim}, ${colors.accent})`, borderRadius: 6, transition: "width 0.4s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 12.5, letterSpacing: 0.5, fontWeight: 600, color: colors.accent, textTransform: "uppercase" }}>{rank.name}</div>
                <div style={{ fontSize: 11, color: colors.textDim }}>{nRank ? `${nRank.name} at Lv ${nRank.min}` : "Top rank reached"}</div>
            </div>
        </div>
    );
}
