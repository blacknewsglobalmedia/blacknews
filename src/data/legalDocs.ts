/**
 * Contenido legal de BLACKNEWS.
 * Fuente única transcrita del documento "Términos, Políticas y Condiciones de Uso" v1.0
 * (fecha de entrada en vigor: 3 de octubre de 2026).
 *
 * Cada LegalBlock contiene exactamente UN elemento (h, p, list, num o note)
 * y el orden del array es el orden de aparición en el documento original.
 */

export type LegalTab =
  | "terms"
  | "content"
  | "ip"
  | "ads"
  | "privacy"
  | "claims"
  | "cookies";

/** Encabezado meta compartido por todos los documentos legales. */
export const LEGAL_META: Array<{ label: string; value: string }> = [
  { label: "Versión", value: "1.0" },
  { label: "Entrada en vigor", value: "3 de octubre de 2026" },
  { label: "Última actualización", value: "3 de octubre de 2026" },
  { label: "Entidad responsable", value: "BlackNews Global Media" },
  { label: "Marca", value: "BlackNews" },
  { label: "Sitio web", value: "https://blacknews.blacknewsglobalmedia.workers.dev" },
  { label: "Contacto", value: "blacknewsglobalmedia@gmail.com" },
];

/**
 * Un bloque de contenido legal: exactamente uno de sus campos definidos.
 * `p` admite **negritas** con markdown ligero.
 */
export type LegalBlock =
  | { h: string; p?: undefined; list?: undefined; num?: undefined; note?: undefined }
  | { p: string; h?: undefined; list?: undefined; num?: undefined; note?: undefined }
  | { list: string[]; h?: undefined; p?: undefined; num?: undefined; note?: undefined }
  | { num: string[]; h?: undefined; p?: undefined; list?: undefined; note?: undefined }
  | { note: string; h?: undefined; p?: undefined; list?: undefined; num?: undefined };

export interface LegalSection {
  title: string;
  blocks: LegalBlock[];
}

const SECTION_TERMS: LegalSection = {
  title: "1. Términos y Condiciones de Uso",
  blocks: [
    { h: "1.1. Objeto" },
    { p: "Los presentes Términos y Condiciones regulan el acceso, navegación, utilización y participación en los servicios, plataformas, sitios web, aplicaciones, perfiles de redes sociales, canales, publicaciones y demás espacios digitales operados, administrados o controlados por BlackNews." },
    { p: 'A efectos de estos términos, "BlackNews", "la Plataforma", "el Medio", "nosotros" o "nuestro" podrán referirse conjuntamente a los servicios y activos digitales operados bajo la marca BlackNews.' },
    { p: "El acceso o utilización de cualquiera de nuestros servicios implica la aceptación de estos Términos y Condiciones." },
    { p: "Cuando una persona no esté de acuerdo con ellos, deberá abstenerse de utilizar los servicios de BlackNews." },

    { h: "1.2. Capacidad para utilizar la Plataforma" },
    { p: "El usuario declara que posee capacidad legal suficiente para aceptar estos términos conforme a las leyes aplicables." },
    { p: "Cuando una persona actúe en representación de una empresa, organización, marca, medio de comunicación u otra entidad, declara contar con las facultades necesarias para hacerlo." },

    { h: "1.3. Naturaleza de BlackNews" },
    { p: "BlackNews es un medio y plataforma digital orientado a la publicación, distribución, organización, contextualización y difusión de información, noticias, análisis, contenidos audiovisuales, material editorial y contenido proporcionado por terceros." },
    { p: "El contenido publicado puede proceder de:" },
    { list: [
      "Redacción propia.",
      "Colaboradores.",
      "Corresponsales.",
      "Usuarios.",
      "Agencias.",
      "Fuentes públicas.",
      "Organizaciones.",
      "Empresas.",
      "Anunciantes.",
      "Redes sociales.",
      "Fuentes audiovisuales.",
      "Proveedores de contenido.",
      "Terceros autorizados.",
    ] },
    { p: "La procedencia de un contenido no implica necesariamente que BlackNews sea titular de todos los derechos sobre dicho material." },

    { h: "1.4. Modificación de los servicios" },
    { p: "BlackNews podrá modificar, ampliar, reducir, suspender o discontinuar total o parcialmente cualquier servicio, sección, funcionalidad, formato, plataforma o modalidad de publicación." },
    { p: "Asimismo, podrá introducir nuevos servicios o condiciones específicas para determinadas funcionalidades." },

    { h: "1.5. Disponibilidad" },
    { p: "BlackNews procurará mantener sus servicios disponibles, pero no garantiza que la Plataforma funcione de manera ininterrumpida, libre de errores o completamente disponible en todo momento." },
    { p: "Podrán producirse interrupciones por:" },
    { list: [
      "Mantenimiento.",
      "Actualizaciones.",
      "Fallas técnicas.",
      "Ataques informáticos.",
      "Problemas de proveedores.",
      "Fallas de conectividad.",
      "Circunstancias de fuerza mayor.",
      "Decisiones de terceros.",
      "Cambios regulatorios.",
      "Otras circunstancias fuera de nuestro control razonable.",
    ] },

    { h: "1.6. Uso permitido" },
    { p: "El usuario podrá utilizar BlackNews únicamente para fines legítimos y compatibles con estos términos." },
    { p: "Queda prohibido utilizar la Plataforma para:" },
    { list: [
      "Cometer actos ilícitos.",
      "Infringir derechos de terceros.",
      "Distribuir malware.",
      "Intentar obtener acceso no autorizado.",
      "Interferir con los sistemas.",
      "Suplantar identidades.",
      "Manipular fraudulentamente contenidos.",
      "Utilizar sistemas automatizados de forma abusiva.",
      "Extraer contenido masivamente cuando ello perjudique el funcionamiento de la Plataforma.",
      "Distribuir spam.",
      "Realizar actividades fraudulentas.",
      "Publicar contenido ilegal.",
      "Vulnerar derechos de propiedad intelectual.",
      "Utilizar BlackNews para actividades que puedan perjudicar deliberadamente a otros usuarios o a la Plataforma.",
    ] },

    { h: "1.7. Contenido de terceros" },
    { p: "BlackNews puede mostrar, enlazar, citar, reproducir o contextualizar información y materiales procedentes de terceros." },
    { p: "La inclusión de contenido de terceros no significa necesariamente que BlackNews comparta, respalde o garantice todas las afirmaciones contenidas en dicho material." },
    { p: "Cuando corresponda, BlackNews podrá identificar la fuente, autor, organización, agencia, usuario o proveedor del contenido." },

    { h: "1.8. Exactitud de la información" },
    { p: "BlackNews procurará aplicar estándares razonables de verificación editorial." },
    { p: "Sin embargo, dada la naturaleza dinámica de la información y la velocidad con la que pueden desarrollarse acontecimientos de interés público, no se garantiza que todo contenido esté libre de errores, omisiones, imprecisiones o desactualizaciones." },
    { p: "BlackNews podrá actualizar, corregir, contextualizar, modificar o retirar contenidos cuando lo considere necesario." },

    { h: "1.9. Responsabilidad del usuario" },
    { p: "El usuario será responsable de la información, archivos, fotografías, videos, textos, audios, logotipos, marcas y demás materiales que proporcione a BlackNews." },
    { p: "Al proporcionar contenido, el usuario declara que cuenta con los derechos, autorizaciones y permisos necesarios para hacerlo." },

    { h: "1.10. Suspensión o eliminación" },
    { p: "BlackNews podrá suspender, limitar o eliminar cuentas, contenidos, publicaciones, campañas o materiales cuando existan motivos razonables relacionados con:" },
    { list: [
      "Incumplimiento de estos términos.",
      "Infracción legal.",
      "Infracción de derechos de terceros.",
      "Fraude.",
      "Abuso.",
      "Seguridad.",
      "Riesgo para la Plataforma.",
      "Contenido prohibido.",
      "Requerimientos de autoridades competentes.",
    ] },
    { p: "Cuando resulte apropiado, BlackNews podrá notificar al usuario las razones correspondientes." },
  ],
};

const SECTION_CONTENT: LegalSection = {
  title: "2. Política de Contenidos y Publicación",
  blocks: [
    { h: "2.1. Alcance" },
    { p: "Esta política regula los contenidos que sean enviados, cargados, publicados, compartidos o puestos a disposición de BlackNews por usuarios, colaboradores, organizaciones, empresas, anunciantes o terceros." },

    { h: "2.2. Responsabilidad sobre el contenido" },
    { p: "Quien envíe contenido a BlackNews será responsable de garantizar que posee o controla los derechos necesarios para permitir su utilización." },
    { p: "Esto incluye, cuando corresponda:" },
    { list: [
      "Derechos de autor.",
      "Derechos sobre fotografías.",
      "Derechos audiovisuales.",
      "Derechos sobre música.",
      "Derechos de imagen.",
      "Derechos de marcas.",
      "Derechos sobre logotipos.",
      "Derechos sobre diseños.",
      "Autorizaciones de personas identificables.",
      "Licencias otorgadas por terceros.",
    ] },

    { h: "2.3. Contenido prohibido" },
    { p: "No podrá enviarse contenido que:" },
    { list: [
      "Sea ilegal.",
      "Promueva actividades ilícitas.",
      "Infrinja derechos de terceros.",
      "Contenga malware.",
      "Sea deliberadamente fraudulento.",
      "Suplante a una persona u organización.",
      "Manipule deliberadamente información de manera engañosa.",
      "Contenga material obtenido mediante acceso ilícito.",
      "Infrinja derechos de autor.",
      "Infrinja derechos de marca.",
      "Vulnere derechos de privacidad.",
      "Incluya datos personales cuya publicación no esté autorizada.",
      "Contenga material cuya distribución esté legalmente prohibida.",
    ] },
    { p: "BlackNews podrá establecer restricciones adicionales según la naturaleza del contenido." },

    { h: "2.4. Contenido editorial" },
    { p: "BlackNews podrá seleccionar, editar, resumir, contextualizar, titular, clasificar, traducir o adaptar técnicamente el material recibido." },
    { p: "Las modificaciones editoriales no implican necesariamente una transferencia de propiedad intelectual sobre el contenido original." },

    { h: "2.5. Derecho de selección" },
    { p: "Enviar contenido a BlackNews no garantiza su publicación." },
    { p: "BlackNews podrá aceptar, rechazar, modificar, retrasar, archivar o retirar cualquier contenido según criterios editoriales, técnicos, comerciales, legales o de seguridad." },

    { h: "2.6. Identificación de fuentes" },
    { p: "Cuando resulte posible y apropiado, BlackNews podrá atribuir el contenido a su autor, fuente, organización o proveedor." },
    { p: "La forma de atribución podrá variar según el formato, plataforma o espacio disponible." },
  ],
};

const SECTION_IP: LegalSection = {
  title: "3. Política de Propiedad Intelectual y Licencia de Contenido",
  blocks: [
    { h: "3.1. Principio general" },
    { p: "Salvo que se indique expresamente lo contrario, el hecho de enviar contenido a BlackNews **no transfiere automáticamente la propiedad del mismo a BlackNews**." },
    { p: "El titular conserva los derechos que legalmente le correspondan." },
    { p: "No obstante, el envío o puesta a disposición del contenido implica la concesión de la licencia descrita en esta política cuando sea necesaria para que BlackNews pueda operar, publicar, distribuir y promocionar sus servicios." },

    { h: "3.2. Licencia otorgada a BlackNews" },
    { p: "Al cargar, enviar, publicar, proporcionar o poner a disposición contenido en BlackNews, el usuario concede a BlackNews, en la medida permitida por la legislación aplicable, una licencia:" },
    { list: [
      "No exclusiva.",
      "Mundial.",
      "Gratuita, salvo acuerdo escrito distinto.",
      "Durante el período necesario para las finalidades previstas en estas políticas.",
      "Transferible cuando sea necesario para la prestación de los servicios.",
      "Sublicenciable cuando sea necesario para proveedores, plataformas, distribuidores o socios tecnológicos.",
      "Para utilizar el contenido en los canales y formatos contemplados en estos términos.",
    ] },
    { p: "La licencia podrá comprender, entre otros, los siguientes actos:" },
    { list: [
      "Alojar.",
      "Almacenar.",
      "Reproducir.",
      "Copiar.",
      "Publicar.",
      "Distribuir.",
      "Comunicar públicamente.",
      "Transmitir.",
      "Exhibir.",
      "Adaptar técnicamente.",
      "Redimensionar.",
      "Recortar.",
      "Comprimir.",
      "Formatear.",
      "Traducir cuando sea necesario.",
      "Incorporar a piezas editoriales.",
      "Incorporar a publicaciones digitales.",
      "Utilizar en redes sociales.",
      "Utilizar en newsletters.",
      "Utilizar en sitios web.",
      "Utilizar en aplicaciones.",
      "Utilizar en materiales promocionales.",
      "Utilizar en espacios publicitarios de BlackNews.",
    ] },

    { h: "3.3. Uso promocional" },
    { p: "El usuario autoriza a BlackNews a utilizar el contenido aportado para promocionar la publicación, sección, plataforma, cuenta, servicio o actividad editorial correspondiente." },
    { p: "Esto puede incluir la utilización de fragmentos, miniaturas, imágenes, títulos, extractos o elementos visuales del contenido en:" },
    { list: [
      "Redes sociales.",
      "Sitios web.",
      "Aplicaciones.",
      "Newsletters.",
      "Presentaciones.",
      "Materiales promocionales.",
      "Campañas digitales.",
      "Piezas gráficas.",
      "Comunicaciones institucionales.",
      "Espacios publicitarios propios.",
    ] },

    { h: "3.4. Uso de imágenes y fotografías" },
    { p: "Cuando una persona proporcione una fotografía o imagen, declara que posee los derechos necesarios para permitir su utilización conforme a esta política." },
    { p: "Cuando la imagen contenga personas identificables, el aportante declara que cuenta con las autorizaciones necesarias cuando estas sean legalmente exigibles." },
    { p: "Esta disposición no pretende convertir al usuario en titular de derechos que pertenezcan a terceros." },

    { h: "3.5. Uso de logotipos y marcas" },
    { p: "Cuando el contenido enviado incluya nombres comerciales, marcas, logotipos, símbolos, diseños corporativos u otros elementos distintivos, el usuario declara que está autorizado para proporcionarlos o que su utilización se encuentra amparada por una base jurídica suficiente." },
    { p: "El usuario autoriza a BlackNews a reproducir dichos elementos únicamente en la medida necesaria para:" },
    { list: [
      "Identificar la fuente.",
      "Identificar al autor.",
      "Presentar el contenido.",
      "Contextualizar la información.",
      "Publicar el material.",
      "Promocionar la publicación.",
      "Mostrar referencias.",
      "Ejecutar campañas o espacios publicitarios autorizados.",
      "Operar los servicios de BlackNews.",
    ] },
    { p: "Esta autorización no implica la transferencia de la titularidad de la marca a BlackNews." },

    { h: "3.6. Contenido utilizado en espacios publicitarios" },
    { p: "Cuando un usuario, empresa, organización, anunciante o colaborador proporcione imágenes, logotipos, fotografías, videos, diseños u otros materiales para su utilización en espacios publicitarios de BlackNews, concede a BlackNews los derechos necesarios para:" },
    { num: [
      "Alojar el material.",
      "Reproducirlo.",
      "Distribuirlo.",
      "Mostrarlo.",
      "Integrarlo en piezas publicitarias.",
      "Adaptarlo técnicamente.",
      "Redimensionarlo.",
      "Incorporarlo a formatos digitales.",
      "Mostrarlo en los espacios publicitarios contratados o autorizados.",
      "Distribuir la publicidad a través de los canales correspondientes.",
    ] },
    { p: "Cuando exista un contrato publicitario específico, dicho contrato podrá establecer condiciones distintas o adicionales." },

    { h: "3.7. Materiales proporcionados por anunciantes" },
    { p: "El anunciante será responsable de asegurarse de que todos los materiales entregados a BlackNews pueden ser utilizados legalmente." },
    { p: "El anunciante garantiza que dispone de las autorizaciones correspondientes respecto de:" },
    { list: [
      "Fotografías.",
      "Videos.",
      "Música.",
      "Ilustraciones.",
      "Tipografías.",
      "Marcas.",
      "Logotipos.",
      "Personas representadas.",
      "Textos.",
      "Diseños.",
      "Elementos audiovisuales.",
    ] },

    { h: "3.8. Adaptaciones técnicas" },
    { p: "El usuario autoriza a BlackNews a realizar las modificaciones técnicas necesarias para adaptar el contenido a distintos dispositivos, formatos y plataformas." },
    { p: "Estas modificaciones podrán incluir:" },
    { list: [
      "Compresión.",
      "Conversión de formato.",
      "Recorte.",
      "Redimensionamiento.",
      "Optimización.",
      "Adaptación de resolución.",
      "Conversión audiovisual.",
      "Generación de miniaturas.",
      "Ajustes de proporción.",
    ] },

    { h: "3.9. Derechos morales" },
    { p: "Nada en esta política pretende transferir derechos que legalmente sean intransferibles." },
    { p: "Cuando la legislación aplicable reconozca derechos morales u otros derechos irrenunciables, BlackNews los respetará dentro de los límites legalmente exigibles." },

    { h: "3.10. Garantía del aportante" },
    { p: "El usuario declara y garantiza que:" },
    { num: [
      "Tiene derecho a proporcionar el contenido.",
      "La publicación del contenido no infringe derechos de terceros.",
      "Cuenta con las autorizaciones necesarias.",
      "La información proporcionada sobre el contenido es verdadera.",
      "La licencia concedida a BlackNews no infringe acuerdos anteriores.",
      "No está utilizando BlackNews para distribuir material obtenido ilícitamente.",
    ] },

    { h: "3.11. Reclamaciones de terceros" },
    { p: "Si un tercero presenta una reclamación relacionada con contenido proporcionado por un usuario, BlackNews podrá solicitar información adicional, suspender temporalmente el contenido, modificar su disponibilidad o retirarlo mientras analiza la situación." },
    { p: "El usuario deberá colaborar razonablemente en la resolución de la reclamación." },
  ],
};

const SECTION_ADS: LegalSection = {
  title: "4. Política de Publicidad y Contenido Comercial",
  blocks: [
    { h: "4.1. Espacios publicitarios" },
    { p: "BlackNews podrá ofrecer espacios publicitarios en:" },
    { list: [
      "Sitios web.",
      "Aplicaciones.",
      "Redes sociales.",
      "Newsletters.",
      "Publicaciones.",
      "Videos.",
      "Imágenes.",
      "Eventos.",
      "Comunicaciones digitales.",
      "Otros productos o servicios operados por BlackNews.",
    ] },

    { h: "4.2. Publicidad de terceros" },
    { p: "BlackNews podrá mostrar publicidad de empresas, organizaciones, marcas, productos, servicios y terceros." },
    { p: "La aparición de un anunciante no implica necesariamente que BlackNews recomiende, certifique o garantice sus productos o servicios." },

    { h: "4.3. Material publicitario" },
    { p: "El anunciante será responsable de que sus materiales cumplan con:" },
    { list: [
      "La legislación aplicable.",
      "Los derechos de propiedad intelectual.",
      "Las normas de publicidad.",
      "Los derechos de imagen.",
      "Las normas de protección al consumidor.",
      "Estas políticas.",
      "Las especificaciones técnicas de BlackNews.",
    ] },

    { h: "4.4. Derecho de rechazo" },
    { p: "BlackNews podrá rechazar, suspender o retirar publicidad cuando considere razonablemente que:" },
    { list: [
      "Puede ser ilegal.",
      "Puede infringir derechos de terceros.",
      "Puede inducir a error.",
      "Puede perjudicar la reputación de la Plataforma.",
      "No cumple las especificaciones.",
      "Contiene información manifiestamente falsa.",
      "Presenta riesgos legales.",
      "Incumple las políticas internas.",
      "El anunciante incumple las condiciones comerciales.",
    ] },

    { h: "4.5. Contenido patrocinado" },
    { p: "Cuando corresponda, BlackNews podrá identificar contenidos patrocinados, publicidad nativa, colaboraciones comerciales o materiales promocionales mediante etiquetas o mecanismos destinados a diferenciarlos del contenido editorial." },

    { h: "4.6. Independencia editorial" },
    { p: "La contratación de publicidad no garantiza cobertura editorial favorable ni publicación de contenido editorial sobre el anunciante." },
    { p: "Las decisiones editoriales podrán mantenerse separadas de las relaciones comerciales." },

    { h: "4.7. Materiales de marca" },
    { p: "El anunciante autoriza a BlackNews, durante el período correspondiente a la relación comercial, a utilizar sus marcas, nombres comerciales y logotipos en la medida necesaria para ejecutar y presentar la campaña contratada." },
  ],
};

const SECTION_ADVERTISERS: LegalSection = {
  title: "7. Condiciones para Anunciantes",
  blocks: [
    { h: "7.1. Aceptación" },
    { p: "La contratación de espacios publicitarios implica la aceptación de estas condiciones y, cuando exista, del contrato u orden de publicidad correspondiente." },

    { h: "7.2. Responsabilidad del anunciante" },
    { p: "El anunciante será exclusivamente responsable de:" },
    { list: [
      "La legalidad de sus productos y servicios.",
      "La veracidad de sus afirmaciones.",
      "La legalidad de sus promociones.",
      "Los derechos sobre sus materiales.",
      "Las autorizaciones necesarias.",
      "El cumplimiento de la normativa aplicable.",
    ] },

    { h: "7.3. Licencia publicitaria" },
    { p: "El anunciante concede a BlackNews una licencia limitada para utilizar los materiales proporcionados con la finalidad de ejecutar la campaña contratada." },
    { p: "La licencia podrá incluir:" },
    { list: [
      "Reproducción.",
      "Publicación.",
      "Distribución.",
      "Exhibición.",
      "Adaptación técnica.",
      "Redimensionamiento.",
      "Integración en formatos publicitarios.",
      "Distribución en las plataformas contratadas.",
    ] },

    { h: "7.4. Propiedad de los materiales" },
    { p: "Salvo acuerdo escrito en contrario, el anunciante conserva la titularidad de sus marcas y materiales." },
    { p: "BlackNews no adquiere la propiedad de dichos activos por el mero hecho de utilizarlos en una campaña." },

    { h: "7.5. Suspensión de campañas" },
    { p: "BlackNews podrá suspender campañas cuando:" },
    { list: [
      "Exista un riesgo legal.",
      "El material sea ilegal.",
      "Se detecte una infracción de derechos.",
      "El anunciante incumpla estas condiciones.",
      "Exista información manifiestamente engañosa.",
      "Exista incumplimiento de obligaciones comerciales.",
    ] },

    { h: "7.6. Resultados publicitarios" },
    { p: "Salvo acuerdo escrito en contrario, BlackNews no garantiza:" },
    { list: [
      "Cantidad determinada de impresiones.",
      "Cantidad determinada de clics.",
      "Ventas.",
      "Conversiones.",
      "Seguidores.",
      "Alcance específico.",
      "Resultados económicos determinados.",
    ] },
    { p: "Las métricas estarán sujetas a las características de cada plataforma y sistema de medición." },
  ],
};

const SECTION_PRIVACY: LegalSection = {
  title: "5. Política de Privacidad y Protección de Datos",
  blocks: [
    { h: "5.1. Alcance" },
    { p: "Esta política explica cómo BlackNews podrá recopilar, utilizar, almacenar y proteger información relacionada con usuarios, colaboradores, anunciantes y visitantes." },

    { h: "5.2. Información recopilada" },
    { p: "Dependiendo de la interacción con BlackNews, podremos recopilar:" },
    { list: [
      "Nombre.",
      "Información de contacto.",
      "Correo electrónico.",
      "Información profesional.",
      "Información proporcionada voluntariamente.",
      "Información técnica.",
      "Dirección IP.",
      "Información del dispositivo.",
      "Datos de navegación.",
      "Preferencias.",
      "Información necesaria para gestionar servicios o solicitudes.",
    ] },
    { p: "BlackNews procurará limitar la recopilación a información razonablemente necesaria para las finalidades correspondientes." },

    { h: "5.3. Finalidades" },
    { p: "La información podrá utilizarse para:" },
    { list: [
      "Operar la Plataforma.",
      "Responder consultas.",
      "Gestionar cuentas.",
      "Procesar solicitudes.",
      "Gestionar colaboraciones.",
      "Gestionar publicidad.",
      "Prevenir fraude y abuso.",
      "Mejorar servicios.",
      "Analizar funcionamiento.",
      "Mantener la seguridad.",
      "Cumplir obligaciones legales.",
      "Comunicarse con usuarios cuando corresponda.",
    ] },

    { h: "5.4. Proveedores" },
    { p: "BlackNews podrá utilizar proveedores tecnológicos para prestar servicios relacionados con:" },
    { list: [
      "Hosting.",
      "Analítica.",
      "Comunicaciones.",
      "Publicidad.",
      "Seguridad.",
      "Procesamiento de pagos.",
      "Gestión de contenido.",
      "Distribución.",
    ] },
    { p: "Los proveedores únicamente deberán acceder a la información necesaria para prestar sus servicios conforme a los acuerdos correspondientes." },

    { h: "5.5. Seguridad" },
    { p: "BlackNews adoptará medidas razonables de seguridad destinadas a proteger la información frente a accesos, alteraciones, divulgaciones o destrucciones no autorizadas." },
    { p: "Ningún sistema conectado a Internet puede garantizar seguridad absoluta." },

    { h: "5.6. Derechos de los usuarios" },
    { p: "Los usuarios podrán ejercer los derechos que les correspondan conforme a la legislación aplicable." },
    { p: "Las solicitudes podrán enviarse a:" },
    { note: "blacknewsglobalmedia@gmail.com" },
  ],
};

const SECTION_CLAIMS: LegalSection = {
  title: "6. Política de Reclamos, Retiro y Correcciones",
  blocks: [
    { h: "6.1. Reclamos sobre contenido" },
    { p: "Cualquier persona podrá comunicar a BlackNews una preocupación relacionada con contenido publicado." },
    { p: "Los reclamos podrán estar relacionados con:" },
    { list: [
      "Propiedad intelectual.",
      "Derechos de imagen.",
      "Privacidad.",
      "Información incorrecta.",
      "Suplantación.",
      "Contenido ilegal.",
      "Uso no autorizado de material.",
      "Otros derechos legítimos.",
    ] },

    { h: "6.2. Información mínima" },
    { p: "Cuando sea posible, la solicitud deberá incluir:" },
    { list: [
      "Identificación del reclamante.",
      "Medio de contacto.",
      "URL o ubicación del contenido.",
      "Descripción del reclamo.",
      "Derechos presuntamente afectados.",
      "Evidencia disponible.",
      "Información que permita verificar la reclamación.",
    ] },

    { h: "6.3. Evaluación" },
    { p: "BlackNews podrá revisar el material y solicitar información adicional." },
    { p: "Dependiendo del caso, podrá:" },
    { list: [
      "Mantener el contenido.",
      "Corregirlo.",
      "Actualizarlo.",
      "Añadir contexto.",
      "Modificar la atribución.",
      "Limitar temporalmente su disponibilidad.",
      "Retirarlo.",
      "Solicitar documentación adicional.",
    ] },
    { p: "La presentación de un reclamo no garantiza la eliminación del contenido." },

    { h: "6.4. Correcciones editoriales" },
    { p: "Cuando BlackNews detecte un error relevante, podrá publicar una corrección, actualización o aclaración." },
    { p: "La forma de corrección dependerá de la naturaleza y relevancia del error." },

    { h: "6.5. Solicitudes relacionadas con derechos de autor" },
    { p: "Las solicitudes relacionadas con derechos de autor deberán identificar claramente:" },
    { num: [
      "La obra protegida.",
      "El titular de los derechos.",
      "El contenido reclamado.",
      "La ubicación del material.",
      "La base de la reclamación.",
      "Información de contacto.",
    ] },
    { p: "BlackNews podrá retirar temporalmente el material mientras evalúa una reclamación suficientemente fundada." },
  ],
};

const SECTION_GENERAL: LegalSection = {
  title: "8. Disposiciones Generales",
  blocks: [
    { h: "8.1. Modificaciones" },
    { p: "BlackNews podrá modificar estas políticas cuando resulte necesario para:" },
    { list: [
      "Adaptarlas a cambios legales.",
      "Incorporar nuevos servicios.",
      "Mejorar procesos.",
      "Incorporar nuevas funcionalidades.",
      "Corregir errores.",
      "Actualizar procedimientos.",
    ] },
    { p: "La versión vigente será la publicada en la Plataforma." },

    { h: "8.2. Separabilidad" },
    { p: "Si alguna disposición fuese considerada inválida, ilegal o inaplicable, las restantes disposiciones continuarán vigentes en la máxima medida permitida." },

    { h: "8.3. No renuncia" },
    { p: "La falta de ejercicio inmediato de un derecho por parte de BlackNews no constituye una renuncia a dicho derecho." },

    { h: "8.4. Legislación aplicable" },
    { p: "Estas condiciones se regirán e interpretarán conforme a la legislación de Uruguay, de los Estados Unidos de América y de la Unión Europea, según corresponda por el lugar de acceso, uso o prestación del servicio." },
    { p: "Cualquier controversia será sometida a los tribunales competentes de Uruguay, de los Estados Unidos de América o de la Unión Europea, según corresponda, salvo que la legislación aplicable imperativa disponga otra cosa." },

    { h: "8.5. Contacto" },
    { p: "Para consultas relacionadas con estas políticas:" },
    { list: [
      "BlackNews.",
      "Email general: blacknewsglobalmedia@gmail.com",
      "Email legal: blacknewsglobalmedia@gmail.com",
      "Email de privacidad: blacknewsglobalmedia@gmail.com",
      "Sitio web: https://blacknews.blacknewsglobalmedia.workers.dev",
    ] },
  ],
};

const SECTION_ACCEPTANCE: LegalSection = {
  title: "9. Aceptación",
  blocks: [
    { p: "Al utilizar los servicios de BlackNews, enviar contenido, proporcionar materiales, participar como colaborador, contratar publicidad o utilizar funcionalidades que requieran aceptación específica, el usuario reconoce haber leído y comprendido las disposiciones aplicables y acepta quedar sujeto a ellas." },
    { note: "Última actualización: 3 de octubre de 2026 · Versión 1.0" },
  ],
};

/** Contenido por pestaña (la pestaña "cookies" se mantiene en JSX por ser específica del sitio). */
export const LEGAL_TABS_CONTENT: Record<
  Exclude<LegalTab, "cookies">,
  LegalSection[]
> = {
  terms: [SECTION_TERMS, SECTION_GENERAL, SECTION_ACCEPTANCE],
  content: [SECTION_CONTENT],
  ip: [SECTION_IP],
  ads: [SECTION_ADS, SECTION_ADVERTISERS],
  privacy: [SECTION_PRIVACY],
  claims: [SECTION_CLAIMS],
};
