import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { ensurePhotoLibraryAccess } from "@/lib/photoLibraryAccess";
import { Image as ExpoImage } from "expo-image";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTeams } from "@/hooks/useTeams";
import GooglePlacesInput from "@/components/GooglePlacesInput";
import { getTeamByIdAPI } from "@/services/TeamApi";
import { goBackTo } from "@/lib/navigationBack";
import { CREATE_TEAM_SPORT_ICONS } from "@/constants/sports";
import { useAppearance } from "@/context/AppearanceContext";
import { getAppTheme } from "@/constants/appearanceTheme";

// Premium 3D object icons used for the first creation step.
const sportOptions = [
  { name: "Football", icon: CREATE_TEAM_SPORT_ICONS.Football, accent: "#B8F500" },
  { name: "Basketball", icon: CREATE_TEAM_SPORT_ICONS.Basketball, accent: "#FF7417" },
  { name: "Cricket", icon: CREATE_TEAM_SPORT_ICONS.Cricket, accent: "#B8F500" },
  { name: "Baseball", icon: CREATE_TEAM_SPORT_ICONS.Baseball, accent: "#FF304F" },
  { name: "Volleyball", icon: CREATE_TEAM_SPORT_ICONS.Volleyball, accent: "#258BFF" },
  { name: "Tennis", icon: CREATE_TEAM_SPORT_ICONS.Tennis, accent: "#71E8E2" },
  { name: "TableTennis", icon: CREATE_TEAM_SPORT_ICONS.TableTennis, accent: "#27B7FF" },
  { name: "Badminton", icon: CREATE_TEAM_SPORT_ICONS.Badminton, accent: "#C150FF" },
  { name: "Rugby", icon: CREATE_TEAM_SPORT_ICONS.Rugby, accent: "#F2A33A" },
  { name: "Hockey", icon: CREATE_TEAM_SPORT_ICONS.Hockey, accent: "#18D6F5" },
  { name: "IceHockey", icon: CREATE_TEAM_SPORT_ICONS.IceHockey, accent: "#2A7EFF" },
  { name: "Pickleball", icon: CREATE_TEAM_SPORT_ICONS.Pickleball, accent: "#5AF2B0" },
  { name: "Chess", icon: CREATE_TEAM_SPORT_ICONS.Chess, accent: "#A844FF" },
];

const teamTypeOptions = [
  { name: "Select / Travel", icon: "briefcase-outline" },
  { name: "Local League", icon: "home-outline" },
  { name: "School", icon: "school-outline" },
];

const ageGroupOptions = [
  { name: "Under 13", icon: "trending-up-outline" },
  { name: "Between 13-18", icon: "fitness-outline" },
  { name: "Over 18", icon: "trophy-outline" },
];

const seasonOptions = [
  { name: "Spring 2026", icon: "flower-outline" },
  { name: "Summer 2026", icon: "sunny-outline" },
  { name: "Fall 2026", icon: "leaf-outline" },
  { name: "Winter 2026-27", icon: "snow-outline" },
  { name: "Spring 2027", icon: "flower-outline" },
  { name: "Summer 2027", icon: "sunny-outline" },
  { name: "Fall 2027", icon: "leaf-outline" },
];

const teamLogoOptions = [
  { name: "Boxer", image: require("@/assets/team-logos/boxer.webp"), path: "/team-logos/boxer.webp" },
  { name: "Lion", image: require("@/assets/team-logos/female-lion.webp"), path: "/team-logos/female-lion.webp" },
  { name: "Hyena", image: require("@/assets/team-logos/hyna.webp"), path: "/team-logos/hyna.webp" },
  { name: "BlueBee", image: require("@/assets/team-logos/ice-monster.webp"), path: "/team-logos/ice-monster.webp" },
  { name: "Tiger", image: require("@/assets/team-logos/ice-tiger.webp"), path: "/team-logos/ice-tiger.webp" },
  // { name: "Hawk", image: require("@/assets/team-logos/policebird.webp"), path: "/team-logos/policebird.webp" },
  { name: "MrDog", image: require("@/assets/team-logos/white-dog.webp"), path: "/team-logos/white-dog.webp" },
  { name: "Puppy", image: require("@/assets/team-logos/yellow-dog.webp"), path: "/team-logos/yellow-dog.webp" },
  { name: "Player", image: require("@/assets/team-logos/wolf1.webp"), path: "/team-logos/wolf1.webp" },
  { name: "Mascot", image: require("@/assets/team-logos/mascot-skunk.webp"), path: "/team-logos/mascot-skunk.webp" },
];

const STEPS = [
  "Sport",
  "Team Type",
  "Age Group",
  "Location",
  "Team Name",
  "Season",
  "Team Logo",
];

const INITIAL_FORM = {
  step: 0,
  sport: "",
  teamType: "",
  ageGroup: "",
  location: "",
  teamName: "",
  season: "",
  teamlogo: "",
  customTeamLogo: null,
  error: "",
};

const CreateTeam = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const editModeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const editTeamIdParam = Array.isArray(params.teamId) ? params.teamId[0] : params.teamId;
  const isEditMode = editModeParam === "edit" && !!editTeamIdParam;
  const { createTeam, updateTeam } = useTeams();
  
  const { isDark } = useAppearance();
  const T = getAppTheme(isDark);

  const [step, setStep] = useState(0);
  const [sport, setSport] = useState("");
  const [teamType, setTeamType] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [location, setLocation] = useState("");
  const [teamName, setTeamName] = useState("");
  const [season, setSeason] = useState("");
  const [teamlogo, setTeamlogo] = useState("");
  const [customTeamLogo, setCustomTeamLogo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);

  const isKnownLogo = useMemo(
    () => teamLogoOptions.some((logo) => logo.path === teamlogo),
    [teamlogo]
  );

  const isRemoteTeamLogo =
    !customTeamLogo &&
    !!teamlogo &&
    typeof teamlogo === "string" &&
    /^https?:\/\//i.test(teamlogo) &&
    !isKnownLogo;

  const resetCreateForm = useCallback(() => {
    setStep(INITIAL_FORM.step);
    setSport(INITIAL_FORM.sport);
    setTeamType(INITIAL_FORM.teamType);
    setAgeGroup(INITIAL_FORM.ageGroup);
    setLocation(INITIAL_FORM.location);
    setTeamName(INITIAL_FORM.teamName);
    setSeason(INITIAL_FORM.season);
    setTeamlogo(INITIAL_FORM.teamlogo);
    setCustomTeamLogo(INITIAL_FORM.customTeamLogo);
    setError(INITIAL_FORM.error);
    setLoading(false);
    setFormKey((k) => k + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isEditMode) return;

      const rawSport = paramsRef.current?.sport;
      const incomingSport = Array.isArray(rawSport) ? rawSport[0] : rawSport;

      resetCreateForm();

      // Preselect sport from home "Pick a Sport" (and similar entry points).
      if (incomingSport) {
        const normalized = String(incomingSport).replace(/\s+/g, "");
        const match = sportOptions.find(
          (s) => s.name.toLowerCase() === normalized.toLowerCase(),
        );
        if (match) setSport(match.name);
      }

      // Clear one-shot params. Do not depend on sportParam in this callback —
      // clearing it would re-run the effect and wipe the selection.
      if (
        paramsRef.current?.mode != null ||
        paramsRef.current?.teamId != null ||
        paramsRef.current?.sport != null
      ) {
        router.setParams({ mode: undefined, teamId: undefined, sport: undefined });
      }
    }, [isEditMode, resetCreateForm, router]),
  );

  useEffect(() => {
    let mounted = true;

    const hydrateTeam = async () => {
      if (!isEditMode || !editTeamIdParam) {
        setInitialLoading(false);
        return;
      }

      setInitialLoading(true);
      setError("");

      try {
        const result = await getTeamByIdAPI(editTeamIdParam);
        const team = result?.data || result?.team || result;
        if (!mounted || !team) return;

        setSport(team.sport || "");
        setTeamType(team.teamType || "");
        setAgeGroup(team.ageGroup || "");
        setLocation(team.location || "");
        setTeamName(team.teamName || "");
        setSeason(team.season || "");
        setTeamlogo(team.teamlogo || "");
        setCustomTeamLogo(null);
      } catch (err) {
        if (mounted) {
          setError(err?.response?.data?.message || err?.message || "Failed to load team");
        }
      } finally {
        if (mounted) setInitialLoading(false);
      }
    };

    hydrateTeam();
    return () => {
      mounted = false;
    };
  }, [editTeamIdParam, isEditMode]);

  const canProceed = () => {
    if (initialLoading) return false;

    switch (step) {
      case 0: return !!sport;
      case 1: return !!teamType;
      case 2: return !!ageGroup;
      case 3: return !!location.trim();
      case 4: return teamName.trim().length >= 3;
      case 5: return !!season;
      case 6: return !!teamlogo || !!customTeamLogo;
      default: return false;
    }
  };

  const pickCustomTeamLogo = async () => {
    const allowed = await ensurePhotoLibraryAccess();
    if (!allowed) {
      Alert.alert("Permission needed", "Please allow access to your photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setCustomTeamLogo(asset);
    setTeamlogo(asset.uri || "");
    setError("");
  };



  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      setError("");
    } else {
      handleCreate();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
      setError("");
    }
  };

  const handleCreate = async () => {
    setError("");
    setLoading(true);
    try {
      const payload = customTeamLogo
        ? (() => {
            const formData = new FormData();
            formData.append("teamName", teamName.trim());
            formData.append("sport", sport);
            formData.append("teamType", teamType);
            formData.append("ageGroup", ageGroup);
            formData.append("location", location.trim());
            formData.append("season", season);
            formData.append("teamlogoFile", {
              uri: customTeamLogo.uri,
              type: customTeamLogo.mimeType || "image/jpeg",
              name: customTeamLogo.fileName || `team-logo-${Date.now()}.jpg`,
            });
            return formData;
          })()
        : {
            teamName: teamName.trim(),
            sport,
            teamType,
            ageGroup,
            location: location.trim(),
            season,
            teamlogo,
          };

      if (isEditMode) {
        await updateTeam(editTeamIdParam, payload);
      } else {
        await createTeam(payload);
        resetCreateForm();
      }

      Alert.alert("Success", isEditMode ? "Team updated successfully!" : "Team created successfully!", [
        {
          text: "OK",
          onPress: () => {
            if (!isEditMode) {
              resetCreateForm();
            }
            router.replace("/(tabs)/teams");
          },
        },
      ]);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || (isEditMode ? "Failed to update team" : "Failed to create team")
      );
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }} className="items-center justify-center px-6">
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <ActivityIndicator size="large" color={T.text} />
        <Text style={{ color: T.textDim }} className="font-semibold mt-4">Loading team details...</Text>
      </View>
    );
  }

  const renderStepContent = () => {
    switch (step) {
      // Step 0: Sport Selection
      case 0:
        return (
          <View>
            <Text style={{ color: T.text }} className="text-lg font-bold mb-1">Select your sport</Text>
            <Text style={{ color: T.textDim }} className="text-sm mb-5">Choose the sport your team plays</Text>
            <View className="flex-row flex-wrap justify-between">
              {sportOptions.map((s) => {
                const selected = sport === s.name;
                return (
                  <TouchableOpacity
                    key={s.name}
                    onPress={() => setSport(s.name)}
                    activeOpacity={0.82}
                    className="w-[23%] items-center mb-4 rounded-2xl"
                    style={{
                      backgroundColor: T.surface,
                      borderWidth: 2,
                      borderColor: selected ? "#9AEA62" : (isDark ? `${s.accent}35` : T.border),
                      height: 80,
                      marginTop: 26,
                      shadowColor: s.accent,
                      shadowOpacity: selected ? 0.18 : (isDark ? 0.08 : 0.04),
                      shadowRadius: selected ? 9 : 5,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: selected ? 4 : 2,
                    }}
                  >
                    <Svg
                      width="125%"
                      height={76}
                      viewBox="0 0 100 76"
                      pointerEvents="none"
                      style={{ position: "absolute", top: -17 }}
                    >
                      <Defs>
                        <RadialGradient
                          id={`sport-glow-${s.name}`}
                          cx="40%"
                          cy="42%"
                          r="60%"
                        >
                          <Stop
                            offset="0%"
                            stopColor={s.accent}
                            stopOpacity={selected ? (isDark ? 0.46 : 0.32) : (isDark ? 0.34 : 0.22)}
                          />
                          <Stop offset="48%" stopColor={s.accent} stopOpacity={isDark ? 0.16 : 0.08} />
                          <Stop offset="100%" stopColor={s.accent} stopOpacity="0" />
                        </RadialGradient>
                      </Defs>
                      <Ellipse
                        cx="50"
                        cy="36"
                        rx="46"
                        ry="31"
                        fill={`url(#sport-glow-${s.name})`}
                      />
                    </Svg>
                    <View
                      style={{
                        position: "absolute",
                        top: -35,
                        width: 74,
                        height: 74,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "transparent",
                        shadowColor: s.accent,
                        shadowOpacity: selected ? 0.3 : 0.2,
                        shadowRadius: 9,
                        shadowOffset: { width: 0, height: 5 },
                      }}
                    >
                      <ExpoImage
                        source={s.icon}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        transition={0}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{
                        marginTop: 50,
                        color: selected ? "#BAF072" : T.text,
                      }}
                      className="text-[10px] font-bold"
                    >
                      {s.name === "TableTennis"
                        ? "Table Tennis"
                        : s.name === "IceHockey"
                          ? "Ice Hockey"
                          : s.name}
                    </Text>
                    {selected ? (
                      <View className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#BAF072] items-center justify-center">
                        <Ionicons name="checkmark" size={14} color="#0B1324" />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      // Step 1: Team Type
      case 1:
        return (
          <View>
            <Text style={{ color: T.text }} className="text-lg font-bold mb-1">Team type</Text>
            <Text style={{ color: T.textDim }} className="text-sm mb-5">What kind of team is this?</Text>
            {teamTypeOptions.map((t) => (
              <TouchableOpacity
                key={t.name}
                onPress={() => setTeamType(t.name)}
                className="flex-row items-center p-4 mb-3 rounded-xl"
                style={{
                  backgroundColor: teamType === t.name ? (isDark ? "#1A3A1F" : "#dcfce7") : T.surface,
                  borderWidth: 2,
                  borderColor: teamType === t.name ? "#16a34a" : T.border,
                }}
              >
                <Ionicons
                  name={t.icon}
                  size={24}
                  color={teamType === t.name ? "#16a34a" : T.textDim}
                />
                <Text
                  style={{ color: teamType === t.name ? "#16a34a" : T.text }}
                  className="text-[15px] ml-3 font-semibold"
                >
                  {t.name}
                </Text>
                {teamType === t.name && (
                  <Ionicons name="checkmark-circle" size={22} color="#16a34a" style={{ marginLeft: "auto" }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        );

      // Step 2: Age Group
      case 2:
        return (
          <View>
            <Text style={{ color: T.text }} className="text-lg font-bold mb-1">Age group</Text>
            <Text style={{ color: T.textDim }} className="text-sm mb-5">Select the age range for your team</Text>
            {ageGroupOptions.map((a) => (
              <TouchableOpacity
                key={a.name}
                onPress={() => setAgeGroup(a.name)}
                className="flex-row items-center p-4 mb-3 rounded-xl"
                style={{
                  backgroundColor: ageGroup === a.name ? (isDark ? "#1A3A1F" : "#dcfce7") : T.surface,
                  borderWidth: 2,
                  borderColor: ageGroup === a.name ? "#16a34a" : T.border,
                }}
              >
                <Ionicons
                  name={a.icon}
                  size={24}
                  color={ageGroup === a.name ? "#16a34a" : T.textDim}
                />
                <Text
                  style={{ color: ageGroup === a.name ? "#16a34a" : T.text }}
                  className="text-[15px] ml-3 font-semibold"
                >
                  {a.name}
                </Text>
                {ageGroup === a.name && (
                  <Ionicons name="checkmark-circle" size={22} color="#16a34a" style={{ marginLeft: "auto" }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        );

      // Step 3: Location
      case 3:
        return (
          <View>
            <Text style={{ color: T.text }} className="text-lg font-bold mb-1">Location</Text>
            <Text style={{ color: T.textDim }} className="text-sm mb-5">Where is your team based?</Text>
            <GooglePlacesInput
              key={`location-${formKey}`}
              value={location}
              onSelect={setLocation}
              placeholder="City, State"
              inputStyle={{
                backgroundColor: T.surface,
                borderWidth: 2,
                borderColor: T.border,
              }}
            />
          </View>
        );

      // Step 4: Team Name
      case 4:
        return (
          <View>
            <Text style={{ color: T.text }} className="text-lg font-bold mb-1">Team name</Text>
            <Text style={{ color: T.textDim }} className="text-sm mb-5">Choose a name for your team (min 3 characters)</Text>
            <View className="flex-row items-center rounded-xl px-4 h-13" style={{ backgroundColor: T.surface, borderWidth: 2, borderColor: T.border }}>
              <Ionicons name="people-outline" size={20} color={T.textDim} style={{ marginRight: 10 }} />
              <TextInput
                value={teamName}
                onChangeText={setTeamName}
                placeholder="Enter team name"
                placeholderTextColor={T.textDim}
                maxLength={40}
                style={{ color: T.text }}
                className="flex-1 text-[15px]"
              />
            </View>
          </View>
        );

      // Step 5: Season
      case 5:
        return (
          <View>
            <Text style={{ color: T.text }} className="text-lg font-bold mb-1">Season</Text>
            <Text style={{ color: T.textDim }} className="text-sm mb-5">Which season is this team for?</Text>
            {seasonOptions.map((s) => (
              <TouchableOpacity
                key={s.name}
                onPress={() => setSeason(s.name)}
                className="flex-row items-center p-4 mb-3 rounded-xl"
                style={{
                  backgroundColor: season === s.name ? (isDark ? "#1A3A1F" : "#dcfce7") : T.surface,
                  borderWidth: 2,
                  borderColor: season === s.name ? "#16a34a" : T.border,
                }}
              >
                <Ionicons
                  name={s.icon}
                  size={24}
                  color={season === s.name ? "#16a34a" : T.textDim}
                />
                <Text
                  style={{ color: season === s.name ? "#16a34a" : T.text }}
                  className="text-[15px] ml-3 font-semibold"
                >
                  {s.name}
                </Text>
                {season === s.name && (
                  <Ionicons name="checkmark-circle" size={22} color="#16a34a" style={{ marginLeft: "auto" }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        );

      // Step 6: Team Logo
      case 6:
        return (
          <View>
            <Text style={{ color: T.text }} className="text-lg font-bold mb-1">Team logo</Text>
            <Text style={{ color: T.textDim }} className="text-sm mb-5">Pick a mascot or upload your own team logo</Text>
            <TouchableOpacity
              onPress={pickCustomTeamLogo}
              className="flex-row items-center justify-center border-2 border-dashed rounded-xl px-4 py-4 mb-4"
              style={{ backgroundColor: T.surface, borderColor: T.border }}
            >
              <Ionicons name="cloud-upload-outline" size={20} color={T.text} />
              <Text style={{ color: T.text }} className="font-semibold ml-2">Browse from device</Text>
            </TouchableOpacity>

            {customTeamLogo ? (
              <View className="border-2 border-green-500 rounded-xl p-3 mb-4" style={{ backgroundColor: T.surface }}>
                <View className="flex-row items-center">
                  <Image source={{ uri: customTeamLogo.uri }} style={{ width: 56, height: 56, borderRadius: 28 }} />
                  <View className="flex-1 ml-3">
                    <Text className="text-sm font-bold text-green-700">Custom logo selected</Text>
                    <Text style={{ color: T.textDim }} className="text-xs">This uploaded image will be used for your team.</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setCustomTeamLogo(null);
                      setTeamlogo("");
                    }}
                    className="w-8 h-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: isDark ? "#2A2A2E" : "#F3F4F6" }}
                  >
                    <Ionicons name="close" size={16} color={T.textDim} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {isRemoteTeamLogo ? (
              <View className="border-2 border-green-500 rounded-xl p-3 mb-4" style={{ backgroundColor: T.surface }}>
                <View className="flex-row items-center">
                  <Image source={{ uri: teamlogo }} style={{ width: 56, height: 56, borderRadius: 28 }} />
                  <View className="flex-1 ml-3">
                    <Text className="text-sm font-bold text-green-700">Current uploaded logo</Text>
                    <Text style={{ color: T.textDim }} className="text-xs">Keep this logo or browse to replace it.</Text>
                  </View>
                </View>
              </View>
            ) : null}

            <View className="flex-row flex-wrap justify-between">
              {teamLogoOptions.map((logo) => (
                <TouchableOpacity
                  key={logo.name}
                  onPress={() => {
                    setCustomTeamLogo(null);
                    setTeamlogo(logo.path);
                  }}
                  className="w-[31%] items-center p-3 mb-3 rounded-xl"
                  style={{
                    backgroundColor: teamlogo === logo.path ? (isDark ? "#1A3A1F" : "#dcfce7") : T.surface,
                    borderWidth: 2,
                    borderColor: teamlogo === logo.path ? "#16a34a" : T.border,
                  }}
                >
                  <Image source={logo.image} style={{ width: 56, height: 56 }} resizeMode="contain" />
                  <Text
                    style={{ color: teamlogo === logo.path ? "#16a34a" : T.text }}
                    className="text-xs mt-2 font-semibold"
                  >
                    {logo.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Progress Bar */}
        <View className="px-5 pt-10 pb-2">
          <View className="flex-row items-center justify-between mb-2">
            {step > 0 ? (
              <TouchableOpacity onPress={handleBack} className="p-1">
                <Ionicons name="arrow-back" size={24} color={T.text} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => goBackTo(router)} className="p-1">
                <Ionicons name="close" size={24} color={T.text} />
              </TouchableOpacity>
            )}
            <Text style={{ color: T.textDim }} className="text-sm font-medium">
              Step {step + 1} of {STEPS.length}
            </Text>
          </View>
          <View className="flex-row h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? "#2A2A2E" : "#D1D5DB" }}>
            <View
              className="bg-green-500 rounded-full"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </View>
        </View>

        <ScrollView
          className="flex-1 px-5 pt-2"
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Error */}
          {error ? (
            <View className="bg-red-500/10 border border-red-400 rounded-xl px-4 py-3 mb-4">
              <Text className="text-red-600 text-[13px] text-center">{error}</Text>
            </View>
          ) : null}

          {renderStepContent()}
        </ScrollView>

        {/* Bottom Button — above tab bar */}
        <View className="px-5 pt-3 pb-2" style={{ marginBottom: 150 }}>
          <TouchableOpacity
            onPress={handleNext}
            disabled={!canProceed() || loading}
            activeOpacity={0.8}
            className="py-4 rounded-xl items-center"
            style={{
              backgroundColor: canProceed() && !loading ? (isDark ? "#F0F0F0" : "#111827") : (isDark ? "#3A3A3E" : "#9CA3AF"),
            }}
          >
            {loading ? (
              <ActivityIndicator color={isDark ? "#000" : "#fff"} />
            ) : (
              <Text style={{ color: canProceed() && !loading ? (isDark ? "#000" : "#fff") : (isDark ? "#6B7280" : "#fff") }} className="font-bold text-[16px]">
                {step === STEPS.length - 1 ? (isEditMode ? "Update Team" : "Create Team") : "Continue"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default CreateTeam;