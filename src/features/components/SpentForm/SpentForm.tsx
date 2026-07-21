import { useState } from "react";
import { Pressable, Text, TouchableOpacity, View } from "react-native";
import { cn } from "@/lib/styles";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";

export function SpentForm() {
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(new Date());

  const isValid = title.trim() !== "" && value !== "";
  const isNegative = value.startsWith("-");

  const resetForm = () => {
    setTitle("");
    setValue("");
    setDate(new Date());
  };

  const handleSubmit = () => {
    if (!isValid) return;
    console.log({
      title,
      value,
      date,
    });
  };

  return (
    <View className="px-4 py-4 gap-2">
      <Input
        type="text"
        label="Add transaction"
        value={title}
        onChangeText={setTitle}
        maxLength={140}
        multiline
        placeholder="What was this for?"
      />

      <View className="flex-row gap-4">
        <View className="flex-1">
          <Input
            type="decimal"
            label="Value"
            value={value}
            onChange={setValue}
            placeholder="0.00"
          />
        </View>
        <View className="flex-1">
          <Input
            type="datetime"
            label="Date"
            value={date}
            onChange={setDate}
          />
        </View>
      </View>

      <View className="flex-row items-center justify-between gap-3 pt-2">
        <TouchableOpacity
          testID="eraser-button"
          onPress={resetForm}
          className="p-3 border border-muted rounded-full"
        >
          <Icon name="eraser" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <Pressable
          testID="submit-button"
          onPress={handleSubmit}
          disabled={!isValid}
          className={cn(
            "rounded-lg border px-5 py-3 flex-row items-center gap-2",
            isValid ? "" : "opacity-50",
            isNegative ? "border-success" : "border-error",
          )}
        >
          <Icon
            name="upload"
            size={20}
            color={isNegative ? "#46AE82" : "#C05959"}
          />
          <Text
            className={cn(
              "font-semibold text-base",
              isNegative ? "text-success" : "text-error"
            )}
          >
            {isNegative ? "Add return" : "Add expense"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
