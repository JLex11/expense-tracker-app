import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import * as LocalAuthentication from "expo-local-authentication";
import * as QuickActions from "expo-quick-actions";
import { useQuickActionRouting } from "expo-quick-actions/router";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform } from "react-native";
import "react-native-reanimated";
import "./globals.css";

import { seedCategories } from "@/database";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useI18n } from "@/hooks/useI18n";
import { savePrefs, usePrefs } from "@/hooks/usePrefs";
import { useSync } from "@/hooks/useSync";
import { isLoggedIn } from "@/services/auth";
import { evaluateBudgetAlerts } from "@/services/budget-alerts";
import { Text, TouchableOpacity, View } from "@/tw";
import { exportExpensesCSV } from "@/utils/export-csv";
import { SafeAreaProvider } from "react-native-safe-area-context";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const prefs = usePrefs();
  const { t } = useI18n();
  const { syncNow } = useSync();
  const [isLocked, setIsLocked] = useState(
    () => Platform.OS !== "web" && prefs.appLockEnabled,
  );
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const isAuthenticatingRef = useRef(false);
  const hasCheckedInitialLockRef = useRef(false);
  const isLockedRef = useRef(isLocked);
  const prefsRef = useRef(prefs);

  useQuickActionRouting();

  useEffect(() => {
    QuickActions.setItems([
      {
        id: "add_expense",
        title: t("addExpense"),
        icon:
          Platform.OS === "ios" ? "symbol:plus.circle.fill" : "shortcut_add",
        params: { href: "/(tabs)/transact" },
      },
      {
        id: "view_budget",
        title: t("viewBudget"),
        icon:
          Platform.OS === "ios" ? "symbol:chart.pie.fill" : "shortcut_budget",
        params: { href: "/(tabs)/budget" },
      },
      {
        id: "search",
        title: t("searchTransactions"),
        icon:
          Platform.OS === "ios" ? "symbol:magnifyingglass" : "shortcut_search",
        params: { href: "/(tabs)/budget" },
      },
      {
        id: "export_csv",
        title: t("exportCsv"),
        icon:
          Platform.OS === "ios"
            ? "symbol:square.and.arrow.up"
            : "shortcut_export",
        params: { href: "/(tabs)/profile" },
      },
    ]);
  }, [t]);

  useEffect(() => {
    const subscription = QuickActions.addListener((action) => {
      if (action.id === "export_csv") {
        exportExpensesCSV();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  const disableAppLock = useCallback(() => {
    const currentPrefs = prefsRef.current;
    if (!currentPrefs.appLockEnabled) return;
    savePrefs({ ...currentPrefs, appLockEnabled: false });
  }, []);

  const authenticateToUnlock = useCallback(async () => {
    if (Platform.OS === "web") {
      disableAppLock();
      setIsLocked(false);
      setLockMessage(null);
      return;
    }

    const currentPrefs = prefsRef.current;
    if (!currentPrefs.appLockEnabled || isAuthenticatingRef.current) {
      if (!currentPrefs.appLockEnabled) {
        setIsLocked(false);
        setLockMessage(null);
      }
      return;
    }

    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    setLockMessage(null);

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        disableAppLock();
        setIsLocked(false);
        setLockMessage(null);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t("promptUnlock"),
      });

      if (result.success) {
        setIsLocked(false);
        setLockMessage(null);
        return;
      }

      setIsLocked(true);
      setLockMessage(t("authFailedOrCanceled"));
    } catch (error) {
      console.error("App lock authentication failed", error);
      setIsLocked(true);
      setLockMessage(t("authFailed"));
    } finally {
      isAuthenticatingRef.current = false;
      setIsAuthenticating(false);
    }
  }, [disableAppLock, t]);

  const syncAppState = useCallback(async () => {
    try {
      await seedCategories();
    } catch (error) {
      console.error("Failed to seed local categories", error);
    }

    const logged = await isLoggedIn();
    if (logged) {
      try {
        await syncNow();
      } catch (error) {
        console.error("Failed to sync app state", error);
      }
    }

    try {
      await evaluateBudgetAlerts();
    } catch (error) {
      console.error("Failed to evaluate budget alerts", error);
    }
  }, [syncNow]);

  useEffect(() => {
    if (Platform.OS === "web") {
      if (prefs.appLockEnabled) {
        disableAppLock();
      }
      setIsLocked(false);
      setLockMessage(null);
      hasCheckedInitialLockRef.current = true;
      return;
    }

    if (!hasCheckedInitialLockRef.current) {
      hasCheckedInitialLockRef.current = true;
      if (prefs.appLockEnabled) {
        setIsLocked(true);
        void authenticateToUnlock();
      }
      return;
    }

    if (!prefs.appLockEnabled) {
      setIsLocked(false);
      setLockMessage(null);
    }
  }, [prefs.appLockEnabled, authenticateToUnlock, disableAppLock]);

  useEffect(() => {
    void syncAppState();
  }, [syncAppState]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const subscription = AppState.addEventListener("change", (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      const becameActive =
        (prevState === "background" || prevState === "inactive") &&
        nextState === "active";

      if (becameActive && prefsRef.current.appLockEnabled) {
        isLockedRef.current = true;
        setIsLocked(true);
        void authenticateToUnlock();
      }

      if (becameActive) {
        void syncAppState();
      }
    });

    return () => subscription.remove();
  }, [authenticateToUnlock, syncAppState]);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <View className="flex-1">
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="notifications"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="movement/[id]"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="quick-add"
              options={{
                presentation: "transparentModal",
                headerShown: false,
                animation: "fade",
              }}
            />
            <Stack.Screen
              name="modal"
              options={{ presentation: "modal", title: t("routeModalTitle") }}
            />
          </Stack>
          {isLocked && (
            <View className="absolute inset-0 items-center justify-center bg-slate-900/90 px-6">
              <View className="w-full max-w-85 rounded-[20px] border border-white/20 bg-slate-900 p-6">
                <Text className="mb-2 text-2xl font-bold text-white">
                  {t("appLock")}
                </Text>
                <Text className="mb-5 text-[15px] leading-5.5 text-gray-300">
                  {lockMessage ?? t("authContinue")}
                </Text>
                <TouchableOpacity
                  className="min-h-11.5 items-center justify-center rounded-xl bg-blue-600 py-3"
                  onPress={() => void authenticateToUnlock()}
                  disabled={isAuthenticating}
                >
                  {isAuthenticating ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-base font-semibold text-white">
                      {lockMessage ? t("retry") : t("unlock")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
