import { useColorScheme } from "@/hooks/use-color-scheme";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SPRING_CONFIG = {
  damping: 22,
  stiffness: 280,
  mass: 0.5,
};

const ACTIVE_STATE_DURATION_MS = 170;

function TabItem({
  route,
  isActive,
  onPress,
  onLongPress,
  descriptors,
  activeColor,
  inactiveColor,
  isDark,
}: {
  route: BottomTabBarProps["state"]["routes"][number];
  isActive: boolean;
  onPress: () => void;
  onLongPress: () => void;
  descriptors: BottomTabBarProps["descriptors"];
  activeColor: string;
  inactiveColor: string;
  isDark: boolean;
}) {
  const activeAnim = useSharedValue(isActive ? 1 : 0);
  const scaleAnim = useSharedValue(1);

  useEffect(() => {
    activeAnim.value = withTiming(isActive ? 1 : 0, {
      duration: ACTIVE_STATE_DURATION_MS,
    });
  }, [isActive, activeAnim]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(activeAnim.value, [0, 0.4, 1], [0, 0.6, 1]),
    transform: [
      {
        scaleX: interpolate(activeAnim.value, [0, 1], [0.75, 1]),
      },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(activeAnim.value, [0.3, 1], [0, 1]),
    maxWidth: interpolate(activeAnim.value, [0, 1], [0, 72]),
    marginLeft: interpolate(activeAnim.value, [0, 1], [0, 5]),
  }));

  const iconContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  const { options } = descriptors[route.key];
  const label =
    typeof options.tabBarLabel === "string"
      ? options.tabBarLabel
      : typeof options.title === "string"
        ? options.title
        : route.name;

  const icon = options.tabBarIcon?.({
    focused: isActive,
    color: isActive ? activeColor : inactiveColor,
    size: 24,
  });

  const pillBg = isDark ? "rgba(255,255,255,0.13)" : "rgba(0,122,255,0.12)";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isActive ? { selected: true } : {}}
      accessibilityLabel={options.tabBarAccessibilityLabel}
      onPress={() => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        scaleAnim.value = withSpring(
          0.85,
          { damping: 10, stiffness: 300 },
          () => {
            scaleAnim.value = withSpring(1, SPRING_CONFIG);
          },
        );
        onPress();
      }}
      onLongPress={onLongPress}
      style={styles.tabPressable}
    >
      <Animated.View
        style={[styles.pill, { backgroundColor: pillBg }, pillStyle]}
      >
        <Animated.View style={iconContainerStyle}>{icon}</Animated.View>
        <Animated.Text
          style={[styles.label, { color: activeColor }, labelStyle]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
      </Animated.View>

      {/* Inactive icon (rendered behind, fades out when active) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.inactiveIcon,
          useAnimatedStyle(() => ({
            opacity: interpolate(activeAnim.value, [0, 0.5], [1, 0]),
          })),
        ]}
      >
        {options.tabBarIcon?.({
          focused: false,
          color: inactiveColor,
          size: 24,
        })}
      </Animated.View>
    </Pressable>
  );
}

export function IOSTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const activeColor = isDark ? "#FFFFFF" : "#007AFF";
  const inactiveColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.35)";

  const barBg = isDark ? "rgba(28, 28, 30, 0.92)" : "rgba(255, 255, 255, 0.92)";
  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  return (
    <View
      style={[
        styles.outerContainer,
        { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 },
      ]}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: barBg,
            borderColor,
            shadowColor: isDark ? "#000" : "#000",
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const isActive = state.index === index;

          return (
            <TabItem
              key={route.key}
              route={route}
              isActive={isActive}
              descriptors={descriptors}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
              isDark={isDark}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isActive && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() => {
                navigation.emit({
                  type: "tabLongPress",
                  target: route.key,
                });
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    // iOS shadow
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    // Android elevation
    elevation: 8,
  },
  tabPressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  pill: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  inactiveIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.2,
    overflow: "hidden",
  },
});
