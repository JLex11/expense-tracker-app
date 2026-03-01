import { HapticTab } from "@/components/haptic-tab";
import QuickAddDialog from "@/components/quick-add-bottom-sheet";
import { Colors } from "@/constants/theme";
import { QuickAddProvider, useQuickAdd } from "@/contexts/quick-add";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Easing } from "react-native";

function TabsContent() {
	const colorScheme = useColorScheme();
	const { open } = useQuickAdd();

	return (
		<>
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
						title: "Home",
						tabBarIcon: ({ color }) => (
							<Ionicons size={28} name="home" color={color} />
						),
					}}
				/>
				<Tabs.Screen
					name="transact"
					options={{
						title: "Transact",
						tabBarIcon: ({ color }) => (
							<Ionicons size={28} name="add-circle" color={color} />
						),
					}}
					listeners={{
						tabPress: (e) => {
							e.preventDefault();
							open();
						},
					}}
				/>
				<Tabs.Screen
					name="budget"
					options={{
						title: "Budget",
						tabBarIcon: ({ color }) => (
							<Ionicons size={28} name="pie-chart" color={color} />
						),
					}}
				/>
				<Tabs.Screen
					name="profile"
					options={{
						title: "Profile",
						tabBarIcon: ({ color }) => (
							<Ionicons size={28} name="person" color={color} />
						),
					}}
				/>
			</Tabs>
			<QuickAddDialog />
		</>
	);
}

export default function TabLayout() {
	return (
		<QuickAddProvider>
			<TabsContent />
		</QuickAddProvider>
	);
}
