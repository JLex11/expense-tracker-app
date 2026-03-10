import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useI18n } from "@/hooks/useI18n";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Easing } from "react-native";

export default function TabLayout() {
	const colorScheme = useColorScheme();
	const { t } = useI18n();

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
				headerShown: false,
				tabBarButton: HapticTab,
				animation: "shift",
				transitionSpec: {
					animation: "timing",
					config: {
						duration: 220,
						easing: Easing.inOut(Easing.ease),
					},
				},
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: t("home"),
					tabBarIcon: ({ color }) => (
						<Ionicons size={28} name="home" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="transact"
				options={{
					title: t("transact"),
					tabBarIcon: ({ color }) => (
						<Ionicons size={28} name="add-circle" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="budget"
				options={{
					title: t("budget"),
					tabBarIcon: ({ color }) => (
						<Ionicons size={28} name="pie-chart" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					title: t("profile"),
					tabBarIcon: ({ color }) => (
						<Ionicons size={28} name="person" color={color} />
					),
				}}
			/>
		</Tabs>
	);
}
