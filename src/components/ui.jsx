import { useUi } from "./theme.js";

export function Panel({ children, style }) {
    const { colors } = useUi();
    return (
        <div style={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18, ...style }}>
            {children}
        </div>
    );
}

export function SectionLabel({ children, color, style }) {
    const { colors } = useUi();
    return (
        <div style={{ fontSize: 12, color: color || colors.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5, ...style }}>
            {children}
        </div>
    );
}

export function Hint({ children, style }) {
    const { colors } = useUi();
    return <div style={{ fontSize: 12.5, color: colors.textDim, lineHeight: 1.6, marginBottom: 12, ...style }}>{children}</div>;
}

// Toggle-style button used for tabs and option pickers.
export function Chip({ selected, onClick, children, style, ...rest }) {
    const { colors } = useUi();
    return (
        <button className="ql-btn" onClick={onClick} {...rest}
            style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${selected ? colors.accent : colors.border}`, background: selected ? colors.panel2 : "transparent", color: colors.text, fontSize: 12.5, ...style }}>
            {children}
        </button>
    );
}

export function TextInput({ style, ...rest }) {
    const { colors } = useUi();
    return (
        <input {...rest}
            style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.panel, color: colors.text, fontSize: 12.5, ...style }} />
    );
}

export function PrimaryButton({ children, style, ...rest }) {
    const { colors, dark } = useUi();
    return (
        <button className="ql-btn" {...rest}
            style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: colors.accent, color: dark ? "#0b1613" : "#fff", fontWeight: 600, fontSize: 13.5, opacity: rest.disabled ? 0.5 : 1, ...style }}>
            {children}
        </button>
    );
}

export function SecondaryButton({ children, style, ...rest }) {
    const { colors } = useUi();
    return (
        <button className="ql-btn" {...rest}
            style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.panel2, color: colors.text, fontWeight: 600, fontSize: 13.5, opacity: rest.disabled ? 0.5 : 1, ...style }}>
            {children}
        </button>
    );
}
