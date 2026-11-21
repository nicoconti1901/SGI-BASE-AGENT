// Fondo de salón: negro cálido con un halo dorado arriba y una viñeta, para que el teléfono "flote" en la pista.
import { AbsoluteFill } from "remotion";
import { tema } from "../tema";

export const Fondo: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: tema.fondo,
      backgroundImage: [
        "radial-gradient(ellipse 70% 40% at 50% 8%, rgba(209,174,108,0.16), transparent 70%)",
        "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(122,30,50,0.22), transparent 70%)",
        "radial-gradient(ellipse 120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
      ].join(","),
    }}
  />
);
