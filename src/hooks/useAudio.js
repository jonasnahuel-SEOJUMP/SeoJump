"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export function useAudio() {
  const [isMuted, setIsMuted] = useState(false);
  const audioCtxRef = useRef(null);

  const clickAudio = useRef(null);
  const successAudio = useRef(null);
  const levelUpAudio = useRef(null);

  useEffect(() => {
    // Initialize audio objects
    clickAudio.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav");
    successAudio.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2019/2019-84.wav");
    levelUpAudio.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-84.wav");

    // Preload them
    clickAudio.current.volume = 0.5;
    successAudio.current.volume = 0.6;
    levelUpAudio.current.volume = 0.7;

    // Retrieve mute preference
    const savedMute = localStorage.getItem("seojump_muted");
    if (savedMute === "true") {
      setIsMuted(true);
    }
  }, []);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playSyntheticTone = useCallback((type, payload) => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, ctx.currentTime); // 1000Hz (campanita)
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime); // Volumen a la mitad (suave)
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05); // Decaimiento rápido
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
      } else if (type === 'theme') {
        const isDark = payload;
        osc.type = 'sine';
        if (isDark) {
          // Descendente (hacia Oscuro)
          osc.frequency.setValueAtTime(900, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
        } else {
          // Ascendente (hacia Claro)
          osc.frequency.setValueAtTime(600, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.1);
        }
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === 'levelup') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.setValueAtTime(400, ctx.currentTime + 0.2);
        osc.frequency.setValueAtTime(500, ctx.currentTime + 0.4);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.6);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 1.0);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 1.0);
      }
    } catch (e) {
      console.warn("Synthetic audio failed", e);
    }
  }, [getAudioContext]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const newState = !prev;
      localStorage.setItem("seojump_muted", newState);
      return newState;
    });
  }, []);

  const playClick = useCallback(() => {
    if (!isMuted) {
      // Siempre usar el sintético para el clic según requerimiento
      playSyntheticTone('click');
    }
  }, [isMuted, playSyntheticTone]);
  
  const playThemeToggle = useCallback((isDark) => {
    if (!isMuted) {
      playSyntheticTone('theme', isDark);
    }
  }, [isMuted, playSyntheticTone]);

  const playSuccess = useCallback(() => {
    if (!isMuted) {
      if (successAudio.current) {
        successAudio.current.currentTime = 0;
        successAudio.current.play().catch(() => {
          playSyntheticTone('success');
        });
      } else {
        playSyntheticTone('success');
      }
    }
  }, [isMuted, playSyntheticTone]);

  const playLevelUp = useCallback(() => {
    if (!isMuted) {
      if (levelUpAudio.current) {
        levelUpAudio.current.currentTime = 0;
        levelUpAudio.current.play().catch(() => {
          playSyntheticTone('levelup');
        });
      } else {
        playSyntheticTone('levelup');
      }
    }
  }, [isMuted, playSyntheticTone]);

  return { isMuted, toggleMute, playClick, playThemeToggle, playSuccess, playLevelUp };
}
