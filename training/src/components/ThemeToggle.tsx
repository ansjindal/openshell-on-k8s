"use client";
import { useEffect, useState } from "react";


export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const t = (localStorage.getItem("oclaw-theme") as "dark" | "light") || "dark";
    setTheme(t);
    document.documentElement.dataset.theme = t;
  }, []);
  const toggle = () => {
    const t = theme === "dark" ? "light" : "dark";
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("oclaw-theme", t); } catch {}
    window.dispatchEvent(new CustomEvent("oclaw:theme", { detail: t }));
  };
  return (
    <span onClick={toggle} title="Light / dark" aria-label="Toggle theme" role="button" className="hbtn">◐</span>
  );
}
