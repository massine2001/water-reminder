"use client";

import { useEffect, useMemo, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function Page() {
  const [supported, setSupported] = useState(false);
  const [installedHint, setInstalledHint] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(21);
  const [status, setStatus] = useState("");

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
  const [timezone, setTimezone] = useState("loading");

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  useEffect(() => {
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalledHint("PWA installée");
    } else {
      setInstalledHint("Sur iPhone, installe d’abord l’app via Partager > Ajouter à l’écran d’accueil.");
    }

    navigator.serviceWorker?.register("/sw.js").catch(console.error);
  }, []);

  async function enableNotifications() {
    try {
      if (!supported) {
        setStatus("Push non supporté ici.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("Permission refusée.");
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
            enabled: true,
          },
        }),
      });

      if (!res.ok) throw new Error("subscribe failed");
      setStatus("Notifications activées.");
    } catch (e) {
      setStatus("Échec de l’activation.");
      console.error(e);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Water Reminder</h1>
      <p>{installedHint}</p>

      <label>Intervalle (minutes)</label>
      <input
        type="number"
        min={5}
        step={5}
        value={intervalMinutes}
        onChange={(e) => setIntervalMinutes(Number(e.target.value))}
        style={{ display: "block", marginBottom: 12, width: "100%" }}
      />

      <label>Début des rappels (heure)</label>
      <input
        type="number"
        min={0}
        max={23}
        value={startHour}
        onChange={(e) => setStartHour(Number(e.target.value))}
        style={{ display: "block", marginBottom: 12, width: "100%" }}
      />

      <label>Fin des rappels (heure)</label>
      <input
        type="number"
        min={1}
        max={24}
        value={endHour}
        onChange={(e) => setEndHour(Number(e.target.value))}
        style={{ display: "block", marginBottom: 12, width: "100%" }}
      />

      <button onClick={enableNotifications}>Activer les notifications</button>
      <p>{status}</p>
      <p>Fuseau détecté : {timezone}</p>
    </main>
  );
}
