/**
 * Edición de perfil (Mi Espacio → Mi Perfil).
 *
 * Lo más sencillo posible: nombre + foto. La foto se recorta en el navegador
 * a un cuadrado de 400×400 px como máximo y se sube al optimizador existente
 * (/api/images/optimize → Cloudinary), que la devuelve ya en formato .AVIF.
 * El resultado se guarda en el perfil de la sesión (localStorage).
 */

import React, { useRef, useState } from "react";
import { Camera, Check, Image as ImageIcon, Trash2, User } from "lucide-react";
import { RedactorProfile } from "../types/auth";

/** Lado máximo del avatar: 400×400 (variante AVIF 400 del optimizador). */
const AVATAR_SIZE = 400;
/** Tamaño máximo del archivo de origen (se recorta y reduce igualmente). */
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

interface ProfileEditorProps {
  currentUser: RedactorProfile;
  /** Guarda nombre (y foto, si cambió) en la sesión actual. */
  onSaveProfile: (patch: { name: string; avatarUrl?: string }) => void;
}

/** Recorta al centro un cuadrado de, como mucho, AVATAR_SIZE px (JPEG). */
async function cropSquare(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("No se pudo leer la imagen."));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar la imagen.");
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) throw new Error("No se pudo convertir la imagen.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Sube el recorte al optimizador y devuelve la URL de la variante .AVIF 400. */
async function uploadAvatar(blob: Blob, name: string): Promise<string> {
  const formData = new FormData();
  formData.append("image", blob, "avatar.jpg");
  formData.append("slug", `avatar-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lector"}`);
  const response = await fetch("/api/images/optimize", {
    method: "POST",
    body: formData,
  });
  const data = await response.json().catch(() => null);
  if (!data || !data.success) {
    throw new Error(data?.error || "No se pudo optimizar la foto.");
  }
  const variants: Array<{ format?: string; width?: number; url?: string }> =
    data.data?.variants || [];
  const avif =
    variants.find((v) => v.format === "avif" && v.width === AVATAR_SIZE) ||
    variants.filter((v) => v.format === "avif").pop() ||
    { url: data.data?.fallbackUrl };
  if (!avif.url) throw new Error("No se pudo generar el avatar .AVIF.");
  return avif.url;
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({
  currentUser,
  onSaveProfile,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(currentUser.name);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const currentAvatar = removePhoto ? null : currentUser.avatarUrl || null;
  const showAvatar = previewUrl || currentAvatar;

  const handlePick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError("Formato no admitido: usa JPG, PNG, WebP o AVIF.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError("La imagen supera los 10 MB.");
      return;
    }
    try {
      const blob = await cropSquare(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setPendingBlob(blob);
      setRemovePhoto(false);
      setSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer la imagen.");
    }
  };

  const handleSave = async () => {
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setError("El nombre debe tener al menos 2 caracteres.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      let avatarUrl: string | undefined;
      if (pendingBlob) {
        // Recorte 400×400 → optimizador → variante .AVIF
        avatarUrl = await uploadAvatar(pendingBlob, cleanName);
      } else if (removePhoto) {
        avatarUrl = undefined;
      } else {
        avatarUrl = currentUser.avatarUrl || undefined;
      }
      onSaveProfile({ name: cleanName, avatarUrl });
      if (pendingBlob && previewUrl) URL.revokeObjectURL(previewUrl);
      setPendingBlob(null);
      setPreviewUrl(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white">
          <User className="w-4 h-4 text-neutral-500" />
          <span>Mi perfil</span>
        </div>
        <span className="text-[10px] font-mono text-neutral-500">
          nombre · foto .AVIF {AVATAR_SIZE}×{AVATAR_SIZE}
        </span>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 space-y-6">
        {/* Foto */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="shrink-0">
            {showAvatar ? (
              <img
                src={showAvatar || undefined}
                alt={name}
                className="w-20 h-20 rounded-xl object-cover border border-white/10"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-white text-black font-black flex items-center justify-center text-xl">
                {currentUser.avatarInitials}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED.join(",")}
              className="hidden"
              onChange={(e) => {
                void handlePick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-black hover:bg-neutral-200 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                {showAvatar ? "Cambiar foto" : "Elegir foto"}
              </button>
              {(currentAvatar || pendingBlob) && (
                <button
                  type="button"
                  onClick={() => {
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                    setPendingBlob(null);
                    setRemovePhoto(true);
                    setSaved(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-neutral-400 hover:text-red-400 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Quitar foto
                </button>
              )}
            </div>
            <p className="text-[11px] text-neutral-500 font-light leading-relaxed">
              JPG, PNG, WebP o AVIF · máximo 10 MB. Se recorta al centro y se
              convierte en <span className="text-neutral-300">.AVIF 400×400</span> al guardar.
            </p>
          </div>
        </div>

        {/* Nombre */}
        <div className="space-y-2">
          <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold">
            Nombre visible
          </label>
          <input
            type="text"
            value={name}
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            placeholder="Tu nombre"
            className="w-full rounded-lg border border-white/10 bg-black px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30"
          />
          <p className="text-[11px] text-neutral-500 font-light">
            Aparece en tu panel, en tus comentarios y define tus iniciales.
          </p>
        </div>

        {/* Mensajes */}
        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {saved && (
          <p className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 rounded-lg px-3 py-2 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            Perfil actualizado correctamente.
          </p>
        )}

        {/* Guardar */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            {saving ? "Guardando…" : "Guardar perfil"}
          </button>
        </div>
      </div>
    </div>
  );
};
