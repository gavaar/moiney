import { Text } from 'react-native';
import { expo } from '@/../app.json';

export function MoineyVers() {
  return (
    <Text className="text-sm text-muted">
      moiney v{expo.version}
    </Text>);
}
