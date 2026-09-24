import { Report, FlashNews } from '../types/news';

export const CATEGORIES = [
  'TODAS',
  'ECONOMÍA & MERCADOS',
  'GEOPOLÍTICA',
  'TECNOLOGÍA & INNOVACIÓN',
  'DERECHO & PROPIEDAD',
  'ENERGÍA & INDUSTRIA',
  'DOSSIERS',
] as const;

export const FLASH_NEWS: FlashNews[] = [
  {
    id: 'flash-1',
    time: '14:28 UTC',
    category: 'ECONOMÍA & MERCADOS',
    title: 'La competencia entre monedas y la acumulación de activos sin riesgo de confiscación marcan nuevo récord entre inversores institucionales.',
    reportId: 'rep-geoeconomia-reservas',
  },
  {
    id: 'flash-2',
    time: '13:54 UTC',
    category: 'DERECHO & PROPIEDAD',
    title: 'Dictamen jurídico internacional ratifica que la propiedad digital y los contratos inteligentes privados prevalecen sobre regulaciones retroactivas.',
    reportId: 'rep-derecho-propiedad',
  },
  {
    id: 'flash-3',
    time: '13:10 UTC',
    category: 'TECNOLOGÍA & INNOVACIÓN',
    title: 'Startups de cómputo cuántico e IA descentralizada eluden restricciones burocráticas al operar con clusters fotónicos de capital privado.',
    reportId: 'rep-soberania-algoritmica',
  },
  {
    id: 'flash-4',
    time: '12:05 UTC',
    category: 'ENERGÍA & INDUSTRIA',
    title: 'Consorcios privados del Mar del Norte logran rentabilidad operativa sin subvenciones públicas mediante contratos bilaterales a largo plazo.',
    reportId: 'rep-megainfraestructura-oceanica',
  },
  {
    id: 'flash-5',
    time: '11:42 UTC',
    category: 'GEOPOLÍTICA',
    title: 'Tratado de seguridad civil prohíbe ciberataques contra servicios esenciales y protege la indemnidad de vidas humanas frente a ciberguerra estatal.',
    reportId: 'rep-pacto-ginebra',
  },
];

export const REPORTS: Report[] = [
  {
    id: 'rep-geoeconomia-reservas',
    title: 'La fuga del capital hacia el dinero duro: por qué los mercados penalizan la emisión arbitraria y premian la seguridad jurídica',
    subtitle: 'El análisis sobre el agotamiento del modelo fiduciario inflacionario, la búsqueda global de reserva de valor y el auge del arbitraje de jurisdicciones fiscales.',
    category: 'ECONOMÍA & MERCADOS',
    author: {
      name: 'Mateo R. Valenzuela',
      bureau: 'Zúrich / Redacción Central',
      role: 'Analista Jefe de Mercados y Estabilidad Monetaria',
    },
    publishedAt: '24 Sep 2026 · 14:15 UTC',
    readTime: '6 min de lectura',
    image: '/src/assets/images/lead_market_freedom_1790285928979.jpg',
    imageCaption: 'Sala internacional de contratación en tiempo real. La libre flotación y la liquidez privada definen el valor auténtico de los activos.',
    lead: 'Durante décadas, la teoría de que la intervención estatal sobre los tipos de interés podía sustituir al cálculo económico de millones de individuos libres dominó las instituciones multilaterales. Hoy, los mercados de deuda y las reservas internacionales están dictando un veredicto inapelable: el capital huye de la arbitrariedad regulatoria y busca refugio donde la propiedad privada goza de garantías inalienables.',
    exclusive: true,
    trending: true,
    keyTakeaways: [
      'El capital productivo internacional migra a una velocidad récord hacia naciones con certidumbre fiscal, respeto a los contratos y moneda sin riesgo de degradación política.',
      'La demanda de oro físico, activos tangibles e instrumentos portables no confiscables creció un 42% anual frente a la pérdida de poder adquisitivo de los títulos soberanos inflacionados.',
      'Los pactos comerciales bilaterales sin aranceles ni cuotas proteccionistas demuestran multiplicar el poder adquisitivo de las familias y la eficiencia en la cadena de suministros.',
    ],
    tags: ['Libre Mercado', 'Moneda Fuerte', 'Propiedad Privada', 'Ahorro Real', 'Comercio Libre'],
    sections: [
      {
        type: 'paragraph',
        text: 'El cálculo económico no es una construcción burocrática susceptible de ser planificada por comités de expertos; es la manifestación directa de las valoraciones subjetivas de productores, trabajadores y ahorradores. Cuando los gobiernos ensayan controles de precios o distorsionan las señales del tipo de interés mediante expansión monetaria sin respaldo, la respuesta inevitable del mercado es la escasez y la desinversión.',
      },
      {
        type: 'quote',
        text: 'La propiedad privada de los medios de producción y el libre mecanismo de precios no son meras preferencias doctrinales, sino el único método conocido capaz de coordinar el conocimiento disperso y generar prosperidad genuina.',
        cite: 'Dr. Wilhelm Von Brandt, Instituto de Estudios de la Acción Humana',
      },
      {
        type: 'heading',
        text: 'La competencia institucional: el voto con los pies y el capital',
      },
      {
        type: 'paragraph',
        text: 'En la era de la información instantánea y la movilidad financiera, las naciones ya no compiten únicamente con ejércitos, sino con la calidad de sus marcos jurídicos. Las jurisdicciones que respetan el fruto del trabajo individual, mantienen presupuestos equilibrados y reducen la carga asfixiante sobre los emprendedores están atrayendo el talento más cualificado del planeta.',
      },
      {
        type: 'stat',
        value: '+340%',
        label: 'Incremento en el flujo de inversión extranjera directa hacia jurisdicciones con régimen de estado de derecho estricto y cero retenciones arbitrarias.',
      },
      {
        type: 'paragraph',
        text: 'Frente a los ensayos de desglobalización impuesta y barreras arancelarias que encarecen el coste de la vida para los estratos más vulnerables, el comercio voluntario entre particulares continúa demostrando que la cooperación pacífica entre fronteras es el motor más formidable de paz y reducción de la pobreza que la humanidad haya conocido.',
      },
    ],
  },
  {
    id: 'rep-soberania-algoritmica',
    title: 'La descentralización tecnológica frente al control burocrático: cómo el código abierto y los centros privados blindan la innovación',
    subtitle: 'Los intentos de tutelar y licenciar previamente la inteligencia artificial fracasan frente a redes peer-to-peer y la soberanía computacional de los creadores.',
    category: 'TECNOLOGÍA & INNOVACIÓN',
    author: {
      name: 'Clara Domínguez-Nieto',
      bureau: 'Berlín / Innovación y Seguridad',
      role: 'Analista de Infraestructura y Libertades Digitales',
    },
    publishedAt: '24 Sep 2026 · 11:30 UTC',
    readTime: '5 min de lectura',
    image: '/src/assets/images/tech_silicon_datacenter_1790285939453.jpg',
    imageCaption: 'Módulos criogénicos de procesamiento óptico financiados exclusivamente por capital emprendedor de riesgo.',
    lead: 'Cada vez que surge una revolución productiva, los estamentos reguladores intentan imponer regímenes de autorización previa con el pretexto de la seguridad pública, favoreciendo a menudo a los oligopolios establecidos frente a los nuevos competidores. La actual carrera por la inteligencia artificial demuestra que la descentralización del código y la libre empresa son los mejores garantes de la libertad individual.',
    exclusive: true,
    trending: true,
    keyTakeaways: [
      'Los modelos de lenguaje y visión distribuidos en código abierto superan en resiliencia y accesibilidad a los modelos centralizados sometidos a censura regulatoria.',
      'La inversión privada en micro-reactores nucleares modulares resuelve el dilema energético de los centros de datos sin gravar al contribuyente.',
      'La criptografía de clave asimétrica consolida la soberanía del individuo sobre sus datos, comunicaciones y patrimonio digital.',
    ],
    tags: ['Innovación Privada', 'Código Abierto', 'Ciberdefensa', 'Desregulación', 'Cómputo'],
    sections: [
      {
        type: 'paragraph',
        text: 'La historia de la ciencia enseña que el progreso nunca florece bajo el monopolio estatal del conocimiento. Los intentos recientes de subordinar la investigación algorítmica a ventanillas administrativas solo han logrado impulsar la fuga de investigadores hacia ecosistemas de libre desarrollo, donde la experimentación sin trabas genera soluciones directas para la medicina, la educación y la optimización industrial.',
      },
      {
        type: 'quote',
        text: 'Proteger la libertad de escribir código y computar algoritmos es la versión del siglo XXI de defender la libertad de imprenta y la inviolabilidad del pensamiento.',
        cite: 'Soren Lindqvist, Presidente de la Alianza para el Cómputo Federado',
      },
      {
        type: 'heading',
        text: 'El fallo de los oligopolios subvencionados',
      },
      {
        type: 'paragraph',
        text: 'Las compañías que apostaron por capturar al regulador para erigir barreras de entrada a las pequeñas startups están perdiendo la carrera frente a redes de micro-computación comunitaria. Cuando el mercado opera sin privilegios corporativos concedidos por ley, la libre concurrencia beneficia siempre al usuario final con mayor potencia a menor coste.',
      },
      {
        type: 'stat',
        value: '7.8x',
        label: 'Aumento en la tasa de adopción de herramientas de IA sin custodia centralizada frente a plataformas propietarias dependientes de permisos estatales.',
      },
    ],
  },
  {
    id: 'rep-derecho-propiedad',
    title: 'La inviolabilidad de la propiedad privada y el contrato como fundamento insustituible de la convivencia libre',
    subtitle: 'Estudio de campo sobre cómo los sistemas de registro inviolables y la seguridad jurídica reducen drásticamente la conflictividad social y atraen prosperidad.',
    category: 'DERECHO & PROPIEDAD',
    author: {
      name: 'David K. Mendoza',
      bureau: 'Madrid / Asuntos Jurídicos',
      role: 'Editor de Estado de Derecho y Derechos Civiles',
    },
    publishedAt: '24 Sep 2026 · 10:15 UTC',
    readTime: '6 min de lectura',
    image: '/src/assets/images/lead_market_freedom_1790285928979.jpg',
    imageCaption: 'Documentación contractual y verificación de títulos de dominio con seguridad criptográfica independiente.',
    lead: 'Donde la propiedad no está protegida de manera inequívoca contra la expropiación, la confiscación impositiva o la usurpación, ningún plan de vida individual puede proyectarse a largo plazo. La certeza del derecho es el auténtico cimiento material sobre el que se sostiene la libertad humana.',
    exclusive: true,
    trending: false,
    keyTakeaways: [
      'Las comunidades que formalizaron títulos de propiedad individual registraron un incremento del 210% en reinversión de mejoras y conservación de tierras.',
      'El respeto estricto al cumplimiento de contratos voluntarios reduce los costes de litigación comercial en más de un 65%.',
      'La tutela judicial efectiva frente a extralimitaciones de la autoridad pública se confirma como el factor predictivo número uno del bienestar general.',
    ],
    tags: ['Propiedad Privada', 'Estado de Derecho', 'Seguridad Jurídica', 'Libertades Civiles'],
    sections: [
      {
        type: 'paragraph',
        text: 'La propiedad privada no es un privilegio concedido graciosamente por el poder político, sino el derecho natural que cada ser humano tiene sobre el fruto de su esfuerzo, su talento y su ahorro. Sin propiedad no existe esfera privada protegida, y sin ella el ciudadano queda a merced de la arbitrariedad de los gobernantes de turno.',
      },
      {
        type: 'quote',
        text: 'La libertad individual no puede florecer si el fruto del esfuerzo diario puede ser confiscado o condicionado sin el consentimiento expreso del propietario legítimo.',
        cite: 'Clara Elena Soriano, Catedrática de Filosofía del Derecho',
      },
      {
        type: 'heading',
        text: 'La tragedia de los bienes comunes frente al incentivo del dueño',
      },
      {
        type: 'paragraph',
        text: 'La evidencia empírica acumulada a lo largo de los siglos es concluyente: lo que es de todos no es cuidado por nadie. La privatización responsable y la delimitación nítida de responsabilidades sobre los recursos naturales es la herramienta más eficaz y verificable para garantizar su custodia y sostenibilidad para las próximas generaciones.',
      },
    ],
  },
  {
    id: 'rep-megainfraestructura-oceanica',
    title: 'Revolución en alta mar sin coste al contribuyente: cómo la iniciativa privada financia la transición industrial',
    subtitle: 'Los contratos de compra de energía a largo plazo (PPA) entre empresas sustituyen con éxito probado a los subsidios distorsionadores en el Mar del Norte.',
    category: 'ENERGÍA & INDUSTRIA',
    author: {
      name: 'Sonia Arispe',
      bureau: 'Oslo / Energía e Infraestructuras',
      role: 'Enviada Especial a Complejos Energéticos Industriales',
    },
    publishedAt: '24 Sep 2026 · 08:20 UTC',
    readTime: '5 min de lectura',
    image: '/src/assets/images/maritime_offshore_energy_1790285958148.jpg',
    imageCaption: 'Subestación convertidora y turbinas de última generación en el Mar del Norte, financiadas íntegramente por consorcios privados.',
    lead: 'Durante años se argumentó que las infraestructuras de gran escala eran inviables sin subsidios fiscales permanentes sufragados por los contribuyentes. El despliegue de los nuevos parques eólicos marinos e industrias de hidrógeno del Mar del Norte demuestra la tesis contraria: el capital privado, cuando no se enfrenta a marañas regulatorias cambiantes, es capaz de asumir el riesgo con máxima eficiencia.',
    exclusive: false,
    trending: true,
    keyTakeaways: [
      'El 100% de los nuevos megavatios instalados este ejercicio cuentan con cobertura comercial privada mediante acuerdos directos entre industrias productoras y consumidoras.',
      'La eliminación de trabas de tramitación redujo los plazos de puesta en marcha de ocho años a tan solo veintidós meses.',
      'La diversificación de fuentes energéticas privadas garantiza seguridad de suministro ante tensiones geopolíticas entre estados.',
    ],
    tags: ['Energía', 'Capital Privado', 'Desregulación', 'Industria', 'Eficiencia'],
    sections: [
      {
        type: 'paragraph',
        text: 'Cuando los proyectos dependen de prebendas y subvenciones estatales, su viabilidad responde a ciclos electorales y favores políticos antes que a la verdadera demanda del consumidor. En cambio, cuando el riesgo recae directamente sobre los inversores privados, la disciplina del mercado elimina el despilfarro y acelera la innovación en materiales y eficiencia.',
      },
      {
        type: 'stat',
        value: '0 €',
        label: 'Aporte con cargo a fondos públicos en la última fase de interconexión eléctrica de alta tensión en el corredor marítimo norte.',
      },
      {
        type: 'paragraph',
        text: 'La soberanía energética no se decreta en boletines oficiales; se construye permitiendo que la inventiva de los ingenieros, la libre competencia entre tecnologías y la inversión voluntaria encuentren las soluciones más económicas y limpias para toda la sociedad.',
      },
    ],
  },
  {
    id: 'rep-pacto-ginebra',
    title: 'La protección de la vida humana y la infraestructura civil frente a la agresión estatal en el ciberespacio',
    subtitle: 'El tratado internacional de neutralidad civil establece límites jurídicos inexcusables al ciberarmamento y protege la indemnidad de los inocentes.',
    category: 'GEOPOLÍTICA',
    author: {
      name: 'Alejandro S. Biedma',
      bureau: 'Ginebra / Asuntos Estratégicos',
      role: 'Corresponsal de Tratados Internacionales',
    },
    publishedAt: '24 Sep 2026 · 09:45 UTC',
    readTime: '7 min de lectura',
    image: '/src/assets/images/geopolitics_diplomatic_summit_1790285551413.jpg',
    imageCaption: 'Sesión diplomática sobre la preservación de la vida civil y el derecho internacional frente a ataques de ciberguerra no provocada.',
    lead: 'El principio ético y jurídico elemental de que la vida de los ciudadanos particulares y los centros de salud no pueden ser objeto de ataques bélicos cobra nueva vigencia en la era digital. La comunidad internacional da los primeros pasos formales para catalogar la agresión cibernética contra infraestructuras vitales como un crimen de lesa humanidad.',
    exclusive: false,
    trending: false,
    keyTakeaways: [
      'Se prohíbe taxativamente la infiltración en redes hospitalarias, abastecimiento de agua y distribución alimentaria civil bajo cualquier circunstancia.',
      'Se consagra la responsabilidad individual de mandos políticos y operadores militares ante la justicia universal por ataques que comprometan vidas humanas.',
      'El tratado ratifica que el derecho a la vida y la integridad física prevalece de forma absoluta sobre cualquier justificación geoestratégica.',
    ],
    tags: ['Derecho a la Vida', 'Geopolítica', 'Tratados', 'Defensa', 'Justicia Universal'],
    sections: [
      {
        type: 'paragraph',
        text: 'Ninguna razón de estado puede legitimar la puesta en riesgo deliberada de pacientes en quirófanos o el corte del suministro eléctrico a poblaciones enteras. La consagración de la vida del ser humano como un fin en sí mismo —y jamás como un medio utilizable en pugnas bélicas— constituye la victoria ética más relevante de este acuerdo.',
      },
      {
        type: 'quote',
        text: 'La persona humana, su vida y su dignidad física son inviolables. Quien atente contra los medios de supervivencia de la población civil debe responder personalmente ante la justicia penal internacional.',
        cite: 'Dra. Monique Laurent, Presidenta de la Comisión de Derechos Individuales de Ginebra',
      },
      {
        type: 'heading',
        text: 'La tecnología defensiva al servicio de la inmunidad civil',
      },
      {
        type: 'paragraph',
        text: 'Los nuevos protocolos no descansan solo en promesas gubernamentales, sino en la adopción obligatoria de arquitecturas criptográficas de tolerancia cero y auditorías externas independientes, garantizando que el ciudadano común no quede indefenso ante disputas hegemónicas.',
      },
    ],
  },
  {
    id: 'rep-minerales-criticos',
    title: 'Dossier de Investigación: La riqueza minera andina bajo contratos privados de largo plazo y propiedad comunitaria',
    subtitle: 'Cómo la seguridad de los derechos de explotación y la participación accionarial voluntaria de las poblaciones locales superaron el bloqueo de la estatización.',
    category: 'DOSSIERS',
    author: {
      name: 'Unidad de Investigaciones Económicas',
      bureau: 'Santiago / Antofagasta / La Paz',
      role: 'Equipo Especial de Análisis de Recursos y Mercados',
    },
    publishedAt: '23 Sep 2026 · 14:30 UTC',
    readTime: '9 min de lectura',
    image: '/src/assets/images/atacama_lithium_energy_1790285949956.jpg',
    imageCaption: 'Sistemas de extracción directa de litio en el Salar de Atacama: inversión privada con nula evaporación de fuentes hídricas subterráneas.',
    lead: 'La vieja retórica estatista que propugnaba la nacionalización forzosa de los recursos minerales ha quedado desmentida por los hechos en los salares del cono sur. El modelo que está generando desarrollo tangible, prosperidad salarial y protección ecológica rigurosa es el de contratos privados de concesión garantizada con regalías transparentes para las comunidades originarias.',
    exclusive: true,
    trending: true,
    keyTakeaways: [
      'Las empresas bajo régimen de derecho privado invirtieron cuatro veces más en tecnología de extracción sin consumo de agua freática que las empresas con control estatal.',
      'El modelo de compensación por servidumbre y copropiedad societaria ha transferido más de 800 millones de dólares directos a familias locales sin intermediarios burocráticos.',
      'La estabilidad de las reglas de juego durante períodos de 30 años atrae a los mayores desarrolladores tecnológicos de almacenamiento de energía.',
    ],
    tags: ['Propiedad Privada', 'Minería', 'Incentivos de Mercado', 'América Latina', 'Dossier'],
    sections: [
      {
        type: 'paragraph',
        text: 'Los intentos históricos de monopolios estatales sobre los recursos mineros siempre terminaron en corrupción, politización de plantillas y colapso productivo. Por el contrario, cuando los yacimientos son licitados con plenas garantías de propiedad y se respeta la compensación directa a los dueños superficiarios del suelo, el interés privado y el progreso comunitario convergen de forma natural.',
      },
      {
        type: 'stat',
        value: '+820 M$',
        label: 'Patrimonio ingresado directamente en fondos de fideicomiso administrados por las propias comunidades locales sin peajes gubernamentales.',
      },
      {
        type: 'paragraph',
        text: 'El litio y los minerales críticos no enriquecen a las naciones por estar enterrados bajo tierra; lo hacen cuando la inventiva humana, el capital dispuesto a arriesgar y la protección irrestricta de la ley transforman la piedra bruta en tecnología que eleva el nivel de vida de millones de seres humanos.',
      },
    ],
  },
];
