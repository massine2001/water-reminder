"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function Page() {
  const [supported, setSupported] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [timezone, setTimezone] = useState("...");
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(21);
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

  useEffect(() => {
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(ok);
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);

    navigator.serviceWorker?.register("/sw.js").catch(console.error);
  }, []);

  async function enableNotifications() {
    try {
      setLoading(true);
      setStatus("");

      if (!supported) {
        setStatus("Les notifications web ne sont pas disponibles ici.");
        return;
      }

      if (!installed) {
        setStatus("Installe d’abord l’app via Safari > Partager > Ajouter à l’écran d’accueil.");
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus("Autorisation refusée.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub,
          settings: {
            intervalMinutes,
            startHour,
            endHour,
            timezone,
            enabled,
          },
        }),
      });

      if (!res.ok) {
        throw new Error("subscribe failed");
      }

      setStatus("Notifications activées.");
    } catch (error) {
      console.error(error);
      setStatus("Impossible d’activer les notifications.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <section className="hero">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          Hydration
        </div>

        <h1 className="hero-title">Water Reminder</h1>

      </section>

      <section className="glass-card">
        <div className="card-header">
          <div>
            <p className="card-eyebrow">Statut</p>
            <h2 className="card-title">Configuration</h2>
          </div>

          <div className={`pill ${installed ? "pill-ok" : ""}`}>
            {installed ? "Installée" : "Safari requis"}
          </div>
        </div>

        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Notifications</span>
            <span className={`info-value ${supported ? "ok" : "warn"}`}>
              {supported ? "Disponibles" : "Indisponibles"}
            </span>
          </div>

          <div className="info-item">
            <span className="info-label">Fuseau</span>
            <span className="info-value">{timezone}</span>
          </div>
        </div>
      </section>

      <section className="glass-card">
        <div className="card-header">
          <div>
            <p className="card-eyebrow">Préférences</p>
            <h2 className="card-title">Rappels</h2>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Activer les rappels</label>
          <button
            type="button"
            className={`toggle ${enabled ? "toggle-on" : ""}`}
            onClick={() => setEnabled((v) => !v)}
            aria-pressed={enabled}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">Intervalle</label>
          <div className="segmented">
            {[30, 60, 90, 120].map((value) => (
              <button
                key={value}
                type="button"
                className={`segment ${intervalMinutes === value ? "segment-active" : ""}`}
                onClick={() => setIntervalMinutes(value)}
              >
                {value} min
              </button>
            ))}
          </div>
        </div>

        <div className="two-cols">
          <div className="field-card">
            <label className="field-label">Début</label>
            <select
              className="field-input"
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")} h
                </option>
              ))}
            </select>
          </div>

          <div className="field-card">
            <label className="field-label">Fin</label>
            <select
              className="field-input"
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")} h
                </option>
              ))}
            </select>
          </div>
        </div>

        <button className="primary-button" onClick={enableNotifications} disabled={loading}>
          {loading ? "Activation..." : "Activer les notifications"}
        </button>

        {status ? (
          <div className={`status ${status.includes("activées") ? "status-success" : "status-error"}`}>
            {status}
          </div>
        ) : null}
      </section>

      <section className="glass-card subtle-card">
        <p className="footnote">
          Sur iPhone, ouvre d’abord l’app depuis l’écran d’accueil pour activer les notifications.
        </p>
      </section>
    </main>
  );
}