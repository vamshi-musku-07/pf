import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import KeyboardBottomSheet from "@/components/KeyboardBottomSheet";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";
import { buildAdminRows } from "@/features/tournament/manageConfig";

export default function AdminsSheet({
  visible,
  tournament,
  profiles = {},
  isOwner,
  busy,
  onClose,
  onAddByEmail,
  onRemove,
}) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (visible) setEmail("");
  }, [visible]);

  const rows = buildAdminRows(tournament || {}, profiles);

  const handleAdd = () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    onAddByEmail(trimmed);
  };

  return (
    <KeyboardBottomSheet
      visible={visible}
      onClose={onClose}
      contentPadding={20}
      sheetBackgroundColor={isDark ? T.surface : "#fff"}
      footerBorderColor={isDark ? T.border : "#F3F4F6"}
    >
      <Text style={{ fontSize: 18, fontWeight: "800", color: isDark ? T.text : "#0B1324", marginBottom: 2 }}>League admins</Text>
      <Text style={{ fontSize: 12, color: isDark ? T.textMuted : "#9CA3AF", marginBottom: 16 }}>
        Co-admins can manage teams, fixtures, scoring and results. Only the owner can add or remove admins.
      </Text>

      {rows.map((row) => (
        <View
          key={row.userId}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: isDark ? T.border : "#F1F5F9",
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: row.isOwner ? "#0B1324" : isDark ? T.surfaceAlt : "#F1F5F9",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
            }}
          >
            <Ionicons name={row.isOwner ? "ribbon" : "person"} size={16} color={row.isOwner ? "#BAF072" : isDark ? T.iconMuted : "#64748B"} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: isDark ? T.text : "#0B1324" }} numberOfLines={1}>
              {row.name}
            </Text>
            <Text style={{ fontSize: 11, color: isDark ? T.textMuted : "#9CA3AF", marginTop: 2 }} numberOfLines={1}>
              {row.isOwner ? "Owner" : row.email || "Co-admin"}
            </Text>
          </View>
          {isOwner && !row.isOwner ? (
            <TouchableOpacity onPress={() => onRemove(row)} disabled={busy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={20} color={isDark ? "#F87171" : "#EF4444"} />
            </TouchableOpacity>
          ) : null}
        </View>
      ))}

      {isOwner ? (
        <>
          <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? T.textDim : "#6B7280", marginTop: 18, marginBottom: 6 }}>
            Add co-admin by email
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor={isDark ? T.textMuted : "#9CA3AF"}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!busy}
              style={{
                flex: 1,
                backgroundColor: isDark ? T.surfaceAlt : "#F8FAFC",
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                color: isDark ? T.text : "#0B1324",
                borderWidth: 1,
                borderColor: isDark ? T.border : "#E5E7EB",
              }}
            />
            <TouchableOpacity
              onPress={handleAdd}
              disabled={busy || !email.trim()}
              style={{
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: "#0B1324",
                alignItems: "center",
                justifyContent: "center",
                opacity: busy || !email.trim() ? 0.5 : 1,
                ...(isDark && { borderWidth: 1, borderColor: T.border }),
              }}
            >
              {busy ? <ActivityIndicator color="#BAF072" size="small" /> : <Text style={{ color: "#BAF072", fontWeight: "800" }}>Add</Text>}
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 11, color: isDark ? T.textMuted : "#9CA3AF", marginTop: 8, lineHeight: 16 }}>
            The person must already have a PlayFlash account with this email.
          </Text>
        </>
      ) : null}
    </KeyboardBottomSheet>
  );
}
