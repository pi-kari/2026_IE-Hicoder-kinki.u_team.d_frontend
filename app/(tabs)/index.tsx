import { ExternalLink } from '@tamagui/lucide-icons-2'
import { Anchor, H2, Paragraph, XStack, YStack, Button, Card, Image, Theme, Progress } from 'tamagui'
import { ToastControl } from 'components/CurrentToast'

const progressItems = [
  { label: '一冊目のタイトル', value: 80, visible: true },
  { label: '二冊目のタイトル', value: 60, visible: true },
  { label: '三冊目のタイトル', value: 40, visible: true },
]

export default function TabOneScreen() {
  return (
    <YStack flex={1} items="center" gap="$8" px="$10" pt="$5" bg="$background">
    
      <H2>TSUMIDOKU v0.0a</H2>
      <XStack width="100%">
        <Card width="100%" size="$4" borderWidth={1} borderColor="$borderColor">
          <Card.Header p="$4">
            <H2>あなたの木</H2>
            <Paragraph>（成長段階とか書いてみる？）</Paragraph>
          </Card.Header>
          <Card.Footer p="$4">
            <XStack flex={1} />
            <Button rounded="$10">詳細を見る</Button>
          </Card.Footer>
          <Card.Background items="center">
            <Image
              objectFit="contain"
              width={1080}
              height={1080}
              src="木の画像を貼ろう"></Image>
          </Card.Background>
        </Card>
      </XStack>
      <XStack width="100%">
        <Card width="100%" size="$4" borderWidth={1} borderColor="$borderColor">
          <Card.Header p="$4">
            <H2>進捗状況</H2>
          </Card.Header>
          <YStack px="$4" pb="$4">
            <YStack gap="$3">
              {progressItems.filter((item) => item.visible).map((item) => (
                <YStack key={item.label} gap="$1">
                  <Paragraph>{item.label}</Paragraph>
                  <Progress value={item.value} max={100} height="$1.5">
                    <Progress.Indicator background="$green10" />
                  </Progress>
                </YStack>
              ))}
            </YStack>
          </YStack>
          <Card.Footer p="$4">
            <XStack flex={1} />
            <Button rounded="$10">詳細を見る</Button>
          </Card.Footer>
        </Card>
      </XStack>
      <XStack
        items="center"
        justify="center"
        flexWrap="wrap"
        gap="$1.5"
        position="absolute"
        b="$8"
      >
      </XStack>
    </YStack>
  )
}
