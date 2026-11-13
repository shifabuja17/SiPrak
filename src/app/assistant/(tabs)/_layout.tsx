import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type TabIconProps = {
  type: 'home' | 'profile';
  color: ComponentProps<typeof Path>['stroke'];
};

function TabIcon({ type, color }: TabIconProps) {
  return (
    <Svg
      width={23}
      height={23}
      viewBox="0 0 24 24"
      fill="none"
    >
      {type === 'home' && (
        <>
          <Path
            d="M3 10.5L12 3L21 10.5"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <Path
            d="M5.5 9.5V20H18.5V9.5"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <Path
            d="M9.5 20V14H14.5V20"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        </>
      )}

      {type === 'profile' && (
        <>
          <Circle
            cx={12}
            cy={8}
            r={4}
            stroke={color}
            strokeWidth={1.8}
          />

          <Path
            d="M4 21C4 16.8 7.2 14 12 14C16.8 14 20 16.8 20 21"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );
}

export default function AssistantTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#888888',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E5E5',
          borderTopWidth: 1,
          height: 65,
          paddingTop: 7,
          paddingBottom: 7,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color }) => (
            <TabIcon type="home" color={color ?? '#000000'} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => (
            <TabIcon type="profile" color={color ?? '#000000'} />
          ),
        }}
      />
    </Tabs>
  );
}