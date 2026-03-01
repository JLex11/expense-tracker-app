import {
    type Prefs,
    savePrefs,
    usePrefs,
    type WeekStart,
} from "@/hooks/usePrefs";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "@/tw";
import { exportExpensesCSV } from "@/utils/export-csv";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CURRENCIES = [
	"USD",
	"EUR",
	"GBP",
	"MXN",
	"CAD",
	"AUD",
	"JPY",
	"BRL",
	"CNY",
	"INR",
];
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

	const openWeekStartPicker = () => {
		Alert.alert("Week Starts On", "Choose the first day of your week", [
			...WEEK_DAYS.map((day) => ({
				text: day === prefs.weekStart ? `${day} ✓` : day,
				onPress: () => updatePrefs({ weekStart: day }),
			})),
			{ text: "Cancel", style: "cancel" as const },
		]);
	};

	const toggleAppLock = async () => {
		const shouldEnable = !prefs.appLockEnabled;

		if (Platform.OS === "web" && shouldEnable) {
			Alert.alert("Not Supported", "App Lock is not available on web.");
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
				if (result.success) updatePrefs({ appLockEnabled: true });
				return;
			}

			const result = await LocalAuthentication.authenticateAsync({
				promptMessage: "Authenticate to disable App Lock",
			});
			if (result.success) updatePrefs({ appLockEnabled: false });
		} catch (error) {
			console.error(error);
			Alert.alert("Authentication Error", "Unable to complete authentication.");
		}
	};

	const handleExportCSV = () => {
		exportExpensesCSV();
	};

	return (
		<View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
			<Modal
				visible={editProfileVisible}
				animationType="slide"
				transparent
				onRequestClose={() => setEditProfileVisible(false)}
			>
				<KeyboardAvoidingView
					className="flex-1 justify-end bg-black/40"
					behavior={Platform.OS === "ios" ? "padding" : "height"}
				>
					<View className="rounded-t-3xl bg-white px-6 pb-10 pt-6">
						<Text className="mb-5 text-center text-lg font-bold text-gray-900">
							Edit Profile
						</Text>

						<Text className="mb-1.5 text-[13px] font-semibold text-gray-500">
							Name
						</Text>
						<TextInput
							className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-base text-gray-900"
							value={editName}
							onChangeText={setEditName}
							placeholder="Your name"
							placeholderTextColor="#9ca3af"
							returnKeyType="next"
						/>

						<Text className="mb-1.5 text-[13px] font-semibold text-gray-500">
							Email
						</Text>
						<TextInput
							className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-base text-gray-900"
							value={editEmail}
							onChangeText={setEditEmail}
							placeholder="your@email.com"
							placeholderTextColor="#9ca3af"
							keyboardType="email-address"
							autoCapitalize="none"
							returnKeyType="done"
							onSubmitEditing={saveProfile}
						/>

						<View className="mt-1 flex-row gap-3">
							<TouchableOpacity
								className="flex-1 items-center rounded-xl border border-gray-200 py-3.5"
								onPress={() => setEditProfileVisible(false)}
							>
								<Text className="text-base font-semibold text-gray-500">
									Cancel
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								className="flex-1 items-center rounded-xl bg-blue-500 py-3.5"
								onPress={saveProfile}
							>
								<Text className="text-base font-semibold text-white">Save</Text>
							</TouchableOpacity>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>

			<Modal
				visible={currencyPickerVisible}
				animationType="slide"
				transparent
				onRequestClose={() => setCurrencyPickerVisible(false)}
			>
				<View className="flex-1 justify-end bg-black/40">
					<View className="rounded-t-3xl bg-white px-6 pb-10 pt-6">
						<Text className="mb-5 text-center text-lg font-bold text-gray-900">
							Select Currency
						</Text>

						{CURRENCIES.map((c) => {
							const selected = c === prefs.currency;
							return (
								<TouchableOpacity
									key={c}
									className="flex-row items-center justify-between border-b border-gray-100 py-3.5"
									onPress={() => {
										updatePrefs({ currency: c });
										setCurrencyPickerVisible(false);
									}}
								>
									<Text
										className={`text-base ${selected ? "font-bold text-blue-500" : "text-gray-700"}`}
									>
										{c}
									</Text>
									{selected && (
										<Ionicons name="checkmark" size={20} color="#3b82f6" />
									)}
								</TouchableOpacity>
							);
						})}

						<TouchableOpacity
							className="mt-2 self-center rounded-xl border border-gray-200 px-8 py-3.5"
							onPress={() => setCurrencyPickerVisible(false)}
						>
							<Text className="text-base font-semibold text-gray-500">
								Cancel
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>

			<View className="border-b border-gray-100 bg-white px-5 pb-4 pt-4">
				<Text className="text-2xl font-bold text-gray-900">Settings</Text>
			</View>

			<ScrollView contentContainerClassName="pb-24">
				<View className="items-center border-b border-gray-100 bg-white py-8">
					<View className="mb-4 h-24 w-24 items-center justify-center rounded-full bg-blue-100">
						<Ionicons name="person" size={48} color="#3b82f6" />
					</View>
					<Text className="text-2xl font-bold text-gray-900">{prefs.name}</Text>
					<Text className="mt-1 font-medium text-gray-500">{prefs.email}</Text>
					<TouchableOpacity
						className="mt-4 rounded-full bg-gray-100 px-6 py-2"
						onPress={openEditProfile}
					>
						<Text className="font-bold text-gray-700">Edit Profile</Text>
					</TouchableOpacity>
				</View>

				<View className="mb-2 mt-8 px-6">
					<Text className="text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
						Preferences
					</Text>
				</View>
				<View className="border-y border-gray-100 bg-white">
					<TouchableOpacity
						className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4"
						onPress={() => setCurrencyPickerVisible(true)}
					>
						<View className="flex-row items-center gap-3">
							<View className="h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
								<Ionicons name="cash-outline" size={18} color="#3b82f6" />
							</View>
							<Text className="text-base font-medium text-gray-800">
								Currency
							</Text>
						</View>
						<View className="flex-row items-center gap-1">
							<Text className="text-gray-500">{prefs.currency}</Text>
							<Ionicons name="chevron-forward" size={20} color="#9ca3af" />
						</View>
					</TouchableOpacity>

					<TouchableOpacity
						className="flex-row items-center justify-between px-5 py-4"
						onPress={openWeekStartPicker}
					>
						<View className="flex-row items-center gap-3">
							<View className="h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
								<Ionicons name="calendar-outline" size={18} color="#6366f1" />
							</View>
							<Text className="text-base font-medium text-gray-800">
								Week Starts On
							</Text>
						</View>
						<View className="flex-row items-center gap-1">
							<Text className="text-gray-500">{prefs.weekStart}</Text>
							<Ionicons name="chevron-forward" size={20} color="#9ca3af" />
						</View>
					</TouchableOpacity>
				</View>

				<View className="mb-2 mt-8 px-6">
					<Text className="text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
						Security &amp; Data
					</Text>
				</View>
				<View className="border-y border-gray-100 bg-white">
					<View className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4">
						<View className="flex-row items-center gap-3">
							<View className="h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
								<Ionicons
									name="lock-closed-outline"
									size={18}
									color="#10b981"
								/>
							</View>
							<View>
								<Text className="text-base font-medium text-gray-800">
									App Lock
								</Text>
								<Text className="text-xs text-gray-400">
									Require FaceID / Passcode
								</Text>
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
						className="flex-row items-center justify-between px-5 py-4"
						onPress={handleExportCSV}
					>
						<View className="flex-row items-center gap-3">
							<View className="h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
								<Ionicons name="download-outline" size={18} color="#f59e0b" />
							</View>
							<View>
								<Text className="text-base font-medium text-gray-800">
									Export Data
								</Text>
								<Text className="text-xs text-gray-400">
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
