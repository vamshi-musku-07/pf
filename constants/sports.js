// Single source of truth for sport icons and metadata.
// Import from here instead of duplicating across files.

export const SPORT_ICONS = {
  Football: require("../assets/sports-images/footballicon.png"),
  Basketball: require("../assets/sports-images/basketballicon.png"),
  Cricket: require("../assets/sports-images/cricket.png"),
  Badminton: require("../assets/sports-images/badmintonicon.png"),
  Volleyball: require("../assets/sports-images/volleyballicon.png"),
  Tennis: require("../assets/sports-images/tennisicon.png"),
  "Table Tennis": require("../assets/sports-images/tabletennisicon.png"),
  TableTennis: require("../assets/sports-images/tabletennisicon.png"),
  Baseball: require("../assets/sports-images/baseballicon.png"),
  Rugby: require("../assets/sports-images/rugbyicon.png"),
  Hockey: require("../assets/sports-images/hockeyicon.png"),
  IceHockey: require("../assets/sports-images/icehockeyicon.png"),
  Pickleball: require("../assets/sports-images/pickleballicon.png"),
  Chess: require("../assets/sports-images/chessicon.png"),
};

/** Photoreal featured tiles used on the home horizontal sports row (compressed JPG). */
export const FEATURED_SPORT_IMAGES = {
  Football: require("../assets/sports-images/featured-football.jpg"),
  Basketball: require("../assets/sports-images/featured-basketball.jpg"),
  Cricket: require("../assets/sports-images/featured-cricket.jpg"),
  Badminton: require("../assets/sports-images/featured-badminton.jpg"),
  Volleyball: require("../assets/sports-images/featured-volleyball.jpg"),
  Tennis: require("../assets/sports-images/featured-tennis.jpg"),
  "Table Tennis": require("../assets/sports-images/featured-tabletennis.jpg"),
  TableTennis: require("../assets/sports-images/featured-tabletennis.jpg"),
  Baseball: require("../assets/sports-images/featured-baseball.jpg"),
  Rugby: require("../assets/sports-images/featured-rugby.jpg"),
  Hockey: require("../assets/sports-images/featured-hockey.jpg"),
  IceHockey: require("../assets/sports-images/featured-icehockey.jpg"),
  Pickleball: require("../assets/sports-images/featured-pickleball.jpg"),
  Chess: require("../assets/sports-images/featured-chess.jpg"),
};

/** Playful 3D object icons used by the create-team sport picker. */
export const CREATE_TEAM_SPORT_ICONS = {
  Football: require("../assets/sports-images/create-icon-football-transparent.png"),
  Basketball: require("../assets/sports-images/create-icon-basketball-transparent.png"),
  Cricket: require("../assets/sports-images/create-icon-cricket-transparent.png"),
  Baseball: require("../assets/sports-images/create-icon-baseball-transparent.png"),
  Volleyball: require("../assets/sports-images/create-icon-volleyball-transparent.png"),
  Tennis: require("../assets/sports-images/create-icon-tennis-transparent.png"),
  "Table Tennis": require("../assets/sports-images/create-icon-tabletennis-transparent.png"),
  TableTennis: require("../assets/sports-images/create-icon-tabletennis-transparent.png"),
  Badminton: require("../assets/sports-images/create-icon-badminton-transparent.png"),
  Rugby: require("../assets/sports-images/create-icon-rugby-transparent.png"),
  Hockey: require("../assets/sports-images/create-icon-hockey-transparent.png"),
  IceHockey: require("../assets/sports-images/create-icon-icehockey-transparent.png"),
  Pickleball: require("../assets/sports-images/create-icon-pickleball-transparent.png"),
  Chess: require("../assets/sports-images/create-icon-chess-transparent.png"),
};

/** Scene-style 3D card art for home "Pick a Sport" (white header + scene bottom). */
export const HOME_PICK_SPORT_ICONS = {
  Football: require("../assets/sports-images/pick-sport-football.jpg"),
  Basketball: require("../assets/sports-images/pick-sport-basketball.jpg"),
  Cricket: require("../assets/sports-images/pick-sport-cricket.jpg"),
  Baseball: require("../assets/sports-images/pick-sport-baseball.jpg"),
  Volleyball: require("../assets/sports-images/pick-sport-volleyball.jpg"),
  Tennis: require("../assets/sports-images/pick-sport-tennis.jpg"),
  "Table Tennis": require("../assets/sports-images/pick-sport-tabletennis.jpg"),
  TableTennis: require("../assets/sports-images/pick-sport-tabletennis.jpg"),
  Badminton: require("../assets/sports-images/pick-sport-badminton.jpg"),
  Rugby: require("../assets/sports-images/pick-sport-rugby.jpg"),
  Hockey: require("../assets/sports-images/pick-sport-hockey.jpg"),
  IceHockey: require("../assets/sports-images/pick-sport-icehockey.jpg"),
  Pickleball: require("../assets/sports-images/pick-sport-pickleball.jpg"),
  Chess: require("../assets/sports-images/pick-sport-chess.jpg"),
};

/** Dark-theme Pick a Sport scenes (black header + scene bottom). */
export const HOME_PICK_SPORT_ICONS_DARK = {
  Football: require("../assets/sports-images/pick-sport-dark-football.jpg"),
  Basketball: require("../assets/sports-images/pick-sport-dark-basketball.jpg"),
  Cricket: require("../assets/sports-images/pick-sport-dark-cricket.jpg"),
  Baseball: require("../assets/sports-images/pick-sport-dark-baseball.jpg"),
  Volleyball: require("../assets/sports-images/pick-sport-dark-volleyball.jpg"),
  Tennis: require("../assets/sports-images/pick-sport-dark-tennis.jpg"),
  "Table Tennis": require("../assets/sports-images/pick-sport-dark-tabletennis.jpg"),
  TableTennis: require("../assets/sports-images/pick-sport-dark-tabletennis.jpg"),
  Badminton: require("../assets/sports-images/pick-sport-dark-badminton.jpg"),
  Rugby: require("../assets/sports-images/pick-sport-dark-rugby.jpg"),
  Hockey: require("../assets/sports-images/pick-sport-dark-hockey.jpg"),
  IceHockey: require("../assets/sports-images/pick-sport-dark-icehockey.jpg"),
  Pickleball: require("../assets/sports-images/pick-sport-dark-pickleball.jpg"),
  Chess: require("../assets/sports-images/pick-sport-dark-chess.jpg"),
};

export const DEFAULT_SPORT_ICON = require("../assets/sports-images/footballicon.png");

export const SPORTS_LIST = [
  {
    name: "Football",
    icon: FEATURED_SPORT_IMAGES.Football,
    href: "/football",
    color: "#2382F2",
    gradient: ["#2382F2", "#1a5fc2"],
  },
  {
    name: "Basketball",
    icon: FEATURED_SPORT_IMAGES.Basketball,
    href: "/basketball",
    color: "#FF6518",
    gradient: ["#FF6518", "#e54d00"],
  },
  {
    name: "Baseball",
    icon: FEATURED_SPORT_IMAGES.Baseball,
    href: "/baseball",
    color: "#E51733",
    gradient: ["#E51733", "#c1132b"],
  },
  {
    name: "Rugby",
    icon: FEATURED_SPORT_IMAGES.Rugby,
    href: "/rugby",
    color: "#DE9444",
    gradient: ["#DE9444", "#c67a2a"],
  },
  {
    name: "Cricket",
    icon: FEATURED_SPORT_IMAGES.Cricket,
    href: "/cricket",
    color: "#9AEA62",
    gradient: ["#9AEA62", "#7bc842"],
  },
  {
    name: "Volleyball",
    icon: FEATURED_SPORT_IMAGES.Volleyball,
    href: "/volleyball",
    color: "#2382F2",
    gradient: ["#2382F2", "#1a5fc2"],
  },
  {
    name: "Tennis",
    icon: FEATURED_SPORT_IMAGES.Tennis,
    href: "/tennis",
    color: "#0f100a",
    gradient: ["#D7FF38", "#b8dc26"],
  },
  {
    name: "Table Tennis",
    icon: FEATURED_SPORT_IMAGES["Table Tennis"],
    href: "/table-tennis",
    color: "#FF6518",
    gradient: ["#FF6518", "#e54d00"],
  },
  {
    name: "Badminton",
    icon: FEATURED_SPORT_IMAGES.Badminton,
    href: "/badminton",
    color: "#DE9444",
    gradient: ["#DE9444", "#c67a2a"],
  },
  {
    name: "Hockey",
    icon: FEATURED_SPORT_IMAGES.Hockey,
    href: "/hockey",
    color: "#5B7180",
    gradient: ["#5B7180", "#455666"],
  },
  {
    name: "IceHockey",
    icon: FEATURED_SPORT_IMAGES.IceHockey,
    href: "/ice-hockey",
    color: "#4A90D9",
    gradient: ["#4A90D9", "#3670b0"],
  },
  {
    name: "Pickleball",
    icon: FEATURED_SPORT_IMAGES.Pickleball,
    href: "/pickleball",
    color: "#9AEA62",
    gradient: ["#9AEA62", "#7bc842"],
  },
  {
    name: "Chess",
    icon: FEATURED_SPORT_IMAGES.Chess,
    href: "/chess",
    color: "#8B6914",
    gradient: ["#8B6914", "#6b4e0f"],
  },
];
