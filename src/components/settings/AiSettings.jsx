import { useState } from "react";
import { useUi, MONO } from "../theme.js";
import { Panel, Chip, TextInput, Hint, SectionLabel, SecondaryButton } from "../ui.jsx";
import { PROVIDERS, OFF, resolveProvider, providerProblem, gradeTask } from "../../lib/providers.js";
import { CATS } from "../../lib/grading.js";

const SAMPLE_TASK = "Finish chemistry lab report";

export default function AiSettings({ ai, onSetAi }) {
    const { colors, catColor } = useUi();
    const [test, setTest] = useState(null); // { running } | { result }
    const current = resolveProvider(ai);
    const def = PROVIDERS[ai.provider];
    const cfg = ai.configs[ai.provider] || {};
    const problem = providerProblem(current);

    const selectProvider = (id) => { setTest(null); onSetAi((a) => ({ ...a, provider: id })); };
    const setCfg = (patch) => onSetAi((a) => ({ ...a, configs: { ...a.configs, [a.provider]: { ...(a.configs[a.provider] || {}), ...patch } } }));

    async function runTest() {
        setTest({ running: true });
        const result = await gradeTask(SAMPLE_TASK, ai);
        setTest({ result });
    }

    return (
        <Panel>
            <Hint>
                Pick which AI grades your quests. Every new task is sent to that provider to judge its category
                and XP. Switch any time; with no provider set up, Questlog uses its built-in keyword rules.
            </Hint>
            <SectionLabel>Provider</SectionLabel>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <Chip selected={ai.provider === OFF} onClick={() => selectProvider(OFF)}>Off (local rules)</Chip>
                {Object.entries(PROVIDERS).map(([id, p]) => (
                    <Chip key={id} selected={ai.provider === id} onClick={() => selectProvider(id)}>
                        {p.label}{ai.configs[id]?.apiKey ? " ✓" : ""}
                    </Chip>
                ))}
            </div>

            {def && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, background: colors.panel2, padding: 12, borderRadius: 8, marginBottom: 12 }}>
                    {def.editableEndpoint ? (
                        <TextInput placeholder="Endpoint URL (…/v1/chat/completions)" value={cfg.endpoint || ""} onChange={(e) => setCfg({ endpoint: e.target.value.trim() })} />
                    ) : (
                        <div style={{ fontSize: 11, color: colors.textDim, fontFamily: MONO, overflowWrap: "anywhere" }}>{def.endpoint}</div>
                    )}
                    <TextInput placeholder={`Model (default: ${def.defaultModel || "required"})`} value={cfg.model || ""} onChange={(e) => setCfg({ model: e.target.value.trim() })} />
                    <TextInput placeholder={def.keyRequired ? "API key" : "API key (optional)"} type="password" autoComplete="off" value={cfg.apiKey || ""} onChange={(e) => setCfg({ apiKey: e.target.value.trim() })} />
                    <div style={{ fontSize: 11, color: colors.textDim, lineHeight: 1.5 }}>
                        {def.keyHelp} Your key stays on this device, is sent only to {def.label}, and is left out of exported save files.
                    </div>
                </div>
            )}

            {problem && <div style={{ fontSize: 12, color: colors.danger, marginBottom: 12 }}>{problem}</div>}

            {def && (
                <SecondaryButton onClick={runTest} disabled={!!problem || test?.running} style={{ padding: "10px 0", fontSize: 13 }}>
                    {test?.running ? "Testing…" : `Test with "${SAMPLE_TASK}"`}
                </SecondaryButton>
            )}
            {test?.result && (
                <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.5 }}>
                    <span style={{ color: catColor(test.result.category), fontWeight: 600 }}>{CATS[test.result.category].label}</span>
                    <span style={{ color: colors.amber, fontFamily: MONO }}> +{test.result.exp}</span>
                    <span style={{ color: colors.textDim }}> · {test.result.reason} · {test.result.gradedBy}</span>
                </div>
            )}
        </Panel>
    );
}
