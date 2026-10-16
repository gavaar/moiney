import { Text, useWindowDimensions, View } from "react-native";
import { formatAmount } from "@/lib/format";
import { colors } from "@/lib/styles";
import { Icon, type IconName } from "@ui/Icon";

function AmountRow({ label, value, highlighted = false, icon }: { label: string; value: number; highlighted?: boolean; icon?: IconName }) {
  return (
    <View accessible accessibilityLabel={`${label}, ${formatAmount(value)}`} className="flex-row items-start justify-between gap-1">
      {icon ? <Icon name={icon} size={12} color={colors.text} /> : null}
      <Text className="text-text text-sm flex-1">{label}</Text>
      <Text className={highlighted ? "text-warning text-sm" : "text-text text-sm"}>
        {formatAmount(value)}
      </Text>
    </View>
  );
}

type CoverageProps = {
  source: { capacity: number; spent: number };
  donor: { name: string; icon: string; fed: number; spent: number };
  amountCents: number;
};

export function CoverageDetails({ source, donor, amountCents }: CoverageProps) {
  const { width } = useWindowDimensions();
  const demand = Math.max(0, source.spent - source.capacity);
  const available = Math.max(0, donor.fed - donor.spent);
  const uncovered = demand - amountCents;

  return (
    <View className="gap-2" style={{ width: Math.min(320, width * 0.85 - 18) }}>
      <Text className="text-warning text-sm">Estimate · Funding is not reserved</Text>
      <AmountRow label="Above capacity" value={demand} />
      <View className="gap-1">
        <AmountRow label={`${donor.name} funding`} value={available} icon={donor.icon as IconName} />
        <Text className="text-muted text-xs">check donor pipe details for current breakdown</Text>
      </View>
      <AmountRow label="Possible coverage" value={amountCents} highlighted />
      <View className="gap-1">
        <AmountRow label="Carried-forward debt" value={uncovered} />
        <Text className="text-muted text-xs">Uncovered amount before any update.</Text>
      </View>
      <View className="border-t border-border" />
      <Text className="text-muted text-sm">Applied at settlement. Original expenses stay attributed to this pipe.</Text>
      <Text className="text-muted text-sm">Changing balances and settlement order, including scheduled sharing, can reduce actual coverage.</Text>
    </View>
  );
}

type CoverageProvidedProps = {
  donor: { fed: number; spent: number };
  allocations: readonly { source: { id: string; name: string }; amountCents: number }[];
  amountCents: number;
};

export function CoverageProvidedDetails({ donor, allocations, amountCents }: CoverageProvidedProps) {
  const { width } = useWindowDimensions();
  const available = Math.max(0, donor.fed - donor.spent);

  return (
    <View className="gap-2" style={{ width: Math.min(320, width * 0.85 - 18) }}>
      <Text className="text-warning text-sm">Estimate · Funding is not reserved</Text>
      <AmountRow label="Available funding" value={available} />
      <View className="gap-2 border-y border-border py-2">
        {allocations.length > 0 ? allocations.map(({ source, amountCents: allocation }) => (
          <AmountRow key={source.id} label={source.name} value={allocation} highlighted />
        )) : <Text className="text-muted text-sm">No pipes could receive coverage right now.</Text>}
      </View>
      <AmountRow label="Possible coverage" value={amountCents} highlighted />
      <AmountRow label="Funding left if applied" value={available - amountCents} />
      <Text className="text-muted text-sm">Applied at settlement. These pipes share one funding pool; original expenses stay attributed to them.</Text>
      <Text className="text-muted text-sm">Changing balances and settlement order, including scheduled sharing, can change these allocations.</Text>
    </View>
  );
}
