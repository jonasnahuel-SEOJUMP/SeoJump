"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAudio } from "../hooks/useAudio";

const DROPDOWN_WIDTH = 320;
const DROPDOWN_GAP = 12;

function getDropdownCoords(buttonEl) {
  if (!buttonEl || typeof window === "undefined") {
    return { top: 0, left: 8, width: DROPDOWN_WIDTH };
  }
  const rect = buttonEl.getBoundingClientRect();
  const width = Math.min(DROPDOWN_WIDTH, window.innerWidth - 16);
  let left = rect.right - width;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
  return {
    top: rect.bottom + DROPDOWN_GAP,
    left,
    width,
  };
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 8, width: DROPDOWN_WIDTH });
  const { playClick } = useAudio();
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const ignoreOutsideUntilRef = useRef(0);

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

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    setCoords(getDropdownCoords(buttonRef.current));
  }, []);

  useEffect(() => {
    setMounted(true);
    reloadNotifications();
    window.addEventListener("seojump_notifications_updated", reloadNotifications);

    return () => {
      window.removeEventListener("seojump_notifications_updated", reloadNotifications);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    // Second pass after layout/paint in case the first read was stale
    const raf = window.requestAnimationFrame(() => updatePosition());

    const handleOutsidePointer = (e) => {
      if (Date.now() < ignoreOutsideUntilRef.current) return;
      const inButton = containerRef.current?.contains(e.target);
      const inDropdown = dropdownRef.current?.contains(e.target);
      if (!inButton && !inDropdown) {
        setIsOpen(false);
      }
    };

    const handleReposition = () => updatePosition();
    const handleKey = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handleOutsidePointer);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    document.addEventListener("keydown", handleKey);

    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener("pointerdown", handleOutsidePointer);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, updatePosition]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (playClick) playClick();

    if (isOpen) {
      setIsOpen(false);
      return;
    }

    // Ignore the opening pointer gesture so the panel does not close instantly
    ignoreOutsideUntilRef.current = Date.now() + 400;
    setCoords(getDropdownCoords(buttonRef.current));
    setIsOpen(true);
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

  const dropdown =
    isOpen && mounted
      ? createPortal(
          <div
            ref={dropdownRef}
            role="menu"
            aria-label="Notificaciones"
            className="notification-dropdown-panel font-fredoka animate-in fade-in duration-200"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width || DROPDOWN_WIDTH,
              zIndex: 9999,
              borderWidth: 2,
              borderStyle: "solid",
              borderRadius: 16,
              boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
              overflow: "hidden",
            }}
          >
            <div className="notification-dropdown-panel__header flex items-center justify-between gap-3 p-4 border-b border-white/10">
              <span className="font-black text-sm text-slate-100 flex items-center gap-1.5">
                <span>🔔</span> Notificaciones
              </span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs font-black text-blue-400 hover:text-blue-300 transition-colors hover:underline shrink-0"
                >
                  Leer todas
                </button>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-white/10">
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 flex gap-3 text-left transition-colors ${
                      notif.read ? "" : "notification-dropdown-panel__item--unread"
                    }`}
                  >
                    <span className="text-xl flex-shrink-0 mt-0.5">
                      {notif.type === "indexation" ? "🚀" : notif.type === "seo_win" ? "📈" : "🔔"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-200 leading-relaxed break-words">
                        {notif.text}
                      </p>
                      <span className="text-[10px] text-slate-400 font-bold block mt-1">
                        {notif.date}
                      </span>
                    </div>
                    {!notif.read && (
                      <span className="w-2 h-2 bg-blue-400 rounded-full mt-1.5 flex-shrink-0" />
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 font-bold text-sm leading-relaxed space-y-2">
                  <div className="text-3xl">🦉</div>
                  <p>No tenés notificaciones nuevas. ¡A optimizar!</p>
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="notification-dropdown-panel__footer p-2 border-t border-white/10 text-center">
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[11px] font-black text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Limpiar historial
                </button>
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative notification-bell-container flex-shrink-0" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="text-3xl hover:scale-110 transition-transform relative focus:outline-none flex items-center justify-center"
        title="Notificaciones"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <span>🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-[10px] font-black w-5 h-5 flex items-center justify-center border-2 border-white dark:border-slate-800 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {dropdown}
    </div>
  );
}
