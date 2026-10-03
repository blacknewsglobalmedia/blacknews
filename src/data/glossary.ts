export interface GlossaryEntry {
  term: string;
  def: string;
}

/**
 * Glosario curado por la redacción: términos financieros y geopolíticos
 * que se resaltan con un tooltip dentro de los artículos.
 * Contenido estático, sin IA ni servicios externos.
 */
export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "FED",
    def: "Banco central de Estados Unidos: fija el tipo de interés del dólar y dirige su política monetaria.",
  },
  {
    term: "BCE",
    def: "Banco Central Europeo: responsable de la política monetaria de la eurozona.",
  },
  {
    term: "QE",
    def: "Del inglés quantitative easing: compra masiva de bonos por un banco central para inyectar liquidez.",
  },
  {
    term: "QT",
    def: "Proceso inverso del QE: el banco central reduce su cartera de bonos y retira dinero de circulación.",
  },
  {
    term: "tipos de interés",
    def: "Precio del dinero: lo que cuesta pedir prestado o lo que renta ahorrar, decidido en gran medida por el banco central.",
  },
  {
    term: "tasa de interés",
    def: "Precio del dinero: lo que cuesta pedir prestado o lo que renta ahorrar.",
  },
  {
    term: "inflación",
    def: "Subida generalizada y sostenida de los precios; erosiona el poder adquisitivo del dinero.",
  },
  {
    term: "IPC",
    def: "Índice de Precios al Consumidor: la inflación medida sobre la canasta típica de las familias.",
  },
  {
    term: "PIB",
    def: "Producto Interior Bruto: el valor total de bienes y servicios producidos por un país.",
  },
  {
    term: "bonos",
    def: "Títulos de deuda de un Estado o empresa que pagan un interés periódico hasta el vencimiento.",
  },
  {
    term: "spread",
    def: "Diferencia de rendimiento entre dos bonos; mide la prima de riesgo que exige el mercado.",
  },
  {
    term: "deuda soberana",
    def: "Deuda pública de un Estado, emitida normalmente en forma de bonos.",
  },
  {
    term: "riesgo soberano",
    def: "Probabilidad de que un Estado no cumpla con el pago de su deuda.",
  },
  {
    term: "déficit fiscal",
    def: "Situación en que los gastos del Estado superan a sus ingresos durante un ejercicio.",
  },
  {
    term: "recesión",
    def: "Caída sostenida de la actividad económica, habitualmente durante dos trimestres seguidos.",
  },
  {
    term: "tipo de cambio",
    def: "Precio de una moneda expresado en función de otra.",
  },
  {
    term: "divisa",
    def: "Moneda con curso internacional utilizada en el comercio y las finanzas globales (dólar, euro, yuan…).",
  },
  {
    term: "volatililidad",
    def: "Rapidez con la que un precio oscila; se interpreta como medida de la incertidumbre del mercado.",
  },
  {
    term: "liquidez",
    def: "Facilidad con la que un activo se compra o vende sin mover su precio.",
  },
  {
    term: "mercado bajista",
    def: "Periodo prolongado de caída de los precios bursátiles (bear market).",
  },
  {
    term: "OPEP+",
    def: "Países petroleros y sus aliados, que acuerdan recortes o aumentos de la producción de crudo.",
  },
  {
    term: "BRICS",
    def: "Bloque de grandes economías emergentes: Brasil, Rusia, India, China y Sudáfrica, entre otros.",
  },
  {
    term: "Estrecho de Ormuz",
    def: "Vía marítima entre Irán y Omán por la que circula una parte crítica del petróleo mundial.",
  },
  {
    term: "OTAN",
    def: "Alianza Atlántica de defensa que agrupa a Norteamérica y numerosos países europeos.",
  },
  {
    term: "arancel",
    def: "Impuesto aduanero que grava la entrada de productos extranjeros.",
  },
  {
    term: "sanciones",
    def: "Medidas coercitivas —embargos, bloqueo de activos— aplicadas contra países o actores.",
  },
  {
    term: "swap",
    def: "Línea de intercambio de divisas entre bancos centrales para proveer liquidez en momentos de crisis.",
  },
  {
    term: "petrodólar",
    def: "Dólares que obtienen los países exportadores de petróleo y que alimentan el sistema financiero mundial.",
  },
];
