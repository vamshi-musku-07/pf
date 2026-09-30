import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

/** Cached once — avoid re-requiring a missing native module (throws + redbox). */
let imageManipulatorModule = undefined;

const getImageManipulator = () => {
  if (imageManipulatorModule !== undefined) return imageManipulatorModule;

  // Expo Go / clients without a rebuild: native module is absent.
  if (!requireOptionalNativeModule("ExpoImageManipulator")) {
    imageManipulatorModule = null;
    return null;
  }

  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    imageManipulatorModule = require("expo-image-manipulator");
  } catch {
    imageManipulatorModule = null;
  }
  return imageManipulatorModule;
};

export const normalizeUploadUri = (uri) => {
  if (!uri) return uri;
  if (uri.startsWith("file://") || uri.startsWith("content://")) return uri;
  if (Platform.OS === "android") return `file://${uri}`;
  return uri;
};

const extensionForMime = (mimeType = "") => {
  const m = mimeType.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("heic") || m.includes("heif")) return "heic";
  if (m.includes("video")) return "mp4";
  return "jpg";
};

/** Copy content:// / ph:// URIs to a readable file:// path in cache (required for RN uploads). */
export const resolveUploadUri = async (uri, mimeType = "image/jpeg") => {
  const source = normalizeUploadUri(uri);
  if (!source) throw new Error("Missing media file.");

  if (source.startsWith("file://")) {
    const info = await FileSystem.getInfoAsync(source);
    if (info.exists) return source;
  }

  if (!FileSystem.cacheDirectory) {
    return source;
  }

  const ext = extensionForMime(mimeType);
  const dest = `${FileSystem.cacheDirectory}post_upload_${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: source, to: dest });
  return dest;
};

/**
 * Optionally resize/compress via expo-image-manipulator when the native
 * module is present (dev client rebuild). Otherwise returns the original URI.
 */
export const compressImageForUpload = async (uri) => {
  const source = await resolveUploadUri(uri, "image/jpeg");
  const ImageManipulator = getImageManipulator();

  if (!ImageManipulator?.manipulateAsync) {
    return { uri: source, mimeType: "image/jpeg" };
  }

  try {
    const result = await ImageManipulator.manipulateAsync(
      source,
      [{ resize: { width: 1280 } }],
      {
        compress: 0.62,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
    return {
      uri: result.uri,
      mimeType: "image/jpeg",
      width: result.width,
      height: result.height,
    };
  } catch {
    return { uri: source, mimeType: "image/jpeg" };
  }
};

/**
 * Build upload payload for POST /api/v1/post.
 * Images use base64 JSON (reliable on Android). Videos use multipart.
 */
export const buildPostUploadPayload = async ({ teamId, media }) => {
  if (!media) throw new Error("Select an image or video.");

  const mimeType =
    media.mimeType ||
    (media.type === "video" ? "video/mp4" : "image/jpeg");

  if (media.type === "video") {
    const readableUri = await resolveUploadUri(media.uri, mimeType);
    const formData = new FormData();
    formData.append("teamId", teamId);
    formData.append("video", {
      uri: readableUri,
      type: mimeType,
      name: media.name || `video-${Date.now()}.mp4`,
    });
    return { kind: "multipart", body: formData };
  }

  const compressed = await compressImageForUpload(media.uri);
  const info = await FileSystem.getInfoAsync(compressed.uri);
  if (info.size && info.size > MAX_IMAGE_BYTES) {
    throw new Error("Image is too large (max 12 MB). Try another photo.");
  }

  const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return {
    kind: "json",
    body: {
      teamId,
      file: base64,
      mimetype: compressed.mimeType,
      content: "",
    },
  };
};
