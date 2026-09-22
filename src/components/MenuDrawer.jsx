import { useUi, SERIF } from "./theme.js";

export default function MenuDrawer({ items, view, onSelect, onClose }) {
    const { colors } = useUi();
    return (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }}>
            <nav onClick={(e) => e.stopPropagation()}
                style={{ width: 240, height: "100%", background: colors.panel, borderRight: `1px solid ${colors.border}`, padding: "calc(18px + env(safe-area-inset-top)) 18px 18px" }}>
                <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, marginBottom: 18 }}>Questlog</div>
                {items.map(([id, label]) => (
                    <button key={id} className="ql-btn" onClick={() => onSelect(id)}
                        style={{
                            display: "block", width: "100%", textAlign: "left", padding: "12px 16px", borderRadius: 8,
                            background: view === id ? colors.panel2 : "transparent", border: "none", color: colors.text,
                            fontSize: 14.5, fontWeight: view === id ? 600 : 400, marginBottom: 4,
                        }}>
                        {label}
                    </button>
                ))}
            </nav>
        </div>
    );
}
