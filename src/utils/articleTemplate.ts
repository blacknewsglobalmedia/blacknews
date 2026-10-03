import { Report, ReportSection, CategoryId } from '../types/news';
import { CATEGORIES } from '../data/newsData';

export interface BlacknewsArticleJsonPayload {
  _meta?: {
    formato: string;
    version: string;
    descripcion: string;
    proposito_para_ia: string;
  };
  _instrucciones_para_ia?: {
    objetivo: string;
    estilo_editorial: string;
    limitaciones_del_documento: {
      title: string;
      subtitle: string;
      category: string;
      lead: string;
      readTime: string;
      imageCaption: string;
      tags: string;
      keyTakeaways: string;
      exclusive: string;
      sections: {
        descripcion: string;
        paragraph: string;
        heading: string;
        quote: string;
        stat: string;
      };
    };
  };
  articulo: {
    title: string;
    subtitle: string;
    category: CategoryId;
    lead: string;
    readTime: string;
    image?: string;
    imageCaption: string;
    exclusive?: boolean;
    tags: string[];
    keyTakeaways: string[];
    sections: ReportSection[];
  };
}

/**
 * Plantilla de ejemplo completa con guías de extensión, métricas de caracteres
 * y un artículo real de periodismo de investigación sobre economía y tecnología.
 */
export const SAMPLE_ARTICLE_JSON: BlacknewsArticleJsonPayload = {
  _meta: {
    formato: "BLACKNEWS_EDITORIAL_ARTICLE_V1",
    version: "1.2.0",
    descripcion: "Plantilla oficial de despacho editorial para BLACKNEWS con especificaciones estrictas de extensión, balance de párrafos y directrices para modelos de Inteligencia Artificial.",
    proposito_para_ia: "Pásale este archivo o su contenido a una IA (Gemini, ChatGPT, Claude) junto con tu tema de investigación para que genere un artículo completo que cumpla al 100% las limitaciones editoriales e impórtalo directamente en el Constructor de Artículos."
  },
  _instrucciones_para_ia: {
    objetivo: "Generar un artículo de investigación periodística de alto rigor, profundidad analítica y sobriedad argumentativa listo para publicarse en la portada de BLACKNEWS.",
    estilo_editorial: "Periodismo riguroso, analítico, técnico y librepensador. Sin sensacionalismo, sin clickbait, sin adjetivación vacía, sin clichés ni emojis. Enfoque en datos contrastados, certidumbre jurídica, fundamentos económicos, libertades civiles e innovación disruptiva.",
    limitaciones_del_documento: {
      title: "Titular principal de la investigación. Extensión recomendada: entre 50 y 90 caracteres (máximo estricto: 110 caracteres). Debe ser directo, asertivo y de peso intelectual.",
      subtitle: "Bajada o deck de portada. Extensión recomendada: entre 120 y 220 caracteres (máximo: 260 caracteres). Debe actuar como resumen ejecutivo con la tesis o hallazgo nuclear.",
      category: `Sección editorial temática. Debe ser exactamente UNA de las siguientes categorías válidas: ${CATEGORIES.filter((c) => c !== 'TODAS').map((c) => `'${c}'`).join(' | ')}.`,
      lead: "Párrafo de entrada principal (Lead periodístico). Extensión recomendada: entre 280 y 450 caracteres (máximo: 550 caracteres). Debe responder de inmediato al qué, quién, cuándo y por qué con máxima densidad informativa.",
      readTime: "Tiempo estimado de lectura para el usuario. Formato: '[N] min de lectura' (ejemplo: '4 min de lectura', '6 min de lectura').",
      imageCaption: "Pie de foto descriptivo y contextual. Extensión recomendada: entre 60 y 140 caracteres. Debe contextualizar la fotografía o gráfico con precisión técnica.",
      tags: "Lista de 3 a 6 etiquetas clave sin almohadillas (#) para indexación y navegación temática (ej: ['Cómputo Cuántico', 'Soberanía Digital', 'Inversión Privada']).",
      keyTakeaways: "Lista de 3 a 5 puntos clave (conclusiones nucleares) sintetizados en una oración concisa. Extensión por punto: entre 60 y 130 caracteres (máximo: 150 caracteres).",
      exclusive: "Booleano (true | false). Valor true si es una investigación o primicia exclusiva del equipo de BLACKNEWS; false para despachos de cobertura analítica estándar.",
      sections: {
        descripcion: "Bloques dinámicos que constituyen el cuerpo de la investigación. Se recomienda intercalar párrafos con subtítulos, citas textuales autorizadas y cifras de alto impacto.",
        paragraph: "Párrafo narrativo o analítico. Extensión recomendada: entre 200 y 420 caracteres por párrafo (máximo: 500 caracteres). REGLA FUNDAMENTAL: Evitar bloques gigantes de texto; dividir ideas complejas en párrafos ágiles y contundentes.",
        heading: "Subtítulo de sección interna. Extensión recomendada: entre 20 y 55 caracteres. Agrupa lógicamente los diferentes ángulos de la investigación.",
        quote: "Cita textual de relevancia testimonial o académica. 'text': entre 80 y 240 caracteres de cita textual directa. 'cite': nombre del emisor, cargo o entidad consultada (entre 15 y 55 caracteres).",
        stat: "Indicador métrico o dato estadístico cardinal. 'value': cifra o porcentaje breve de 2 a 10 caracteres (ej: '+34.8%', '$4.8B', '99.94%'). 'label': descripción explicativa del dato (entre 30 y 85 caracteres)."
      }
    }
  },
  articulo: {
    title: "La desregulación de centros de cómputo cuántico atrae 14.000 millones en capital privado",
    subtitle: "El establecimiento de marcos jurídicos estables y la exención de trabas arancelarias impulsan una nueva generación de infraestructuras críticas sin recurrir a subsidios estatales.",
    category: "TECNOLOGÍA & INNOVACIÓN",
    lead: "La adopción de marcos regulatorios basados en la certeza contractual y la libre transferencia de datos ha detonado una oleada de inversiones estratégicas en centros de computación de alto rendimiento en Europa y América Latina, superando las previsiones más optimistas de los analistas de mercado.",
    readTime: "5 min de lectura",
    image: "/src/assets/images/tech_silicon_datacenter_1790285939453.jpg",
    imageCaption: "Interconexión criogénica de clústeres de cálculo cuántico financiados por consorcios tecnológicos internacionales.",
    exclusive: true,
    tags: [
      "Cómputo Cuántico",
      "Capital Privado",
      "Infraestructura Crítica",
      "Desregulación",
      "Soberanía Tecnológica"
    ],
    keyTakeaways: [
      "La certidumbre jurídica de largo plazo superó a los subsidios como el factor determinante para la radicación de capital.",
      "Los consorcios privados asumen el 100% del riesgo operativo y tecnológico sin comprometer fondos públicos.",
      "La eficiencia térmica y el acceso directo a contratos bilaterales de energía limpia reducen los costes operativos un 32%."
    ],
    sections: [
      {
        type: "paragraph",
        text: "Durante la última década, las políticas industriales dirigistas intentaron orientar el despliegue tecnológico mediante complejas convocatorias de ayudas estatales. Sin embargo, la evidencia documental demuestra que la agilidad decisoria del capital independiente es capaz de resolver los cuellos de botella con una velocidad inalcanzable para la planificación burocrática."
      },
      {
        type: "heading",
        text: "Certidumbre contractual frente al arbitrio normativo"
      },
      {
        type: "paragraph",
        text: "Los operadores de centros de datos señalan que la clave del auge no radica en los incentivos fiscales temporales, sino en la garantía explícita de no interferencia gubernamental en los protocolos de cifrado y en la gobernanza algorítmica de los procesadores superconductores."
      },
      {
        type: "quote",
        text: "Cuando las reglas del juego son transparentes e inmutables a quince años vista, los inversores no reclaman rescates ni subsidios: asumen gustosamente el riesgo del mercado.",
        cite: "Dra. Elena Vane, Directora del Observatorio de Competitividad Tecnológica"
      },
      {
        type: "stat",
        value: "+41.5%",
        label: "Incremento interanual en la potencia de cómputo privado instalada sin apalancamiento fiscal."
      },
      {
        type: "heading",
        text: "Impacto en la soberanía energética y de red"
      },
      {
        type: "paragraph",
        text: "La integración directa de estas instalaciones con parques fotovoltaicos y reactores nucleares modulares de iniciativa corporativa ha demostrado que la demanda industrial avanzada es el catalizador más eficiente para la modernización de la matriz energética continental."
      },
      {
        type: "stat",
        value: "€14.2B",
        label: "Inversión acumulada en acuerdos directos de suministro renovable de largo plazo (PPA)."
      },
      {
        type: "paragraph",
        text: "El cierre de este ciclo consolida una premisa fundamental para el periodismo de análisis: la libre asociación de agentes económicos genera soluciones más robustas y resilientes ante los desafíos de la frontera científica internacional."
      }
    ]
  }
};

/**
 * Descarga el archivo JSON en el navegador del usuario
 */
export function downloadArticleTemplateJson(filename = 'blacknews-plantilla-articulo.json'): void {
  const jsonContent = JSON.stringify(SAMPLE_ARTICLE_JSON, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validador e importador de artículos en formato JSON
 */
export interface ParsedArticleImport {
  title: string;
  subtitle: string;
  category: CategoryId;
  lead: string;
  readTime: string;
  image?: string;
  imageCaption?: string;
  exclusive?: boolean;
  tags: string[];
  keyTakeaways: string[];
  sections: ReportSection[];
}

export function parseAndValidateArticleJson(jsonString: string): {
  success: boolean;
  data?: ParsedArticleImport;
  error?: string;
} {
  try {
    const raw = JSON.parse(jsonString);

    // Puede venir en { articulo: { ... } } o directamente como el objeto raíz { title, ... }
    const root = (raw && typeof raw === 'object' && raw.articulo) ? raw.articulo : raw;

    if (!root || typeof root !== 'object') {
      return { success: false, error: 'El archivo JSON no contiene un objeto válido con los datos del artículo.' };
    }

    if (!root.title || typeof root.title !== 'string' || root.title.trim().length === 0) {
      return { success: false, error: 'El campo "title" (titular) es obligatorio en el JSON.' };
    }

    if (!root.lead || typeof root.lead !== 'string' || root.lead.trim().length === 0) {
      return { success: false, error: 'El campo "lead" (entrada principal) es obligatorio en el JSON.' };
    }

    const VALID_CATEGORIES: CategoryId[] = CATEGORIES.filter(
      (c) => c !== 'TODAS',
    );

    let category: CategoryId = 'ECONOMÍA & MERCADOS';
    if (root.category && VALID_CATEGORIES.includes(root.category)) {
      category = root.category;
    }

    // Normalizar secciones
    const sections: ReportSection[] = [];
    if (Array.isArray(root.sections)) {
      root.sections.forEach((sec: any) => {
        if (sec && typeof sec === 'object' && sec.type) {
          if (sec.type === 'paragraph' && sec.text) {
            sections.push({ type: 'paragraph', text: String(sec.text) });
          } else if (sec.type === 'heading' && sec.text) {
            sections.push({ type: 'heading', text: String(sec.text) });
          } else if (sec.type === 'quote' && sec.text) {
            sections.push({ type: 'quote', text: String(sec.text), cite: sec.cite ? String(sec.cite) : '' });
          } else if (sec.type === 'stat' && (sec.value || sec.label)) {
            sections.push({ type: 'stat', value: String(sec.value || ''), label: String(sec.label || '') });
          } else if (sec.type === 'highlight' && sec.text) {
            sections.push({ type: 'paragraph', text: String(sec.text) });
          }
        }
      });
    }

    // Normalizar tags
    let tags: string[] = [];
    if (Array.isArray(root.tags)) {
      tags = root.tags.map((t: any) => String(t).trim()).filter((t: string) => t.length > 0);
    } else if (typeof root.tags === 'string') {
      tags = root.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
    }

    // Normalizar key takeaways
    let keyTakeaways: string[] = [];
    if (Array.isArray(root.keyTakeaways)) {
      keyTakeaways = root.keyTakeaways.map((t: any) => String(t).trim()).filter((t: string) => t.length > 0);
    }

    return {
      success: true,
      data: {
        title: String(root.title).trim(),
        subtitle: root.subtitle ? String(root.subtitle).trim() : '',
        category,
        lead: String(root.lead).trim(),
        readTime: root.readTime ? String(root.readTime).trim() : '5 min de lectura',
        image: root.image ? String(root.image).trim() : undefined,
        imageCaption: root.imageCaption ? String(root.imageCaption).trim() : '',
        exclusive: Boolean(root.exclusive),
        tags,
        keyTakeaways,
        sections: sections.length > 0 ? sections : [{ type: 'paragraph', text: '' }]
      }
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Error al procesar el archivo JSON: ${err?.message || 'Formato de sintaxis inválido.'}`
    };
  }
}
