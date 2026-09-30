import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

export const normalizeUploadUri = (uri) => {
  if (!uri) return uri;
  if (uri.startsWith("file://") || uri.startsWith("content://")) return uri;
  if (Platform.OS === "android") return `file://${uri}`;
  return uri;
};

export const getUploadFieldName = (att) => {
  if (att.type === "audio") return "audio";
  if (att.type === "video") return "video";
  return "image";
};

export const buildMessageUploadFormData = async (attachments) => {
  const formData = new FormData();

  for (const att of attachments) {
    const uri = normalizeUploadUri(att.uri);
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      throw new Error("Recording file is missing. Please record again.");
    }

    const mimeType = att.mimeType || "application/octet-stream";
    const name = att.name || `upload_${Date.now()}`;

    formData.append(getUploadFieldName(att), {
      uri,
      type: mimeType,
      name,
    });
  }

  return formData;
};
