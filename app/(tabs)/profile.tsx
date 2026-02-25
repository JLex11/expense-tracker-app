import { database } from "@/database";
import type Category from "@/database/models/Category";
import type Expense from "@/database/models/Expense";
import {
	savePrefs,
	type Prefs,
	type WeekStart,
	usePrefs,
} from "@/hooks/usePrefs";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as LocalAuthentication from "expo-local-authentication";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import {
	Alert,
	KeyboardAvoidingView,
	Modal,
	Platform,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CURRENCIES = ["USD", "EUR", "GBP", "MXN", "CAD", "AUD", "JPY", "BRL", "CNY", "INR"];
const WEEK_DAYS: WeekStart[] = ["Sunday", "Monday"];

export default function ProfileScreen() {
	const insets = useSafeAreaInsets();
	const prefs = usePrefs();

	const [editProfileVisible, setEditProfileVisible] = useState(false);
	const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
	const [editName, setEditName] = useState("");
	const [editEmail, setEditEmail] = useState("");

	const updatePrefs = (updates: Partial<Prefs>) => {
		const next = { ...prefs, ...updates };
		savePrefs(next);
	};

	// ── Edit Profile ──────────────────────────────────────────────────────────

	const openEditProfile = () => {
		setEditName(prefs.name);
		setEditEmail(prefs.email);
		setEditProfileVisible(true);
	};

	const saveProfile = () => {
		const name = editName.trim() || prefs.name;
		const email = editEmail.trim() || prefs.email;
		updatePrefs({ name, email });
		setEditProfileVisible(false);
	};

	// ── Week Start ────────────────────────────────────────────────────────────

	const openWeekStartPicker = () => {
		Alert.alert(
			"Week Starts On",
			"Choose the first day of your week",
			[
				...WEEK_DAYS.map((day) => ({
					text: day === prefs.weekStart ? `${day} ✓` : day,
					onPress: () => updatePrefs({ weekStart: day }),
				})),
				{ text: "Cancel", style: "cancel" as const },
			],
		);
	};

	// ── App Lock ──────────────────────────────────────────────────────────────

	const toggleAppLock = async () => {
		const shouldEnable = !prefs.appLockEnabled;

		if (Platform.OS === "web" && shouldEnable) {
			Alert.alert(
				"Not Supported",
				"App Lock is not available on web.",
			);
			return;
		}

		try {
			if (shouldEnable) {
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
				if (result.success) {
					updatePrefs({ appLockEnabled: true });
				}
				return;
			}

			const result = await LocalAuthentication.authenticateAsync({
				promptMessage: "Authenticate to disable App Lock",
			});
			if (result.success) {
				updatePrefs({ appLockEnabled: false });
			}
		} catch (error) {
			console.error(error);
			Alert.alert("Authentication Error", "Unable to complete authentication.");
		}
	};

	// ── Export CSV ────────────────────────────────────────────────────────────

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

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<View style={[styles.container, { paddingTop: insets.top }]}>
			{/* Edit Profile Modal */}
			<Modal
				visible={editProfileVisible}
				animationType="slide"
				transparent
				onRequestClose={() => setEditProfileVisible(false)}
			>
				<KeyboardAvoidingView
					style={styles.modalOverlay}
					behavior={Platform.OS === "ios" ? "padding" : "height"}
				>
					<View style={styles.modalCard}>
						<Text style={styles.modalTitle}>Edit Profile</Text>

						<Text style={styles.inputLabel}>Name</Text>
						<TextInput
							style={styles.input}
							value={editName}
							onChangeText={setEditName}
							placeholder="Your name"
							placeholderTextColor="#9ca3af"
							returnKeyType="next"
						/>

						<Text style={styles.inputLabel}>Email</Text>
						<TextInput
							style={styles.input}
							value={editEmail}
							onChangeText={setEditEmail}
							placeholder="your@email.com"
							placeholderTextColor="#9ca3af"
							keyboardType="email-address"
							autoCapitalize="none"
							returnKeyType="done"
							onSubmitEditing={saveProfile}
						/>

						<View style={styles.modalActions}>
							<TouchableOpacity
								style={styles.modalCancelBtn}
								onPress={() => setEditProfileVisible(false)}
							>
								<Text style={styles.modalCancelText}>Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity style={styles.modalSaveBtn} onPress={saveProfile}>
								<Text style={styles.modalSaveText}>Save</Text>
							</TouchableOpacity>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>

			{/* Currency Picker Modal */}
			<Modal
				visible={currencyPickerVisible}
				animationType="slide"
				transparent
				onRequestClose={() => setCurrencyPickerVisible(false)}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.modalCard}>
						<Text style={styles.modalTitle}>Select Currency</Text>
						{CURRENCIES.map((c) => (
							<TouchableOpacity
								key={c}
								style={styles.currencyOption}
								onPress={() => {
									updatePrefs({ currency: c });
									setCurrencyPickerVisible(false);
								}}
							>
								<Text
									style={[
										styles.currencyText,
										c === prefs.currency && styles.currencyTextSelected,
									]}
								>
									{c}
								</Text>
								{c === prefs.currency && (
									<Ionicons name="checkmark" size={20} color="#3b82f6" />
								)}
							</TouchableOpacity>
						))}
						<TouchableOpacity
							style={[styles.modalCancelBtn, { marginTop: 8, alignSelf: "center" }]}
							onPress={() => setCurrencyPickerVisible(false)}
						>
							<Text style={styles.modalCancelText}>Cancel</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>

			{/* Header */}
			<View style={styles.headerBar}>
				<Text style={styles.headerTitle}>Settings</Text>
			</View>

			<ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
				{/* Profile card */}
				<View style={styles.profileCard}>
					<View style={styles.avatarCircle}>
						<Ionicons name="person" size={48} color="#3b82f6" />
					</View>
					<Text style={styles.profileName}>{prefs.name}</Text>
					<Text style={styles.profileEmail}>{prefs.email}</Text>
					<TouchableOpacity style={styles.editBtn} onPress={openEditProfile}>
						<Text style={styles.editBtnText}>Edit Profile</Text>
					</TouchableOpacity>
				</View>

				{/* Preferences */}
				<View style={styles.sectionHeader}>
					<Text style={styles.sectionLabel}>Preferences</Text>
				</View>
				<View style={styles.settingsGroup}>
					<TouchableOpacity
						style={styles.settingRow}
						onPress={() => setCurrencyPickerVisible(true)}
					>
						<View style={styles.settingLeft}>
							<View style={[styles.settingIcon, { backgroundColor: "#EFF6FF" }]}>
								<Ionicons name="cash-outline" size={18} color="#3b82f6" />
							</View>
							<Text style={styles.settingTitle}>Currency</Text>
						</View>
						<View style={styles.settingRight}>
							<Text style={styles.settingValue}>{prefs.currency}</Text>
							<Ionicons name="chevron-forward" size={20} color="#9ca3af" />
						</View>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.settingRow, styles.settingRowNoBottom]}
						onPress={openWeekStartPicker}
					>
						<View style={styles.settingLeft}>
							<View style={[styles.settingIcon, { backgroundColor: "#EEF2FF" }]}>
								<Ionicons name="calendar-outline" size={18} color="#6366f1" />
							</View>
							<Text style={styles.settingTitle}>Week Starts On</Text>
						</View>
						<View style={styles.settingRight}>
							<Text style={styles.settingValue}>{prefs.weekStart}</Text>
							<Ionicons name="chevron-forward" size={20} color="#9ca3af" />
						</View>
					</TouchableOpacity>
				</View>

				{/* Security & Data */}
				<View style={styles.sectionHeader}>
					<Text style={styles.sectionLabel}>Security & Data</Text>
				</View>
				<View style={styles.settingsGroup}>
					<View style={styles.settingRow}>
						<View style={styles.settingLeft}>
							<View style={[styles.settingIcon, { backgroundColor: "#ECFDF5" }]}>
								<Ionicons name="lock-closed-outline" size={18} color="#10b981" />
							</View>
							<View>
								<Text style={styles.settingTitle}>App Lock</Text>
								<Text style={styles.settingSubtitle}>Require FaceID / Passcode</Text>
							</View>
						</View>
						<Switch
							value={prefs.appLockEnabled}
							onValueChange={toggleAppLock}
							disabled={Platform.OS === "web"}
							trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
							thumbColor={prefs.appLockEnabled ? "#3b82f6" : "#f3f4f6"}
						/>
					</View>
					<TouchableOpacity
						style={[styles.settingRow, styles.settingRowNoBottom]}
						onPress={handleExportCSV}
					>
						<View style={styles.settingLeft}>
							<View style={[styles.settingIcon, { backgroundColor: "#FFFBEB" }]}>
								<Ionicons name="download-outline" size={18} color="#f59e0b" />
							</View>
							<View>
								<Text style={styles.settingTitle}>Export Data</Text>
								<Text style={styles.settingSubtitle}>Download transactions to CSV</Text>
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

	// Profile card
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

	// Section headers
	sectionHeader: { paddingHorizontal: 24, marginTop: 32, marginBottom: 8 },
	sectionLabel: {
		fontSize: 12,
		fontWeight: "bold",
		color: "#9CA3AF",
		textTransform: "uppercase",
		letterSpacing: 2,
	},

	// Settings group / rows
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

	// Modals
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.4)",
		justifyContent: "flex-end",
	},
	modalCard: {
		backgroundColor: "white",
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		paddingHorizontal: 24,
		paddingTop: 24,
		paddingBottom: 40,
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#111827",
		marginBottom: 20,
		textAlign: "center",
	},

	// Edit Profile inputs
	inputLabel: { fontSize: 13, fontWeight: "600", color: "#6B7280", marginBottom: 6 },
	input: {
		borderWidth: 1,
		borderColor: "#E5E7EB",
		borderRadius: 10,
		paddingHorizontal: 14,
		paddingVertical: 12,
		fontSize: 16,
		color: "#111827",
		marginBottom: 16,
		backgroundColor: "#F9FAFB",
	},
	modalActions: {
		flexDirection: "row",
		gap: 12,
		marginTop: 4,
	},
	modalCancelBtn: {
		flex: 1,
		paddingVertical: 14,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "#E5E7EB",
		alignItems: "center",
	},
	modalCancelText: { fontSize: 16, fontWeight: "600", color: "#6B7280" },
	modalSaveBtn: {
		flex: 1,
		paddingVertical: 14,
		borderRadius: 12,
		backgroundColor: "#3b82f6",
		alignItems: "center",
	},
	modalSaveText: { fontSize: 16, fontWeight: "600", color: "white" },

	// Currency picker
	currencyOption: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 14,
		borderBottomWidth: 1,
		borderBottomColor: "#F3F4F6",
	},
	currencyText: { fontSize: 16, color: "#374151" },
	currencyTextSelected: { fontWeight: "bold", color: "#3b82f6" },
});
