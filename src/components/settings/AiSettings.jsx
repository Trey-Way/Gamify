import { useUi } from "../theme.js";
import { Panel, Chip, TextInput } from "../ui.jsx";
import { PROVIDER_PRESETS } from "../../lib/providers.js";

export default function AiSettings({ aiMode, onSetAiMode, customProvider, onSetCustomProvider }) {
    const { colors } = useUi();
    const set = (patch) => onSetCustomProvider((p) => ({ ...p, ...patch }));
    return (
        <Panel>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                {[{ id: "builtin", label: "Claude (built-in)" }, { id: "custom", label: "Custom AI" }, { id: "off", label: "Off (local rules)" }].map((opt) => (
                    <Chip key={opt.id} selected={aiMode === opt.id} onClick={() => onSetAiMode(opt.id)}>{opt.label}</Chip>
                ))}
            </div>
            {aiMode === "custom" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, background: colors.panel2, padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: colors.textDim, marginBottom: 2 }}>Quick fill a preset, then paste your key:</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                        {PROVIDER_PRESETS.map((p) => (
                            <button key={p.name} className="ql-btn" onClick={() => set({ endpoint: p.endpoint, model: p.model })}
                                style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.panel, color: colors.text, fontSize: 11.5 }}>
                                {p.name}
                            </button>
                        ))}
                    </div>
                    <TextInput placeholder="Endpoint URL (OpenAI-compatible /chat/completions)" value={customProvider.endpoint} onChange={(e) => set({ endpoint: e.target.value })} />
                    <TextInput placeholder="Model name (e.g. gpt-4o-mini)" value={customProvider.model} onChange={(e) => set({ model: e.target.value })} />
                    <TextInput placeholder="API key (leave blank for Ollama/local)" type="password" value={customProvider.apiKey} onChange={(e) => set({ apiKey: e.target.value })} />
                    <div style={{ fontSize: 11, color: colors.textDim, lineHeight: 1.5 }}>Stored only in this app's saved data on this device</div>
                </div>
            )}
            {aiMode === "builtin" && <div style={{ fontSize: 11.5, color: colors.textDim, lineHeight: 1.5 }}>Every new task is sent to Claude to judge its category and XP value.</div>}
        </Panel>
    );
}
