import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  formatGoogleAddressComponents,
  formatPlaceAutocompleteLabel,
} from "@/lib/formatLocation";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function GooglePlacesInput({
  value,
  onSelect,
  onFocus,
  onSuggestionsVisibilityChange,
  placeholder = "Search location...",
  containerStyle,
  inputStyle,
}) {
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    setQuery(value || "");
    setSuggestions([]);
  }, [value]);

  useEffect(() => {
    onSuggestionsVisibilityChange?.(suggestions.length > 0);
  }, [suggestions.length, onSuggestionsVisibilityChange]);

  const fetchSuggestions = async (text) => {
    if (!text || text.length < 2) {
      setSuggestions([]);
      return;
    }
    if (!GOOGLE_API_KEY) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_API_KEY}`,
      );
      const json = await res.json();
      setSuggestions(json.predictions || []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (text) => {
    setQuery(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fetchSuggestions(text), 350);
    if (text.length === 0) onSelect?.("");
  };

  const handleSelect = async (place) => {
    const fallbackLabel = formatPlaceAutocompleteLabel(place);
    setQuery(fallbackLabel);
    setSuggestions([]);
    try {
      if (GOOGLE_API_KEY && place.place_id) {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=geometry,formatted_address,address_components,name&key=${GOOGLE_API_KEY}`,
        );
        const json = await res.json();
        const result = json.result;
        const loc = result?.geometry?.location;
        const fromComponents = formatGoogleAddressComponents(
          result?.address_components || [],
        );
        const formatted = result?.formatted_address?.trim();
        const venueName = result?.name?.trim();
        const label =
          formatted ||
          fromComponents ||
          (venueName && formatted ? `${venueName}, ${formatted}` : venueName) ||
          fallbackLabel;
        setQuery(label);
        if (loc) {
          onSelect?.(label, { lat: loc.lat, lng: loc.lng });
          return;
        }
        onSelect?.(label, null);
        return;
      }
    } catch {
      /* fall through */
    }
    onSelect?.(fallbackLabel, null);
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    onSelect?.("");
  };

  return (
    <View style={[{ position: "relative", zIndex: 30 }, containerStyle]}>
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: T.inputBg,
            borderRadius: 12,
            paddingHorizontal: 14,
            height: 52,
            borderWidth: 1,
            borderColor: T.inputBorder,
          },
          inputStyle,
        ]}
      >
        <Ionicons
          name="location-outline"
          size={20}
          color={T.iconMuted}
          style={{ marginRight: 10 }}
        />
        <TextInput
          value={query}
          onChangeText={handleChange}
          onFocus={onFocus}
          placeholder={placeholder}
          placeholderTextColor={T.textMuted}
          style={{ flex: 1, fontSize: 15, color: T.text }}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading ? (
          <ActivityIndicator size="small" color={T.iconMuted} />
        ) : query.length > 0 ? (
          <TouchableOpacity
            onPress={handleClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={T.iconMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {suggestions.length > 0 && (
        <View
          style={{
            position: "absolute",
            top: 56,
            left: 0,
            right: 0,
            zIndex: 40,
            backgroundColor: T.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: T.border,
            marginTop: 4,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.35 : 0.12,
            shadowRadius: 8,
            elevation: 8,
            overflow: "hidden",
          }}
        >
          {suggestions.slice(0, 5).map((item, index) => (
            <TouchableOpacity
              key={item.place_id || index}
              onPress={() => handleSelect(item)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderBottomWidth:
                  index < Math.min(suggestions.length, 5) - 1 ? 1 : 0,
                borderBottomColor: T.borderSubtle,
              }}
            >
              <Ionicons
                name="location-outline"
                size={16}
                color={T.iconMuted}
                style={{ marginRight: 10 }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 14, color: T.text, fontWeight: "600" }}
                  numberOfLines={1}
                >
                  {item.structured_formatting?.main_text || item.description}
                </Text>
                {!!item.structured_formatting?.secondary_text && (
                  <Text
                    style={{ fontSize: 12, color: T.textDim, marginTop: 1 }}
                    numberOfLines={1}
                  >
                    {item.structured_formatting.secondary_text}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
