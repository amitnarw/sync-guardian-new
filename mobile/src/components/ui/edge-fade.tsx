import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  ScrollView,
  FlatList,
  View,
  StyleSheet,
  Animated,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type ScrollViewProps,
  type FlatListProps,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Direction = 'vertical' | 'horizontal';

export interface EdgeFadeScrollViewProps extends ScrollViewProps {
  direction?: Direction;
  fadeColor?: string;
  fadeSize?: number;
}

export interface EdgeFadeFlatListProps<T> extends Omit<FlatListProps<T>, 'onScroll' | 'onContentSizeChange'> {
  direction?: Direction;
  fadeColor?: string;
  fadeSize?: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const DEFAULT_FADE_COLOR = '#fff8f0';
const DEFAULT_FADE_SIZE = 32;
const THRESHOLD = 8;

function useEdgeFade(direction: Direction, fadeColor: string, fadeSize: number) {
  const isHorizontal = direction === 'horizontal';

  const [scrollOffset, setScrollOffset] = useState(0);
  const [contentSize, setContentSize] = useState(0);
  const [layoutSize, setLayoutSize] = useState(0);

  const startOpacity = useRef(new Animated.Value(0)).current;
  const endOpacity = useRef(new Animated.Value(0)).current;

  const isScrollable = contentSize > layoutSize + 1;
  const maxOffset = Math.max(0, contentSize - layoutSize);

  useEffect(() => {
    if (!isScrollable) {
      startOpacity.setValue(0);
      endOpacity.setValue(0);
      return;
    }

    const showStart = scrollOffset > THRESHOLD;
    const showEnd = scrollOffset < maxOffset - THRESHOLD;

    Animated.parallel([
      Animated.timing(startOpacity, {
        toValue: showStart ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(endOpacity, {
        toValue: showEnd ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scrollOffset, isScrollable, maxOffset, startOpacity, endOpacity]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = isHorizontal ? e.nativeEvent.contentOffset.x : e.nativeEvent.contentOffset.y;
      setScrollOffset(offset);
    },
    [isHorizontal],
  );

  const handleContentSizeChange = useCallback(
    (w: number, h: number) => {
      setContentSize(isHorizontal ? w : h);
    },
    [isHorizontal],
  );

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayoutSize(isHorizontal ? width : height);
  }, [isHorizontal]);

  const overlayBase: ViewStyle = {
    position: 'absolute',
    zIndex: 10,
  };

  const renderOverlays = () => {
    if (!isScrollable) return null;

    if (isHorizontal) {
      return (
        <>
          <Animated.View pointerEvents="none" style={[{ left: 0, top: 0, bottom: 0, width: fadeSize, opacity: startOpacity }, overlayBase]}>
            <LinearGradient
              colors={[fadeColor, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[{ right: 0, top: 0, bottom: 0, width: fadeSize, opacity: endOpacity }, overlayBase]}>
            <LinearGradient
              colors={['transparent', fadeColor]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </>
      );
    }

    return (
      <>
        <Animated.View pointerEvents="none" style={[{ top: 0, left: 0, right: 0, height: fadeSize, opacity: startOpacity }, overlayBase]}>
          <LinearGradient
            colors={[fadeColor, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[{ bottom: 0, left: 0, right: 0, height: fadeSize, opacity: endOpacity }, overlayBase]}>
          <LinearGradient
            colors={['transparent', fadeColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </>
    );
  };

  return {
    handleScroll,
    handleContentSizeChange,
    handleLayout,
    renderOverlays,
  };
}

const EdgeFadeScrollView = React.forwardRef<ScrollView, EdgeFadeScrollViewProps>(
  (props, ref) => {
    const {
      direction = 'vertical',
      fadeColor = DEFAULT_FADE_COLOR,
      fadeSize = DEFAULT_FADE_SIZE,
      onScroll,
      onContentSizeChange,
      onLayout,
      scrollEventThrottle,
      ...scrollProps
    } = props;

    const { handleScroll, handleContentSizeChange, handleLayout, renderOverlays } =
      useEdgeFade(direction, fadeColor, fadeSize);

    const composedOnScroll = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        handleScroll(e);
        onScroll?.(e);
      },
      [onScroll, handleScroll],
    );

    const composedOnContentSizeChange = useCallback(
      (w: number, h: number) => {
        handleContentSizeChange(w, h);
        onContentSizeChange?.(w, h);
      },
      [onContentSizeChange, handleContentSizeChange],
    );

    const composedOnLayout = useCallback(
      (e: LayoutChangeEvent) => {
        handleLayout(e);
        onLayout?.(e);
      },
      [onLayout, handleLayout],
    );

    return (
      <View style={wrapperStyle}>
        <ScrollView
          ref={ref}
          {...scrollProps}
          onScroll={composedOnScroll}
          onContentSizeChange={composedOnContentSizeChange}
          onLayout={composedOnLayout}
          scrollEventThrottle={scrollEventThrottle ?? 16}
        />
        {renderOverlays()}
      </View>
    );
  },
);

EdgeFadeScrollView.displayName = 'EdgeFadeScrollView';

function EdgeFadeFlatList<T>(props: EdgeFadeFlatListProps<T>) {
  const {
    direction = 'vertical',
    fadeColor = DEFAULT_FADE_COLOR,
    fadeSize = DEFAULT_FADE_SIZE,
    onScroll,
    ...flatListProps
  } = props;

  const { handleScroll, handleContentSizeChange, handleLayout, renderOverlays } =
    useEdgeFade(direction, fadeColor, fadeSize);

  const composedOnScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScroll(e);
      onScroll?.(e);
    },
    [onScroll, handleScroll],
  );

  return (
    <View style={wrapperStyle}>
      <FlatList<T>
        {...flatListProps}
        onScroll={composedOnScroll}
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleLayout}
        scrollEventThrottle={16}
      />
      {renderOverlays()}
    </View>
  );
}

const wrapperStyle: ViewStyle = {
  flex: 1,
  position: 'relative',
};

export { EdgeFadeScrollView, EdgeFadeFlatList };
