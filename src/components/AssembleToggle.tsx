import { Blocks } from "lucide-react";
import { setAssembleEnabled, useAssemble } from "../lib/assemble";

export const AssembleToggle: React.FC = () => {
  const on = useAssemble();
  return (
    <button
      onClick={() => setAssembleEnabled(!on)}
      aria-pressed={on}
      title={on ? "Efecto de entrada activo: pulsar para desactivarlo" : "Activar efecto de entrada"}
      className={`hover:text-white transition-colors flex items-center gap-1 cursor-pointer px-1.5 py-1.5 -mx-1.5 -my-1.5 ${
        on ? "text-white font-medium" : "text-neutral-500"
      }`}
    >
      <Blocks className="w-3 h-3" />
      <span className="hidden sm:inline">EFECTO</span>
    </button>
  );
};
