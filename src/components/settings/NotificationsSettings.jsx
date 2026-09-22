import { useState } from "react";
import { useUi } from "../theme.js";
import { Panel, Hint, SectionLabel, TextInput, PrimaryButton, SecondaryButton, Chip } from "../ui.jsx";
import { enablePush, disablePush, syncPush, sendTestPush, pushUnavailableReason, buildPushSnapshot } from "../../lib/push.js";
import { isIos, isStandalone } from "../../lib/pwa.js";

const KINDS = [
    ["morning", "☀️ Morning plan", "Today's quests and what's overdue"],
    ["streak", "🔥 Streak check", "Your streak count and what's at risk today"],
    ["evening", "🌙 Evening check-in", "What you finished today and what's still open"],
];

export default function NotificationsSettings({ push, onSetPush, tasks, lost }) {
    const { colors } = useUi();
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState(null); // { ok, msg }
    const unavailable = pushUnavailableReason();
    const enabled = !!push.id;

    async function run(fn, okMsg) {
        setBusy(true);
        setStatus(null);
        try {
            await fn();
            if (okMsg) setStatus({ ok: true, msg: okMsg });
        } catch (e) {
            setStatus({ ok: false, msg: e.message });
        } finally {
            setBusy(false);
        }
    }

    const enable = () => run(async () => {
        const id = await enablePush(push.serverUrl, { prefs: push.prefs, snapshot: buildPushSnapshot(tasks) });
        onSetPush((p) => ({ ...p, id }));
    }, "Notifications are on.");

    const disable = () => run(async () => {
        await disablePush(push.serverUrl, push.id);
        onSetPush((p) => ({ ...p, id: null }));
    }, "Notifications are off.");

    function setPref(kind, patch) {
        const prefs = { ...push.prefs, [kind]: { ...push.prefs[kind], ...patch } };
        onSetPush((p) => ({ ...p, prefs }));
        if (push.id) syncPush(push.serverUrl, push.id, { prefs }).catch((e) => setStatus({ ok: false, msg: `Couldn't save times: ${e.message}` }));
    }

    return (
        <Panel>
            <Hint>
                Get a morning plan, a daily streak check with what's at risk, and an evening check-in on your phone.
                Notifications come from your own push server (a small Cloudflare Worker — see the README).
            </Hint>

            {isIos() && !isStandalone() && (
                <div style={{ fontSize: 12.5, lineHeight: 1.6, padding: 10, borderRadius: 8, border: `1px solid ${colors.amber}`, marginBottom: 14 }}>
                    <strong>Install first:</strong> in Safari tap <strong>Share → Add to Home Screen</strong>, then open Questlog from your
                    home screen. iPhone only allows notifications for installed apps (iOS 16.4 or later).
                </div>
            )}

            <SectionLabel>Push server</SectionLabel>
            <TextInput placeholder="https://questlog-push.<you>.workers.dev" value={push.serverUrl} disabled={enabled} inputMode="url" autoCapitalize="off"
                onChange={(e) => onSetPush((p) => ({ ...p, serverUrl: e.target.value.trim() }))} style={{ width: "100%", marginBottom: 12, opacity: enabled ? 0.6 : 1 }} />

            {lost && enabled && (
                <div style={{ fontSize: 12, color: colors.danger, marginBottom: 10 }}>
                    This device's push subscription was removed (by the browser or server). Turn notifications off and on again.
                </div>
            )}

            {enabled ? (
                <SecondaryButton onClick={disable} disabled={busy} style={{ marginBottom: 16 }}>Turn off notifications</SecondaryButton>
            ) : (
                <PrimaryButton onClick={enable} disabled={busy || !!unavailable || !push.serverUrl} style={{ marginBottom: 8 }}>
                    {busy ? "Working…" : "🔔 Turn on notifications"}
                </PrimaryButton>
            )}
            {!enabled && unavailable && <div style={{ fontSize: 11.5, color: colors.textDim, marginBottom: 16, lineHeight: 1.5 }}>{unavailable}</div>}

            <SectionLabel style={{ marginTop: 8 }}>Schedule (your local time)</SectionLabel>
            {KINDS.map(([kind, label, desc]) => (
                <div key={kind} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${colors.border}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5 }}>{label}</div>
                        <div style={{ fontSize: 11, color: colors.textDim }}>{desc}</div>
                    </div>
                    <input type="time" aria-label={`${label} time`} value={push.prefs[kind].time} disabled={!push.prefs[kind].enabled}
                        onChange={(e) => e.target.value && setPref(kind, { time: e.target.value })}
                        style={{ padding: "5px 6px", borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.panel2, color: colors.text, fontSize: 12.5 }} />
                    <Chip selected={push.prefs[kind].enabled} onClick={() => setPref(kind, { enabled: !push.prefs[kind].enabled })} style={{ padding: "5px 10px", fontSize: 11.5, minWidth: 44 }}>
                        {push.prefs[kind].enabled ? "On" : "Off"}
                    </Chip>
                </div>
            ))}

            {enabled && (
                <>
                    <SectionLabel style={{ marginTop: 16 }}>Send one now</SectionLabel>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {KINDS.map(([kind, label]) => (
                            <Chip key={kind} disabled={busy} onClick={() => run(() => sendTestPush(push.serverUrl, push.id, kind), "Sent — check your notifications.")} style={{ fontSize: 11.5 }}>
                                {label}
                            </Chip>
                        ))}
                    </div>
                </>
            )}

            {status && (
                <div style={{ marginTop: 14, fontSize: 12.5, color: status.ok ? colors.accent : colors.danger }}>{status.msg}</div>
            )}

            <div style={{ fontSize: 11, color: colors.textDim, lineHeight: 1.5, marginTop: 16 }}>
                To write these messages, your push server keeps the titles, XP and due times of your open quests plus the times you
                completed quests over the last 60 days. Nothing else leaves this device, and turning notifications off deletes it.
            </div>
        </Panel>
    );
}
