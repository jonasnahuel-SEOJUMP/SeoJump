"use client"

import { login } from "../lib/actions"

export default function LoginButton({ text = "Conectar con Google", className = "" }) {
  return (
    <button
      onClick={() => login()}
      className={`btn-3d btn-white flex items-center justify-center gap-3 w-full text-xl py-4 ${className}`}
    >
      <img
        src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png"
        alt="Google"
        className="w-6 h-6"
      />
      {text}
    </button>
  )
}
