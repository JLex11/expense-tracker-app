import { database } from "@/database";
import type Category from "@/database/models/Category";
import type Expense from "@/database/models/Expense";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as LocalAuthentication from "expo-local-authentication";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ProfileScreen() {
	const insets = useSafeAreaInsets();
	const [appLockEnabled, setAppLockEnabled] = useState(false);
	const [currency] = useState("USD");
	const [weekStart] = useState("Sunday");

	const toggleAppLock = async () => {
		if (!appLockEnabled) {
			const hasHardware = await LocalAuthentication.hasHardwareAsync();
			const isEnrolled = await LocalAuthentication.isEnrolledAsync();
			if (!hasHardware || !isEnrolled) {
				Alert.alert(
					"Not Supported",
					"Biometrics or device credentials are not set up on this device.",
				);
				return;
			}
			const result = await LocalAuthentication.authenticateAsync({
				promptMessage: "Authenticate to enable App Lock",
			});
			if (result.success) setAppLockEnabled(true);
		} else {
			const result = await LocalAuthentication.authenticateAsync({
				promptMessage: "Authenticate to disable App Lock",
			});
			if (result.success) setAppLockEnabled(false);
		}
	};

	const handleExportCSV = async () => {
		try {
			const expenses = await database.get<Expense>("expenses").query().fetch();
			const categories = await database
				.get<Category>("categories")
				.query()
				.fetch();
			const header = "Date,Amount,Category,Payment Method,Note\n";
			const rows = expenses
				.map((exp) => {
					const cat = categories.find((c) => c.id === exp.categoryId);
					return `${new Date(exp.date).toLocaleString()},${exp.amount},${cat?.name || "Unknown"},${exp.paymentMethod},"${exp.note || ""}"`;
				})
				.join("\n");

			const file = new FileSystem.File(FileSystem.Paths.document, "expenses_export.csv");
			file.write(header + rows);

			if (await Sharing.isAvailableAsync()) {
				await Sharing.shareAsync(file.uri);
			} else {
				Alert.alert(
					"Sharing not available",
					"Cannot share CSV file on this device.",
				);
			}
		} catch (error) {
			Alert.alert("Error", "Failed to export CSV. Please try again.");
			console.error(error);
		}
	};

	return (
		<View style={[styles.container, { paddingTop: insets.top }]}>
			<View style={styles.headerBar}>
				<Text style={styles.headerTitle}>Settings</Text>
			</View>

			<ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
				{/* Profile card */}
				<View style={styles.profileCard}>
					<View style={styles.avatarCircle}>
						<Ionicons name="person" size={48} color="#3b82f6" />
					</View>
					<Text style={styles.profileName}>Alex</Text>
					<Text style={styles.profileEmail}>alex@example.com</Text>
					<TouchableOpacity style={styles.editBtn}>
						<Text style={styles.editBtnText}>Edit Profile</Text>
					</TouchableOpacity>
				</View>

				{/* Preferences */}
				<View style={styles.sectionHeader}>
					<Text style={styles.sectionLabel}>Preferences</Text>
				</View>
				<View style={styles.settingsGroup}>
					<View style={styles.settingRow}>
						<View style={styles.settingLeft}>
							<View
								style={[styles.settingIcon, { backgroundColor: "#EFF6FF" }]}
							>
								<Ionicons name="cash-outline" size={18} color="#3b82f6" />
							</View>
							<Text style={styles.settingTitle}>Currency</Text>
						</View>
						<View style={styles.settingRight}>
							<Text style={styles.settingValue}>{currency}</Text>
							<Ionicons name="chevron-forward" size={20} color="#9ca3af" />
						</View>
					</View>
					<View style={[styles.settingRow, styles.settingRowNoBottom]}>
						<View style={styles.settingLeft}>
							<View
								style={[styles.settingIcon, { backgroundColor: "#EEF2FF" }]}
							>
								<Ionicons name="calendar-outline" size={18} color="#6366f1" />
							</View>
							<Text style={styles.settingTitle}>Week Starts On</Text>
						</View>
						<View style={styles.settingRight}>
							<Text style={styles.settingValue}>{weekStart}</Text>
							<Ionicons name="chevron-forward" size={20} color="#9ca3af" />
						</View>
					</View>
				</View>

				{/* Security & Data */}
				<View style={styles.sectionHeader}>
					<Text style={styles.sectionLabel}>Security & Data</Text>
				</View>
				<View style={styles.settingsGroup}>
					<View style={styles.settingRow}>
						<View style={styles.settingLeft}>
							<View
								style={[styles.settingIcon, { backgroundColor: "#ECFDF5" }]}
							>
								<Ionicons
									name="lock-closed-outline"
									size={18}
									color="#10b981"
								/>
							</View>
							<View>
								<Text style={styles.settingTitle}>App Lock</Text>
								<Text style={styles.settingSubtitle}>
									Require FaceID / Passcode
								</Text>
							</View>
						</View>
						<Switch
							value={appLockEnabled}
							onValueChange={toggleAppLock}
							trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
							thumbColor={appLockEnabled ? "#3b82f6" : "#f3f4f6"}
						/>
					</View>
					<TouchableOpacity
						style={[styles.settingRow, styles.settingRowNoBottom]}
						onPress={handleExportCSV}
					>
						<View style={styles.settingLeft}>
							<View
								style={[styles.settingIcon, { backgroundColor: "#FFFBEB" }]}
							>
								<Ionicons name="download-outline" size={18} color="#f59e0b" />
							</View>
							<View>
								<Text style={styles.settingTitle}>Export Data</Text>
								<Text style={styles.settingSubtitle}>
									Download transactions to CSV
								</Text>
							</View>
						</View>
						<Ionicons name="chevron-forward" size={20} color="#9ca3af" />
					</TouchableOpacity>
				</View>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#F9FAFB" },
	headerBar: {
		paddingHorizontal: 20,
		paddingTop: 16,
		paddingBottom: 16,
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#F3F4F6",
	},
	headerTitle: { fontSize: 24, fontWeight: "bold", color: "#111827" },
	profileCard: {
		backgroundColor: "white",
		paddingVertical: 32,
		borderBottomWidth: 1,
		borderBottomColor: "#F3F4F6",
		alignItems: "center",
	},
	avatarCircle: {
		width: 96,
		height: 96,
		backgroundColor: "#DBEAFE",
		borderRadius: 48,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 16,
	},
	profileName: { fontSize: 24, fontWeight: "bold", color: "#111827" },
	profileEmail: { color: "#6B7280", fontWeight: "500", marginTop: 4 },
	editBtn: {
		marginTop: 16,
		backgroundColor: "#F3F4F6",
		paddingHorizontal: 24,
		paddingVertical: 8,
		borderRadius: 20,
	},
	editBtnText: { color: "#374151", fontWeight: "bold" },
	sectionHeader: { paddingHorizontal: 24, marginTop: 32, marginBottom: 8 },
	sectionLabel: {
		fontSize: 12,
		fontWeight: "bold",
		color: "#9CA3AF",
		textTransform: "uppercase",
		letterSpacing: 2,
	},
	settingsGroup: {
		backgroundColor: "white",
		borderTopWidth: 1,
		borderBottomWidth: 1,
		borderColor: "#F3F4F6",
	},
	settingRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingVertical: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#F3F4F6",
	},
	settingRowNoBottom: { borderBottomWidth: 0 },
	settingLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
	settingIcon: {
		width: 32,
		height: 32,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
	},
	settingTitle: { fontSize: 16, fontWeight: "500", color: "#1F2937" },
	settingSubtitle: { fontSize: 12, color: "#9CA3AF" },
	settingRight: { flexDirection: "row", alignItems: "center", gap: 4 },
	settingValue: { color: "#6B7280" },
});
