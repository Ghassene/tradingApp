import { RatesDashboard } from "@/components/RatesDashboard";
import { getRates } from "@/lib/rates";

// Les taux sont publiés une fois par jour : on régénère la page toutes les heures.
export const revalidate = 3600;

export default async function HomePage() {
  try {
    const data = await getRates(90);
    return <RatesDashboard data={data} />;
  } catch {
    return (
      <main className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="text-2xl font-semibold text-slate-100">Taux indisponibles</h1>
        <p className="mt-3 text-slate-400">La source des taux ne répond pas. Réessayez dans quelques minutes.</p>
      </main>
    );
  }
}
