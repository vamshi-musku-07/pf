/** Build "Hitech City, Hyderabad" style label from Expo reverse-geocode result. */
export function formatLocationFromGeocode(geo) {
  if (!geo) return "";

  const city = (geo.city || geo.subregion || geo.region || "").trim();
  const area = (
    geo.district ||
    geo.name ||
    geo.street ||
    geo.streetNumber ||
    ""
  ).trim();

  if (area && city && area.toLowerCase() !== city.toLowerCase()) {
    return `${area}, ${city}`;
  }
  return city || area || "";
}

/** Autocomplete row label — use Google's full description when available. */
export function formatPlaceAutocompleteLabel(place) {
  if (!place) return "";
  if (place.description?.trim()) return place.description.trim();
  const main = place.structured_formatting?.main_text?.trim();
  const secondary = place.structured_formatting?.secondary_text?.trim();
  if (main && secondary) return `${main}, ${secondary}`;
  return main || "";
}

/** Google Place Details address_components → full street + area + city + state. */
export function formatGoogleAddressComponents(components = []) {
  const get = (type) =>
    components.find((c) => Array.isArray(c.types) && c.types.includes(type))?.long_name;

  const streetNumber = get("street_number");
  const route = get("route");
  const premise = get("premise") || get("establishment") || get("point_of_interest");
  const sublocality =
    get("sublocality_level_1") ||
    get("sublocality_level_2") ||
    get("sublocality");
  const neighborhood = get("neighborhood");
  const city =
    get("locality") ||
    get("postal_town") ||
    get("administrative_area_level_2");
  const state = get("administrative_area_level_1");
  const postalCode = get("postal_code");

  const streetLine = [streetNumber, route].filter(Boolean).join(" ").trim();

  const parts = [];
  const seen = new Set();
  const add = (val) => {
    const text = String(val || "").trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    parts.push(text);
  };

  add(premise);
  add(streetLine);
  if (!streetLine) add(route);
  add(sublocality);
  add(neighborhood);
  add(city);
  add(state);
  add(postalCode);

  return parts.join(", ");
}
