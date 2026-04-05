import {
	type Prefs,
	type AppLanguage,
	savePrefs,
	usePrefs,
	type WeekStart,
} from "@/hooks/usePrefs";
import { useCategories } from "@/hooks/useCategories";
import { useI18n } from "@/hooks/useI18n";
import { useSync } from "@/hooks/useSync";
import {
	createCategory,
	deleteCategory,
	updateCategory,
} from "@/services/categories";
import { register, login, logout, isLoggedIn } from "@/services/auth";
import { exportAppBackup, importAppBackup } from "@/services/backup";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "@/tw";
import { getWeekStartLabel } from "@/utils/i18n";
import { exportExpensesCSV } from "@/utils/export-csv";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useState, useEffect } from "react";
import {
	Alert,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Switch,
	ActivityIndicator,
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
const LANGUAGES: AppLanguage[] = ["es", "en"];

const WEEK_DAYS: WeekStart[] = ["Sunday", "Monday"];
const CATEGORY_ICONS = [
	"fast-food",
	"car",
	"home",
	"medkit",
	"game-controller",
	"book",
	"cart",
	"cafe",
	"shirt",
	"airplane",
	"paw",
	"gift",
	"musical-notes",
	"fitness",
] as const;

export default function ProfileScreen() {
	const insets = useSafeAreaInsets();
	const prefs = usePrefs();
	const categories = useCategories();
	const { t, language, locale } = useI18n();
	const { syncNow, isSyncing, lastSyncedAt, error } = useSync();

	const [editProfileVisible, setEditProfileVisible] = useState(false);
	const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
	const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
	const [categoriesVisible, setCategoriesVisible] = useState(false);
	const [categoryEditorVisible, setCategoryEditorVisible] = useState(false);
	const [editName, setEditName] = useState("");
	const [editEmail, setEditEmail] = useState("");
	const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
	const [categoryName, setCategoryName] = useState("");
	const [categoryIcon, setCategoryIcon] =
		useState<(typeof CATEGORY_ICONS)[number]>("cart");

	const [authModalVisible, setAuthModalVisible] = useState(false);
	const [authMode, setAuthMode] = useState<"login" | "register">("login");
	const [authEmail, setAuthEmail] = useState("");
	const [authPassword, setAuthPassword] = useState("");
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [userLoggedIn, setUserLoggedIn] = useState(false);

	useEffect(() => {
		const checkLogin = async () => {
			const logged = await isLoggedIn();
			setUserLoggedIn(logged);
		};
		checkLogin();
	}, []);

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
		Alert.alert(t("weekStartsOn"), t("weekStartsOn"), [
			...WEEK_DAYS.map((day) => ({
				text:
					day === prefs.weekStart
						? `${getWeekStartLabel(language, day)} ✓`
						: getWeekStartLabel(language, day),
				onPress: () => updatePrefs({ weekStart: day }),
			})),
			{ text: t("cancel"), style: "cancel" as const },
		]);
	};

	const toggleAppLock = async () => {
		const shouldEnable = !prefs.appLockEnabled;

		if (Platform.OS === "web" && shouldEnable) {
			Alert.alert(t("notSupported"), t("appLockNotAvailableWeb"));
			return;
		}

		try {
			if (shouldEnable) {
				const hasHardware = await LocalAuthentication.hasHardwareAsync();
				const isEnrolled = await LocalAuthentication.isEnrolledAsync();
				if (!hasHardware || !isEnrolled) {
					Alert.alert(
						t("notSupported"),
						t("biometricsNotConfigured"),
					);
					return;
				}

				const result = await LocalAuthentication.authenticateAsync({
					promptMessage: t("authEnableAppLock"),
				});
				if (result.success) updatePrefs({ appLockEnabled: true });
				return;
			}

			const result = await LocalAuthentication.authenticateAsync({
				promptMessage: t("authDisableAppLock"),
			});
			if (result.success) updatePrefs({ appLockEnabled: false });
		} catch (error) {
			console.error(error);
			Alert.alert(t("authenticationError"), t("unableCompleteAuthentication"));
		}
	};

	const openCreateCategory = () => {
		setEditingCategoryId(null);
		setCategoryName("");
		setCategoryIcon("cart");
		setCategoryEditorVisible(true);
	};

	const openEditCategory = (categoryId: string) => {
		const category = categories.find((item) => item.id === categoryId);
		if (!category) return;
		setEditingCategoryId(category.id);
		setCategoryName(category.name);
		setCategoryIcon(
			(CATEGORY_ICONS as readonly string[]).includes(category.icon)
				? (category.icon as (typeof CATEGORY_ICONS)[number])
				: "cart",
		);
		setCategoryEditorVisible(true);
	};

	const closeCategoryEditor = () => {
		setCategoryEditorVisible(false);
		setEditingCategoryId(null);
		setCategoryName("");
		setCategoryIcon("cart");
	};

	const handleSaveCategory = async () => {
		try {
			if (editingCategoryId) {
				await updateCategory(editingCategoryId, {
					name: categoryName,
					icon: categoryIcon,
				});
			} else {
				await createCategory({
					name: categoryName,
					icon: categoryIcon,
				});
			}
			closeCategoryEditor();
		} catch (error) {
			console.error(error);
			Alert.alert(
				t("error"),
				error instanceof Error ? error.message : t("couldNotSaveCategory"),
			);
		}
	};

	const handleDeleteCategory = () => {
		if (!editingCategoryId) return;

		Alert.alert(t("deleteCategoryTitle"), t("deleteCategoryBody"), [
			{ text: t("cancel"), style: "cancel" },
			{
				text: t("delete"),
				style: "destructive",
				onPress: async () => {
					try {
						await deleteCategory(editingCategoryId);
						closeCategoryEditor();
					} catch (error) {
						console.error(error);
						Alert.alert(
							t("error"),
							error instanceof Error
								? error.message
								: t("couldNotDeleteCategory"),
						);
					}
				},
			},
		]);
	};

	const handleImportBackup = () => {
		Alert.alert(
			t("importBackupTitle"),
			t("importBackupBody"),
			[
				{ text: t("cancel"), style: "cancel" },
				{
					text: t("importBackup"),
					style: "destructive",
					onPress: async () => {
						const imported = await importAppBackup();
						if (imported) {
							Alert.alert(t("backupImported"), t("backupImportedBody"));
						}
					},
				},
			],
		);
	};

	const handleAuth = async () => {
		if (!authEmail || !authPassword) {
			Alert.alert(t("error"), t("enterValidEmailPassword"));
			return;
		}

		setIsAuthenticating(true);
		try {
			if (authMode === "login") {
				await login(authEmail, authPassword);
			} else {
				await register(authEmail, authPassword);
			}
			setUserLoggedIn(true);
			setAuthModalVisible(false);
			setAuthEmail("");
			setAuthPassword("");
			// Automatically sync after login
			await syncNow();
		} catch (error) {
			console.error(error);
			Alert.alert(t("error"), error instanceof Error ? error.message : t("authFailed"));
		} finally {
			setIsAuthenticating(false);
		}
	};

	const handleManualSync = async () => {
		try {
			await syncNow();
		} catch (syncError) {
			console.error(syncError);
			Alert.alert(
				t("error"),
				syncError instanceof Error ? syncError.message : t("error"),
			);
		}
	};

	const handleLogout = async () => {
		Alert.alert(t("logout"), t("confirmLogout"), [
			{ text: t("cancel"), style: "cancel" },
			{
				text: t("logout"),
				style: "destructive",
				onPress: async () => {
					await logout();
					setUserLoggedIn(false);
				},
			},
		]);
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
							{t("editProfileTitle")}
						</Text>

						<Text className="mb-1.5 text-[13px] font-semibold text-gray-500">
							{t("name")}
						</Text>
						<TextInput
							className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-base text-gray-900"
							value={editName}
							onChangeText={setEditName}
							placeholder={t("yourName")}
							placeholderTextColor="#9ca3af"
							returnKeyType="next"
						/>

						<Text className="mb-1.5 text-[13px] font-semibold text-gray-500">
							{t("email")}
						</Text>
						<TextInput
							className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-base text-gray-900"
							value={editEmail}
							onChangeText={setEditEmail}
							placeholder={t("yourEmail")}
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
									{t("cancel")}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								className="flex-1 items-center rounded-xl bg-blue-500 py-3.5"
								onPress={saveProfile}
							>
								<Text className="text-base font-semibold text-white">{t("save")}</Text>
							</TouchableOpacity>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>

			<Modal
				visible={authModalVisible}
				animationType="slide"
				transparent
				onRequestClose={() => setAuthModalVisible(false)}
			>
				<KeyboardAvoidingView
					className="flex-1 justify-end bg-black/40"
					behavior={Platform.OS === "ios" ? "padding" : "height"}
				>
					<View className="rounded-t-3xl bg-white px-6 pb-10 pt-6">
						<Text className="mb-5 text-center text-lg font-bold text-gray-900">
							{authMode === "login" ? t("login") : t("register")}
						</Text>

						<Text className="mb-1.5 text-[13px] font-semibold text-gray-500">
							{t("email")}
						</Text>
						<TextInput
							className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-base text-gray-900"
							value={authEmail}
							onChangeText={setAuthEmail}
							placeholder={t("yourEmail")}
							placeholderTextColor="#9ca3af"
							keyboardType="email-address"
							autoCapitalize="none"
							autoCorrect={false}
						/>

						<Text className="mb-1.5 text-[13px] font-semibold text-gray-500">
							{t("password")}
						</Text>
						<TextInput
							className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-base text-gray-900"
							value={authPassword}
							onChangeText={setAuthPassword}
							placeholder="••••••••"
							placeholderTextColor="#9ca3af"
							secureTextEntry
						/>

						<TouchableOpacity
							className="mb-4 items-center rounded-xl bg-blue-500 py-3.5"
							onPress={() => void handleAuth()}
							disabled={isAuthenticating}
						>
							{isAuthenticating ? (
								<ActivityIndicator color="#fff" />
							) : (
								<Text className="text-base font-semibold text-white">
									{authMode === "login" ? t("login") : t("register")}
								</Text>
							)}
						</TouchableOpacity>

						<TouchableOpacity
							className="items-center py-2"
							onPress={() => setAuthMode(authMode === "login" ? "register" : "login")}
						>
							<Text className="text-blue-500 font-medium">
								{authMode === "login" ? t("noAccountRegister") : t("hasAccountLogin")}
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							className="mt-4 items-center rounded-xl border border-gray-200 py-3.5"
							onPress={() => setAuthModalVisible(false)}
						>
							<Text className="text-base font-semibold text-gray-500">
								{t("cancel")}
							</Text>
						</TouchableOpacity>
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
							{t("selectCurrency")}
						</Text>

						{CURRENCIES.map((currency) => {
							const selected = currency === prefs.currency;
							return (
								<TouchableOpacity
									key={currency}
									className="flex-row items-center justify-between border-b border-gray-100 py-3.5"
									onPress={() => {
										updatePrefs({ currency });
										setCurrencyPickerVisible(false);
									}}
								>
									<Text
										className={`text-base ${
											selected ? "font-bold text-blue-500" : "text-gray-700"
										}`}
									>
										{currency}
									</Text>
									{selected ? (
										<Ionicons name="checkmark" size={20} color="#3b82f6" />
									) : null}
								</TouchableOpacity>
							);
						})}

						<TouchableOpacity
							className="mt-2 self-center rounded-xl border border-gray-200 px-8 py-3.5"
							onPress={() => setCurrencyPickerVisible(false)}
						>
							<Text className="text-base font-semibold text-gray-500">
								{t("cancel")}
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>

			<Modal
				visible={languagePickerVisible}
				animationType="slide"
				transparent
				onRequestClose={() => setLanguagePickerVisible(false)}
			>
				<View className="flex-1 justify-end bg-black/40">
					<View className="rounded-t-3xl bg-white px-6 pb-10 pt-6">
						<Text className="mb-5 text-center text-lg font-bold text-gray-900">
							{t("selectLanguage")}
						</Text>

						{LANGUAGES.map((lang) => {
							const selected = lang === prefs.language;
							return (
								<TouchableOpacity
									key={lang}
									className="flex-row items-center justify-between border-b border-gray-100 py-3.5"
									onPress={() => {
										updatePrefs({ language: lang });
										setLanguagePickerVisible(false);
									}}
								>
									<Text
										className={`text-base ${
											selected ? "font-bold text-blue-500" : "text-gray-700"
										}`}
									>
										{lang === "es" ? "Español" : "English"}
									</Text>
									{selected ? (
										<Ionicons name="checkmark" size={20} color="#3b82f6" />
									) : null}
								</TouchableOpacity>
							);
						})}

						<TouchableOpacity
							className="mt-2 self-center rounded-xl border border-gray-200 px-8 py-3.5"
							onPress={() => setLanguagePickerVisible(false)}
						>
							<Text className="text-base font-semibold text-gray-500">
								{t("cancel")}
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>

			<Modal
				visible={categoriesVisible}
				animationType="slide"
				transparent
				onRequestClose={() => setCategoriesVisible(false)}
			>
				<View className="flex-1 justify-end bg-black/40">
					<View className="max-h-[80%] rounded-t-3xl bg-white px-6 pb-10 pt-6">
						<View className="mb-5 flex-row items-center justify-between">
							<Text className="text-lg font-bold text-gray-900">
								{t("manageCategories")}
							</Text>
							<TouchableOpacity onPress={() => setCategoriesVisible(false)}>
								<Ionicons name="close" size={22} color="#9ca3af" />
							</TouchableOpacity>
						</View>

						<ScrollView contentContainerClassName="gap-3 pb-2">
							{categories.map((category) => (
								<TouchableOpacity
									key={category.id}
									className="flex-row items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4"
									onPress={() => openEditCategory(category.id)}
								>
									<View className="flex-row items-center gap-3">
										<View className="h-10 w-10 items-center justify-center rounded-2xl bg-white">
											<Ionicons
												name={category.icon as keyof typeof Ionicons.glyphMap}
												size={20}
												color="#3b82f6"
											/>
										</View>
										<Text className="font-semibold text-gray-800">
											{category.name}
										</Text>
									</View>
									<Ionicons
										name="chevron-forward"
										size={20}
										color="#9ca3af"
									/>
								</TouchableOpacity>
							))}
						</ScrollView>

						<TouchableOpacity
							className="mt-5 items-center rounded-2xl bg-primary py-3.5"
							onPress={openCreateCategory}
						>
							<Text className="font-bold text-white">{t("addCategory")}</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>

			<Modal
				visible={categoryEditorVisible}
				animationType="slide"
				transparent
				onRequestClose={closeCategoryEditor}
			>
				<KeyboardAvoidingView
					className="flex-1 justify-end bg-black/40"
					behavior={Platform.OS === "ios" ? "padding" : "height"}
				>
					<View className="rounded-t-3xl bg-white px-6 pb-10 pt-6">
						<Text className="mb-5 text-center text-lg font-bold text-gray-900">
							{editingCategoryId ? t("editCategory") : t("newCategory")}
						</Text>

						<Text className="mb-1.5 text-[13px] font-semibold text-gray-500">
							{t("name")}
						</Text>
						<TextInput
							className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-base text-gray-900"
							value={categoryName}
							onChangeText={setCategoryName}
							placeholder={t("categoryName")}
							placeholderTextColor="#9ca3af"
						/>

						<Text className="mb-2 text-[13px] font-semibold text-gray-500">
							{t("icon")}
						</Text>
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerClassName="mb-6 flex-row gap-2"
						>
							{CATEGORY_ICONS.map((icon) => {
								const selected = categoryIcon === icon;
								return (
									<TouchableOpacity
										key={icon}
										onPress={() => setCategoryIcon(icon)}
										className={`h-12 w-12 items-center justify-center rounded-2xl border ${
											selected
												? "border-primary bg-primary"
												: "border-gray-200 bg-gray-50"
										}`}
									>
										<Ionicons
											name={icon}
											size={20}
											color={selected ? "#fff" : "#4b5563"}
										/>
									</TouchableOpacity>
								);
							})}
						</ScrollView>

						<View className="flex-row gap-3">
							<TouchableOpacity
								className="flex-1 items-center rounded-xl border border-gray-200 py-3.5"
								onPress={closeCategoryEditor}
							>
								<Text className="text-base font-semibold text-gray-500">
									{t("cancel")}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								className="flex-1 items-center rounded-xl bg-blue-500 py-3.5"
								onPress={() => void handleSaveCategory()}
							>
								<Text className="text-base font-semibold text-white">{t("save")}</Text>
							</TouchableOpacity>
						</View>

						{editingCategoryId ? (
							<TouchableOpacity
								className="mt-4 items-center rounded-xl bg-red-50 py-3.5"
								onPress={handleDeleteCategory}
							>
								<Text className="text-base font-semibold text-red-600">
									{t("deleteCategory")}
								</Text>
							</TouchableOpacity>
						) : null}
					</View>
				</KeyboardAvoidingView>
			</Modal>

			<View className="border-b border-gray-100 bg-white px-5 pb-4 pt-4">
				<Text className="text-2xl font-bold text-gray-900">{t("settings")}</Text>
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
						<Text className="font-bold text-gray-700">{t("editProfile")}</Text>
					</TouchableOpacity>
				</View>

				<View className="mb-2 mt-8 px-6">
					<Text className="text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
						{t("syncCloud")}
					</Text>
				</View>
				<View className="border-y border-gray-100 bg-white px-5 py-4">
					<View className="flex-row items-center gap-3 mb-4">
						<View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
							<Ionicons name="cloud-upload-outline" size={20} color="#3b82f6" />
						</View>
						<View className="flex-1">
							<Text className="text-base font-semibold text-gray-800">
								{userLoggedIn ? t("cloudSyncActive") : t("notLoggedIn")}
							</Text>
							<Text className="text-xs text-gray-500">
								{userLoggedIn ? t("syncDescription") : t("loginToSync")}
							</Text>
							{userLoggedIn ? (
								<Text className="mt-1 text-xs text-gray-400">
									{t("lastSync")}:{" "}
									{lastSyncedAt
										? new Date(lastSyncedAt).toLocaleString(locale)
										: "—"}
								</Text>
							) : null}
							{error ? (
								<Text className="mt-1 text-xs font-medium text-red-600">
									{error.message}
								</Text>
							) : null}
						</View>
					</View>

					{userLoggedIn ? (
						<View className="flex-row gap-3">
							<TouchableOpacity
								className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-blue-500 py-3"
								onPress={() => void handleManualSync()}
								disabled={isSyncing}
							>
								{isSyncing ? (
									<ActivityIndicator size="small" color="#fff" />
								) : (
									<>
										<Ionicons name="sync" size={18} color="#fff" />
										<Text className="font-bold text-white">{t("syncNow")}</Text>
									</>
								)}
							</TouchableOpacity>
							<TouchableOpacity
								className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-gray-100 py-3"
								onPress={() => void handleLogout()}
							>
								<Ionicons name="log-out-outline" size={18} color="#4b5563" />
								<Text className="font-bold text-gray-700">{t("logout")}</Text>
							</TouchableOpacity>
						</View>
					) : (
						<View className="flex-row gap-3">
							<TouchableOpacity
								className="flex-1 items-center rounded-xl bg-blue-500 py-3"
								onPress={() => {
									setAuthMode("login");
									setAuthModalVisible(true);
								}}
							>
								<Text className="font-bold text-white">{t("login")}</Text>
							</TouchableOpacity>
							<TouchableOpacity
								className="flex-1 items-center rounded-xl border border-blue-500 py-3"
								onPress={() => {
									setAuthMode("register");
									setAuthModalVisible(true);
								}}
							>
								<Text className="font-bold text-blue-500">{t("register")}</Text>
							</TouchableOpacity>
						</View>
					)}
				</View>

				<View className="mb-2 mt-8 px-6">
					<Text className="text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
						{t("preferences")}
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
								{t("currency")}
							</Text>
						</View>
						<View className="flex-row items-center gap-1">
							<Text className="text-gray-500">{prefs.currency}</Text>
							<Ionicons name="chevron-forward" size={20} color="#9ca3af" />
						</View>
					</TouchableOpacity>

					<TouchableOpacity
						className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4"
						onPress={() => setLanguagePickerVisible(true)}
					>
						<View className="flex-row items-center gap-3">
							<View className="h-8 w-8 items-center justify-center rounded-lg bg-cyan-50">
								<Ionicons name="language-outline" size={18} color="#0891b2" />
							</View>
							<Text className="text-base font-medium text-gray-800">
								{t("language")}
							</Text>
						</View>
						<View className="flex-row items-center gap-1">
							<Text className="text-gray-500">
								{prefs.language === "es" ? "Español" : "English"}
							</Text>
							<Ionicons name="chevron-forward" size={20} color="#9ca3af" />
						</View>
					</TouchableOpacity>

					<TouchableOpacity
						className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4"
						onPress={openWeekStartPicker}
					>
						<View className="flex-row items-center gap-3">
							<View className="h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
								<Ionicons name="calendar-outline" size={18} color="#6366f1" />
							</View>
							<Text className="text-base font-medium text-gray-800">
								{t("weekStartsOn")}
							</Text>
						</View>
						<View className="flex-row items-center gap-1">
							<Text className="text-gray-500">
								{getWeekStartLabel(language, prefs.weekStart)}
							</Text>
							<Ionicons name="chevron-forward" size={20} color="#9ca3af" />
						</View>
					</TouchableOpacity>

					<TouchableOpacity
						className="flex-row items-center justify-between px-5 py-4"
						onPress={() => setCategoriesVisible(true)}
					>
						<View className="flex-row items-center gap-3">
							<View className="h-8 w-8 items-center justify-center rounded-lg bg-orange-50">
								<Ionicons name="grid-outline" size={18} color="#f97316" />
							</View>
							<Text className="text-base font-medium text-gray-800">
								{t("manageCategories")}
							</Text>
						</View>
						<View className="flex-row items-center gap-1">
							<Text className="text-gray-500">{categories.length}</Text>
							<Ionicons name="chevron-forward" size={20} color="#9ca3af" />
						</View>
					</TouchableOpacity>
				</View>

				<View className="mb-2 mt-8 px-6">
					<Text className="text-[12px] font-bold uppercase tracking-[2px] text-gray-400">
						{t("securityData")}
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
									{t("appLock")}
								</Text>
								<Text className="text-xs text-gray-400">
									{t("requireFaceId")}
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
						className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4"
						onPress={exportExpensesCSV}
					>
						<View className="flex-row items-center gap-3">
							<View className="h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
								<Ionicons name="download-outline" size={18} color="#f59e0b" />
							</View>
							<View>
								<Text className="text-base font-medium text-gray-800">
									{t("exportCsv")}
								</Text>
								<Text className="text-xs text-gray-400">
									{t("downloadTransactionsCsv")}
								</Text>
							</View>
						</View>
						<Ionicons name="chevron-forward" size={20} color="#9ca3af" />
					</TouchableOpacity>

					<TouchableOpacity
						className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4"
						onPress={() => void exportAppBackup()}
					>
						<View className="flex-row items-center gap-3">
							<View className="h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
								<Ionicons name="archive-outline" size={18} color="#0ea5e9" />
							</View>
							<View>
								<Text className="text-base font-medium text-gray-800">
									{t("exportBackup")}
								</Text>
								<Text className="text-xs text-gray-400">
									{t("exportBackupBody")}
								</Text>
							</View>
						</View>
						<Ionicons name="chevron-forward" size={20} color="#9ca3af" />
					</TouchableOpacity>

					<TouchableOpacity
						className="flex-row items-center justify-between px-5 py-4"
						onPress={handleImportBackup}
					>
						<View className="flex-row items-center gap-3">
							<View className="h-8 w-8 items-center justify-center rounded-lg bg-rose-50">
								<Ionicons name="cloud-upload-outline" size={18} color="#f43f5e" />
							</View>
							<View>
								<Text className="text-base font-medium text-gray-800">
									{t("importBackup")}
								</Text>
								<Text className="text-xs text-gray-400">
									{t("importBackupBodyShort")}
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
