import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { auth, db, doc, getDoc, setDoc } from "../firebase";
import { LegalSection } from "../data/legalDocs";
import {
  DEFAULT_EFFECTIVE_DATE,
  PoliciesRecord,
  PolicyIntroItem,
  defaultPoliciesRecord,
  isValidIsoDate,
  loadCachedPolicies,
  loadSeenVersion,
  parsePolicies,
  parseRecord,
  saveCachedPolicies,
  saveSeenVersion,
} from "../utils/policies";

/**
 * Registro compartido de políticas en Firestore `settings/policies`.
 *
 * Reglas existentes (firestore.rules):
 * - lectura pública (cualquier visitante ve las políticas vigentes),
 * - escritura solo de la cuenta propietaria con sesión Google verificada.
 *
 * Carga en cascada: caché local (pintado instantáneo) → Firestore (fuente de
 * verdad) → documento integrado en el build (sin conexión / sin publicación).
 */

export type PoliciesSource = "server" | "cache" | "builtin";

interface PoliciesContextValue {
  record: PoliciesRecord;
  intro: PolicyIntroItem[];
  sections: LegalSection[];
  source: PoliciesSource;
  loading: boolean;
  syncError: string | null;
  seenVersion: number;
  /** true cuando hay una publicación más reciente que la vista por este navegador. */
  needsNotice: boolean;
  ackNotice: () => void;
  refresh: () => Promise<void>;
  save: (
    md: string,
    effectiveDate: string,
  ) => Promise<{ ok: boolean; error?: string }>;
}

const PoliciesContext = createContext<PoliciesContextValue | null>(null);

export function usePolicies(): PoliciesContextValue {
  const ctx = useContext(PoliciesContext);
  if (!ctx) {
    throw new Error("usePolicies debe usarse dentro de <PoliciesProvider>");
  }
  return ctx;
}

/** Firestore puede quedarse negociando sin red: acotamos la espera. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Valida y normaliza un registro leído de Firestore. */
function normalizeRecord(data: Record<string, unknown>): PoliciesRecord | null {
  const md = typeof data.md === "string" ? data.md : "";
  if (!md.trim()) return null;
  const effectiveDate =
    typeof data.effectiveDate === "string" && isValidIsoDate(data.effectiveDate)
      ? data.effectiveDate
      : DEFAULT_EFFECTIVE_DATE;
  const version =
    typeof data.version === "number" && data.version > 0 ? data.version : 1;
  return {
    md,
    effectiveDate,
    version,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
  };
}

export const PoliciesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [cachedAtMount] = useState(() => loadCachedPolicies());
  const [record, setRecord] = useState<PoliciesRecord>(
    () => cachedAtMount ?? defaultPoliciesRecord(),
  );
  const [source, setSource] = useState<PoliciesSource>(() =>
    cachedAtMount ? "cache" : "builtin",
  );
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [seenVersion, setSeenVersion] = useState<number>(() => loadSeenVersion());

  const fetchRemote = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await withTimeout(
        getDoc(doc(db, "settings", "policies")),
        12000,
      );
      const data = snap.data();
      if (data) {
        const remote = normalizeRecord(data as Record<string, unknown>);
        if (remote) {
          setRecord(remote);
          saveCachedPolicies(remote);
          setSource("server");
        } else {
          // Documento presente pero vacío/inválido: usamos el integrado.
          setRecord(defaultPoliciesRecord());
          setSource("builtin");
        }
      } else {
        // Sin publicación todavía: caché local si existe, si no el integrado.
        const cached = loadCachedPolicies();
        if (cached) {
          setRecord(cached);
          setSource("cache");
        } else {
          setRecord(defaultPoliciesRecord());
          setSource("builtin");
        }
      }
      setSyncError(null);
    } catch (err) {
      const timedOut = err instanceof Error && err.message === "timeout";
      setSyncError(
        timedOut
          ? "Firestore no responde (sin conexión o bloqueado)."
          : "Sin conexión con Firestore: se muestra la última copia disponible.",
      );
      setSource((prev) =>
        prev === "server"
          ? "server"
          : loadCachedPolicies()
            ? "cache"
            : "builtin",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRemote();
  }, [fetchRemote]);

  const ackNotice = useCallback(() => {
    saveSeenVersion(record.version);
    setSeenVersion(record.version);
  }, [record.version]);

  const save = useCallback(
    async (md: string, effectiveDate: string) => {
      if (parsePolicies(md).sections.length === 0) {
        return {
          ok: false,
          error:
            "El documento no tiene secciones: cada una debe empezar por «# Título».",
        };
      }
      if (!isValidIsoDate(effectiveDate)) {
        return {
          ok: false,
          error: "La fecha de entrada en vigor no es válida.",
        };
      }

      // La sesión de Google se restaura de forma asíncrona tras recargar.
      try {
        await auth.authStateReady();
      } catch {
        /* seguimos y comprobamos currentUser abajo */
      }
      const user = auth.currentUser;
      if (!user) {
        return {
          ok: false,
          error:
            "Se requiere iniciar sesión con Google con la cuenta propietaria para publicar.",
        };
      }

      // Versión = máxima entre la local y la publicada (evita pisar cambios).
      let baseVersion = record.version;
      try {
        const snap = await getDoc(doc(db, "settings", "policies"));
        const remoteVersion = snap.data()?.version;
        if (typeof remoteVersion === "number" && remoteVersion >= baseVersion) {
          baseVersion = remoteVersion;
        }
      } catch {
        /* sin red: se incrementa sobre la versión local */
      }

      const next: PoliciesRecord = {
        md,
        effectiveDate,
        version: baseVersion + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: user.email || "",
      };

      try {
        await setDoc(doc(db, "settings", "policies"), next);
        setRecord(next);
        saveCachedPolicies(next);
        setSource("server");
        setSyncError(null);
        // El editor ya lo sabe: no le mostramos su propio aviso.
        saveSeenVersion(next.version);
        setSeenVersion(next.version);
        return { ok: true };
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code === "permission-denied") {
          return {
            ok: false,
            error:
              "Firestore denegó la escritura: se necesita la sesión Google de blacknewsglobalmedia@gmail.com.",
          };
        }
        return {
          ok: false,
          error: `No se pudo publicar (${code || "error"}): ${
            err instanceof Error ? err.message : "error desconocido"
          }`,
        };
      }
    },
    [record.version],
  );

  const parsed = useMemo(() => parseRecord(record), [record]);

  const value = useMemo<PoliciesContextValue>(
    () => ({
      record,
      intro: parsed.intro,
      sections: parsed.sections,
      source,
      loading,
      syncError,
      seenVersion,
      needsNotice: record.version > 0 && record.version > seenVersion,
      ackNotice,
      refresh: fetchRemote,
      save,
    }),
    [
      record,
      parsed,
      source,
      loading,
      syncError,
      seenVersion,
      ackNotice,
      fetchRemote,
      save,
    ],
  );

  return (
    <PoliciesContext.Provider value={value}>
      {children}
    </PoliciesContext.Provider>
  );
};
