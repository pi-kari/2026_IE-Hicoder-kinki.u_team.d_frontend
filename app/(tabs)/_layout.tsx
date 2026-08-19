import { Link, Tabs } from 'expo-router'
import { Button, View, useTheme } from 'tamagui'
import { Home, ClipboardPenLine, AudioWaveform } from '@tamagui/lucide-icons-2'

export default function TabLayout() {
  const theme = useTheme()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.red10.val,
        tabBarStyle: {
          backgroundColor: theme.background.val,
          borderTopColor: theme.borderColor.val,
          overflow: 'visible',
        },
        headerStyle: {
          backgroundColor: theme.background.val,
          borderBottomColor: theme.borderColor.val,
        },
        headerTintColor: theme.color.val,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tab One',
          tabBarShowLabel: false,
          tabBarIcon: ({ color }) => <Home color={color as any} />,
          headerRight: () => (
            <Link href="/modal" asChild>
              <Button mr="$4" size="$2.5">
                Hello!
              </Button>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Tab Two',
          tabBarShowLabel: false,
          tabBarActiveTintColor: theme.green10.val,
          tabBarIcon: ({ color }) => (
            <View
              width={64}
              height={64}
              borderWidth={3}
              borderColor="$green10"
              background="$background"
              items="center"
              justify="center"
              style={{ borderRadius: 32 }}
              transform={[{ translateY: -16 }]}
            >
              <ClipboardPenLine color={color as any} size={30} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="three"
        options={{
          title: 'Tab Three',
          tabBarShowLabel: false,
          tabBarIcon: ({ color }) => <AudioWaveform color={color as any} />,
        }}
      />
    </Tabs>
  )
}
