import "@/global.css";
import * as Sentry from "@sentry/react-native";
import * as SplashScreen from "expo-splash-screen";
import * as WebBrowser from "expo-web-browser";
import { useFonts } from "expo-font";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { BebasNeue_400Regular } from "@expo-google-fonts/bebas-neue";
import { configureTypography } from "@/lib/configureTypography";
import {
  Slot,
  useGlobalSearchParams,
  usePathname,
  useRouter,
  useSegments,
} from "expo-router";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PostHogProvider } from "posthog-react-native";
import ErrorBoundary from "@/components/ErrorBoundary";
import Loading from "@/components/Loading";
import OfflineBanner from "@/components/OfflineBanner";
import { BackendAuthProvider, useBackendAuth } from "@/context/BackendAuthContext";
import { AppearanceProvider } from "@/context/AppearanceContext";
import { NotificationBadgeProvider } from "@/context/NotificationBadgeContext";
import { ToastProvider } from "@/context/ToastContext";
import { LiveStreamProvider } from "@/context/LiveStreamContext";
import FloatingVideoPlayer from "@/components/FloatingVideoPlayer";
import { buildRedirectParam, parseRedirectParam } from "@/lib/authRedirect";
import { persistor, store } from "@/store";

WebBrowser.maybeCompleteAuthSession();

if (process.env.EXPO_PUBLIC_ENABLE_LIVEKIT === "true") {
  try {
    const { registerGlobals } = require("@livekit/react-native");
    registerGlobals();
  } catch (error) {
    console.warn("LiveKit init failed (expected in Expo Go):", error.message);
  }
}

const integrations = [];
const reactNativeTracingIntegration =
  Sentry["reactNativeTracingIntegration"];
const mobileVitalsIntegration = Sentry["mobileVitalsIntegration"];
const mobileReplayIntegration = Sentry["mobileReplayIntegration"];
const feedbackIntegration = Sentry["feedbackIntegration"];

if (typeof reactNativeTracingIntegration === "function") {
  integrations.push(reactNativeTracingIntegration());
}
if (typeof mobileVitalsIntegration === "function") {
  integrations.push(mobileVitalsIntegration());
}
if (typeof mobileReplayIntegration === "function") {
  integrations.push(mobileReplayIntegration());
}
if (typeof feedbackIntegration === "function") {
  integrations.push(feedbackIntegration());
}

/** Sentry's ExpoUpdatesListener loads expo-updates and crashes in Expo Go / dev without a native build. */
const filterSentryIntegrations = (defaults) =>
  defaults.filter((integration) => {
    if (integration?.name !== "ExpoUpdatesListener") return true;
    if (__DEV__) return false;
    try {
      const { requireNativeModule } = require("expo-modules-core");
      requireNativeModule("ExpoUpdates");
      return true;
    } catch {
      return false;
    }
  });

Sentry.init({
  dsn: "https://038e99eec12aa637ef520aa3bb20f688@o4509541569855488.ingest.us.sentry.io/4511194161545216",
  sendDefaultPii: true,
  enableLogs: true,
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: (defaults) => [
    ...filterSentryIntegrations(defaults),
    ...integrations,
  ],
  beforeSend(event) {
    if (event.request?.headers?.Authorization) {
      event.request.headers.Authorization = "[Filtered]";
    }
    return event;
  },
});

if (process.env.EXPO_PUBLIC_SENTRY_SEND_TEST === "true") {
  try {
    Sentry.logger.info("Sentry test: info log from app startup");
    Sentry.logger.warn("Sentry test: warn log from app startup", {
      log_type: "test",
    });
    Sentry.logger.error("Sentry test: error log from app startup");
    const user = "test_user";
    const action = "startup";
    Sentry.logger.info(
      Sentry.logger.fmt`User '${user}' performed '${action}'`,
    );
    console.log("Sentry test logs sent");
  } catch (error) {
    console.warn("Sentry test logging failed:", error.message);
  }
}

SplashScreen.preventAutoHideAsync().catch(() => {});

// Failsafe: always hide splash after 8s even if React tree never mounts
setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 8000);

const BOOTSTRAP_TIMEOUT_MS = 6000;

/** Avoid infinite splash when redux-persist rehydrate stalls on device. */
function usePersistorReady(persistor) {
  const [ready, setReady] = useState(() => persistor.getState().bootstrapped);

  useEffect(() => {
    if (persistor.getState().bootstrapped) {
      setReady(true);
      return undefined;
    }

    const unsub = persistor.subscribe(() => {
      if (persistor.getState().bootstrapped) {
        setReady(true);
      }
    });

    const timer = setTimeout(() => {
      if (__DEV__) {
        console.warn("[bootstrap] Persist rehydrate timed out — continuing");
      }
      setReady(true);
    }, BOOTSTRAP_TIMEOUT_MS);

    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [persistor]);

  return ready;
}

function AuthGate() {
  const { isLoaded, isSignedIn } = useBackendAuth();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const globalSearchParams = useGlobalSearchParams();
  const redirectParam = globalSearchParams?.redirect;
  const redirectTarget = useMemo(
    () => parseRedirectParam(redirectParam),
    [redirectParam],
  );

  useEffect(() => {
    if (!isLoaded) return;

    SplashScreen.hideAsync().catch(() => {});

    const inAuthGroup = segments[0] === "(auth)";
    const isPublicRoute =
      segments[0] === "team-join" ||
      segments[0] === "data-protection" ||
      segments[0] === "terms-of-use";
    if (isSignedIn && inAuthGroup) {
      if (redirectTarget?.pathname) {
        router.replace({
          pathname: redirectTarget.pathname,
          params: redirectTarget.params,
        });
      } else {
        router.replace("/(tabs)");
      }
    } else if (!isSignedIn && !inAuthGroup && !isPublicRoute) {
      const redirect = buildRedirectParam(pathname, globalSearchParams);
      if (redirect) {
        router.replace({
          pathname: "/(auth)/welcome",
          params: { redirect },
        });
      } else {
        router.replace("/(auth)/welcome");
      }
    }
  }, [
    globalSearchParams,
    isLoaded,
    isSignedIn,
    pathname,
    redirectTarget,
    router,
    segments,
  ]);

  if (!isLoaded) {
    return <Loading />;
  }

  return <Slot />;
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    BebasNeue_400Regular,
  });
  const [fontTimedOut, setFontTimedOut] = useState(false);
  const persistReady = usePersistorReady(persistor);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!fontsLoaded && !fontError) {
        if (__DEV__) {
          console.warn("[bootstrap] Font load timed out — continuing");
        }
        setFontTimedOut(true);
      }
    }, BOOTSTRAP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  const fontsReady = fontsLoaded || fontError || fontTimedOut;

  if (fontsReady) {
    configureTypography();
  }

  if (!fontsReady || !persistReady) {
    return <Loading />;
  }

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
            <SafeAreaProvider>
              <PostHogProvider
                apiKey={process.env.EXPO_PUBLIC_POSTHOG_API_KEY}
                options={{ host: process.env.EXPO_PUBLIC_POSTHOG_HOST }}
              >
                <ErrorBoundary>
                  <BackendAuthProvider>
                    <AppearanceProvider>
                      <NotificationBadgeProvider>
                        <ToastProvider>
                          <LiveStreamProvider>
                            <AuthGate />
                            <FloatingVideoPlayer />
                            <OfflineBanner />
                          </LiveStreamProvider>
                        </ToastProvider>
                      </NotificationBadgeProvider>
                    </AppearanceProvider>
                  </BackendAuthProvider>
                </ErrorBoundary>
              </PostHogProvider>
            </SafeAreaProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </PersistGate>
    </Provider>
  );
}

export default Sentry.wrap(RootLayout);
