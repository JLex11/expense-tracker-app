import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { Pressable } from "react-native";

export function HapticTab({
	onPress,
	onPressIn,
	children,
	style,
	accessibilityState,
	accessibilityLabel,
}: BottomTabBarButtonProps) {
	return (
		<Pressable
			onPress={onPress}
			onPressIn={(ev) => {
				if (process.env.EXPO_OS === "ios") {
					Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
				}
				onPressIn?.(ev);
			}}
			style={style}
			accessibilityState={accessibilityState}
			accessibilityLabel={accessibilityLabel}
		>
			{children}
		</Pressable>
	);
}
