/**
 * Padrón de usuarios en la nube (colección Firestore `users`).
 *
 * Motivo: el roster de redactores vivía solo en el localStorage del
 * navegador del propietario — los registros hechos desde otro dispositivo
 * jamás aparecían y el rol concedido no llegaba al equipo. Aquí el rol y el
 * registro se guardan en Firestore para que viajen entre dispositivos.
 *
 * Reglas (firestore.users): el propietario lee/escribe todo el padrón; cada
 * cuenta con Google verificado se da de alta a sí misma —siempre como
 * LECTOR, el propietario asciende después— y solo puede leer/editar sus
 * datos personales, nunca su rol.
 *
 * Todo es fire-and-forget con fail-open: sin permisos o sin conexión la app
 * sigue funcionando en local (mismo patrón que utils/reportSync).
 */
import { db, doc, setDoc, getDoc, getDocs, collection, onSnapshot } from "../firebase";
import type { RedactorProfile, RedactorRole } from "../types/auth";
import { firestoreDoc } from "./reportSync";

export const USERS_COLLECTION = "users";

/** Id del documento = el correo tal cual llega del token de Google. */
const docIdFor = (email: string): string => email.trim();

const toProfile = (id: string, data: Record<string, unknown>): RedactorProfile | null => {
  const email = typeof data.email === "string" ? data.email : "";
  if (!email) return null;
  return {
    // El id local del que creó el doc; si viniera sin él, uno estable por correo.
    id: typeof data.id === "string" && data.id ? data.id : `usr-cloud-${docIdFor(email)}`,
    name: typeof data.name === "string" ? data.name : email,
    email,
    role: (data.role as RedactorRole) || "LECTOR",
    bureau: typeof data.bureau === "string" ? data.bureau : "",
    title: typeof data.title === "string" ? data.title : "",
    avatarInitials: typeof data.avatarInitials === "string" ? data.avatarInitials : "US",
    requestedAt: typeof data.requestedAt === "string" ? data.requestedAt : "",
    approvedAt: typeof data.approvedAt === "string" ? data.approvedAt : undefined,
    avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : undefined,
    bio: typeof data.bio === "string" ? data.bio : undefined,
    isGoogleAccount: data.isGoogleAccount !== false,
  };
};

/** Lectura del rol en la nube (null = sin doc todavía). */
export async function readCloudRole(email: string): Promise<RedactorRole | null> {
  try {
    const snap = await getDoc(doc(db, USERS_COLLECTION, docIdFor(email)));
    if (!snap.exists()) return null;
    const role = (snap.data() as { role?: RedactorRole }).role;
    return role || null;
  } catch {
    return null; // fail-open: sin permisos/conexión se decide en local
  }
}

/**
 * Identidad propia al entrar con Google: lee el rol concedido por el
 * propietario (en otro dispositivo) y crea/actualiza su doc del padrón.
 *
 * Devuelve el rol de la nube (para que el llamante adopte el concedido) o
 * null si no había doc. En la autoalta, un no-propietario entra como
 * LECTOR (lo exigen las reglas); el propietario conserva su rol.
 */
export async function syncIdentity(
  profile: RedactorProfile,
  isOwner: boolean,
): Promise<RedactorRole | null> {
  const ref = doc(db, USERS_COLLECTION, docIdFor(profile.email));
  let cloudRole: RedactorRole | null = null;
  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
    if (exists) {
      cloudRole = ((snap.data() as { role?: RedactorRole }).role) || null;
    }
  } catch {
    return null; // sin conexión: nada que sincronizar
  }

  const roleToWrite: RedactorRole = exists
    ? cloudRole && !isOwner
      ? cloudRole // el rol de la nube manda sobre el local
      : profile.role
    : isOwner
      ? profile.role
      : "LECTOR";

  try {
    await setDoc(ref, firestoreDoc({ ...profile, role: roleToWrite }), { merge: true });
  } catch {
    /* sin permisos: el registro queda local (fail-open) */
  }
  return cloudRole;
}

/** El propietario (o quien pueda) escribe el rol de un miembro en la nube. */
export async function writeCloudRole(member: RedactorProfile): Promise<void> {
  try {
    await setDoc(
      doc(db, USERS_COLLECTION, docIdFor(member.email)),
      firestoreDoc({ ...member }),
      { merge: true },
    );
  } catch {
    /* reglas lo niegan para cuentas no-propietarias: se queda en local */
  }
}

/**
 * Empareja el roster local con el de la nube (misma prioridad que
 * mergeReports): gana la nube en rol/datos, el id local se conserva para no
 * romper los cambios de rol por id, y los registros solo-nube se añaden.
 */
export function mergeCloudRoster(
  local: RedactorProfile[],
  cloud: RedactorProfile[],
): RedactorProfile[] {
  const byEmailLocal = new Map(local.map((u) => [u.email.toLowerCase(), u]));
  const merged: RedactorProfile[] = local.map((u) => {
    const remote = cloud.find((c) => c.email.toLowerCase() === u.email.toLowerCase());
    if (!remote) return u;
    return { ...u, role: remote.role, name: remote.name || u.name };
  });
  for (const c of cloud) {
    if (!byEmailLocal.has(c.email.toLowerCase())) merged.push(c);
  }
  return merged;
}

/**
 * Suscripción en vivo al padrón (solo el propietario tiene reglas de lectura
 * de todo el conjunto). Devuelve el unsubscribe de onSnapshot.
 */
export function subscribeToRegistry(
  onChange: (profiles: RedactorProfile[], emails: string[]) => void,
): () => void {
  try {
    return onSnapshot(
      collection(db, USERS_COLLECTION),
      (snap) => {
        const profiles: RedactorProfile[] = [];
        snap.docs.forEach((d) => {
          const p = toProfile(d.id, d.data() as Record<string, unknown>);
          if (p) profiles.push(p);
        });
        onChange(profiles, profiles.map((p) => p.email));
      },
      () => {
        /* sin permisos/conexión: se vive con el roster local */
      },
    );
  } catch {
    return () => {};
  }
}

/** Descarga puntual del padrón (sin listener) para mezclar al arrancar. */
export async function fetchRegistry(): Promise<RedactorProfile[]> {
  try {
    const snap = await getDocs(collection(db, USERS_COLLECTION));
    const out: RedactorProfile[] = [];
    snap.docs.forEach((d) => {
      const p = toProfile(d.id, d.data() as Record<string, unknown>);
      if (p) out.push(p);
    });
    return out;
  } catch {
    return [];
  }
}
