import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as LocalAuthentication from "expo-local-authentication";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	AppState,
	Platform,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import "react-native-reanimated";
import "./globals.css";

import { seedCategories } from "@/database";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { savePrefs, usePrefs } from "@/hooks/usePrefs";
import { SafeAreaProvider } from "react-native-safe-area-context";

export const unstable_settings = {
	initialRouteName: "(tabs)",
};

export default function RootLayout() {
	const colorScheme = useColorScheme();
	const prefs = usePrefs();
	const [isLocked, setIsLocked] = useState(false);
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [lockMessage, setLockMessage] = useState<string | null>(null);
	const appStateRef = useRef(AppState.currentState);
	const isAuthenticatingRef = useRef(false);
	const hasCheckedInitialLockRef = useRef(false);
	const prefsRef = useRef(prefs);

	useEffect(() => {
		prefsRef.current = prefs;
	}, [prefs]);

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
				promptMessage: "Authenticate to unlock Expense Tracker",
			});

			if (result.success) {
				setIsLocked(false);
				setLockMessage(null);
				return;
			}

			setIsLocked(true);
			setLockMessage("Authentication failed or canceled. Please try again.");
		} catch (error) {
			console.error("App lock authentication failed", error);
			setIsLocked(true);
			setLockMessage("Authentication failed. Please try again.");
		} finally {
			isAuthenticatingRef.current = false;
			setIsAuthenticating(false);
		}
	}, [disableAppLock]);

	useEffect(() => {
		seedCategories().catch(console.error);
	}, []);

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
		if (Platform.OS === "web") return;

		const subscription = AppState.addEventListener("change", (nextState) => {
			const prevState = appStateRef.current;
			appStateRef.current = nextState;

			const becameActive =
				(prevState === "background" || prevState === "inactive") &&
				nextState === "active";

			if (becameActive && prefsRef.current.appLockEnabled) {
				setIsLocked(true);
				void authenticateToUnlock();
			}
		});

		return () => subscription.remove();
	}, [authenticateToUnlock]);

	return (
		<SafeAreaProvider>
			<ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
				<View style={styles.root}>
					<Stack>
						<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
						<Stack.Screen
							name="modal"
							options={{ presentation: "modal", title: "Modal" }}
						/>
					</Stack>
					{isLocked && (
						<View style={styles.lockOverlay}>
							<View style={styles.lockCard}>
								<Text style={styles.lockTitle}>App Locked</Text>
								<Text style={styles.lockSubtitle}>
									{lockMessage ?? "Authenticate to continue"}
								</Text>
								<TouchableOpacity
									style={styles.lockButton}
									onPress={() => void authenticateToUnlock()}
									disabled={isAuthenticating}
								>
									{isAuthenticating ? (
										<ActivityIndicator color="#ffffff" />
									) : (
										<Text style={styles.lockButtonText}>
											{lockMessage ? "Retry" : "Unlock"}
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

const styles = StyleSheet.create({
	root: { flex: 1 },
	lockOverlay: {
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		backgroundColor: "rgba(17, 24, 39, 0.92)",
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 24,
	},
	lockCard: {
		width: "100%",
		maxWidth: 340,
		backgroundColor: "#111827",
		borderRadius: 20,
		padding: 24,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.16)",
	},
	lockTitle: {
		fontSize: 24,
		fontWeight: "700",
		color: "#ffffff",
		marginBottom: 8,
	},
	lockSubtitle: {
		fontSize: 15,
		color: "#d1d5db",
		lineHeight: 22,
		marginBottom: 20,
	},
	lockButton: {
		backgroundColor: "#2563eb",
		paddingVertical: 12,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 46,
	},
	lockButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#ffffff",
	},
});
