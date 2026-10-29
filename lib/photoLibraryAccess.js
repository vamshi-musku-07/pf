import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

/**
 * Android opens the system photo picker, which does not need
 * READ_MEDIA_IMAGES or READ_MEDIA_VIDEO. iOS still asks for photo access.
 * @returns {Promise<boolean>}
 */
export async function ensurePhotoLibraryAccess() {
  if (Platform.OS !== "ios") return true;
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return permission.granted === true || permission.status === "granted";
}
