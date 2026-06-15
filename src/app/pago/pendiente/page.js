import Link from "next/link";

export default function PagoPendientePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-fredoka flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-6">
        <div className="text-6xl">⏳</div>
        <h1 className="text-3xl font-black text-white">Pago pendiente</h1>
        <p className="text-slate-400 font-semibold">
          Tu pago está en proceso. Cuando Mercado Pago lo confirme, activaremos tu plan PRO
          automáticamente.
        </p>
        <Link
          href="/"
          className="inline-block btn-3d btn-green font-black py-3 px-8 rounded-xl"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
