import { ExternalLink } from '@tamagui/lucide-icons-2'
import { Anchor, H2, Paragraph, XStack, YStack, Button, Card, Image, Theme} from 'tamagui'
import { ToastControl } from 'components/CurrentToast'

export default function TabOneScreen() {
  return (
    <YStack flex={1} items="center" gap="$8" px="$10" pt="$5" bg="$background">
    
      <H2>TSUMIDOKU v0.0a</H2>
      <XStack>
        <Card size="$4" borderWidth={1} borderColor="$borderColor">
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
