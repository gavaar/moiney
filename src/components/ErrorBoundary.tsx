import { Component, type ErrorInfo, type ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
          <Text className="text-lg font-bold text-text">Something went wrong</Text>
          <Text className="text-sm text-secondary text-center">
            {this.state.error.message}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ error: null })}
            className="rounded-lg bg-primary px-4 py-2"
          >
            <Text className="font-semibold text-white">Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}