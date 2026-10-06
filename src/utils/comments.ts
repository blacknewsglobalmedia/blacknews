/**
 * Comentarios y reacciones ("Me gusta") de los posts — Firestore.
 *
 * Colecciones públicas (lectura para todos, escritura con Google verificada
 * y siempre a nombre propio — ver firestore.rules):
 *
 * - `comments`: { reportId, authorEmail, authorName, avatarInitials, text, createdAt }
 * - `reactions`: un documento por (post, correo), id = `${reportId}_${email}`,
 *   { reportId, userEmail, kind: 'like', createdAt }. Activar o desactivar el
 *   "Me gusta" crea/borra el documento; el contador es la suma por post.
 *
 * Consultas por igualdad simple (sin índice compuesto): el orden y el recuento
 * se calculan en el cliente, que son listas cortas.
 */

import { db } from "../firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

export interface PostComment {
  id: string;
  reportId: string;
  authorEmail: string;
  authorName: string;
  avatarInitials: string;
  /** URL de la foto de perfil (.AVIF) del autor, si la tiene. */
  authorAvatar?: string;
  text: string;
  /** Epoch ms. */
  createdAt: number;
}

export interface LikeState {
  /** "Me gusta" del post. */
  count: number;
  /** El de la sesión actual está activo. */
  mine: boolean;
}

interface CommentDoc {
  reportId?: unknown;
  authorEmail?: unknown;
  authorName?: unknown;
  avatarInitials?: unknown;
  authorAvatar?: unknown;
  text?: unknown;
  createdAt?: unknown;
}

export async function fetchComments(reportId: string): Promise<PostComment[]> {
  const snap = await getDocs(
    query(collection(db, "comments"), where("reportId", "==", reportId)),
  );
  const list: PostComment[] = [];
  snap.docs.forEach((d) => {
    const x = d.data() as CommentDoc;
    if (
      typeof x.text === "string" &&
      typeof x.authorEmail === "string" &&
      typeof x.createdAt === "number"
    ) {
      list.push({
        id: d.id,
        reportId,
        authorEmail: x.authorEmail,
        authorName:
          typeof x.authorName === "string" ? x.authorName : "Lector",
        avatarInitials:
          typeof x.avatarInitials === "string" ? x.avatarInitials : "L",
        authorAvatar:
          typeof x.authorAvatar === "string" ? x.authorAvatar : undefined,
        text: x.text,
        createdAt: x.createdAt,
      });
    }
  });
  list.sort((a, b) => b.createdAt - a.createdAt);
  return list;
}

export async function publishComment(input: {
  reportId: string;
  authorEmail: string;
  authorName: string;
  avatarInitials: string;
  authorAvatar?: string;
  text: string;
}): Promise<void> {
  // Firestore rechaza undefined: solo se incluye authorAvatar si existe
  await addDoc(collection(db, "comments"), {
    reportId: input.reportId,
    authorEmail: input.authorEmail,
    authorName: input.authorName,
    avatarInitials: input.avatarInitials,
    ...(input.authorAvatar ? { authorAvatar: input.authorAvatar } : {}),
    text: input.text,
    createdAt: Date.now(),
  });
}

export async function deleteComment(commentId: string): Promise<void> {
  await deleteDoc(doc(db, "comments", commentId));
}

/** Id del documento de reacción: único por (post, correo). */
export function likeDocId(reportId: string, userEmail: string): string {
  return `${reportId}_${userEmail}`;
}

interface ReactionDoc {
  kind?: unknown;
  userEmail?: unknown;
}

export async function fetchLikes(
  reportId: string,
  userEmail: string | null,
): Promise<LikeState> {
  const snap = await getDocs(
    query(collection(db, "reactions"), where("reportId", "==", reportId)),
  );
  let count = 0;
  let mine = false;
  snap.docs.forEach((d) => {
    const x = d.data() as ReactionDoc;
    if (x.kind === "like") {
      count += 1;
      if (userEmail && x.userEmail === userEmail) mine = true;
    }
  });
  return { count, mine };
}

/** Activa (`on`) o desactiva el "Me gusta" de la sesión en el post. */
export async function setLike(
  reportId: string,
  userEmail: string,
  on: boolean,
): Promise<void> {
  const ref = doc(db, "reactions", likeDocId(reportId, userEmail));
  if (on) {
    await setDoc(ref, {
      reportId,
      userEmail,
      kind: "like",
      createdAt: Date.now(),
    });
  } else {
    await deleteDoc(ref);
  }
}
