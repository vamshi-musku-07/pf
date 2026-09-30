const getAttachmentKind = (att) => {
  if (!att) return "file";
  const mime = `${att.type || ""}`.toLowerCase();
  const ft = `${att.fileType || ""}`.toLowerCase();
  if (ft === "gif" || mime.includes("gif")) return "gif";
  if (mime.startsWith("video/") || ft === "video") return "video";
  if (mime.startsWith("audio/") || ft === "audio" || ft === "voice") return "audio";
  if (mime.startsWith("image/") || ft === "image") return "image";
  return "file";
};

const labelForKind = (kind, text, attName) => {
  if (text) return text;
  if (kind === "gif") return "GIF";
  if (kind === "image") return "Photo";
  if (kind === "video") return "Video";
  if (kind === "audio") return "Voice message";
  return attName || "Attachment";
};

/** Build reply snapshot when user swipes / taps reply on a message. */
export const buildReplyPreviewFromMessage = (msg) => {
  if (!msg) return null;
  const messageId = msg._id || msg.id;
  if (!messageId) return null;

  const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
  const first = attachments[0];
  const text = (msg.message || "").trim();
  const messageType = msg.messageType || "";

  let previewKind = "text";
  let previewUrl = null;
  let previewLabel = text;

  if (first?.url) {
    const kind = getAttachmentKind(first);
    previewKind = kind;
    previewUrl = first.url;
    previewLabel = labelForKind(kind, text, first.name);
  } else if (!text) {
    previewLabel = "Message";
  }

  return {
    messageId: String(messageId),
    senderName: msg.senderName || "User",
    senderId: msg.senderId,
    message: text,
    messageType,
    previewKind,
    previewUrl,
    previewLabel,
  };
};

/** Normalize replyTo from API, socket, or optimistic payload. */
export const normalizeReplyPreview = (replyTo) => {
  if (!replyTo) return null;

  const messageId = replyTo.messageId || replyTo._id || replyTo.id;
  const text = (replyTo.message || "").trim();
  const attachments = Array.isArray(replyTo.attachments) ? replyTo.attachments : [];
  const first = attachments[0];

  let previewKind = replyTo.previewKind || "text";
  let previewUrl = replyTo.previewUrl || first?.url || null;
  let previewLabel = replyTo.previewLabel;

  if (!previewLabel) {
    if (previewUrl && !previewKind) {
      previewKind = getAttachmentKind(first);
    }
    if (previewKind && previewKind !== "text" && !text) {
      previewLabel = labelForKind(previewKind, text, first?.name);
    } else {
      previewLabel = text || labelForKind(previewKind, text, first?.name);
    }
  }

  return {
    messageId: messageId ? String(messageId) : undefined,
    senderName: replyTo.senderName || "User",
    senderId: replyTo.senderId,
    message: text,
    messageType: replyTo.messageType || "",
    previewKind: previewUrl && previewKind === "text" ? getAttachmentKind(first) : previewKind,
    previewUrl,
    previewLabel: previewLabel || text || "Message",
  };
};
