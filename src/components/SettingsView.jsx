import { useState } from "react";
import { Chip } from "./ui.jsx";

// Tabbed settings shell. `sections` is a list of { id, label, render }.
export default function SettingsView({ sections }) {
    const [current, setCurrent] = useState(sections[0].id);
    const section = sections.find((s) => s.id === current) || sections[0];
    return (
        <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {sections.map((s) => <Chip key={s.id} selected={s.id === section.id} onClick={() => setCurrent(s.id)}>{s.label}</Chip>)}
            </div>
            {section.render()}
        </div>
    );
}
