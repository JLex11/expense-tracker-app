import { IOSTabBar } from "@/components/ios-tab-bar";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useI18n } from "@/hooks/useI18n";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Easing } from "react-native";

export default function TabLayout() {
	const colorScheme = useColorScheme();
	const { t } = useI18n();
	const sceneBackgroundColor = Colors[colorScheme ?? "light"].background;

	return (
		<Tabs
			tabBar={(props) => <IOSTabBar {...props} />}
			screenOptions={{
				tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
				headerShown: false,
				animation: "fade",
				transitionSpec: {
					animation: "timing",
					config: {
						duration: 170,
						easing: Easing.inOut(Easing.ease),
					},
				},
				sceneStyle: {
					backgroundColor: sceneBackgroundColor,
				},
				// Extra bottom padding so content isn't hidden under the floating tab bar
				tabBarStyle: { display: "none" },
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: t("home"),
					tabBarIcon: ({ color }) => (
						<Ionicons size={24} name="home" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="transact"
				options={{
					title: t("transact"),
					tabBarIcon: ({ color }) => (
						<Ionicons size={24} name="add-circle" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="budget"
				options={{
					title: t("budget"),
					tabBarIcon: ({ color }) => (
						<Ionicons size={24} name="pie-chart" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					title: t("profile"),
					tabBarIcon: ({ color }) => (
						<Ionicons size={24} name="person" color={color} />
					),
				}}
			/>
		</Tabs>
	);
}
