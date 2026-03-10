import { useNotifications } from "@/hooks/useNotifications";
import {
	clearNotifications,
	markAllNotificationsAsRead,
	markNotificationAsRead,
} from "@/hooks/usePrefs";
import { useI18n } from "@/hooks/useI18n";
import { ScrollView, Text, TouchableOpacity, View } from "@/tw";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ICON_BY_TYPE: Record<string, keyof typeof Ionicons.glyphMap> = {
	pending_recurring: "time-outline",
	budget_threshold: "alert-circle-outline",
	budget_over: "warning-outline",
};

export default function NotificationsScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const { t } = useI18n();
	const { notifications, unreadCount, persistedUnreadCount } = useNotifications();

	const handleMarkAllAsRead = () => {
		markAllNotificationsAsRead();
	};

	const handleClearAll = () => {
		if (persistedUnreadCount === 0 && notifications.length === 0) {
			return;
		}

		Alert.alert(t("delete"), t("actionCannotBeUndone"), [
			{ text: t("cancel"), style: "cancel" },
			{
				text: t("delete"),
				style: "destructive",
				onPress: () => {
					clearNotifications();
				},
			},
		]);
	};

	const renderBody = (
		bodyKey: string,
		params?: Record<string, string | number>,
		meta?: Record<string, string | number | boolean | null>,
	) => {
		if (bodyKey === "pendingReviewBody") {
			const count = Number(params?.count ?? meta?.pendingCount ?? 0);
			const labelKey =
				typeof meta?.labelKey === "string"
					? meta.labelKey
					: count === 1
						? "pendingExpenseLabelOne"
						: "pendingExpenseLabelMany";

			return t("pendingReviewBody", {
				count,
				label: t(labelKey),
			});
		}

		return t(bodyKey, params);
	};

	return (
		<View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
			<View className="border-b border-gray-100 bg-white px-5 pb-4 pt-4">
				<View className="flex-row items-center justify-between">
					<Text className="text-2xl font-bold text-gray-900">
						{t("notificationsTitle")}
					</Text>
					<View className="flex-row gap-2">
						<TouchableOpacity
							className="rounded-full bg-blue-50 px-3 py-1.5"
							onPress={handleMarkAllAsRead}
						>
							<Text className="text-xs font-semibold text-blue-600">
								{t("markAllRead")}
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							className="rounded-full bg-red-50 px-3 py-1.5"
							onPress={handleClearAll}
						>
							<Text className="text-xs font-semibold text-red-600">
								{t("clearAll")}
							</Text>
						</TouchableOpacity>
					</View>
				</View>
				<Text className="mt-1 text-sm text-gray-500">
					{t("notificationsSubtitle")}
				</Text>

				<View className="mt-3 self-start rounded-full bg-slate-100 px-3 py-1">
					<Text className="text-xs font-bold text-slate-700">
						{unreadCount} {t("pending")}
					</Text>
				</View>
			</View>

			<ScrollView contentContainerClassName="px-5 pb-24 pt-5">
				{notifications.length === 0 ? (
					<View className="mt-20 items-center">
						<View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-gray-200/60">
							<Ionicons name="notifications-off-outline" size={30} color="#6b7280" />
						</View>
						<Text className="text-lg font-bold text-gray-800">
							{t("noNotifications")}
						</Text>
						<Text className="mt-1 text-center text-gray-500">
							{t("noNotificationsBody")}
						</Text>
					</View>
				) : (
					<View className="gap-3">
						{notifications.map((item) => {
							const icon = ICON_BY_TYPE[item.type] ?? "notifications-outline";
							const isUnread = item.readAt === null;
							const body = renderBody(item.bodyKey, item.params, item.meta);

							return (
								<TouchableOpacity
									key={item.id}
									activeOpacity={0.85}
									onPress={() => {
										if (item.source === "persisted" && isUnread) {
											markNotificationAsRead(item.id);
										}
										if (item.actionRoute) {
											router.push(item.actionRoute as any);
										}
									}}
									className={`rounded-3xl border p-4 ${
										isUnread
											? "border-blue-200 bg-blue-50"
											: "border-gray-100 bg-white"
									}`}
								>
									<View className="flex-row gap-3">
										<View
											className={`h-11 w-11 items-center justify-center rounded-2xl ${
												isUnread ? "bg-blue-100" : "bg-gray-100"
											}`}
										>
											<Ionicons
												name={icon}
												size={22}
												color={isUnread ? "#2563eb" : "#6b7280"}
											/>
										</View>
										<View className="flex-1">
											<View className="flex-row items-start justify-between gap-2">
												<Text className="flex-1 text-base font-bold text-gray-900">
													{t(item.titleKey)}
												</Text>
												{isUnread ? (
													<View className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
												) : null}
											</View>

											<Text className="mt-1 text-sm leading-5 text-gray-600">{body}</Text>

											<Text className="mt-2 text-xs text-gray-400">
												{new Date(item.createdAt).toLocaleString()}
											</Text>
										</View>
									</View>
								</TouchableOpacity>
							);
						})}
					</View>
				)}
			</ScrollView>
		</View>
	);
}
