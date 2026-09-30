import React from "react";
import { Image } from "react-native";

/** Generated Sofascore-style white glyph icons for Browse → Select Sport. */
export const BROWSE_SPORT_ICON_SOURCES = {
  Trending: require("../../assets/sports-images/browse-icons/browse-icon-trending.png"),
  Football: require("../../assets/sports-images/browse-icons/browse-icon-football.png"),
  Cricket: require("../../assets/sports-images/browse-icons/browse-icon-cricket.png"),
  Tennis: require("../../assets/sports-images/browse-icons/browse-icon-tennis.png"),
  Basketball: require("../../assets/sports-images/browse-icons/browse-icon-basketball.png"),
  "Table Tennis": require("../../assets/sports-images/browse-icons/browse-icon-tabletennis.png"),
  TableTennis: require("../../assets/sports-images/browse-icons/browse-icon-tabletennis.png"),
  Baseball: require("../../assets/sports-images/browse-icons/browse-icon-baseball.png"),
  Badminton: require("../../assets/sports-images/browse-icons/browse-icon-badminton.png"),
  Volleyball: require("../../assets/sports-images/browse-icons/browse-icon-volleyball.png"),
  Rugby: require("../../assets/sports-images/browse-icons/browse-icon-rugby.png"),
  "American football": require("../../assets/sports-images/browse-icons/browse-icon-rugby.png"),
  Hockey: require("../../assets/sports-images/browse-icons/browse-icon-hockey.png"),
  IceHockey: require("../../assets/sports-images/browse-icons/browse-icon-icehockey.png"),
  "Ice hockey": require("../../assets/sports-images/browse-icons/browse-icon-icehockey.png"),
  Pickleball: require("../../assets/sports-images/browse-icons/browse-icon-pickleball.png"),
};

export function BrowseSportIcon({ name, size = 26, color = "#FFFFFF" }) {
  const source =
    BROWSE_SPORT_ICON_SOURCES[String(name || "")] ||
    BROWSE_SPORT_ICON_SOURCES.Football;

  return (
    <Image
      source={source}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

export const BROWSE_SPORT_ORDER = [
  "Trending",
  "Football",
  "Cricket",
  "Tennis",
  "Basketball",
  "Table Tennis",
  "Baseball",
  "Badminton",
  "Volleyball",
  "Rugby",
  "Hockey",
  "IceHockey",
  "Pickleball",
];

export const browseSportLabel = (sport) => {
  if (sport === "IceHockey") return "Ice hockey";
  if (sport === "TableTennis" || sport === "Table Tennis") return "Table tennis";
  return sport;
};
