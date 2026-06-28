"use client";

import { useState, useEffect, useRef } from "react";
import { useAudio } from "../hooks/useAudio";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const { playClick } = useAudio();
  const containerRef = useRef(null);

  const reloadNotifications = () => {
    const raw = localStorage.getItem("seojump_notifications");
    if (raw) {
      try {
        setNotifications(JSON.parse(raw));
      } catch (e) {
        setNotifications([]);
      }
    } else {
      setNotifications([]);
    }
  };

  useEffect(() => {
    reloadNotifications();
    window.addEventListener("seojump_notifications_updated", reloadNotifications);
    
    // Close dropdown on outside click
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);

    return () => {
      window.removeEventListener("seojump_notifications_updated", reloadNotifications);
      document.removeEventListener("click", handleOutsideClick);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleToggle = () => {
    if (playClick) playClick();
    setIsOpen(!isOpen);
  };

  const markAllAsRead = () => {
    if (playClick) playClick();
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    localStorage.setItem("seojump_notifications", JSON.stringify(updated));
    window.dispatchEvent(new Event("seojump_notifications_updated"));
  };

  const clearAll = () => {
    if (playClick) playClick();
    setNotifications([]);
    localStorage.removeItem("seojump_notifications");
    window.dispatchEvent(new Event("seojump_notifications_updated"));
  };

  return (
    <div className="relative notification-bell-container" ref={containerRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="text-3xl hover:scale-110 transition-transform relative focus:outline-none flex items-center justify-center"
        title="Notificaciones"
      >
        <span>🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-[10px] font-black w-5 h-5 flex items-center justify-center border-2 border-white dark:border-slate-800 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-3.5 z-50 w-72 md:w-80 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden font-fredoka transition-all animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <span className="font-black text-sm text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <span>🔔</span> Notificaciones
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-black text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors hover:underline"
              >
                Leer todas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto divide-y-2 divide-slate-100 dark:divide-slate-700">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 flex gap-3 text-left transition-colors ${
                    notif.read ? "bg-transparent" : "bg-blue-50/30 dark:bg-blue-950/10"
                  }`}
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">
                    {notif.type === "indexation" ? "🚀" : notif.type === "seo_win" ? "📈" : "🔔"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-650 dark:text-slate-300 leading-relaxed break-words">
                      {notif.text}
                    </p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-1">
                      {notif.date}
                    </span>
                  </div>
                  {!notif.read && (
                    <span className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mt-1.5 flex-shrink-0" />
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 font-bold text-sm leading-relaxed space-y-2">
                <div className="text-3xl">🦉</div>
                <p>No tenés notificaciones nuevas. ¡A optimizar!</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2 border-t-2 border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 text-center">
              <button
                onClick={clearAll}
                className="text-[11px] font-black text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-350 transition-colors"
              >
                Limpiar historial
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
